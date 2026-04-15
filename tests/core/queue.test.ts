import { describe, it, expect, beforeEach } from "bun:test";
import db from "../../src/db/connection.js";
import { upsertItem } from "../../src/core/items.js";
import { upsertLearner, updateConfig } from "../../src/core/learners.js";
import { recordReview } from "../../src/core/review.js";
import { nextDue, getDueCounts } from "../../src/core/queue.js";

const NOW = new Date("2025-06-01T10:00:00.000Z");
const PAST = new Date("2025-05-31T10:00:00.000Z");

beforeEach(() => {
  db.exec("DELETE FROM reviews; DELETE FROM learner_states; DELETE FROM learner_config; DELETE FROM learners; DELETE FROM items;");
  upsertLearner({ id: "alice" });
  upsertLearner({ id: "bob" });
});

describe("nextDue", () => {
  it("returns { agentPrompt, items } shape", () => {
    upsertItem({ uid: "q:1", payload: {} });
    const result = nextDue({ learnerId: "alice", limit: 5, now: NOW });
    expect(result).toHaveProperty("agentPrompt");
    expect(result).toHaveProperty("items");
    expect(Array.isArray(result.items)).toBe(true);
  });

  it("agentPrompt is null when not configured", () => {
    const result = nextDue({ learnerId: "alice", limit: 1, now: NOW });
    expect(result.agentPrompt).toBeNull();
  });

  it("agentPrompt reflects learner config", () => {
    updateConfig("alice", { agentPrompt: "You are a C++ tutor." });
    const result = nextDue({ learnerId: "alice", limit: 1, now: NOW });
    expect(result.agentPrompt).toBe("You are a C++ tutor.");
  });

  it("returns new items when learner has no states", () => {
    upsertItem({ uid: "q:1", payload: {} });
    upsertItem({ uid: "q:2", payload: {} });
    const { items } = nextDue({ learnerId: "alice", limit: 5, now: NOW });
    expect(items.length).toBe(2);
  });

  it("returns only limit items", () => {
    upsertItem({ uid: "q:1", payload: {} });
    upsertItem({ uid: "q:2", payload: {} });
    upsertItem({ uid: "q:3", payload: {} });
    const { items } = nextDue({ learnerId: "alice", limit: 2, now: NOW });
    expect(items.length).toBe(2);
  });

  it("respects daily_new_limit", () => {
    for (let i = 0; i < 5; i++) upsertItem({ uid: `q:${i}`, payload: {} });
    updateConfig("alice", { dailyNewLimit: 3 });
    const { items } = nextDue({ learnerId: "alice", limit: 10, now: NOW });
    expect(items.length).toBe(3);
  });

  it("filters by tag", () => {
    upsertItem({ uid: "cpp:1", tags: ["cpp"], payload: {} });
    upsertItem({ uid: "go:1",  tags: ["go"],  payload: {} });
    const { items } = nextDue({ learnerId: "alice", limit: 5, tag: "cpp", now: NOW });
    expect(items.length).toBe(1);
    expect(items[0].uid).toBe("cpp:1");
  });

  it("does not bleed items between learners", () => {
    upsertItem({ uid: "q:1", payload: {} });
    recordReview({ learnerId: "alice", uid: "q:1", rating: 4, now: PAST });
    const { items } = nextDue({ learnerId: "bob", limit: 5, now: NOW });
    expect(items.some((i) => i.uid === "q:1")).toBe(true);
  });

  it("puts due review cards before new cards", () => {
    upsertItem({ uid: "old:1", payload: {} });
    upsertItem({ uid: "new:1", payload: {} });
    recordReview({ learnerId: "alice", uid: "old:1", rating: 1, now: PAST });
    const { items } = nextDue({ learnerId: "alice", limit: 5, now: NOW });
    const uids = items.map((i) => i.uid);
    expect(uids).toContain("old:1");
    expect(uids).toContain("new:1");
    expect(uids.indexOf("old:1")).toBeLessThan(uids.indexOf("new:1"));
  });

  it("item has agentNotes null before any review", () => {
    upsertItem({ uid: "q:1", payload: {} });
    const { items } = nextDue({ learnerId: "alice", limit: 1, now: NOW });
    expect(items[0].agentNotes).toBeNull();
  });

  it("item has agentNotes populated after review with notes", () => {
    upsertItem({ uid: "q:1", payload: {} });
    recordReview({ learnerId: "alice", uid: "q:1", rating: 1, agentNotes: "Weak on pointers.", now: PAST });
    const { items } = nextDue({ learnerId: "alice", limit: 1, now: NOW });
    expect(items[0].agentNotes).toBe("Weak on pointers.");
  });

  it("item has lastReview null before any review", () => {
    upsertItem({ uid: "q:1", payload: {} });
    const { items } = nextDue({ learnerId: "alice", limit: 1, now: NOW });
    expect(items[0].lastReview).toBeNull();
  });

  it("item has lastReview populated with rating, ratedAt, metadata after review", () => {
    upsertItem({ uid: "q:1", payload: {} });
    const meta = { note: "missed edge case", confidence: "low" };
    recordReview({ learnerId: "alice", uid: "q:1", rating: 2, metadata: meta, now: PAST });
    // after 'again' (1 in PAST) item is due NOW; fetch it
    const { items } = nextDue({ learnerId: "alice", limit: 1, now: NOW });
    expect(items[0].lastReview).not.toBeNull();
    expect(items[0].lastReview!.rating).toBe(2);
    expect(typeof items[0].lastReview!.ratedAt).toBe("string");
    expect(items[0].lastReview!.metadata).toEqual(meta);
  });
});

describe("getDueCounts", () => {
  it("returns newCount and dueCount", () => {
    upsertItem({ uid: "q:1", payload: {} });
    upsertItem({ uid: "q:2", payload: {} });
    recordReview({ learnerId: "alice", uid: "q:1", rating: 1, now: PAST });
    const counts = getDueCounts({ learnerId: "alice", now: NOW });
    expect(counts.newCount).toBe(1);   // q:2 never seen
    expect(counts.dueCount).toBe(1);   // q:1 is due (rated Again in the past)
  });
});
