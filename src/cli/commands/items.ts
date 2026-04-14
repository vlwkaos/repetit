import { upsertItems, getItem, listItems } from "../../core/items.js";
import { parseArgs, out, die } from "../args.js";
import { readFileSync } from "fs";
import { parseApkg } from "../../importers/apkg.js";

export async function runItems(argv: string[]): Promise<void> {
  const [sub, ...rest] = argv;
  const { flags, pos } = parseArgs(rest);
  const pretty = flags["pretty"] === true;

  switch (sub) {
    case "import": {
      const file = pos[0];
      if (!file) die("items import requires a file path or -");
      const raw = file === "-"
        ? readFileSync("/dev/stdin", "utf-8")
        : readFileSync(file, "utf-8");
      let arr: unknown;
      try { arr = JSON.parse(raw); } catch { die("Import file is not valid JSON"); }
      if (!Array.isArray(arr)) die("Import file must be a JSON array");
      for (const item of arr as unknown[]) {
        if (typeof (item as any)?.uid !== "string" || (item as any).payload === undefined) {
          die("Each item must have uid (string) and payload");
        }
      }
      const n = upsertItems(arr as Array<{ uid: string; tags?: string[]; payload: unknown }>);
      out({ upserted: n }, pretty);
      break;
    }
    case "list": {
      const tag = flags["tag"] ? String(flags["tag"]) : undefined;
      const limit = flags["limit"] ? Number(flags["limit"]) : undefined;
      out(listItems({ tag, limit }), pretty);
      break;
    }
    case "get": {
      const uid = pos[0];
      if (!uid) die("items get requires a uid");
      const item = getItem(uid);
      if (!item) die(`Item not found: ${uid}`);
      out(item, pretty);
      break;
    }
    case "import-apkg": {
      const file = pos[0];
      if (!file) die("items import-apkg requires a .apkg file path");
      const deck = flags["deck"] ? String(flags["deck"]) : undefined;
      try {
        const result = parseApkg(file, deck);
        const n = upsertItems(result.items);
        out({ upserted: n, skipped: result.skipped, decks: result.decks }, pretty);
      } catch (e: any) {
        die(e.message ?? String(e));
      }
      break;
    }
    default:
      die("items subcommand: import <file|-> | import-apkg <file.apkg> [--deck <name>] | list [--tag <tag>] | get <uid>");
  }
}
