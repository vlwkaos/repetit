import type { Rating } from "../core/types.js";

/** Maps rating words (and single-letter shortcuts) to FSRS rating numbers. */
export const RATING_MAP: Record<string, Rating> = {
  again: 1, a: 1,
  hard:  2, h: 2,
  good:  3, g: 3,
  easy:  4, e: 4,
};

/** Human label for each rating number. */
export const RATING_LABELS: Record<number, string> = { 1: "Again", 2: "Hard", 3: "Good", 4: "Easy" };

/** Minimal flag parser — no deps. Returns named flags and positional args. */
export function parseArgs(argv: string[]): { flags: Record<string, string | true>; pos: string[] } {
  const flags: Record<string, string | true> = {};
  const pos: string[] = [];
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = true;
        i++;
      }
    } else {
      pos.push(arg);
      i++;
    }
  }
  return { flags, pos };
}

export function out(data: unknown, pretty: boolean): void {
  console.log(pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data));
}

export function die(msg: string): never {
  process.stderr.write(JSON.stringify({ error: msg }) + "\n");
  process.exit(1);
}
