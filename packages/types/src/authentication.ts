import type { SupabaseToken } from "./db";

export interface AuthenticatedUser {
  readonly id: string;
  readonly token: SupabaseToken;
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
