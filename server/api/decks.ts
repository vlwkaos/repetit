import db from "../db/connection.js";
import { getDueCounts } from "../fsrs/scheduler.js";
import { jsonResponse } from "../json.js";

export function listDecks(): Response {
  const decks = db.prepare("SELECT * FROM decks ORDER BY created_at DESC").all() as any[];

  const result = decks.map((d) => ({
    ...d,
    counts: getDueCounts(d.id),
  }));

  return jsonResponse(result);
}

export function getDeck(id: number): Response {
  const deck = db.prepare("SELECT * FROM decks WHERE id = ?").get(id);
  if (!deck) return new Response("Not found", { status: 404 });

  return jsonResponse({
    ...(deck as any),
    counts: getDueCounts(id),
  });
}

export function deleteDeck(id: number): Response {
  db.prepare("DELETE FROM decks WHERE id = ?").run(id);
  return new Response(null, { status: 204 });
}
