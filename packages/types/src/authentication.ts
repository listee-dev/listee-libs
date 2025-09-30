import type { SupabaseToken } from "./db";

export interface HeaderToken {
  readonly type: "header";
  readonly scheme: string;
  readonly value: string;
}

export type AuthenticatedToken = SupabaseToken | HeaderToken;

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

export interface HeaderAuthenticationOptions {
  readonly headerName?: string;
  readonly scheme?: string;
}

export interface SupabaseAuthenticationOptions
  extends HeaderAuthenticationOptions {
  readonly projectUrl: string;
  readonly audience?: string | readonly string[];
  readonly issuer?: string;
  readonly requiredRole?: string;
  readonly clockToleranceSeconds?: number;
  readonly jwksPath?: string;
}
