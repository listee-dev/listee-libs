import type { SupabaseToken } from "./db";

export type AuthenticatedToken = SupabaseToken;

export interface AuthenticatedUser {
  readonly id: string;
  readonly token: AuthenticatedToken;
}

export interface AuthenticationContext {
  readonly request: Request;
}

export interface AuthenticationResult {
  readonly user: AuthenticatedUser;
}

export interface AuthenticationProvider {
  authenticate(context: AuthenticationContext): Promise<AuthenticationResult>;
}

export interface SupabaseAuthenticationOptions {
  readonly projectUrl: string;
  readonly audience?: string | readonly string[];
  readonly issuer?: string;
  readonly requiredRole?: string;
  readonly clockToleranceSeconds?: number;
  readonly jwksPath?: string;
  readonly headerName?: string;
  readonly scheme?: string;
}
