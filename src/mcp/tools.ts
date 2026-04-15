// MCP tool definitions mirroring the CLI surface
// SDK docs: https://github.com/modelcontextprotocol/typescript-sdk

export const TOOLS = [
  {
    name: "get_next",
    description: "Get the next due item(s) for a learner. Returns { agentPrompt, items } — agentPrompt carries the learner's configured agent instructions; each item includes agentNotes (running summary) and lastReview (rating, ratedAt, metadata from previous session).",
    inputSchema: {
      type: "object" as const,
      properties: {
        learner_id: { type: "string", description: "Learner identifier (e.g. telegram chat_id, agent session id)" },
        tag:        { type: "string", description: "Filter items by tag" },
        limit:      { type: "number", description: "Max items to return (default 1)" },
      },
      required: ["learner_id"],
    },
  },
  {
    name: "submit_review",
    description: "Record a rating for a reviewed item. Channel decides the rating based on user's answer. Include metadata with your assessment and agent_notes for a running summary — both are returned in future get_next calls so context survives session loss.",
    inputSchema: {
      type: "object" as const,
      properties: {
        learner_id:  { type: "string" },
        uid:         { type: "string", description: "Item uid from get_next" },
        rating:      { type: "number", enum: [1, 2, 3, 4], description: "1=Again 2=Hard 3=Good 4=Easy" },
        elapsed_ms:  { type: "number", description: "Time the learner spent on this item (optional)" },
        metadata:    { description: "Opaque JSON — agent's per-review assessment (e.g. { note, misconceptions, confidence })" },
        agent_notes: { type: "string", description: "Mutable running summary for this item; overwrites previous value; returned in next get_next call" },
      },
      required: ["learner_id", "uid", "rating"],
    },
  },
  {
    name: "import_items",
    description: "Bulk upsert items. Idempotent by uid.",
    inputSchema: {
      type: "object" as const,
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              uid:     { type: "string" },
              tags:    { type: "array", items: { type: "string" } },
              payload: { description: "Opaque JSON — any shape the channel needs" },
            },
            required: ["uid", "payload"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "list_items",
    description: "List items, optionally filtered by tag.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tag:   { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "import_apkg",
    description: "Import cards from an Anki .apkg export file. Returns count of upserted items, skipped notes, and deck names found.",
    inputSchema: {
      type: "object" as const,
      properties: {
        path:        { type: "string", description: "Absolute path to the .apkg file" },
        deck_filter: { type: "string", description: "Only import cards from decks whose name contains this string (case-insensitive)" },
      },
      required: ["path"],
    },
  },
  {
    name: "get_due_counts",
    description: "Get the count of new and due items for a learner.",
    inputSchema: {
      type: "object" as const,
      properties: {
        learner_id: { type: "string" },
        tag:        { type: "string" },
      },
      required: ["learner_id"],
    },
  },
] as const;
