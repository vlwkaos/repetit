#!/usr/bin/env bun
import { runNext } from "./commands/next.js";
import { runRate } from "./commands/rate.js";
import { runItems } from "./commands/items.js";
import { runLearners } from "./commands/learners.js";
import { runQueue } from "./commands/queue.js";
import { runStudy } from "./commands/study.js";
import { runMcp } from "../mcp/server.js";
import { runServe } from "./commands/serve.js";

const [,, cmd, ...rest] = process.argv;

function usage(): never {
  console.error([
    "Usage: repetit <command> [options]",
    "",
    "Commands:",
    "  study      [--learner <id>] [--tag <tag>] [--limit <n>]",
  "  next       [--learner <id>] [--tag <tag>] [--limit <n>]",
    "  rate       <uid> <again|hard|good|easy> [--learner <id>] [--ms <n>]",
    "  queue      [--learner <id>] [--tag <tag>]",
    "  items      import <file|-> | list [--tag <tag>] | get <uid>",
    "  learners   add <id> [--name <name>] [--tz <offset_minutes>]",
    "             list",
    "             config <id> [--new-limit <n>] [--review-limit <n>] [--retention <f>] [--tz <n>]",
    "  mcp        Start stdio MCP server",
    "  serve      [--port <n>]  Start HTTP server",
    "",
    "Output: JSON to stdout. Use --pretty for human-readable output.",
  ].join("\n"));
  process.exit(1);
}

switch (cmd) {
  case "next":     await runNext(rest); break;
  case "rate":     await runRate(rest); break;
  case "queue":    await runQueue(rest); break;
  case "items":    await runItems(rest); break;
  case "learners": await runLearners(rest); break;
  case "study":    await runStudy(rest); break;
  case "mcp":      await runMcp(); break;
  case "serve":    await runServe(rest); break;
  default:         usage();
}
