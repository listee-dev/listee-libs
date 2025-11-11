import { describe, expect, test } from "bun:test";
import { createSupabaseAuthClient, SupabaseAuthError } from "./index.js";

type MockHandler = (request: Request) => Promise<Response> | Response;

const ensureValue = <T>(value: T | null | undefined, message: string): T => {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
};

const createMockFetch = (handler: MockHandler): typeof fetch => {
  const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    return await handler(request);
  };

  const fetchWithPreconnect: typeof fetch = Object.assign(fetchFn, {
    async preconnect() {
      return;
    },
  });

  return fetchWithPreconnect;
};

describe("createSupabaseAuthClient", () => {
  test("login normalizes token payloads", async () => {
    let capturedBody: unknown;
    const client = createSupabaseAuthClient({
      projectUrl: "https://example.supabase.co",
      publishableKey: "anon-key",
      fetch: createMockFetch(async (request) => {
        capturedBody = await request.json();
        return new Response(
          JSON.stringify({
            access_token: "access-123",
            refresh_token: "refresh-456",
            token_type: "bearer",
            expires_in: 3600,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    });

    const result = await client.login({
      email: "user@example.com",
      password: "secret",
    });

    expect(result).toEqual({
      accessToken: "access-123",
      refreshToken: "refresh-456",
      tokenType: "bearer",
      expiresIn: 3600,
    });
    expect(capturedBody).toEqual({
      email: "user@example.com",
      password: "secret",
    });
  });

  test("refresh handles nested data payloads", async () => {
    const client = createSupabaseAuthClient({
      projectUrl: "https://example.supabase.co",
      publishableKey: "anon-key",
      fetch: createMockFetch(async () => {
        return new Response(
          JSON.stringify({
            data: {
              access_token: "access-nested",
              refresh_token: "refresh-nested",
              token_type: "bearer",
              expires_in: 1800,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    });

    const result = await client.refresh({ refreshToken: "refresh-token" });
    expect(result.accessToken).toBe("access-nested");
  });

  test("signup forwards redirect URL", async () => {
    let receivedUrl: string | null = null;
    const client = createSupabaseAuthClient({
      projectUrl: "https://example.supabase.co",
      publishableKey: "anon-key",
      fetch: createMockFetch(async (request) => {
        receivedUrl = request.url;
        return new Response(null, { status: 200 });
      }),
    });

    await client.signup({
      email: "user@example.com",
      password: "secret",
      redirectUrl: "https://app.example.dev/callback",
    });

    const resolvedUrl = ensureValue<string>(
      receivedUrl,
      "Expected signup to issue an HTTP request.",
    );

    expect(resolvedUrl).toBe(
      "https://example.supabase.co/auth/v1/signup?redirect_to=" +
        encodeURIComponent("https://app.example.dev/callback"),
    );
  });

  test("propagates Supabase error payloads", async () => {
    const client = createSupabaseAuthClient({
      projectUrl: "https://example.supabase.co",
      publishableKey: "anon-key",
      fetch: createMockFetch(async () => {
        return new Response(JSON.stringify({ error: "Invalid login" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }),
    });

    await expect(
      client.login({ email: "user@example.com", password: "bad" }),
    ).rejects.toThrow("Invalid login");
  });

  test("wraps network failures", async () => {
    const client = createSupabaseAuthClient({
      projectUrl: "https://example.supabase.co",
      publishableKey: "anon-key",
      fetch: createMockFetch(async () => {
        throw new Error("connection reset");
      }),
    });

    await expect(
      client.refresh({ refreshToken: "refresh-token" }),
    ).rejects.toThrow(SupabaseAuthError);
  });

  test("validates project URL", () => {
    expect(() => {
      createSupabaseAuthClient({
        projectUrl: "",
        publishableKey: "anon-key",
      });
    }).toThrowErrorMatchingInlineSnapshot(
      '"Supabase project URL must not be empty."',
    );
  });
});
