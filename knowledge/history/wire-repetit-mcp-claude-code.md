---
slug: wire-repetit-mcp-claude-code
kind: history
branch: ankimo
completed: 2026-04-16
---
# Wire repetit mcp into Claude Code

## Summary

Added `bun run mcp` script to `package.json` and created `.claude/settings.json` with `bun run mcp` + `cwd` so Claude Code can spawn the repetit MCP server from the project directory without a hardcoded source path.

## Key Decisions

- Use `bun run mcp` (package.json script) + `cwd` instead of `"args": ["src/cli/main.ts", "mcp"]` — keeps the file path out of the committed settings
- Project-level `settings.json` (team-visible) is acceptable for now since the `cwd` is the only machine-specific part; after publishing, `bunx repetit mcp` removes the machine dependency entirely
- MCP stdio transport requires no daemon — Claude Code manages the process lifecycle

## Knowledge Created/Updated

- `coding/repetit-mcp.md` — stdio MCP setup, tools list, Claude Code config pattern

## Implementation Notes

Clarified that stdio MCP servers do not run as daemons. Claude Code spawns the process fresh and keeps it alive for the session duration. Config uses `cwd` to resolve `bun run mcp` from the right directory.
