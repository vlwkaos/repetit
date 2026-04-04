import db from "../db/connection.js";
import { jsonResponse } from "../json.js";

export function getConfig(deckId?: number): Response {
  const config = db.prepare(`
    SELECT * FROM learning_config
    WHERE deck_id IS ? OR deck_id IS NULL
    ORDER BY deck_id DESC LIMIT 1
  `).get(deckId ?? null);

  return jsonResponse(config);
}

export async function updateConfig(req: Request, deckId?: number): Promise<Response> {
  const body = await req.json();
  const { daily_new_limit, daily_review_limit, new_card_order, target_retention, fsrs_weights } = body;

  // upsert config for this deck (or global if deckId is null)
  db.prepare(`
    INSERT INTO learning_config (deck_id, daily_new_limit, daily_review_limit, new_card_order, target_retention, fsrs_weights)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(deck_id) DO UPDATE SET
      daily_new_limit = COALESCE(?, daily_new_limit),
      daily_review_limit = COALESCE(?, daily_review_limit),
      new_card_order = COALESCE(?, new_card_order),
      target_retention = COALESCE(?, target_retention),
      fsrs_weights = COALESCE(?, fsrs_weights)
  `).run(
    deckId ?? null,
    daily_new_limit ?? 20,
    daily_review_limit ?? 200,
    new_card_order ?? "sequential",
    target_retention ?? 0.9,
    fsrs_weights ? JSON.stringify(fsrs_weights) : null,
    daily_new_limit ?? null,
    daily_review_limit ?? null,
    new_card_order ?? null,
    target_retention ?? null,
    fsrs_weights ? JSON.stringify(fsrs_weights) : null,
  );

  return getConfig(deckId);
}
