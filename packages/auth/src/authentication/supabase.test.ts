import { describe, expect, test } from "bun:test";
import type { SupabaseAuthenticationOptions } from "@listee/types";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { AuthenticationError, createSupabaseAuthentication } from "./index.js";

describe("createSupabaseAuthentication", () => {
  test("returns user when token is valid", async () => {
    const helper = await createSupabaseTestHelper({
      audience: "authenticated",
      requiredRole: "authenticated",
    });
    try {
      const token = await helper.signToken({
        subject: "user-123",
        role: "authenticated",
        audience: "authenticated",
      });

      const request = new Request("https://example.com/api", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await helper.provider.authenticate({ request });

      expect(result.user.id).toBe("user-123");
      expect(result.user.token.sub).toBe("user-123");
      expect(result.user.token.role).toBe("authenticated");
    } finally {
      helper.restore();
    }
  });

  test("throws when role requirement is not met", async () => {
    const helper = await createSupabaseTestHelper({
      audience: "authenticated",
      requiredRole: "service_role",
    });
    try {
      const token = await helper.signToken({
        subject: "user-456",
        role: "authenticated",
        audience: "authenticated",
      });

      const request = new Request("https://example.com/api", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(helper.provider.authenticate({ request })).rejects.toThrow(
        AuthenticationError,
      );
    } finally {
      helper.restore();
    }
  });

  test("throws when authorization header is missing", async () => {
    const helper = await createSupabaseTestHelper({
      audience: "authenticated",
      requiredRole: "authenticated",
    });
    try {
      const request = new Request("https://example.com/api");

      expect(helper.provider.authenticate({ request })).rejects.toThrow(
        AuthenticationError,
      );
    } finally {
      helper.restore();
    }
  });
});

interface SupabaseTestHelperConfig {
  readonly audience?: SupabaseAuthenticationOptions["audience"];
  readonly projectUrl?: SupabaseAuthenticationOptions["projectUrl"];
  readonly requiredRole?: SupabaseAuthenticationOptions["requiredRole"];
  readonly clockToleranceSeconds?: SupabaseAuthenticationOptions["clockToleranceSeconds"];
}

interface SupabaseTestHelper {
  readonly provider: ReturnType<typeof createSupabaseAuthentication>;
  signToken(config: {
    readonly subject: string;
    readonly role: string;
    readonly audience: string;
  }): Promise<string>;
  restore(): void;
}

async function createSupabaseTestHelper(
  config: SupabaseTestHelperConfig,
): Promise<SupabaseTestHelper> {
  const projectUrl = config.projectUrl ?? "https://example.supabase.co";
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const exportedJwk = await exportJWK(publicKey);
  const jwk = {
    ...exportedJwk,
    use: "sig",
    alg: "RS256",
    kid: "test-key",
  };

  const keysUrl = `${projectUrl}/auth/v1/.well-known/jwks.json`;
  const jwksBody = JSON.stringify({ keys: [jwk] });

  const originalFetch = globalThis.fetch;
  const mockFetch = Object.assign(
    async (
      input: Parameters<typeof fetch>[0],
      _init?: Parameters<typeof fetch>[1],
    ): Promise<Response> => {
      const requestUrl = resolveRequestUrl(input);
      if (requestUrl === keysUrl) {
        return new Response(jwksBody, {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      }

      return new Response("Not Found", { status: 404 });
    },
    { preconnect: originalFetch.preconnect },
  ) satisfies typeof fetch;

  globalThis.fetch = mockFetch;

  const baseOptions: SupabaseAuthenticationOptions = {
    projectUrl,
    audience: config.audience,
    requiredRole: config.requiredRole,
    clockToleranceSeconds: config.clockToleranceSeconds,
  };

  const provider = createSupabaseAuthentication(baseOptions);

  async function signToken(input: {
    readonly subject: string;
    readonly role: string;
    readonly audience: string;
  }): Promise<string> {
    const jwt = await new SignJWT({ role: input.role })
      .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
      .setSubject(input.subject)
      .setAudience(input.audience)
      .setIssuer(`${projectUrl}/auth/v1`)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);

    return jwt;
  }

  function restore(): void {
    globalThis.fetch = originalFetch;
  }

  return { provider, signToken, restore };
}

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}
