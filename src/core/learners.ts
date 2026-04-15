import db from "../db/connection.js";
import type { Learner, LearnerId, LearnerConfig } from "./types.js";

export function upsertLearner(input: { id: LearnerId; displayName?: string }): Learner {
  db.prepare(`
    INSERT INTO learners (id, display_name)
    VALUES (?, ?)
    ON CONFLICT(id) DO UPDATE SET
      display_name = COALESCE(excluded.display_name, display_name)
  `).run(input.id, input.displayName ?? null);

  // ensure config row exists with defaults
  db.prepare(`
    INSERT OR IGNORE INTO learner_config (learner_id) VALUES (?)
  `).run(input.id);

  return getLearner(input.id)!;
}

export function getLearner(id: LearnerId): Learner | null {
  const row = db.prepare("SELECT * FROM learners WHERE id = ?").get(id) as any;
  if (!row) return null;
  return { id: row.id, displayName: row.display_name, createdAt: row.created_at };
}

export function listLearners(): Learner[] {
  return (db.prepare("SELECT * FROM learners ORDER BY created_at").all() as any[]).map((r) => ({
    id: r.id,
    displayName: r.display_name,
    createdAt: r.created_at,
  }));
}

export function getConfig(learnerId: LearnerId): LearnerConfig {
  const row = db.prepare("SELECT * FROM learner_config WHERE learner_id = ?").get(learnerId) as any;
  if (!row) {
    // auto-create defaults if learner exists
    db.prepare("INSERT OR IGNORE INTO learner_config (learner_id) VALUES (?)").run(learnerId);
    return getConfig(learnerId);
  }
  return {
    learnerId: row.learner_id,
    dailyNewLimit: row.daily_new_limit,
    dailyReviewLimit: row.daily_review_limit,
    targetRetention: row.target_retention,
    tzOffsetMinutes: row.tz_offset_minutes,
    fsrsWeights: row.fsrs_weights ? JSON.parse(row.fsrs_weights) : null,
    agentPrompt: row.agent_prompt ?? null,
  };
}

export function updateConfig(
  learnerId: LearnerId,
  patch: Partial<Omit<LearnerConfig, "learnerId">>,
): LearnerConfig {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.dailyNewLimit !== undefined) { fields.push("daily_new_limit = ?"); values.push(patch.dailyNewLimit); }
  if (patch.dailyReviewLimit !== undefined) { fields.push("daily_review_limit = ?"); values.push(patch.dailyReviewLimit); }
  if (patch.targetRetention !== undefined) { fields.push("target_retention = ?"); values.push(patch.targetRetention); }
  if (patch.tzOffsetMinutes !== undefined) { fields.push("tz_offset_minutes = ?"); values.push(patch.tzOffsetMinutes); }
  if (patch.fsrsWeights !== undefined) {
    fields.push("fsrs_weights = ?");
    values.push(patch.fsrsWeights !== null ? JSON.stringify(patch.fsrsWeights) : null);
  }
  if (patch.agentPrompt !== undefined) {
    fields.push("agent_prompt = ?");
    values.push(patch.agentPrompt ?? null);
  }

  if (fields.length > 0) {
    values.push(learnerId);
    db.prepare(`UPDATE learner_config SET ${fields.join(", ")} WHERE learner_id = ?`).run(...values);
  }

  return getConfig(learnerId);
}
