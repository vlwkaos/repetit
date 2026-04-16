import { createInterface } from "readline";
import { nextDue } from "../../core/queue.js";
import { recordReview } from "../../core/review.js";
import { upsertLearner } from "../../core/learners.js";
import { parseArgs, RATING_MAP, RATING_LABELS } from "../args.js";
import type { Rating } from "../../core/types.js";

function println(s = "") { process.stdout.write(s + "\n"); }
function stripHtml(s: string) { return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"); }

export async function runStudy(argv: string[]): Promise<void> {
  const { flags } = parseArgs(argv);
  const learnerId = String(flags["learner"] ?? "default");
  const tag = flags["tag"] ? String(flags["tag"]) : undefined;
  const limit = flags["limit"] ? Number(flags["limit"]) : 20;

  upsertLearner({ id: learnerId });
  const { items } = nextDue({ learnerId, limit, tag });

  if (items.length === 0) {
    println("Nothing due. Come back later.");
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });

  // ^ Buffer lines so piped input works — readline may emit 'line' before question() is called
  const lineQueue: string[] = [];
  const waiters: Array<(line: string) => void> = [];
  rl.on("line", (line) => {
    if (waiters.length > 0) waiters.shift()!(line);
    else lineQueue.push(line);
  });

  const ask = (prompt: string): Promise<string> => {
    process.stdout.write(prompt);
    return new Promise((resolve) => {
      if (lineQueue.length > 0) resolve(lineQueue.shift()!);
      else waiters.push(resolve);
    });
  };

  println(`\nStarting session — ${items.length} card(s)  [learner: ${learnerId}${tag ? `, tag: ${tag}` : ""}]`);
  println("Ratings: again(a)  hard(h)  good(g)  easy(e)  quit(q)\n");

  let reviewed = 0;

  for (const item of items) {
    const payload = item.payload as any;
    const front = stripHtml(payload?.front ?? JSON.stringify(item.payload));
    const back  = stripHtml(payload?.back  ?? "(no back)");

    println("─".repeat(60));
    println(`[${reviewed + 1}/${items.length}]  ${item.uid}`);
    println();
    println(front);
    println();

    const entered = await ask("  ↵ to reveal  ");
    if (entered.trim().toLowerCase() === "q") break;

    println();
    println(back);
    println();

    let rating: Rating | undefined;
    let quit = false;
    while (!rating) {
      const input = await ask("  Rating (a/h/g/e): ");
      if (input.trim().toLowerCase() === "q") { quit = true; break; }
      rating = RATING_MAP[input.trim().toLowerCase()];
      if (!rating) println("  → again, hard, good, easy  (or a/h/g/e)");
    }
    if (quit) break;

    const result = recordReview({ learnerId, uid: item.uid, rating });
    const diffMin = Math.round((new Date(result.nextDueAt).getTime() - Date.now()) / 60000);
    const when = diffMin < 60 ? `${diffMin}m` : diffMin < 1440 ? `${Math.round(diffMin / 60)}h` : `${Math.round(diffMin / 1440)}d`;

    println(`  ${RATING_LABELS[rating]} → next in ${when}  (stability: ${result.stability.toFixed(2)})`);
    reviewed++;
    println();
  }

  rl.close();
  println("─".repeat(60));
  println(`Session done. Reviewed ${reviewed}/${items.length} cards.`);
}
