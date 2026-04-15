import { describe, it, expect, beforeEach } from "bun:test";
import db from "../../src/db/connection.js";
import {
  upsertLearner,
  getLearner,
  listLearners,
  getConfig,
  updateConfig,
} from "../../src/core/learners.js";

beforeEach(() => {
  db.exec("DELETE FROM reviews; DELETE FROM learner_states; DELETE FROM learner_config; DELETE FROM learners;");
});

describe("upsertLearner", () => {
  it("creates a learner and config row with defaults", () => {
    upsertLearner({ id: "alice" });
    const learner = getLearner("alice");
    expect(learner).not.toBeNull();
    expect(learner!.id).toBe("alice");
    expect(learner!.displayName).toBeNull();

    const config = getConfig("alice");
    expect(config.dailyNewLimit).toBe(20);
    expect(config.dailyReviewLimit).toBe(200);
    expect(config.targetRetention).toBe(0.9);
    expect(config.tzOffsetMinutes).toBe(0);
    expect(config.fsrsWeights).toBeNull();
  });

  it("is idempotent — second call does not overwrite displayName", () => {
    upsertLearner({ id: "alice", displayName: "Alice" });
    upsertLearner({ id: "alice" }); // no displayName
    expect(getLearner("alice")!.displayName).toBe("Alice");
  });

  it("updates displayName when provided on second call", () => {
    upsertLearner({ id: "alice", displayName: "Alice" });
    upsertLearner({ id: "alice", displayName: "Alice K." });
    expect(getLearner("alice")!.displayName).toBe("Alice K.");
  });
});

describe("listLearners", () => {
  it("returns all learners ordered by created_at", () => {
    upsertLearner({ id: "a" });
    upsertLearner({ id: "b" });
    const list = listLearners();
    expect(list.length).toBe(2);
    expect(list.map((l) => l.id)).toEqual(["a", "b"]);
  });
});

describe("getConfig / updateConfig", () => {
  beforeEach(() => upsertLearner({ id: "alice" }));

  it("returns defaults for a fresh learner", () => {
    const c = getConfig("alice");
    expect(c.dailyNewLimit).toBe(20);
    expect(c.fsrsWeights).toBeNull();
  });

  it("updates individual fields", () => {
    updateConfig("alice", { dailyNewLimit: 5, targetRetention: 0.85 });
    const c = getConfig("alice");
    expect(c.dailyNewLimit).toBe(5);
    expect(c.targetRetention).toBe(0.85);
    expect(c.dailyReviewLimit).toBe(200); // unchanged
  });

  it("stores and retrieves fsrsWeights", () => {
    const weights = [0.1, 0.2, 0.3];
    updateConfig("alice", { fsrsWeights: weights });
    expect(getConfig("alice").fsrsWeights).toEqual(weights);
  });

  it("clears fsrsWeights when set to null", () => {
    updateConfig("alice", { fsrsWeights: [0.1] });
    updateConfig("alice", { fsrsWeights: null });
    expect(getConfig("alice").fsrsWeights).toBeNull();
  });

  it("no-op update returns current config unchanged", () => {
    const before = getConfig("alice");
    const after = updateConfig("alice", {});
    expect(after.dailyNewLimit).toBe(before.dailyNewLimit);
  });

  it("agentPrompt is null by default", () => {
    expect(getConfig("alice").agentPrompt).toBeNull();
  });

  it("stores and retrieves agentPrompt", () => {
    updateConfig("alice", { agentPrompt: "You are a C++ tutor." });
    expect(getConfig("alice").agentPrompt).toBe("You are a C++ tutor.");
  });

  it("clears agentPrompt when set to null", () => {
    updateConfig("alice", { agentPrompt: "some prompt" });
    updateConfig("alice", { agentPrompt: null });
    expect(getConfig("alice").agentPrompt).toBeNull();
  });
});
