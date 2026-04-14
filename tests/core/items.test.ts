import { describe, it, expect, beforeEach } from "bun:test";
import db from "../../src/db/connection.js";
import { upsertItem, upsertItems, getItem, listItems } from "../../src/core/items.js";

beforeEach(() => {
  db.exec("DELETE FROM reviews; DELETE FROM learner_states; DELETE FROM learner_config; DELETE FROM learners; DELETE FROM items;");
});

describe("upsertItem", () => {
  it("creates a new item", () => {
    const item = upsertItem({ uid: "a:1", payload: { front: "Q", back: "A" } });
    expect(item.uid).toBe("a:1");
    expect(item.tags).toEqual([]);
    expect((item.payload as any).front).toBe("Q");
  });

  it("is idempotent — second upsert updates payload and updatedAt", () => {
    upsertItem({ uid: "a:1", payload: { front: "Q" } });
    const before = getItem("a:1")!;
    // small sleep so updatedAt differs
    Bun.sleepSync(2);
    upsertItem({ uid: "a:1", payload: { front: "Q2" } });
    const after = getItem("a:1")!;
    expect((after.payload as any).front).toBe("Q2");
    expect(after.updatedAt >= before.updatedAt).toBe(true);
    expect(after.createdAt).toBe(before.createdAt);
  });

  it("stores tags", () => {
    upsertItem({ uid: "a:2", tags: ["cpp", "memory"], payload: {} });
    const item = getItem("a:2")!;
    expect(item.tags).toEqual(["cpp", "memory"]);
  });
});

describe("listItems", () => {
  beforeEach(() => {
    upsertItem({ uid: "a:1", tags: ["cpp"], payload: { front: "1" } });
    upsertItem({ uid: "a:2", tags: ["go"],  payload: { front: "2" } });
    upsertItem({ uid: "a:3", tags: ["cpp"], payload: { front: "3" } });
  });

  it("returns all items without filter", () => {
    expect(listItems().length).toBe(3);
  });

  it("filters by tag", () => {
    const cpp = listItems({ tag: "cpp" });
    expect(cpp.length).toBe(2);
    expect(cpp.every((i) => i.tags.includes("cpp"))).toBe(true);
  });

  it("respects limit", () => {
    expect(listItems({ limit: 2 }).length).toBe(2);
  });
});

describe("upsertItems (batch)", () => {
  it("inserts multiple items and returns count", () => {
    const n = upsertItems([
      { uid: "b:1", payload: "x" },
      { uid: "b:2", payload: "y" },
    ]);
    expect(n).toBe(2);
    expect(getItem("b:1")).not.toBeNull();
    expect(getItem("b:2")).not.toBeNull();
  });
});
