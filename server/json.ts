// ! bun:sqlite rows use a custom prototype that JSON.stringify/spread don't handle
// Convert to plain objects recursively before serializing
function toPlain(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (val instanceof Date) return val.toISOString();
  if (typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(toPlain);
  // Convert to plain object using Object.keys (handles bun:sqlite rows)
  const obj: Record<string, unknown> = {};
  for (const key of Object.keys(val as object)) {
    obj[key] = toPlain((val as any)[key]);
  }
  return obj;
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(toPlain(data)), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
