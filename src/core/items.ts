import db from "../db/connection.js";
import type { Item, ItemUid } from "./types.js";

export function upsertItem(input: {
  uid: ItemUid;
  tags?: string[];
  payload: unknown;
}): Item {
  const tags = JSON.stringify(input.tags ?? []);
  const payload = JSON.stringify(input.payload);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO items (uid, tags, payload, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(uid) DO UPDATE SET
      tags = excluded.tags,
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `).run(input.uid, tags, payload, now, now);

  return getItem(input.uid)!;
}

export function upsertItems(inputs: Array<{ uid: ItemUid; tags?: string[]; payload: unknown }>): number {
  const insert = db.prepare(`
    INSERT INTO items (uid, tags, payload, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(uid) DO UPDATE SET
      tags = excluded.tags,
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `);
  const now = new Date().toISOString();
  const batch = db.transaction((items: typeof inputs) => {
    for (const item of items) {
      insert.run(item.uid, JSON.stringify(item.tags ?? []), JSON.stringify(item.payload), now, now);
    }
  });
  batch(inputs);
  return inputs.length;
}

export function getItem(uid: ItemUid): Item | null {
  const row = db.prepare("SELECT * FROM items WHERE uid = ?").get(uid) as any;
  if (!row) return null;
  return rowToItem(row);
}

export function listItems(filter?: { tag?: string; limit?: number }): Item[] {
  if (filter?.tag) {
    // ^ json_each for tag membership; safe — tag is never user-interpolated into SQL
    const rows = db.prepare(`
      SELECT DISTINCT i.*
      FROM items i, json_each(i.tags) t
      WHERE t.value = ?
      ORDER BY i.created_at
      LIMIT ?
    `).all(filter.tag, filter.limit ?? 1000) as any[];
    return rows.map(rowToItem);
  }
  const rows = db.prepare(`
    SELECT * FROM items ORDER BY created_at LIMIT ?
  `).all(filter?.limit ?? 1000) as any[];
  return rows.map(rowToItem);
}

function rowToItem(row: any): Item {
  return {
    uid: row.uid,
    tags: JSON.parse(row.tags),
    payload: JSON.parse(row.payload),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
