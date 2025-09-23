export function toErrorMessage(value: unknown): string {
  if (value instanceof Error && typeof value.message === "string") {
    return value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "Unknown error";
  }
}
