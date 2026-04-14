import { describe, it, expect, beforeEach } from "bun:test";
import db from "../../src/db/connection.js";
import { upsertItem } from "../../src/core/items.js";
import { upsertLearner } from "../../src/core/learners.js";
import { recordReview } from "../../src/core/review.js";

const NOW = new Date("2025-01-01T10:00:00.000Z");

beforeEach(() => {
  db.exec("DELETE FROM reviews; DELETE FROM learner_states; DELETE FROM learner_config; DELETE FROM learners; DELETE FROM items;");
  upsertLearner({ id: "alice" });
  upsertLearner({ id: "bob" });
  upsertItem({ uid: "q:1", payload: { front: "Q1" } });
  upsertItem({ uid: "q:2", payload: { front: "Q2" } });
});

describe("recordReview", () => {
  it("returns nextDueAt, stability, difficulty, state", () => {
    const result = recordReview({ learnerId: "alice", uid: "q:1", rating: 3, now: NOW });
    expect(typeof result.nextDueAt).toBe("string");
    expect(result.nextDueAt > NOW.toISOString()).toBe(true);
    expect(result.stability).toBeGreaterThan(0);
    expect(result.difficulty).toBeGreaterThan(0);
    expect([0, 1, 2, 3]).toContain(result.state);
  });

  it("again (1) schedules sooner than good (3)", () => {
    const again = recordReview({ learnerId: "alice", uid: "q:1", rating: 1, now: NOW });
    const good  = recordReview({ learnerId: "bob",   uid: "q:1", rating: 3, now: NOW });
    expect(again.nextDueAt < good.nextDueAt).toBe(true);
  });

  it("easy (4) schedules later than good (3)", () => {
    const good = recordReview({ learnerId: "alice", uid: "q:1", rating: 3, now: NOW });
    const easy = recordReview({ learnerId: "bob",   uid: "q:1", rating: 4, now: NOW });
    expect(easy.nextDueAt >= good.nextDueAt).toBe(true);
  });

  it("two learners reviewing same uid keep independent states", () => {
    recordReview({ learnerId: "alice", uid: "q:1", rating: 1, now: NOW });
    recordReview({ learnerId: "bob",   uid: "q:1", rating: 4, now: NOW });

    const aliceState = db.prepare(
      "SELECT due_at FROM learner_states WHERE learner_id = 'alice' AND item_uid = 'q:1'"
    ).get() as any;
    const bobState = db.prepare(
      "SELECT due_at FROM learner_states WHERE learner_id = 'bob' AND item_uid = 'q:1'"
    ).get() as any;

    expect(aliceState.due_at).not.toBe(bobState.due_at);
  });

  it("throws on unknown item", () => {
    expect(() => recordReview({ learnerId: "alice", uid: "no:such", rating: 3 })).toThrow("not found");
  });

  it("throws on unknown learner", () => {
    expect(() => recordReview({ learnerId: "nobody", uid: "q:1", rating: 3 })).toThrow("not found");
  });

  it("persists review row", () => {
    recordReview({ learnerId: "alice", uid: "q:1", rating: 2, elapsedMs: 5000, now: NOW });
    const row = db.prepare(
      "SELECT * FROM reviews WHERE learner_id = 'alice' AND item_uid = 'q:1'"
    ).get() as any;
    expect(row.rating).toBe(2);
    expect(row.elapsed_ms).toBe(5000);
  });
});
