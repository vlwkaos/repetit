# repetit — Plan

## Active

- [ ] Tag v0.1.0 and verify GitHub Actions release workflow builds binaries
- [ ] Update Homebrew formula SHA256 after first release
- [ ] Telegram adapter (channel → core lib calls)
- [ ] Ankimo-markdown importer (reuse server/importers/markdown.ts logic, emit JSON for `repetit items import`)

## Backlog

- [ ] Cloze note splitting (one note → N cards per cloze number)
- [ ] fsrs-optimizer export (reviews CSV → personalized weights → `repetit learners config --weights`)
- [ ] HTTP auth (API key, for non-localhost deployments)
- [ ] Multi-deck grouping beyond tags
- [ ] Study session state tracking (for multi-round banter support in channels)
- [ ] Media extraction from .apkg (images/audio → local cache, HTTP serving)

## Done

- [x] v1 ship prep: pre-release cleanup, release pipeline, Anki improvements (2026-04-18)
  - Removed `private: true`; added `build` script for `bun build --compile`
  - GitHub Actions release workflow: mac-arm64, mac-x64, linux-x64 binaries on tag
  - Homebrew formula in vlwkaos/homebrew-tap
  - DB default moved to `~/.local/share/repetit/repetit.db` (XDG, works compiled)
  - `htmlToText` + cloze awareness in `src/importers/anki-utils.ts`; used in apkg.ts and study.ts
  - RATING_MAP/RATING_LABELS extracted to shared args.ts
- [x] Wire `repetit mcp` into Claude Code settings (project `.claude/settings.json`, `bun run mcp` + cwd) (2026-04-16)
- [x] v1: core lib + CLI + MCP server + HTTP server + tests (2026-04-14)
  - Schema: learners, items (opaque payload), learner_states, reviews, learner_config
  - FSRS scheduling via ts-fsrs@4.7.1; multi-learner; per-learner tz offset
  - `repetit mcp` stdio MCP server (6 tools); HTTP X-Learner-Id header
  - .apkg importer (fflate + bun:sqlite deserialize, deck tags, extra_fields)
  - Agent context: metadata, agentNotes, agentPrompt through all surfaces
  - 82 tests passing
