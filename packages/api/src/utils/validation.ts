export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isNonEmptyString(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  return value.trim().length > 0;
}

export function isBoolean(value: unknown): value is boolean {
  return value === true || value === false;
}
