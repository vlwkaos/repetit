---
slug: repetit-mcp
kind: coding
description: MCP stdio server setup and Claude Code integration for repetit
keywords: mcp, stdio, daemon, settings.json, bun run mcp, cwd, claude-code
created: "2026-04-16T09:47:58"
modified: "2026-04-16T09:47:58"
---

# repetit MCP

`repetit mcp` starts a stdio MCP server. Claude Code spawns it fresh per session — no daemon, no port, no manual startup.

## Tools exposed (6)

`get_next`, `submit_review`, `import_items`, `list_items`, `get_due_counts`, `import_apkg`

## Claude Code config

Project-level (`.claude/settings.json`) using `bun run mcp` + `cwd` to avoid hardcoding the source path:

```json
{
  "mcpServers": {
    "repetit": {
      "command": "bun",
      "args": ["run", "mcp"],
      "cwd": "/path/to/ankimo"
    }
  }
}
```

After publishing, use `bunx repetit mcp` (no cwd needed).

## How stdio MCP works

Claude Code reads the `mcpServers` config, spawns the process with stdin/stdout piped, and sends JSON-RPC messages. The process handles requests and stays alive for the session. Claude Code manages lifecycle.

## Package script

`package.json` has `"mcp": "bun src/cli/main.ts mcp"` so `bun run mcp` works from the project root.
