# Frontend implementation tracker

## Historical checkpoint

**Superseded:** F01 is committed in `229dd677e33a8b7c6e81ac31d75b34aa94ea728d` ("First front-end renewal pass F01"). F02/F03 are also committed, with historical evidence in [14](14-next-implementation-batch.md). The active batch is **F04 + F05**, tracked in [15-feedback-environment-batch.md](15-feedback-environment-batch.md). The user permits multiple tickets only when each is completed and tested. No commit for the current batch has been requested. The F01 details and original stop below are historical; follow 15 for the current stop/next action.

## F01 completed checkpoint (historical)

- Active implementation: **F01 — Journal save and attachment integrity**.
- Status: **implemented and browser-verified; awaiting user review**.
- Baseline HEAD: `8d3b35ecd778f30d52e40498509dc4beab056e42`.
- User instruction: finish one implementation, run Playwright and relevant checks, update this tracker, then stop. Do not start the next ticket or commit until the user reviews and explicitly requests it.
- Scope: source-backed findings `02/A03` and `02/A19`, including full/quick journal editors, success-bearing local saves, rich-text retention, duplicate submission, safe dismissal and attachment replacement.
- Next action: **STOP for user review. Do not commit or begin F02 until the user explicitly requests it.** If the user reports a problem, fix F01, rerun affected tests and refresh this checkpoint.

This file is the detailed implementation checkpoint requested after the original planning pass. The summary ledger remains in [09](09-execution-plan.md), and [11](11-agent-handoff.md) links here. Resume from this checkpoint; do not infer approval for another ticket from completed tests.

## Worktree at start

The original planning documents and skill changes were uncommitted. Additional pre-existing changes were present in `.gitignore`, `package.json`, `package-lock.json`, `.github/workflows/playwright.yml`, root `playwright.config.ts`, and `e2e/`. The Playwright dependency had changed from `^1.61.0` to `^1.63.0`. Preserve these changes; they are not part of this implementation. Dedicated F01 tests use their own configuration under `tests/playwright` and do not replace the new root setup.

## Discovery completed

- Ran scoped Graphify query for `JournalEntryDialog QuickJournalEntryDialog useJournalEntries journalOperations` against the existing graph.
- Read generated Obsidian notes for `JournalEntryDialog.tsx` and `useJournalEntries.ts`; followed references to current source.
- Read F01, current frontend delivery/UX skill guidance and journal patterns, affected editor/hook/service source and existing regression fixtures.
- Source findings: ordinary editor resets immediately; hook catches write errors without propagating failure; quick editor shows success after that resolved failure and waits 1.5 seconds; both allow save during pending image work; old image deletion precedes replacement/persistence; current local create adapter omits rich-text fields.

## Implementation contract

1. `addEntry`/`updateEntry` return a success-bearing result after durable local repository/outbox commit; precommit failures reject. Refresh/status work cannot turn a successful write into a retryable save failure.
2. Both editors await that result, preserve editable draft on failure, lock duplicate submission synchronously, and close/reset only on success or explicit discard.
3. Save is unavailable while picking/uploading. Late asynchronous work cannot modify a different editor/account/book session.
4. Dismissal while saving/uploading is blocked; dirty dismissal requests explicit discard, with Keep editing available. Relevant labels/status and keyboard focus are included in the same behavior slice.
5. Existing saved attachments are never deleted during selection/cancel/failure or merely because a local update committed. Remote reference cleanup requires sync-aware ownership beyond this frontend transaction; preserve assets rather than risk loss.
6. Preserve rich-text fields in local create data. Explicit removal uses a nullable photo reference rather than omitted update data.
7. No new database schema, live account writes, routing migration, theme redesign or dependency upgrade.

## Validation ledger

| Check | Status | Evidence |
| --- | --- | --- |
| Scoped discovery / Graphify / Obsidian | Completed | Source paths and findings above |
| Client regression suite | Passed: 74 tests, 10 files | Final combined run includes editor, hook, adapter, actual Dexie/fake-indexeddb, native-adapter SQL and existing loading/identity-remap coverage |
| Desktop SQLite regressions | Passed: 8 tests | Actual installed Electron + better-sqlite3; two database connections, outbox, ownership and rollback |
| Playwright journal fixture | Passed: 54/54 | 18 scenarios each in Chromium, WebKit, Firefox; zero failures/skips/flakes; final run started 2026-09-27 23:36:07 UTC, 139.283 seconds |
| Workspace typecheck | Passed | `npm run check-types`: client and desktop configured tasks passed |
| Targeted source/test lint and fixture typecheck | Passed | All changed/new application files and F01 fixture; zero warnings |
| Production client and desktop builds | Passed | `npm run build`; `npm --workspace @brack/desktop run build`; final client hash also confirmed by Turbo cache hit |
| Whitespace check | Passed | `git diff --check` |
| Independent code review | Completed | Lifecycle, identity, attachment and hydration findings corrected and regression-tested |
| Local Graphify update and Obsidian export | Passed | Final graph: 8,432 nodes / 19,730 edges / 561 communities; Obsidian export: 8,759 notes plus canvas |
| Documentation links | Passed | Scoped Markdown links resolve; living journal contract and skill reference updated |

