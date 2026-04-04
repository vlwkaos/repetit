import db from "../db/connection.js";
import { jsonResponse } from "../json.js";

export function todayStats(): Response {
  const today = new Date().toISOString().slice(0, 10);

  const streak = db.prepare("SELECT * FROM streaks WHERE date = ?").get(today) as any;

  // compute current streak length
  const streakDays = computeStreakLength();

  // count total reviews today across all decks
  const reviewCount = db.prepare(`
    SELECT COUNT(*) as count FROM reviews WHERE reviewed_at >= ?
  `).get(`${today}T00:00:00`) as any;

  return jsonResponse({
    date: today,
    cardsReviewed: streak?.cards_reviewed ?? 0,
    xpEarned: streak?.xp_earned ?? 0,
    streakDays,
    totalReviewsToday: reviewCount?.count ?? 0,
  });
}

export function heatmapData(): Response {
  // last 365 days of activity
  const rows = db.prepare(`
    SELECT date, cards_reviewed, xp_earned FROM streaks
    WHERE date >= date('now', '-365 days')
    ORDER BY date ASC
  `).all();

  return jsonResponse(rows);
}

export function deckStats(deckId: number): Response {
  const cardStates = db.prepare(`
    SELECT
      SUM(CASE WHEN fsrs_state IS NULL THEN 1 ELSE 0 END) as new_cards,
      SUM(CASE WHEN json_extract(fsrs_state, '$.state') = 1 THEN 1 ELSE 0 END) as learning,
      SUM(CASE WHEN json_extract(fsrs_state, '$.state') = 2 THEN 1 ELSE 0 END) as review,
      SUM(CASE WHEN json_extract(fsrs_state, '$.state') = 3 THEN 1 ELSE 0 END) as relearning,
      COUNT(*) as total
    FROM cards WHERE deck_id = ?
  `).get(deckId) as any;

  const recentReviews = db.prepare(`
    SELECT r.rating, COUNT(*) as count
    FROM reviews r
    JOIN cards c ON c.id = r.card_id
    WHERE c.deck_id = ? AND r.reviewed_at >= date('now', '-30 days')
    GROUP BY r.rating
  `).all(deckId);

  return jsonResponse({
    cardStates,
    recentReviews,
  });
}

function computeStreakLength(): number {
  const rows = db.prepare(`
    SELECT date FROM streaks
    WHERE cards_reviewed > 0
    ORDER BY date DESC
    LIMIT 366
  `).all() as any[];

  if (rows.length === 0) return 0;

  // check if today or yesterday has activity (streak still alive)
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (rows[0].date !== today && rows[0].date !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < rows.length; i++) {
    const prev = new Date(rows[i - 1].date);
    const curr = new Date(rows[i].date);
    const diffDays = (prev.getTime() - curr.getTime()) / 86400000;
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
