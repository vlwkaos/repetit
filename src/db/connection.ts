import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { SCHEMA } from "./schema.js";

// ^ REPETIT_DB overrides; use ":memory:" in tests. Default: XDG data dir (works in compiled binary).
const DB_PATH = process.env.REPETIT_DB
  ?? join(process.env.HOME ?? ".", ".local", "share", "repetit", "repetit.db");

if (DB_PATH !== ":memory:") {
  mkdirSync(dirname(DB_PATH), { recursive: true });
}

const db = new Database(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(SCHEMA);

// Idempotent column migrations for existing DBs (schema.sql handles fresh DBs)
function addColumnIfMissing(table: string, column: string, definition: string) {
  const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as any[]).map((r) => r.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
addColumnIfMissing("learner_states", "agent_notes", "TEXT");
addColumnIfMissing("reviews",        "metadata",    "TEXT");
addColumnIfMissing("learner_config", "agent_prompt","TEXT");

export default db;
