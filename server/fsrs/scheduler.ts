import db from "../db/connection.js";
import { createScheduler, newCard, type Card } from "./index.js";

interface StudyCard {
  id: number;
  deck_id: number;
  type: string;
  front: string;
  back: string;
  front_raw: string | null;
  back_raw: string | null;
  target_word: string | null;
  target_reading: string | null;
  audio_native: string | null;
  audio_sentence: string | null;
  speech_target: string | null;
  speech_accept: string | null;
  context_sentence: string | null;
  situation: string | null;
  fsrs_state: string | null;
  due_at: string | null;
}

export interface StudyQueue {
  cards: StudyCard[];
  newCount: number;
  reviewCount: number;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getStudyQueue(deckId: number): StudyQueue {
  const today = todayStr();
  const now = new Date().toISOString();

  // load config: deck-specific or global fallback
  const config = db.prepare(`
    SELECT * FROM learning_config
    WHERE deck_id = ? OR deck_id IS NULL
    ORDER BY deck_id DESC LIMIT 1
  `).get(deckId) as any;

  const dailyNewLimit = config?.daily_new_limit ?? 20;
  const dailyReviewLimit = config?.daily_review_limit ?? 200;

  // count today's reviews
  const todayReviews = db.prepare(`
    SELECT
      SUM(CASE WHEN c.fsrs_state IS NULL OR json_extract(c.fsrs_state, '$.state') = 0 THEN 0 ELSE 1 END) as review_count,
      SUM(CASE WHEN c.fsrs_state IS NULL OR json_extract(c.fsrs_state, '$.state') = 0 THEN 1 ELSE 0 END) as new_count
    FROM reviews r
    JOIN cards c ON c.id = r.card_id
    WHERE r.reviewed_at >= ? AND c.deck_id = ?
  `).get(`${today}T00:00:00`, deckId) as any;

  const reviewedToday = todayReviews?.review_count ?? 0;
  const newStudiedToday = todayReviews?.new_count ?? 0;

  const remainingNew = Math.max(0, dailyNewLimit - newStudiedToday);
  const remainingReview = Math.max(0, dailyReviewLimit - reviewedToday);

  // fetch due review cards
  const reviewCards = db.prepare(`
    SELECT * FROM cards
    WHERE deck_id = ? AND fsrs_state IS NOT NULL AND due_at <= ?
    ORDER BY due_at ASC
    LIMIT ?
  `).all(deckId, now, remainingReview) as StudyCard[];

  // fetch new cards (no fsrs_state yet)
  const newCards = db.prepare(`
    SELECT * FROM cards
    WHERE deck_id = ? AND fsrs_state IS NULL
    ORDER BY chapter ASC, id ASC
    LIMIT ?
  `).all(deckId, remainingNew) as StudyCard[];

  // interleave: review first, then new
  const cards = [...reviewCards, ...newCards];

  return {
    cards,
    newCount: newCards.length,
    reviewCount: reviewCards.length,
  };
}

export function getDueCounts(deckId: number): { newCount: number; dueCount: number; totalCount: number } {
  const now = new Date().toISOString();

  const counts = db.prepare(`
    SELECT
      SUM(CASE WHEN fsrs_state IS NULL THEN 1 ELSE 0 END) as new_count,
      SUM(CASE WHEN fsrs_state IS NOT NULL AND due_at <= ? THEN 1 ELSE 0 END) as due_count,
      COUNT(*) as total_count
    FROM cards WHERE deck_id = ?
  `).get(now, deckId) as any;

  return {
    newCount: counts?.new_count ?? 0,
    dueCount: counts?.due_count ?? 0,
    totalCount: counts?.total_count ?? 0,
  };
}
