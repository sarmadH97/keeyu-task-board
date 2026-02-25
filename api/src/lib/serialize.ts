/**
 * Prisma uses bigint for ordering columns. This converts bigint values to strings
 * so every response can be safely serialized as JSON.
 */
export function toJsonSafe<T>(value: T): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonSafe(item));
  }

  if (value !== null && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(input)) {
      output[key] = toJsonSafe(item);
    }

    return output;
  }

  return value;
}
