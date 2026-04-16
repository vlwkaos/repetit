// MCP stdio server — mirrors CLI surface
// SDK: @modelcontextprotocol/sdk@1.29.0
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { nextDue, getDueCounts } from "../core/queue.js";
import { recordReview } from "../core/review.js";
import { upsertItems, listItems } from "../core/items.js";
import { upsertLearner } from "../core/learners.js";
import { parseApkg } from "../importers/apkg.js";
import { TOOLS } from "./tools.js";
import type { Rating } from "../core/types.js";

export async function runMcp(): Promise<void> {
  const server = new Server(
    { name: "repetit", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;

    try {
      switch (name) {
        case "get_next": {
          const learnerId = String(args.learner_id);
          upsertLearner({ id: learnerId });
          const session = nextDue({
            learnerId,
            limit: args.limit != null ? Number(args.limit) : 1,
            tag: args.tag != null ? String(args.tag) : undefined,
          });
          return { content: [{ type: "text", text: JSON.stringify(session) }] };
        }

        case "submit_review": {
          const learnerId = String(args.learner_id);
          upsertLearner({ id: learnerId });
          const result = recordReview({
            learnerId,
            uid: String(args.uid),
            rating: Number(args.rating) as Rating,
            elapsedMs: args.elapsed_ms != null ? Number(args.elapsed_ms) : undefined,
            metadata: args.metadata ?? undefined,
            agentNotes: args.agent_notes != null ? String(args.agent_notes) : undefined,
          });
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        }

        case "import_items": {
          const items = args.items as Array<{ uid: string; tags?: string[]; payload: unknown }>;
          if (!Array.isArray(items)) throw new Error("items must be an array");
          const n = upsertItems(items);
          return { content: [{ type: "text", text: JSON.stringify({ upserted: n }) }] };
        }

        case "list_items": {
          const result = listItems({
            tag: args.tag != null ? String(args.tag) : undefined,
            limit: args.limit != null ? Number(args.limit) : undefined,
          });
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        }

        case "import_apkg": {
          const path = String(args.path);
          const deckFilter = args.deck_filter != null ? String(args.deck_filter) : undefined;
          const result = parseApkg(path, deckFilter);
          const n = upsertItems(result.items);
          return { content: [{ type: "text", text: JSON.stringify({ upserted: n, skipped: result.skipped, decks: result.decks }) }] };
        }

        case "get_due_counts": {
          const learnerId = String(args.learner_id);
          upsertLearner({ id: learnerId });
          const counts = getDueCounts({
            learnerId,
            tag: args.tag != null ? String(args.tag) : undefined,
          });
          return { content: [{ type: "text", text: JSON.stringify(counts) }] };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (e: any) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: e.message ?? String(e) }) }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
