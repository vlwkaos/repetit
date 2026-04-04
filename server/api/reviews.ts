import db from "../db/connection.js";
import { createScheduler, newCard, scheduleCard, xpForRating, Rating, type Card } from "../fsrs/index.js";
import { jsonResponse } from "../json.js";

interface ReviewRequest {
  cardId: number;
  rating: number; // 1-4
  elapsedMs: number;
}

export async function submitReview(req: Request): Promise<Response> {
  const body: ReviewRequest = await req.json();
  const { cardId, rating, elapsedMs } = body;

  if (rating < 1 || rating > 4) {
    return jsonResponse({ error: "Rating must be 1-4" }, 400);
  }

  const card = db.prepare("SELECT * FROM cards WHERE id = ?").get(cardId) as any;
  if (!card) return jsonResponse({ error: "Card not found" }, 404);

  // load deck-specific or global config
  const config = db.prepare(`
    SELECT * FROM learning_config
    WHERE deck_id = ? OR deck_id IS NULL
    ORDER BY deck_id DESC LIMIT 1
  `).get(card.deck_id) as any;

  const weights = config?.fsrs_weights ? JSON.parse(config.fsrs_weights) : undefined;
  const retention = config?.target_retention ?? 0.9;
  const scheduler = createScheduler(weights, retention);

  // restore or create FSRS card state
  // ! ts-fsrs requires Date objects for due/last_review; JSON.parse returns strings
  const fsrsCard: Card = card.fsrs_state
    ? (() => {
        const parsed = JSON.parse(card.fsrs_state);
        if (parsed.due) parsed.due = new Date(parsed.due);
        if (parsed.last_review) parsed.last_review = new Date(parsed.last_review);
        return parsed;
      })()
    : newCard();

  // schedule
  const result = scheduleCard(scheduler, fsrsCard, rating as Rating);
  const nextCard = result.card;
  const log = result.log;

  // persist card state
  db.prepare(`
    UPDATE cards SET fsrs_state = ?, due_at = ? WHERE id = ?
  `).run(
    JSON.stringify(nextCard),
    nextCard.due instanceof Date ? nextCard.due.toISOString() : String(nextCard.due),
    cardId,
  );

  // log review
  db.prepare(`
    INSERT INTO reviews (card_id, rating, elapsed_ms, state, stability, difficulty)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    cardId,
    rating,
    elapsedMs,
    String(nextCard.state),
    nextCard.stability,
    nextCard.difficulty,
  );

  // update streak
  const today = new Date().toISOString().slice(0, 10);
  const xp = xpForRating(rating as Rating);
  db.prepare(`
    INSERT INTO streaks (date, cards_reviewed, xp_earned)
    VALUES (?, 1, ?)
    ON CONFLICT(date) DO UPDATE SET
      cards_reviewed = cards_reviewed + 1,
      xp_earned = xp_earned + ?
  `).run(today, xp, xp);

  return jsonResponse({
    nextDue: nextCard.due,
    stability: nextCard.stability,
    difficulty: nextCard.difficulty,
    state: nextCard.state,
  });
}
