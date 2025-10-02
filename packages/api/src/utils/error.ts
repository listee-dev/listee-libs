export function toErrorMessage(value: unknown): string {
  if (value instanceof Error && typeof value.message === "string") {
    return value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    const serialized = JSON.stringify(value);

    if (typeof serialized === "string") {
      return serialized;
    }

    return "Unknown error";
  } catch {
    return "Unknown error";
  }
}
