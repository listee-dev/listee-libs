import { AuthenticationError } from "@listee/auth";
import type {
  AuthenticationProvider,
  AuthenticationResult,
} from "@listee/types";

export async function tryAuthenticate(
  provider: AuthenticationProvider,
  request: Request,
): Promise<AuthenticationResult | null> {
  try {
    return await provider.authenticate({ request });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return null;
    }

    throw error;
  }
}