Browser fixture results will be recorded with actual commands, counts, scenarios and engine coverage. Native keyboard/OS Back/VoiceOver/TalkBack remain separate device checks; never report them passed from browser emulation.

## Integration findings and decisions

- Both editors now share an account/book/entry-scoped lifecycle and explicit discard UI. Pending writes lock fields, formatting and repeated submission. Dirty drafts survive React remounts in memory; they are not persisted across reload or process termination.
- The ordinary editor and quick editor now await the local commit result. Removed the quick editor's arbitrary success delay and animation that previously hid save failure.
- Rich-text initialization and editability changes must not emit user-change events. Both editors give the contenteditable and ordinary inputs explicit visible-label associations.
- New reading-session prompts queue behind the active quick editor; they cannot replace its draft. Queued book context clears on account changes.
- Ordinary remote refresh previously overwrote unsynced entries. The hook now hydrates through the preserve-local repository contract, retains pending/failed creates and updates, and excludes deletion tombstones.
- Review then reproduced a second race: the repository's status check and later cache write were separate operations. F01 therefore includes a necessary local-adapter correction: optional `upsertRecords(..., { preserveUnsynced: true })` performs the condition within a Dexie transaction or SQLite conflict update. Native/desktop and web implementations preserve unsynced rows and cross-account collisions; ordinary sync acknowledgement writes remain unchanged. This changes no remote schema/API or database schema.
- Original/replaced attachment assets are intentionally retained. No remote garbage collection is attempted without sync-aware reference ownership.

## Changed files and ownership

Paths below are relative to the repository root. These are F01 changes; the worktree also contains the earlier audit and pre-existing Playwright setup listed above.

| Area | Files | Outcome |
| --- | --- | --- |
| Editors and entry points | `apps/client/src/components/JournalEntryDialog.tsx`, `QuickJournalEntryDialog.tsx`, `JournalEntriesList.tsx`, `JournalEntryCard.tsx`, `JournalPromptHandler.tsx`, `journal/JournalEditorFeedback.tsx` | Awaited save; explicit discard; queued/account-scoped prompts; named edit/delete controls and focus restoration |
| Rich text | `apps/client/src/components/rich-text/RichTextEditor.tsx` | Labels, actual noneditable pending state, formatting lock, programmatic changes without false dirty events |
| Draft lifecycle | `apps/client/src/hooks/useJournalEditor.ts` | Shared session store, synchronous pending lock, stale-callback isolation, error/success/discard ownership |
| Journal mutations and reads | `apps/client/src/hooks/useJournalEntries.ts`, `apps/client/src/utils/offlineOperation.ts` | Success-bearing local commit; rich fields/null preserved; errors propagate; safe refresh and account checks |
| Local hydration | `apps/client/src/services/local/driver.ts`, `repositories.ts`, `apps/client/src/types/desktop.d.ts`, `apps/desktop/src/sqliteLocalDb.cts` | Atomic conditional hydration across renderer persistence adapters; no backend/schema change |
| New/extended client regressions | `apps/client/src/components/JournalPromptHandler.test.tsx`, `hooks/useJournalEditor.test.tsx`, `hooks/useJournalEntries.mutations.test.tsx`, `utils/offlineOperation.journal.test.ts`, `services/local/repositories.test.ts`, `services/local/driver.hydration.test.ts`, `services/local/driver.native-hydration.test.ts` | Failure/lifecycle/persistence/account/race coverage |
| Desktop regression | `apps/desktop/tests/sqliteLocalDb.test.cjs` | Real SQLite semantics with installed Electron ABI |
| Browser harness | `tests/fixtures/journal-save/`, `tests/e2e/journal-save.spec.ts`, `tests/playwright/journal-save.config.ts`, `tests/playwright/tsconfig.journal-save.json` | Real editor/list/hook/TipTap/dialog behavior at controlled service boundaries |
| Maintained guidance | `docs/ui-journal-editing.md`, `docs/testing.md`, docs indexes, renewal README/09/11/13, `.codex/skills/brack-frontend-ux/references/feature-patterns.md` | Current contract, exact commands, evidence limits and continuation instructions |

## Reproduce validation

All commands run from the repository root unless stated. Local environment: Windows, Node `v24.0.2`, Playwright `1.63.0`. The native SQL unit harness uses Node's `node:sqlite`; the desktop test uses installed Electron to match the existing SQLite addon's ABI instead of rebuilding dependencies.

```powershell
npm --workspace @brack/client run test -- src/hooks/useJournalEditor.test.tsx src/hooks/useJournalEntries.mutations.test.tsx src/hooks/useJournalEntries.loading.test.tsx src/utils/offlineOperation.journal.test.ts src/components/JournalPromptHandler.test.tsx src/components/NestedReaderLoading.test.tsx src/services/local/repositories.test.ts src/services/local/driver.hydration.test.ts src/services/local/driver.native-hydration.test.ts src/services/local/bookIdentityRemap.test.ts
npm run check-types
npm run build
npm --workspace @brack/desktop run build
```

