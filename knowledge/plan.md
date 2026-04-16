# repetit — Plan

## Active

- [ ] Commit v1 and push to vlwkaos/repetit
- [x] Wire `repetit mcp` into Claude Code settings (project `.claude/settings.json`, `bun run mcp` + cwd)
- [ ] Telegram adapter (channel → core lib calls)
- [ ] Ankimo-markdown importer (reuse server/importers/markdown.ts logic, emit JSON for `repetit items import`)

## Backlog

- [ ] `.apkg` importer
- [ ] fsrs-optimizer export (reviews CSV → personalized weights → `repetit learners config --weights`)
- [ ] HTTP auth (API key, for non-localhost deployments)
- [ ] Multi-deck grouping beyond tags
- [ ] Study session state tracking (for multi-round banter support in channels)

## Done

- [x] v1: core lib + CLI + MCP server + HTTP server + tests (2026-04-14)
  - Schema: learners, items (opaque payload), learner_states, reviews, learner_config
  - FSRS scheduling via ts-fsrs@4.7.1
  - Multi-learner from day 1 (learner_id on all state/review rows)
  - Per-learner tz_offset_minutes for daily cap day-boundary
  - `repetit mcp` stdio MCP server (get_next, submit_review, import_items, list_items, get_due_counts)
  - HTTP: X-Learner-Id header, auto-upsert learner on first request
  - Tests: 21 pass, :memory: isolated via bunfig.toml preload
