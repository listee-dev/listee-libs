import { describe, expect, test } from "bun:test";
import type {
  AuthenticatedToken,
  AuthenticationProvider,
  SupabaseAuthenticationOptions,
  SupabaseToken,
} from "@listee/types";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  AuthenticationError,
  createProvisioningSupabaseAuthentication,
  createSupabaseAuthentication,
} from "./index.js";

const BASE_ISSUER = "https://example.supabase.co/auth/v1";
const BASE_AUDIENCE = "authenticated";
const BASE_TIME = 1_700_000_000;

type TokenOverrides = Omit<
  Partial<SupabaseToken>,
  "iss" | "aud" | "exp" | "iat" | "role" | "sub"
> & {
  readonly sub: string;
  readonly role?: string;
};

const buildToken = (overrides: TokenOverrides): SupabaseToken => {
  const { sub, role, ...rest } = overrides;
  return {
    iss: BASE_ISSUER,
    aud: BASE_AUDIENCE,
    exp: BASE_TIME,
    iat: BASE_TIME,
    role: role ?? "authenticated",
    sub,
    ...rest,
  };
};

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

      assertSupabaseToken(result.user.token);
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

      await expect(helper.provider.authenticate({ request })).rejects.toThrow(
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

      await expect(helper.provider.authenticate({ request })).rejects.toThrow(
        AuthenticationError,
      );
    } finally {
      helper.restore();
    }
  });
});

describe("createProvisioningSupabaseAuthentication", () => {
  test("invokes account provisioner after authentication", async () => {
    const token = buildToken({ sub: "user-789", email: "user@example.com" });

    const baseProvider: AuthenticationProvider = {
      async authenticate() {
        return {
          user: {
            id: "user-789",
            token,
          },
        };
      },
    };

    const captured: Array<{ userId: string; email: string | null }> = [];

    const authentication = createProvisioningSupabaseAuthentication(
      { projectUrl: "https://example.supabase.co" },
      {
        authenticationProvider: baseProvider,
        accountProvisioner: {
          async provision(params) {
            captured.push({
              userId: params.userId,
              email: params.email ?? null,
            });
          },
        },
      },
    );

    const request = new Request("https://example.com/api");
    const result = await authentication.authenticate({ request });

    expect(result.user.id).toBe("user-789");
    expect(captured).toHaveLength(1);
    expect(captured[0]).toEqual({
      userId: "user-789",
      email: "user@example.com",
    });
  });

  test("passes null email when token does not include it", async () => {
    const token = buildToken({ sub: "user-555" });

    const baseProvider: AuthenticationProvider = {
      async authenticate() {
        return {
          user: {
            id: "user-555",
            token,
          },
        };
      },
    };

    let received: string | null | undefined;

    const authentication = createProvisioningSupabaseAuthentication(
      { projectUrl: "https://example.supabase.co" },
      {
        authenticationProvider: baseProvider,
        accountProvisioner: {
          async provision(params) {
            received = params.email ?? null;
          },
        },
      },
    );

    const request = new Request("https://example.com/api");
    await authentication.authenticate({ request });

    expect(received).toBeNull();
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

function assertSupabaseToken(
  token: AuthenticatedToken,
): asserts token is SupabaseToken {
  if (
    typeof token === "object" &&
    token !== null &&
    "sub" in token &&
    "role" in token
  ) {
    return;
  }

  throw new Error("Expected Supabase token in authentication result");
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
