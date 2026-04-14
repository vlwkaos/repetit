import { recordReview } from "../../core/review.js";
import { upsertLearner } from "../../core/learners.js";
import { parseArgs, out, die } from "../args.js";
import type { Rating } from "../../core/types.js";

const RATING_MAP: Record<string, Rating> = {
  again: 1, hard: 2, good: 3, easy: 4,
};

export async function runRate(argv: string[]): Promise<void> {
  const { flags, pos } = parseArgs(argv);
  const [uid, ratingLabel] = pos;
  const learnerId = String(flags["learner"] ?? "default");
  const elapsedMs = flags["ms"] ? Number(flags["ms"]) : undefined;
  const pretty = flags["pretty"] === true;

  if (!uid) die("uid required");
  if (!ratingLabel) die("rating required: again | hard | good | easy");

  const rating = RATING_MAP[ratingLabel.toLowerCase()];
  if (!rating) die(`Unknown rating "${ratingLabel}": use again, hard, good, or easy`);

  upsertLearner({ id: learnerId });
  try {
    const result = recordReview({ learnerId, uid, rating, elapsedMs });
    out(result, pretty);
  } catch (e: any) {
    die(e.message ?? String(e));
  }
}
