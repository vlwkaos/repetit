const BASE = "";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  decks: {
    list: () => request<any[]>("GET", "/api/decks"),
    get: (id: number) => request<any>("GET", `/api/decks/${id}`),
    delete: (id: number) => request<void>("DELETE", `/api/decks/${id}`),
  },
  import: {
    markdown: (path: string) => request<{ deckId: number }>("POST", "/api/import/markdown", { path }),
  },
  study: {
    queue: (deckId: number) => request<any>("GET", `/api/study/${deckId}`),
    review: (cardId: number, rating: number, elapsedMs: number) =>
      request<any>("POST", "/api/review", { cardId, rating, elapsedMs }),
  },
  stats: {
    today: () => request<any>("GET", "/api/stats/today"),
    heatmap: () => request<any[]>("GET", "/api/stats/heatmap"),
    deck: (id: number) => request<any>("GET", `/api/stats/deck/${id}`),
  },
  user: {
    get: () => request<any>("GET", "/api/user"),
    update: (data: any) => request<any>("PATCH", "/api/user", data),
  },
  config: {
    get: (deckId?: number) => request<any>("GET", deckId ? `/api/config/${deckId}` : "/api/config"),
    update: (data: any, deckId?: number) =>
      request<any>("PATCH", deckId ? `/api/config/${deckId}` : "/api/config", data),
  },
};
