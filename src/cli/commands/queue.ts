import { getDueCounts } from "../../core/queue.js";
import { upsertLearner } from "../../core/learners.js";
import { parseArgs, out, die } from "../args.js";

export async function runQueue(argv: string[]): Promise<void> {
  const { flags } = parseArgs(argv);
  const learnerId = String(flags["learner"] ?? "default");
  const tag = flags["tag"] ? String(flags["tag"]) : undefined;
  const pretty = flags["pretty"] === true;

  upsertLearner({ id: learnerId });
  const counts = getDueCounts({ learnerId, tag });
  out(counts, pretty);
}