```powershell
$env:ELECTRON_RUN_AS_NODE = '1'
& .\node_modules\electron\dist\electron.exe apps/desktop/tests/sqliteLocalDb.test.cjs
Remove-Item Env:ELECTRON_RUN_AS_NODE
```

```powershell
npx tsc -p tests/playwright/tsconfig.journal-save.json --noEmit
npx eslint tests/playwright/journal-save.config.ts tests/e2e/journal-save.spec.ts tests/fixtures/journal-save --max-warnings=0
npx playwright test --config tests/playwright/journal-save.config.ts
git diff --check
```

Application lint: run ESLint with `--max-warnings=0` over the changed/new files under `apps/client/src`, `apps/desktop/src` and `apps/desktop/tests`; all passed. The JSON Playwright report is generated at `tests/playwright/test-results/journal-save-report.json` and is intentionally ignored by Git. This tracker preserves the actual result when generated artifacts disappear.

Browser scenarios cover: full/quick rejection and retry with formatted writing/metadata/photo; clean cancel; dirty cancel/Keep editing/discard; keyboard focus return and full-editor pointer focus return; pending fields/toolbar/save/close locks; delayed upload rejection and retry; offline local feedback; follow-up status/read failure after commit; editing/replacing/removing saved photos; pending remount rejection and success. Viewport widths are 390, 834 and 1024 CSS px, with 1000 px height; these are browser layouts, not physical-device tests.

The first browser iterations found actual field-label and Safari pointer-focus issues, plus fixture-only selector/readiness issues. Those were corrected before the recorded final run. Windows sandbox worker restrictions (`EPERM`/access denied) required approved local execution for test/build/Graphify workers. No automatic approval rejection remains. Existing build/tool warnings concern browser metadata age, ambiguous Tailwind easing utilities, mixed sync-engine imports, bundle size and Vitest/Vite transform configuration. Node reports its built-in SQLite as experimental; tests passed.

## Review locally

For the real app, use `npm run dev`, open a book's journal and try Add/Edit and cancellation. Reading-session completion exercises the quick editor. Failed local writes should retain the complete draft; ordinary successful saves close promptly and announce local persistence.

For deterministic failure review without an account:

```powershell
npx vite --config tests/fixtures/journal-save/vite.config.ts
```

Open `http://127.0.0.1:8086/` (or `/?existing=1` for a saved entry, `/?offline=1` for offline presentation). Save operations intentionally remain pending until the browser console runs `window.journalFixture.rejectNext()` or `window.journalFixture.resolveNext()`. Reject, inspect retained writing, retry and resolve. Full automated commands and boundaries are in the [fixture README](../../tests/fixtures/journal-save/README.md). Stop the fixture server before running Playwright, which requires a fresh dedicated server.

## Evidence limits and retained follow-ups

- Unsaved drafts survive component/route remount in process memory only. Reload, process death and application restart are not durable recovery. The unload warning applies only while a dirty/pending editor is open; hidden retained drafts have no unload warning.
- Browser fixture service adapters do not prove live Storage, network sync, authenticated API or physical database durability. Separate tests exercise real Dexie with fake IndexedDB, production native-adapter SQL with in-memory SQLite and actual desktop SQLite with two connections. The Capacitor bridge itself is not exercised by the SQL harness.
- Physical iOS/Android pickers, permission UI, keyboards, OS Back, VoiceOver/TalkBack, packaged desktop UI, production fonts/themes and broad accessibility conformance were not verified here. Record those device checks separately; F01 does not claim F07/F13/F20 completion.
- Original/replaced/orphan attachment assets remain in storage until a separate sync-aware cleanup policy exists.
- No commit, deployment, native sync/build, production account write, backend migration, theme redesign or next-ticket implementation was performed.

## Graph and vault checkpoint

Ran `graphify update .` after final source changes (local AST processing), then `graphify export obsidian`. Update already rebuilt communities and the HTML/report, so a second clustering pass was unnecessary. Source notes for the shared editor and feedback component are present. No API-backed extraction, model labeling, database introspection, hook or watcher was enabled.

Graphify reported partial parsing of three existing Android Gradle files. Obsidian export pruned 47 obsolete generated notes and preserved nine pre-existing files it did not own rather than overwriting them; those files are not guaranteed refreshed. Relevant maintained source remains authoritative. Generated graph/vault outputs remain ignored by Git. Open `graphify-out/obsidian/` as a vault; do not edit generated notes as the implementation ledger.

## Handoff and stop rule

F01 is implemented and verified to the limits above. The agent has reached the requested stop. The next agent must read this document and the user's latest response before doing work; passing tests do not authorize a commit or the next ticket. There are no known unresolved failures in the recorded checks. Device/release checks remain explicitly unverified, not silently passed.
