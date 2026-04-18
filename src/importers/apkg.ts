// .apkg importer
// .apkg format: zip containing collection.anki21 (preferred) or collection.anki2 (SQLite) + media JSON
// fflate docs: https://github.com/101arrowz/fflate
import { unzipSync } from "fflate";
import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { htmlToText } from "./anki-utils.js";

/** Anki field separator — ASCII unit separator 0x1F, not a tab */
const ANKI_FIELD_SEP = "\x1f";

const DEFAULT_DECK = "Default";
const UNKNOWN_DECK = "Unknown";

export interface ApkgItem {
  uid: string;
  tags: string[];
  payload: {
    front: string;
    back: string;
    /** Original Anki note GUID — stable across exports */
    anki_guid: string;
    /** Deck name the note was in */
    deck: string;
    /** All fields beyond front/back, keyed by index */
    extra_fields?: string[];
  };
}

export interface ImportApkgResult {
  items: ApkgItem[];
  decks: string[];
  skipped: number;
}

/**
 * Parse a .apkg file and return items ready for upsertItems().
 * Optionally filter to a single deck by name (substring match, case-insensitive).
 */
export function parseApkg(apkgPath: string, deckFilter?: string): ImportApkgResult {
  const files = unzipSync(new Uint8Array(readFileSync(apkgPath)));

  // Prefer newer .anki21 format; fall back to .anki2
  const dbBytes = files["collection.anki21"] ?? files["collection.anki2"];
  if (!dbBytes) throw new Error("No collection database found in .apkg (expected collection.anki21 or collection.anki2)");

  // Load directly from buffer — no temp file needed
  const anki = Database.deserialize(dbBytes);

  try {
    // Parse deck metadata: col.decks is a JSON map of id→{id, name}
    const col = anki.query("SELECT decks FROM col").get() as { decks: string } | null;
    if (!col) throw new Error("collection database has no col row");

    const decksJson: Record<string, { id: number; name: string }> = JSON.parse(col.decks);
    const deckMap = new Map<string, string>();
    for (const deck of Object.values(decksJson)) {
      deckMap.set(String(deck.id), deck.name);
    }
    const allDeckNames = [...deckMap.values()].filter((n) => n !== DEFAULT_DECK);

    // Join notes with their deck in one query; take the first card's deck per note
    const rows = anki.query(`
      SELECT n.id, n.guid, n.tags, n.flds, MIN(c.did) as did
      FROM notes n
      LEFT JOIN cards c ON c.nid = n.id
      GROUP BY n.id
    `).all() as { id: number; guid: string; tags: string; flds: string; did: number | null }[];

    const items: ApkgItem[] = [];
    let skipped = 0;

    for (const row of rows) {
      const deckName = row.did != null ? (deckMap.get(String(row.did)) ?? UNKNOWN_DECK) : UNKNOWN_DECK;

      if (deckFilter && !deckName.toLowerCase().includes(deckFilter.toLowerCase())) {
        skipped++;
        continue;
      }

      const fields = row.flds.split(ANKI_FIELD_SEP);
      const front = htmlToText(fields[0] ?? "");
      const back = htmlToText(fields[1] ?? "");

      if (!front.trim()) {
        skipped++;
        continue;
      }

      const tags = row.tags.trim().split(/\s+/).filter(Boolean);
      if (deckName !== UNKNOWN_DECK && deckName !== DEFAULT_DECK) {
        tags.push(deckName);
      }

      items.push({
        uid: `anki:${row.guid}`,
        tags,
        payload: {
          front,
          back,
          anki_guid: row.guid,
          deck: deckName,
          ...(fields.length > 2 ? { extra_fields: fields.slice(2) } : {}),
        },
      });
    }

    return { items, decks: allDeckNames, skipped };
  } finally {
    anki.close();
  }
}
