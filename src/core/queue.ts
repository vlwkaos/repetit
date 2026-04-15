// Ported and generalized from server/fsrs/scheduler.ts
import db from "../db/connection.js";
import { getConfig } from "./learners.js";
import { getItem } from "./items.js";
import type { LearnerId, DueCounts, SessionResult, ItemWithContext } from "./types.js";

/** Returns the learner's local date string (YYYY-MM-DD) accounting for tz_offset_minutes. */
function localDateStr(now: Date, tzOffsetMinutes: number): string {
  const local = new Date(now.getTime() + tzOffsetMinutes * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function nextDue(args: {
  learnerId: LearnerId;
  limit?: number;
  tag?: string;
  now?: Date;
}): SessionResult {
  const { learnerId, limit = 1, tag, now = new Date() } = args;
  const config = getConfig(learnerId);
  const today = localDateStr(now, config.tzOffsetMinutes);
  const dayStart = `${today}T00:00:00.000Z`;
  const nowIso = now.toISOString();

  // Count today's already-reviewed new vs review cards for this learner
  const todayCounts = db.prepare(`
    SELECT
      SUM(CASE WHEN ls.fsrs_state IS NULL OR json_extract(ls.fsrs_state, '$.state') = 0 THEN 1 ELSE 0 END) as new_count,
      SUM(CASE WHEN ls.fsrs_state IS NOT NULL AND json_extract(ls.fsrs_state, '$.state') != 0 THEN 1 ELSE 0 END) as review_count
    FROM reviews r
    JOIN learner_states ls ON ls.learner_id = r.learner_id AND ls.item_uid = r.item_uid
    WHERE r.learner_id = ? AND r.reviewed_at >= ?
  `).get(learnerId, dayStart) as any;

  const newStudiedToday = todayCounts?.new_count ?? 0;
  const reviewedToday = todayCounts?.review_count ?? 0;
  const remainingNew = Math.max(0, config.dailyNewLimit - newStudiedToday);
  const remainingReview = Math.max(0, config.dailyReviewLimit - reviewedToday);

  const tagJoin = tag
    ? `JOIN json_each(i.tags) t ON t.value = ?`
    : "";
  const tagParam = tag ? [tag] : [];

  // Due review cards (already seen, now due)
  const reviewRows = db.prepare(`
    SELECT DISTINCT i.uid
    FROM items i
    JOIN learner_states ls ON ls.item_uid = i.uid AND ls.learner_id = ?
    ${tagJoin}
    WHERE ls.fsrs_state IS NOT NULL AND ls.due_at <= ?
    ORDER BY ls.due_at ASC
    LIMIT ?
  `).all(learnerId, ...tagParam, nowIso, remainingReview) as { uid: string }[];

  // New items (no learner_state row yet, or state row with NULL fsrs_state)
  const newRows = db.prepare(`
    SELECT DISTINCT i.uid
    FROM items i
    ${tagJoin}
    WHERE i.uid NOT IN (
      SELECT item_uid FROM learner_states WHERE learner_id = ? AND fsrs_state IS NOT NULL
    )
    ORDER BY i.created_at ASC
    LIMIT ?
  `).all(...tagParam, learnerId, remainingNew) as { uid: string }[];

  const uids = [
    ...reviewRows.map((r) => r.uid),
    ...newRows.map((r) => r.uid),
  ].slice(0, limit);

  const items: ItemWithContext[] = uids.map((uid) => {
    const item = getItem(uid)!;
    const stateRow = db.prepare(
      "SELECT agent_notes FROM learner_states WHERE learner_id = ? AND item_uid = ?"
    ).get(learnerId, uid) as any;

    const lastReviewRow = db.prepare(`
      SELECT rating, reviewed_at, metadata
      FROM reviews
      WHERE learner_id = ? AND item_uid = ?
      ORDER BY reviewed_at DESC LIMIT 1
    `).get(learnerId, uid) as any;

    return {
      ...item,
      agentNotes: stateRow?.agent_notes ?? null,
      lastReview: lastReviewRow
        ? {
            rating: lastReviewRow.rating,
            ratedAt: lastReviewRow.reviewed_at,
            metadata: lastReviewRow.metadata ? JSON.parse(lastReviewRow.metadata) : null,
          }
        : null,
    };
  }).filter(Boolean);

  return { agentPrompt: config.agentPrompt, items };
}

export function getDueCounts(args: { learnerId: LearnerId; tag?: string; now?: Date }): DueCounts {
  const { learnerId, tag, now = new Date() } = args;
  const nowIso = now.toISOString();

  const tagJoin = tag ? `JOIN json_each(i.tags) t ON t.value = ?` : "";
  const tagParam = tag ? [tag] : [];

  const counts = db.prepare(`
    SELECT
      SUM(CASE WHEN ls.item_uid IS NULL OR ls.fsrs_state IS NULL THEN 1 ELSE 0 END) as new_count,
      SUM(CASE WHEN ls.fsrs_state IS NOT NULL AND ls.due_at <= ? THEN 1 ELSE 0 END) as due_count
    FROM items i
    ${tagJoin}
    LEFT JOIN learner_states ls ON ls.item_uid = i.uid AND ls.learner_id = ?
  `).get(nowIso, ...tagParam, learnerId) as any;

  return {
    newCount: counts?.new_count ?? 0,
    dueCount: counts?.due_count ?? 0,
  };
}
