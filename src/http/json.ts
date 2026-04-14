// Ported from server/json.ts — bun:sqlite returns bigint for INTEGER; serialize safely
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(safeStringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: { message } }, status);
}

function safeStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) =>
    typeof val === "bigint" ? Number(val) : val
  );
}
