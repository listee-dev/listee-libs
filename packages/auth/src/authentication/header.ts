import type {
  AuthenticationContext,
  AuthenticationProvider,
  AuthenticationResult,
  HeaderAuthenticationOptions,
  SupabaseToken,
} from "@listee/types";
import { extractAuthorizationToken } from "./shared.js";

export function createHeaderAuthentication(
  options: HeaderAuthenticationOptions = {},
): AuthenticationProvider {
  const headerName = options.headerName ?? "authorization";
  const scheme = options.scheme ?? "Bearer";

  async function authenticate(
    context: AuthenticationContext,
  ): Promise<AuthenticationResult> {
    const tokenValue = extractAuthorizationToken(context, headerName, scheme);

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
