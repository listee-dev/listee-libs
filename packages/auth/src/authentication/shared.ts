import type { AuthenticationContext } from "@listee/types";
import { AuthenticationError } from "./errors.js";

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNonEmptyString(value: unknown): value is string {
  if (!isString(value)) {
    return false;
  }

  return value.trim().length > 0;
}

export function assertNonEmptyString(value: unknown, message: string): string {
  if (!isNonEmptyString(value)) {
    throw new AuthenticationError(message);
  }

  return value;
}

export function extractAuthorizationToken(
  context: AuthenticationContext,
  headerName: string,
  scheme: string,
): string {
  const headerValue = context.request.headers.get(headerName);
  if (headerValue === null) {
    throw new AuthenticationError("Missing authorization header");
  }

  const expectedPrefix = `${scheme} `;
  if (!headerValue.startsWith(expectedPrefix)) {
    throw new AuthenticationError("Invalid authorization scheme");
  }

  const tokenValue = headerValue.slice(expectedPrefix.length).trim();
  if (!isNonEmptyString(tokenValue)) {
    throw new AuthenticationError("Missing token value");
  }

  return tokenValue;
}
