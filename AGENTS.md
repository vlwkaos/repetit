# repetit — Agent Notes

## good-to-go

Recurring audit axes (auto-maintained by /good-to-go):

- **`nextDue` return type propagation**: `nextDue` returns `SessionResult` (not `Item[]`). Any caller that destructures or iterates the result must use `.items`. Check: `study.ts`, `mcp/server.ts`, HTTP route, CLI `next.ts`. Regression risk: high — type is `SessionResult` but TS won't catch naive `.length` calls if typed loosely.
- **MCP tool schema vs implementation parity**: Each MCP tool in `tools.ts` must expose all parameters that `mcp/server.ts` actually reads. When adding fields to `recordReview` or `nextDue`, update both `server.ts` (handler) and `tools.ts` (schema + description) together.
- **Dead imports after refactor**: When changing a CLI command to use `upsertLearner` instead of `getLearner`, remove `getLearner` from the import. Check for unused imports in `src/cli/commands/` after any learner.ts change.
- **README command surface**: `README.md` must reflect all CLI flags (`--meta`, `--agent-notes`, `--agent-prompt`) and HTTP body fields (`metadata`, `agentNotes`, `agentPrompt`). Check after any flag addition.
- **Column migration for existing DBs**: New columns added to `schema.sql` must also have an `addColumnIfMissing` call in `connection.ts`. Schema handles fresh DBs; migration handles existing `data/repetit.db`. Both must be updated together.
- **FSRS timing in CLI/HTTP tests**: After rating `again`, `due_at` is set ~1 minute in the future — not immediately due. Tests that call `next` right after rating `again` expecting the item back will fail. Use core tests with controlled `now` for timing-sensitive assertions; CLI/HTTP tests should only verify status codes and data acceptance.
