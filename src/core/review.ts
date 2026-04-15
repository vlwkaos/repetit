// Ported and generalized from server/api/reviews.ts
import db from "../db/connection.js";
import { createScheduler, newCard, scheduleCard, hydrateCard, Rating } from "./fsrs.js";
import { getConfig } from "./learners.js";
import type { LearnerId, ItemUid, Rating as RatingType, ReviewResult } from "./types.js";

export function recordReview(args: {
  learnerId: LearnerId;
  uid: ItemUid;
  rating: RatingType;
  elapsedMs?: number;
  now?: Date;
  metadata?: unknown;
  agentNotes?: string;
}): ReviewResult {
  const { learnerId, uid, rating, elapsedMs, now = new Date(), metadata, agentNotes } = args;

  if (rating < 1 || rating > 4) throw new Error(`Invalid rating ${rating}: must be 1-4`);

  const item = db.prepare("SELECT uid FROM items WHERE uid = ?").get(uid);
  if (!item) throw new Error(`Item not found: ${uid}`);

  const learner = db.prepare("SELECT id FROM learners WHERE id = ?").get(learnerId);
  if (!learner) throw new Error(`Learner not found: ${learnerId}`);

  const config = getConfig(learnerId);
  const scheduler = createScheduler(config.fsrsWeights ?? undefined, config.targetRetention);

  // ensure learner_state row exists
  db.prepare(`
    INSERT OR IGNORE INTO learner_states (learner_id, item_uid) VALUES (?, ?)
  `).run(learnerId, uid);

  const stateRow = db.prepare(
    "SELECT fsrs_state FROM learner_states WHERE learner_id = ? AND item_uid = ?"
  ).get(learnerId, uid) as any;

  // ^ ts-fsrs requires Date objects; hydrateCard converts strings after JSON.parse
  const fsrsCard = stateRow?.fsrs_state
    ? hydrateCard(JSON.parse(stateRow.fsrs_state))
    : newCard(now);

  const result = scheduleCard(scheduler, fsrsCard, rating as Rating, now);
  const next = result.card;
  const nextDueAt = next.due instanceof Date ? next.due.toISOString() : String(next.due);

  db.prepare(`
    UPDATE learner_states
    SET fsrs_state = ?, due_at = ?, last_reviewed_at = ?,
        agent_notes = CASE WHEN ? IS NOT NULL THEN ? ELSE agent_notes END
    WHERE learner_id = ? AND item_uid = ?
  `).run(JSON.stringify(next), nextDueAt, now.toISOString(), agentNotes ?? null, agentNotes ?? null, learnerId, uid);

  db.prepare(`
    INSERT INTO reviews (learner_id, item_uid, rating, elapsed_ms, stability, difficulty, state, reviewed_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(learnerId, uid, rating, elapsedMs ?? null, next.stability, next.difficulty, Number(next.state), now.toISOString(), metadata !== undefined ? JSON.stringify(metadata) : null);

  return {
    nextDueAt,
    stability: next.stability,
    difficulty: next.difficulty,
    state: Number(next.state),
  };
}
