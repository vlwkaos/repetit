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
  it("returns new items when learner has no states", () => {
    upsertItem({ uid: "q:1", payload: {} });
    upsertItem({ uid: "q:2", payload: {} });
    const items = nextDue({ learnerId: "alice", limit: 5, now: NOW });
    expect(items.length).toBe(2);
  });

  it("returns only limit items", () => {
    upsertItem({ uid: "q:1", payload: {} });
    upsertItem({ uid: "q:2", payload: {} });
    upsertItem({ uid: "q:3", payload: {} });
    const items = nextDue({ learnerId: "alice", limit: 2, now: NOW });
    expect(items.length).toBe(2);
  });

  it("respects daily_new_limit", () => {
    for (let i = 0; i < 5; i++) upsertItem({ uid: `q:${i}`, payload: {} });
    updateConfig("alice", { dailyNewLimit: 3 });
    const items = nextDue({ learnerId: "alice", limit: 10, now: NOW });
    expect(items.length).toBe(3);
  });

  it("filters by tag", () => {
    upsertItem({ uid: "cpp:1", tags: ["cpp"], payload: {} });
    upsertItem({ uid: "go:1",  tags: ["go"],  payload: {} });
    const items = nextDue({ learnerId: "alice", limit: 5, tag: "cpp", now: NOW });
    expect(items.length).toBe(1);
    expect(items[0].uid).toBe("cpp:1");
  });

  it("does not bleed items between learners", () => {
    upsertItem({ uid: "q:1", payload: {} });
    // alice reviews it
    recordReview({ learnerId: "alice", uid: "q:1", rating: 4, now: PAST });
    // bob should still see it as new
    const bobItems = nextDue({ learnerId: "bob", limit: 5, now: NOW });
    expect(bobItems.some((i) => i.uid === "q:1")).toBe(true);
  });

  it("puts due review cards before new cards", () => {
    upsertItem({ uid: "old:1", payload: {} });
    upsertItem({ uid: "new:1", payload: {} });
    // alice reviewed old:1 in the past with rating=1 (again) so it's due now
    recordReview({ learnerId: "alice", uid: "old:1", rating: 1, now: PAST });
    const items = nextDue({ learnerId: "alice", limit: 5, now: NOW });
    // old:1 should appear (it's a due review); new:1 should appear too
    const uids = items.map((i) => i.uid);
    expect(uids).toContain("old:1");
    expect(uids).toContain("new:1");
    // review card should come first
    expect(uids.indexOf("old:1")).toBeLessThan(uids.indexOf("new:1"));
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
