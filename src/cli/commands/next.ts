import { nextDue } from "../../core/queue.js";
import { upsertLearner } from "../../core/learners.js";
import { parseArgs, out, die } from "../args.js";

export async function runNext(argv: string[]): Promise<void> {
  const { flags } = parseArgs(argv);
  const learnerId = String(flags["learner"] ?? "default");
  const tag = flags["tag"] ? String(flags["tag"]) : undefined;
  const limit = flags["limit"] ? Number(flags["limit"]) : 1;
  const pretty = flags["pretty"] === true;

  if (isNaN(limit) || limit < 1) die("--limit must be a positive integer");

  upsertLearner({ id: learnerId });
  const items = nextDue({ learnerId, limit, tag });
  out(items, pretty);
}
