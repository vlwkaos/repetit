# repetit

Headless spaced repetition service. Domain: `(learner_id, item_uid) → FSRS state + rating history`.

Items carry opaque JSON payloads. Any channel (CLI, Telegram bot, agent skill, web) attaches as a client, runs the interactive dialog, decides the rating, and sends it back. The server schedules and persists; it never judges answers.

Stack: Bun + bun:sqlite + ts-fsrs.

## Commands

```
repetit learners add <id> [--name NAME] [--tz OFFSET_MINUTES]
repetit learners list
repetit learners config <id> [--new-limit N] [--review-limit N] [--retention 0.9] [--tz N]
                            [--agent-prompt TEXT]

repetit items import <file.json|->   # [{uid, tags?, payload}, ...] JSON array
repetit items list [--tag TAG]
repetit items get <uid>

repetit next  [--learner <id>] [--tag TAG] [--limit N]
              → { agentPrompt, items: [{ uid, payload, tags, agentNotes, lastReview }] }
repetit rate  <uid> again|hard|good|easy [--learner <id>] [--ms N]
              [--meta JSON] [--agent-notes TEXT]
repetit queue [--learner <id>] [--tag TAG]

repetit mcp          # stdio MCP server (for Claude Code / agent use)
repetit serve        # HTTP server (default :3000, set PORT env or --port)
```

All commands output JSON. Use `--pretty` for human-readable output. Errors go to stderr as `{"error":"..."}`, exit 1.

`--learner` defaults to `"default"` if omitted.

### Agent context fields

`repetit next` returns a session envelope that lets agents resume cold without losing context:

| Field | Where | Purpose |
|---|---|---|
| `agentPrompt` | top-level | Learner-configured instructions for the agent (role, metadata schema, behavior) |
| `agentNotes` | per item | Mutable running summary written by the agent on each `rate` call |
| `lastReview` | per item | `{ rating, ratedAt, metadata }` — the agent's last per-review assessment |

Set the prompt: `repetit learners config alice --agent-prompt "You are a C++ tutor. Fill metadata: { note, misconceptions[], confidence }"`

Record notes: `repetit rate q:1 good --agent-notes "Strong on concept, weak on edge cases." --meta '{"confidence":"medium"}'`

## Quickstart

```bash
bun install
repetit learners add alice
echo '[{"uid":"q:1","tags":["demo"],"payload":{"front":"What is RAII?","back":"Resource Acquisition Is Initialization"}}]' \
  | repetit items import -
repetit next --learner alice --tag demo
repetit rate q:1 good --learner alice
repetit queue --learner alice
```

## MCP setup (Claude Code)

Add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "repetit": {
      "command": "bun",
      "args": ["run", "/path/to/ankimo/src/cli/main.ts", "mcp"]
    }
  }
}
```

Tools exposed: `get_next`, `submit_review`, `import_items`, `list_items`, `get_due_counts`.

## HTTP server

```bash
repetit serve --port 3000
# or: PORT=3000 repetit serve
```

All routes require `X-Learner-Id` header. Learner is auto-created on first request.

| Method | Path | Notes |
|---|---|---|
| POST | /items | `[{uid, tags?, payload}]` |
| GET | /items/:uid | |
| GET | /items | `?tag=&limit=` |
| GET | /next | `?tag=&limit=` |
| POST | /rate | `{uid, rating, elapsedMs?, metadata?, agentNotes?}` |
| GET | /queue | `?tag=` |
| GET | /learners/me | |
| PATCH | /learners/me/config | `{dailyNewLimit?, dailyReviewLimit?, targetRetention?, tzOffsetMinutes?, agentPrompt?}` |
| GET | /healthz | |

## Data

DB lives at `data/repetit.db`. Set `REPETIT_DB=:memory:` for testing or ephemeral use.

Legacy data from the previous ankimo webapp is preserved at `data/_legacy/`.

## Tests

```bash
bun test
```

Tests use an in-memory DB (set via `bunfig.toml` preload). No real DB is touched.
