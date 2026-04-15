import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import db from "../../src/db/connection.js";
import { handleRequest } from "../../src/http/routes.js";

// Spin up an ephemeral server for the test suite
const server = Bun.serve({ port: 0, fetch: handleRequest });
const BASE = `http://localhost:${server.port}`;

function req(method: string, path: string, body?: unknown, learnerId?: string): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(learnerId ? { "x-learner-id": learnerId } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

afterAll(() => server.stop());

beforeEach(() => {
  db.exec("DELETE FROM reviews; DELETE FROM learner_states; DELETE FROM learner_config; DELETE FROM learners; DELETE FROM items;");
});

describe("GET /healthz", () => {
  it("returns ok", async () => {
    const res = await req("GET", "/healthz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("POST /items", () => {
  it("upserts a single item", async () => {
    const res = await req("POST", "/items", { uid: "q:1", payload: { front: "F", back: "B" } });
    expect(res.status).toBe(200);
    expect((await res.json()).upserted).toBe(1);
  });

  it("upserts an array of items", async () => {
    const res = await req("POST", "/items", [
      { uid: "q:1", payload: {} },
      { uid: "q:2", payload: {} },
    ]);
    expect((await res.json()).upserted).toBe(2);
  });

  it("returns 400 when uid is missing", async () => {
    const res = await req("POST", "/items", { payload: {} });
    expect(res.status).toBe(400);
  });
});

describe("GET /items/:uid", () => {
  it("returns item by uid", async () => {
    await req("POST", "/items", { uid: "q:1", payload: { front: "F" } });
    const res = await req("GET", "/items/q:1");
    expect(res.status).toBe(200);
    expect((await res.json()).uid).toBe("q:1");
  });

  it("returns 404 for unknown uid", async () => {
    const res = await req("GET", "/items/no:such");
    expect(res.status).toBe(404);
  });
});

describe("GET /next", () => {
  it("returns 400 without X-Learner-Id", async () => {
    const res = await req("GET", "/next");
    expect(res.status).toBe(400);
  });

  it("returns { agentPrompt, items } shape", async () => {
    await req("POST", "/items", { uid: "q:1", payload: { front: "F" } });
    const res = await req("GET", "/next?limit=1", undefined, "alice");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("agentPrompt");
    expect(body).toHaveProperty("items");
    expect(body.items.length).toBe(1);
    expect(body.items[0].uid).toBe("q:1");
  });

  it("agentPrompt is null when not configured", async () => {
    const res = await req("GET", "/next?limit=1", undefined, "alice");
    const body = await res.json();
    expect(body.agentPrompt).toBeNull();
  });

  it("agentPrompt reflects learner config", async () => {
    await req("PATCH", "/learners/me/config", { agentPrompt: "You are a tutor." }, "alice");
    const res = await req("GET", "/next?limit=1", undefined, "alice");
    const body = await res.json();
    expect(body.agentPrompt).toBe("You are a tutor.");
  });

  it("filters by tag", async () => {
    await req("POST", "/items", [
      { uid: "cpp:1", tags: ["cpp"], payload: {} },
      { uid: "go:1",  tags: ["go"],  payload: {} },
    ]);
    const res = await req("GET", "/next?tag=cpp&limit=5", undefined, "alice");
    const { items } = await res.json();
    expect(items.every((i: any) => i.tags.includes("cpp"))).toBe(true);
  });

  it("items include agentNotes and lastReview fields", async () => {
    await req("POST", "/items", { uid: "q:1", payload: {} });
    const res = await req("GET", "/next?limit=1", undefined, "alice");
    const { items } = await res.json();
    expect(items[0]).toHaveProperty("agentNotes");
    expect(items[0]).toHaveProperty("lastReview");
    expect(items[0].agentNotes).toBeNull();
    expect(items[0].lastReview).toBeNull();
  });

  it("POST /rate accepts metadata — lastReview surfacing verified in core tests", async () => {
    // After rating=1 (again), FSRS schedules due_at ~1 min out so the card is not
    // immediately returned by /next. Core queue tests verify lastReview with controlled time.
    // Here we just confirm the route accepts metadata without error.
    await req("POST", "/items", { uid: "q:1", payload: {} });
    const res = await req("POST", "/rate", { uid: "q:1", rating: 1, metadata: { note: "shaky" } }, "alice");
    expect(res.status).toBe(200);
  });
});

describe("POST /rate", () => {
  it("records a review and returns scheduling result", async () => {
    await req("POST", "/items", { uid: "q:1", payload: {} });
    const res = await req("POST", "/rate", { uid: "q:1", rating: 3 }, "alice");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.nextDueAt).toBe("string");
    expect(body.stability).toBeGreaterThan(0);
  });

  it("accepts and stores metadata", async () => {
    await req("POST", "/items", { uid: "q:1", payload: {} });
    const res = await req("POST", "/rate", { uid: "q:1", rating: 3, metadata: { note: "good answer", confidence: "high" } }, "alice");
    expect(res.status).toBe(200);
  });

  it("accepts and stores agentNotes", async () => {
    await req("POST", "/items", { uid: "q:1", payload: {} });
    const res = await req("POST", "/rate", { uid: "q:1", rating: 3, agentNotes: "Strong on concept, weak on syntax." }, "alice");
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid rating", async () => {
    await req("POST", "/items", { uid: "q:1", payload: {} });
    const res = await req("POST", "/rate", { uid: "q:1", rating: 5 }, "alice");
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown item uid", async () => {
    const res = await req("POST", "/rate", { uid: "no:such", rating: 3 }, "alice");
    expect(res.status).toBe(404);
  });
});

describe("GET /queue", () => {
  it("returns newCount and dueCount", async () => {
    await req("POST", "/items", { uid: "q:1", payload: {} });
    const res = await req("GET", "/queue", undefined, "alice");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.newCount).toBe(1);
    expect(body.dueCount).toBe(0);
  });
});

describe("GET /learners/me", () => {
  it("auto-creates learner and returns with config", async () => {
    const res = await req("GET", "/learners/me", undefined, "bob");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("bob");
    expect(body.config.dailyNewLimit).toBe(20);
  });
});

describe("PATCH /learners/me/config", () => {
  it("updates config fields", async () => {
    const res = await req("PATCH", "/learners/me/config", { dailyNewLimit: 10 }, "alice");
    expect(res.status).toBe(200);
    expect((await res.json()).dailyNewLimit).toBe(10);
  });

  it("stores and returns agentPrompt", async () => {
    const res = await req("PATCH", "/learners/me/config", { agentPrompt: "You are a tutor." }, "alice");
    expect(res.status).toBe(200);
    expect((await res.json()).agentPrompt).toBe("You are a tutor.");
  });

  it("clears agentPrompt when set to null", async () => {
    await req("PATCH", "/learners/me/config", { agentPrompt: "some prompt" }, "alice");
    const res = await req("PATCH", "/learners/me/config", { agentPrompt: null }, "alice");
    expect((await res.json()).agentPrompt).toBeNull();
  });
});

describe("unknown route", () => {
  it("returns 404", async () => {
    const res = await req("GET", "/nonexistent");
    expect(res.status).toBe(404);
  });
});
