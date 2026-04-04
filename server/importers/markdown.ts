import { readFileSync, existsSync, cpSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import yaml from "js-yaml";
import { marked } from "marked";
import db, { DATA_DIR } from "../db/connection.js";

interface Manifest {
  deck: {
    name: string;
    id: number;
    description: string;
    tags_root?: string;
  };
  models: Record<string, { id: number; name: string; fields: string[]; css: string }>;
  chapters: Array<{
    chapter: number;
    directory: string;
    card_count: number;
    cards: string[];
    topic: string;
  }>;
  total_cards: number;
}

interface CardFrontmatter {
  id: string;
  type: string;
  tags?: string[];
  target_word?: string;
  target_reading?: string;
  freq?: number;
  cefr?: string;
  part_of_speech?: string;
  formality?: string;
  audio_native?: string;
  audio_sentence?: string;
  speech_target?: string;
  speech_accept?: string[];
  context_sentence?: string;
  context_translation?: string;
  situation?: string;
}

function parseFrontmatter(content: string): { meta: CardFrontmatter; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("Invalid card format: missing YAML frontmatter");
  const meta = yaml.load(match[1]) as CardFrontmatter;
  return { meta, body: match[2] };
}

function extractSections(body: string): { front: string; back: string } {
  const frontMatch = body.match(/# Front\n([\s\S]*?)(?=\n# Back)/);
  const backMatch = body.match(/# Back\n([\s\S]*)$/);
  if (!frontMatch || !backMatch) throw new Error("Card missing # Front or # Back sections");
  return {
    front: frontMatch[1].trim(),
    back: backMatch[1].trim(),
  };
}

export async function importMarkdownDeck(manifestPath: string): Promise<number> {
  const baseDir = dirname(manifestPath);
  const raw = readFileSync(manifestPath, "utf-8");
  const manifest: Manifest = JSON.parse(raw);

  // create deck
  const deckInsert = db.prepare(
    "INSERT INTO decks (name, description, source, source_path) VALUES (?, ?, 'markdown', ?)"
  );
  const result = deckInsert.run(manifest.deck.name, manifest.deck.description ?? "", manifestPath);
  const deckId = Number(result.lastInsertRowid);

  // copy media if exists
  const mediaSource = join(baseDir, "media");
  const mediaDest = join(DATA_DIR, "media", String(deckId));
  if (existsSync(mediaSource)) {
    mkdirSync(mediaDest, { recursive: true });
    cpSync(mediaSource, mediaDest, { recursive: true });
  }

  // import cards
  const cardInsert = db.prepare(`
    INSERT INTO cards (
      deck_id, external_id, type, chapter, chapter_name, tags,
      front, back, front_raw, back_raw,
      target_word, target_reading, frequency_rank, cefr,
      audio_native, audio_sentence, speech_target, speech_accept,
      context_sentence, situation
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction(() => {
    let count = 0;
    for (const chapter of manifest.chapters) {
      for (const cardPath of chapter.cards) {
        const fullPath = join(baseDir, cardPath);
        if (!existsSync(fullPath)) {
          console.warn(`Card file not found: ${fullPath}`);
          continue;
        }

        const content = readFileSync(fullPath, "utf-8");
        const { meta, body } = parseFrontmatter(content);
        const { front, back } = extractSections(body);

        const frontHtml = marked.parse(front) as string;
        const backHtml = marked.parse(back) as string;

        cardInsert.run(
          deckId,
          meta.id,
          meta.type,
          chapter.chapter,
          chapter.topic,
          meta.tags ? JSON.stringify(meta.tags) : null,
          frontHtml,
          backHtml,
          front,
          back,
          meta.target_word ?? null,
          meta.target_reading ?? null,
          meta.freq ?? null,
          meta.cefr ?? null,
          meta.audio_native ?? null,
          meta.audio_sentence ?? null,
          meta.speech_target ?? null,
          meta.speech_accept ? JSON.stringify(meta.speech_accept) : null,
          meta.context_sentence ?? null,
          meta.situation ?? null,
        );
        count++;
      }
    }
    return count;
  });

  const count = insertMany();
  console.log(`Imported deck "${manifest.deck.name}": ${count} cards into deck #${deckId}`);
  return deckId;
}
