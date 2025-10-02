import type {
  AuthenticationContext,
  AuthenticationProvider,
  AuthenticationResult,
  HeaderAuthenticationOptions,
  HeaderToken,
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

    const token: HeaderToken = {
      type: "header",
      scheme,
      value: tokenValue,
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
