import { upsertLearner, getLearner, listLearners, getConfig, updateConfig } from "../../core/learners.js";
import { parseArgs, out, die } from "../args.js";

export async function runLearners(argv: string[]): Promise<void> {
  const [sub, ...rest] = argv;
  const { flags, pos } = parseArgs(rest);
  const pretty = flags["pretty"] === true;

  switch (sub) {
    case "add": {
      const id = pos[0];
      if (!id) die("learners add requires an id");
      const name = flags["name"] ? String(flags["name"]) : undefined;
      const tz = flags["tz"] ? Number(flags["tz"]) : undefined;
      const learner = upsertLearner({ id, displayName: name });
      if (tz !== undefined) updateConfig(id, { tzOffsetMinutes: tz });
      out(learner, pretty);
      break;
    }
    case "list": {
      out(listLearners(), pretty);
      break;
    }
    case "config": {
      const id = pos[0];
      if (!id) die("learners config requires an id");
      if (!getLearner(id)) die(`Learner not found: ${id}`);
      const patch: Record<string, unknown> = {};
      if (flags["new-limit"]) patch.dailyNewLimit = Number(flags["new-limit"]);
      if (flags["review-limit"]) patch.dailyReviewLimit = Number(flags["review-limit"]);
      if (flags["retention"]) patch.targetRetention = Number(flags["retention"]);
      if (flags["tz"]) patch.tzOffsetMinutes = Number(flags["tz"]);
      const config = Object.keys(patch).length
        ? updateConfig(id, patch)
        : getConfig(id);
      out(config, pretty);
      break;
    }
    default:
      die("learners subcommand: add <id> | list | config <id>");
  }
}
