export function describeDeviceError(error: unknown): string {
  return describe(error, new Set<object>());
}

function describe(error: unknown, seen: Set<object>): string {
  if (error && typeof error === "object") {
    if (seen.has(error)) return "Unknown biometric device error";
    seen.add(error);
    const record = error as Record<string, unknown>;
    if (record.cause !== undefined) {
      const cause = describe(record.cause, seen);
      if (cause !== "Unknown biometric device error") return cause;
    }
    if (typeof record.code === "string" && /^[0-9A-Z]{5}$/.test(record.code) && typeof record.message === "string") {
      const constraint = typeof record.constraint_name === "string" ? record.constraint_name : record.constraint;
      return `Database error ${record.code}: ${record.message}${typeof constraint === "string" ? ` (constraint: ${constraint})` : ""}`;
    }
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim() && error.trim() !== "[object Object]") return error.trim();

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    for (const key of ["message", "error", "err", "reason", "details", "code"]) {
      const value = record[key];
      if (value === error) continue;
      const description = describe(value, seen);
      if (description !== "Unknown biometric device error") {
        return key === "code" ? `Device error code: ${description}` : description;
      }
    }

    const details = Object.entries(record)
      .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
      .slice(0, 4)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(", ");
    if (details) return details;
  }

  return "Unknown biometric device error";
}
