import type {
  AuthenticationContext,
  AuthenticationProvider,
  AuthenticationResult,
  SupabaseAuthenticationOptions,
  SupabaseToken,
} from "@listee/types";
import { createRemoteJWKSet, type JWTVerifyOptions, jwtVerify } from "jose";
import { AuthenticationError } from "./errors.js";
import { assertNonEmptyString, extractAuthorizationToken } from "./shared.js";

function parseSupabaseProjectUrl(value: string): URL {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("Supabase project URL is required");
  }

  try {
    return new URL(trimmed);
  } catch {
    throw new Error("Supabase project URL must be a valid URL");
  }
}

function buildSupabaseIssuerUrl(projectUrl: URL): string {
  const issuerUrl = new URL("/auth/v1", projectUrl);
  return issuerUrl.toString();
}

function buildSupabaseJwksUrl(
  projectUrl: URL,
  jwksPath: string | undefined,
): URL {
  const normalizedPath = jwksPath ?? "/auth/v1/.well-known/jwks.json";
  return new URL(normalizedPath, projectUrl);
}

function normalizeAudience(
  audience: string | readonly string[] | undefined,
): string | string[] | undefined {
  if (audience === undefined) {
    return undefined;
  }

  if (typeof audience === "string") {
    return audience;
  }

  return [...audience];
}

export function createSupabaseAuthentication(
  options: SupabaseAuthenticationOptions,
): AuthenticationProvider {
  const headerName = options.headerName ?? "authorization";
  const scheme = options.scheme ?? "Bearer";
  const projectUrl = parseSupabaseProjectUrl(options.projectUrl);
  const issuer = (options.issuer ?? buildSupabaseIssuerUrl(projectUrl)).trim();
  const jwksUrl = buildSupabaseJwksUrl(projectUrl, options.jwksPath);
  const audience = normalizeAudience(options.audience);
  const requiredRole = options.requiredRole;
  const clockTolerance = options.clockToleranceSeconds;

  const remoteJwkSet = createRemoteJWKSet(jwksUrl);

  async function authenticate(
    context: AuthenticationContext,
  ): Promise<AuthenticationResult> {
    const tokenValue = extractAuthorizationToken(context, headerName, scheme);
    const verifyOptions: JWTVerifyOptions = {};

    if (issuer.length > 0) {
      verifyOptions.issuer = issuer;
    }

    if (audience !== undefined) {
      verifyOptions.audience = audience;
    }

    if (clockTolerance !== undefined) {
      verifyOptions.clockTolerance = clockTolerance;
    }

    const { payload } = await jwtVerify(
      tokenValue,
      remoteJwkSet,
      verifyOptions,
    );
    const subject = assertNonEmptyString(payload.sub, "Missing subject claim");

    if (requiredRole !== undefined) {
      const role = assertNonEmptyString(payload.role, "Missing role claim");
      if (role !== requiredRole) {
        throw new AuthenticationError("Role not allowed");
      }
    }

    const token: SupabaseToken = { ...payload };

    return {
      user: {
        id: subject,
        token,
      },
    };
  }

  return { authenticate };
}
