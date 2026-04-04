import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join } from "path";
import { mkdirSync } from "fs";

const DATA_DIR = join(import.meta.dir, "../../data");
const DB_PATH = join(DATA_DIR, "ankimo.db");
const SCHEMA_PATH = join(import.meta.dir, "schema.sql");

mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

const schema = readFileSync(SCHEMA_PATH, "utf-8");
db.exec(schema);

export default db;
export { DATA_DIR };
