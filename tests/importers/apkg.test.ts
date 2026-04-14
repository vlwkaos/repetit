import { describe, it, expect } from "bun:test";
import { zipSync } from "fflate";
import { Database } from "bun:sqlite";
import { writeFileSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";
import { parseApkg } from "../../src/importers/apkg.js";

const TMP = join(import.meta.dir, "../../data");

/** Build a minimal in-memory Anki SQLite and return its bytes. */
function buildAnkiDb(notes: Array<{ guid: string; tags: string; flds: string; deckId: number }>): Uint8Array {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE col (id INTEGER PRIMARY KEY, decks TEXT);
    CREATE TABLE notes (id INTEGER PRIMARY KEY, guid TEXT, tags TEXT, flds TEXT);
    CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER, did INTEGER);
  `);

  const decks: Record<string, { id: string; name: string }> = {
    "1": { id: "1", name: "Default" },
    "2": { id: "2", name: "Japanese::Verbs" },
    "3": { id: "3", name: "Japanese::Nouns" },
  };
  db.prepare("INSERT INTO col (id, decks) VALUES (1, ?)").run(JSON.stringify(decks));

  let nid = 1;
  for (const note of notes) {
    db.prepare("INSERT INTO notes (id, guid, tags, flds) VALUES (?, ?, ?, ?)").run(nid, note.guid, note.tags, note.flds);
    db.prepare("INSERT INTO cards (id, nid, did) VALUES (?, ?, ?)").run(nid * 10, nid, note.deckId);
    nid++;
  }

  // Serialize to bytes via bun:sqlite's serialize
  return new Uint8Array((db as any).serialize());
}

function makeApkg(notes: Parameters<typeof buildAnkiDb>[0]): string {
  mkdirSync(TMP, { recursive: true });
  const dbBytes = buildAnkiDb(notes);
  const apkgBytes = zipSync({ "collection.anki21": dbBytes });
  const path = join(TMP, `test-${Date.now()}.apkg`);
  writeFileSync(path, apkgBytes);
  return path;
}

const NOTES = [
  { guid: "aaa", tags: "grammar", flds: "食べる\x1fto eat",      deckId: 2 },
  { guid: "bbb", tags: "",        flds: "猫\x1fcat",             deckId: 3 },
  { guid: "ccc", tags: "n5",      flds: "見る\x1fto see\x1fextra", deckId: 2 },
  { guid: "ddd", tags: "",        flds: "\x1fempty front",       deckId: 2 }, // should be skipped
];

describe("parseApkg", () => {
  it("parses notes into items", () => {
    const path = makeApkg(NOTES);
    try {
      const { items, skipped } = parseApkg(path);
      expect(items.length).toBe(3); // ddd skipped (empty front)
      expect(skipped).toBe(1);
    } finally { unlinkSync(path); }
  });

  it("maps uid to anki:<guid>", () => {
    const path = makeApkg(NOTES);
    try {
      const { items } = parseApkg(path);
      expect(items.find((i) => i.uid === "anki:aaa")).toBeDefined();
    } finally { unlinkSync(path); }
  });

  it("splits front and back on \\x1f", () => {
    const path = makeApkg(NOTES);
    try {
      const { items } = parseApkg(path);
      const item = items.find((i) => i.uid === "anki:aaa")!;
      expect(item.payload.front).toBe("食べる");
      expect(item.payload.back).toBe("to eat");
    } finally { unlinkSync(path); }
  });

  it("includes extra_fields for notes with >2 fields", () => {
    const path = makeApkg(NOTES);
    try {
      const { items } = parseApkg(path);
      const item = items.find((i) => i.uid === "anki:ccc")!;
      expect(item.payload.extra_fields).toEqual(["extra"]);
    } finally { unlinkSync(path); }
  });

  it("adds deck name as a tag", () => {
    const path = makeApkg(NOTES);
    try {
      const { items } = parseApkg(path);
      const item = items.find((i) => i.uid === "anki:aaa")!;
      expect(item.tags).toContain("Japanese::Verbs");
    } finally { unlinkSync(path); }
  });

  it("filters by deck name (case-insensitive substring)", () => {
    const path = makeApkg(NOTES);
    try {
      const { items, skipped } = parseApkg(path, "nouns");
      expect(items.length).toBe(1);
      expect(items[0].uid).toBe("anki:bbb");
    } finally { unlinkSync(path); }
  });

  it("returns all deck names found", () => {
    const path = makeApkg(NOTES);
    try {
      const { decks } = parseApkg(path);
      expect(decks).toContain("Japanese::Verbs");
      expect(decks).toContain("Japanese::Nouns");
    } finally { unlinkSync(path); }
  });
});
