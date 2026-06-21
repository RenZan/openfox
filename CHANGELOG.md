# Changelog

## [2.0.0] - 2026-06-21

### Multi-Turn Agent Engine (MTAE)

The agent loop has been completely rewritten around a simpler, composable architecture where the EventStore is the single source of truth.

- **Unified agent loop** — All modes (builder, planner, verifier, sub-agents, compaction) run through the same `runAgentTurn` loop. No more nested loops, no hardcoded planner.
- **EventStore as SSOT** — The loop never imports the EventStore directly. State is derived from events, not persisted directly.
- **Compaction in the same loop** — Compaction reuses the same agent loop with `mode: 'compaction'`. No separate compaction loop.
- **System prompt caching decoupled** — Moved out of the agent loop into its own concern.
- **Drain queue extracted** — `drainQueue` is now a standalone function.
- **Dead code removed** — `nudge-helpers.ts`, `verifier-helpers.ts`, `orchestrator-verifier.test.ts`, `runVerifierTurn`, `toolMode`, custom sub-agent loop all deleted.
- **Agent definition injection simplified** — Event-driven, no state tracking, `getAllEvents` API.
- **New docs**: `docs/MTAE-ARCHITECTURE.md` (476 lines), `docs/ENGINE-LOOP.md` (406 lines).

### Provider & LLM Configuration

- **Comprehensive provider dialog** — New `ProviderModal` component with model selection, thinking config, editable kwargs, profile defaults display, and preset management.
- **`reasoningEffort` replaces `disableThinking`** — The old boolean toggle is replaced by a proper `reasoningEffort` field (`low`/`medium`/`high`/`none`), supported across CLI, server, and UI.
- **Local provider badge** — Providers now have an `isLocal` attribute, displayed as a badge in the UI.
- **`detectBackend` removed** — The `auto` sentinel is replaced with `unknown`. Backend detection logic simplified.
- **URL version-prefix logic** — Extracted into shared `src/server/llm/url-utils.ts`.
- **Session title generation** — Now respects thinking/non-thinking model configuration.
- **Thinking blocks in chat feed** — Fixed a bug where thinking blocks were dropped during streaming.

### Auto-Retry Pattern System

- **Configurable auto-retry patterns** — Replaced the hardcoded "Disable XML Tool Call Protection" toggle with a user-configurable pattern matching system.
- **Pattern editor UI** — New `RetryPatternsEditor` component in Advanced settings tab. Users define patterns (field, regex, active toggle) that trigger automated retries.
- **Built-in defaults** — The old XML format error detection is now a built-in default pattern that users can see and optionally deactivate.
- **Retry limiter** — New `retry-limiter.ts` prevents infinite retry loops.
- **New doc**: `docs/DESIGN-AUTO-RETRY-PATTERNS.md`.

### Unified Image Handling

- **Pre-turn context processor** — A single entry point processes all images before each LLM call, replacing scattered handling across attachment stripping, vision fallback, and `read_file` tool results.
- **Vision model fallback** — When using a non-vision model, images are automatically described by a configured vision model. The description replaces raw image data in context.
- **New files**: `src/server/context/image-processor.ts`, `image-processor.test.ts`.
- **New doc**: `docs/DESIGN-UNIFIED-IMAGE-HANDLING.md`.

### Session Metadata & Criteria

- **Unified `session_metadata` tool** — The old `criterion` and `todo` tools are replaced by a single `session_metadata` tool with CRUD operations.
- **Progress → Criteria rename** — "Progress" is now "Criteria" throughout the UI, with status counts and a more compact list.
- **Interactive criteria editor** — Inline editing, CRUD operations, info modal, agent badges for who created each criterion.
- **Review findings locking** — The `finalize` step is now locked until all review findings are resolved. Generic metadata conditions supported.

### Workflow Engine

- **Code review phase** — Added as a standard phase in the build-verify workflow.
- **Workflow sub-groups** — Individual steps can now run in isolation within sub-groups.
- **Summarize step** — New step type for generating summaries.
- **Workflow editor fixes** — Various improvements to the workflow editor UI.
- **`run_command` for code reviewer** — The code reviewer sub-agent now has access to `run_command`.
- **Code reviewer prompt** — Updated to focus on git diff rather than full file review.

### UI/UX

- **Open/New Project buttons** — Added to the project dropdown for quick access.
- **Keybinding fixes** — Keyboard shortcuts now load correctly on app start.
- **Theme loading fixes** — Theme persistence and loading edge cases resolved.
- **Firefox scrollbars** — Custom thin scrollbars with hover behavior, compatible with Firefox.
- **Mobile UI cleanup** — Responsive improvements and dead code removal.
- **DropdownMenu component** — New shared dropdown component used across the UI.
- **PR #19 review** — Addressed all concerns from the PR review.

### Bug Fixes

- **`edit_file` race condition** — Fixed parallel `edit_file` calls causing conflicts with a per-file mutex system.
- **Provider modal step reset** — Fixed step index resetting on parent re-render.
- **Thinking blocks dropped** — Fixed streaming buffer issue where thinking blocks were lost.
- **undici dependency** — Added `undici` as a direct dependency to resolve missing module errors.
- **tsup config** — Fixed build configuration for proper bundling.
- **Update flow** — Fixed `KillMode=control-group` for systemd service, service detection via `OPENFOX_SERVICE` env var, two distinct UI paths for update scenarios.
- **Auto-compaction summary** — Summary messages now use `isCompactionSummary` flag for proper rendering.

### Maintenance

- **Dependency cleanup** — `package-lock.json` reduced from ~2,000 lines to ~250 lines after removing unused dependencies.
- **TypeScript strictness** — Full strict mode with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`.

### Full Commit Log

59 commits, 214 files changed, ~11,000 insertions, ~10,600 deletions since v1.6.103.

---

## [1.6.103] - 2026-05-XX

- Fix: auto-increase Node.js heap limit to prevent OOM on startup

## [1.6.102] - 2026-05-XX

- Fix: Shiki flickering — highlight cache, memoized CodeBlock, ref pattern for async highlighting
- Feat: dynamic system prompt caching with on-demand refresh
- Chore: add web frontend coverage to vitest config

## [1.6.101] - 2026-05-XX

- Fix: git status watcher not detecting working tree changes
- Test: git status watcher tests with configurable polling interval
