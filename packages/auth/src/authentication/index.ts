import type { SupabaseToken } from "@listee/db";

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

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export interface HeaderAuthenticationOptions {
  readonly headerName?: string;
  readonly scheme?: string;
}

export function createHeaderAuthentication(
  options: HeaderAuthenticationOptions = {},
): AuthenticationProvider {
  const headerName = options.headerName ?? "authorization";
  const scheme = options.scheme ?? "Bearer";

  async function authenticate(
    context: AuthenticationContext,
  ): Promise<AuthenticationResult> {
    const headerValue = context.request.headers.get(headerName);
    if (headerValue === null) {
      throw new AuthenticationError("Missing authorization header");
    }

    const expectedPrefix = `${scheme} `;
    if (!headerValue.startsWith(expectedPrefix)) {
      throw new AuthenticationError("Invalid authorization scheme");
    }

    const tokenValue = headerValue.slice(expectedPrefix.length).trim();
    if (tokenValue.length === 0) {
      throw new AuthenticationError("Missing token value");
    }

    const token: SupabaseToken = {
      sub: tokenValue,
      role: "authenticated",
    };

    return {
      user: {
        id: tokenValue,
        token,
      },
    };
  }

  return { authenticate };
}
