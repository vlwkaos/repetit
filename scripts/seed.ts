import { importMarkdownDeck } from "../server/importers/markdown.js";
import db from "../server/db/connection.js";

const MODERN_CPP_MANIFEST = `${process.env.HOME}/ws-ps/dgv3/anki/modern-cpp/manifest.json`;

// clear existing data for clean seed
db.exec("DELETE FROM reviews");
db.exec("DELETE FROM cards");
db.exec("DELETE FROM decks");
db.exec("DELETE FROM streaks");
db.exec("DELETE FROM achievements");

console.log("Seeding ankimo database...");

try {
  await importMarkdownDeck(MODERN_CPP_MANIFEST);
  console.log("Seed complete.");
} catch (err) {
  console.error("Seed failed:", err);
  process.exit(1);
}
