import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(import.meta.dir, "../../data");
// ^ REPETIT_DB overrides path; use ":memory:" in tests
const DB_PATH = process.env.REPETIT_DB ?? join(DATA_DIR, "repetit.db");
const SCHEMA_PATH = join(import.meta.dir, "schema.sql");

if (DB_PATH !== ":memory:") {
  mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

const schema = readFileSync(SCHEMA_PATH, "utf-8");
db.exec(schema);

export default db;
export { DATA_DIR };
