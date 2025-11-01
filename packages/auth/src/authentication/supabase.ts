import type {
  AuthenticationContext,
  AuthenticationProvider,
  AuthenticationResult,
  SupabaseAuthenticationOptions,
  SupabaseToken,
} from "@listee/types";
import { createRemoteJWKSet, type JWTVerifyOptions, jwtVerify } from "jose";
import {
  type AccountProvisioner,
  type AccountProvisionerDependencies,
  createAccountProvisioner,
} from "../account/provision-account.js";
import { AuthenticationError } from "./errors.js";
import { assertNonEmptyString, extractAuthorizationToken } from "./shared.js";

interface ProvisioningDependencies extends AccountProvisionerDependencies {
  readonly accountProvisioner?: AccountProvisioner;
  readonly authenticationProvider?: AuthenticationProvider;
}

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

function extractEmailFromToken(token: SupabaseToken): string | null {
  const emailValue = token.email;
  if (typeof emailValue === "string") {
    const trimmed = emailValue.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return null;
}

export function createProvisioningSupabaseAuthentication(
  options: SupabaseAuthenticationOptions,
  dependencies: ProvisioningDependencies = {},
): AuthenticationProvider {
  const baseProvider =
    dependencies.authenticationProvider ??
    createSupabaseAuthentication(options);

  const accountProvisioner =
    dependencies.accountProvisioner ??
    createAccountProvisioner({
      database: dependencies.database,
      createRlsClient: dependencies.createRlsClient,
      defaultCategoryName: dependencies.defaultCategoryName,
      defaultCategoryKind: dependencies.defaultCategoryKind,
    });

  async function authenticate(
    context: AuthenticationContext,
  ): Promise<AuthenticationResult> {
    const result = await baseProvider.authenticate(context);
    const email = extractEmailFromToken(result.user.token);

    await accountProvisioner.provision({
      userId: result.user.id,
      token: result.user.token,
      email,
    });

    return result;
  }

  return { authenticate };
}
