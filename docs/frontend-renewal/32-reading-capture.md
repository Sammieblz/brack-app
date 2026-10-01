# F11b — Progress capture, correction and history

Status: **implemented and verified within scope; stopped for user review, uncommitted**, 2026-10-01. Baseline HEAD `ee0081e` commits the previous F10c/F11a work; working tree was clean. User authorized continuation and batching complete related work. No commit was made for this pass.

## Bounded batch

Complete three connected F11b units before review: (1) ProgressLogger capture, local-save recovery and attachments; (2) QuickProgressWidget correction; (3) ProgressTracking route hierarchy/history and real capture entry. Preserve Dashboard and BookDetail entry ownership, current reading/status semantics, local/offline capture, themes/fonts/Iconoir, and shared Back/overlay owners. This is one coordinated F11b batch, not completion of F11c timer or S08 EditBook.

Root owns logger/save orchestration, fixture/Playwright, integration and this ledger. Parallel agents own progress route and correction component independently; a third audits persistence and implements history/caller guards. All code is shared and browser matrices run sequentially. Graphify query and Obsidian source notes are checked against current source, not treated as acceptance proof.

## Checkpoints

1. Source review: logger currently creates a log before a separate book update, resets its draft from stale props, permits modal dismissal while saving/dirty, and displays every optional field at once. Correction lacks strict numeric validation and pending/account ownership. Progress route has no direct Log progress entry. Persistence boundaries verified against repository source; browser fixtures cannot establish live sync or native durability.
2. Before implementation: eight baseline captures passed on Chromium at 390 and 834 px across progress route, Book Detail logger/correction and Dashboard logger (`f11b-baseline-ready.json`). An earlier fixture run failed because its API adapter omitted `needsSetupPrompt`; corrected before baseline capture.
3. Implemented all three units and caller/history guards. Helper tests exposed obsolete readback and frozen retry-after-bounds-change defects; fixed and rerun. A later review added a fresh book-update timestamp on retry while preserving the original reading date. Final targeted unit run: 121 tests across 10 files pass.
4. First Chromium integration: 29 pass, 3 failures, 1 not run after the failure limit. All three failures were test selectors: ambiguous offline status, the wrong chart-library class, and `Retry` instead of the actual `Try again` label. Source and error snapshots verified the cause; corrected selectors, then all 4 affected/unrun cases passed. No application assertion was removed.
5. Full three-engine matrix: 120/120 pass. Final review found two additional live-consumer gaps: Book Detail needed to render the history hook's loading/error/retained/empty states, and ProgressTracking's async book reader needed owner checks before starting obsolete fallback/hydration. Both were implemented. A final three-engine subset/new-state run passed 39/39, overlapping 30 main-matrix cases and adding 9. Touch-capability tablet checks passed 3/3, including sheet-to-center draft retention. This is **132 distinct new browser cases**, not 162.
6. Production build passes (4314 modules); existing large-chunk/mixed-import/easing/browser-data warnings remain. Source census passes: 526 runtime source modules/styles, 39 routes, 33 screens, 285 component modules (CSS/helpers included). The census initially could not spawn Git in the sandbox; approved local rerun succeeded. Existing Book Detail regressions pass21/21; membership regressions pass6/6. Final client/fixture types and changed-file lint pass.
7. Final local Graphify update, cluster-only without labels, Obsidian and HTML export all exit0. Final graph: 10582 nodes,23368 edges,709 communities;11283 Obsidian notes. Both finalized Playwright files and five production source/index stat entries match. Three generated source notes and their links were read back; capture call/import paths verified. Three existing Gradle parser warnings remain; eight conflicting notes were preserved. Initial sandbox WinError5 is retained alongside the successful approved retry in `test-results/f11b-graphify.log`. A second incremental cycle includes the final test additions. No cloud processing, hooks, watchers or database access.

## Delivered source and consumer coverage

| Unit | Changed source / actual production owner | Result |
| --- | --- | --- |
| Capture | `components/ProgressLogger.tsx`, `lib/progressCapture.ts`, `components/reading-progress/progress-capture.css` | Prominent Page reached; optional time/notes/position/photo disclosure; native labelled fields, strict integers and bounds; pending/dirty guards; retryable local stages; owned photo selection/upload; focus return and status announcements. |
| Every capture entry | BookDetail, Dashboard Continue Reading, Dashboard Daily Focus, ProgressTracking | Current page/total supplied; stable owner across responsive branches; actual invoker retained, including Safari pointer activation; stale account/auth/route callbacks cannot act on replacement tasks. |
| Correction | `QuickProgressWidget.tsx`, `reading-progress/correction.css`; BookDetail Progress tab | Distinct unboxed correction form; zero/backwards/known-total semantics; no new activity/streak/reward; rejected draft retention; one pending submission; visited tab remains mounted; completed correction remains visible. |
| Progress destination | `screens/ProgressTracking.tsx`, `reading-progress/progress-route.css`, `hooks/useProgressTracking.ts` | Book identity and local saved place first; early Log progress; dated activity list; estimates/charts under Pace and insights; no fake streak/percentage/history; retained offline data and explicit retry. |
| Reading history | `hooks/useProgressLogs.ts`, BookDetail Logs tab | Local pending and newly acknowledged records survive older remote responses; atomic preservation during hydration; tombstones/ownership respected; newest first; real loading/error/retry/confirmed-empty presentation. |
| Refresh ownership | BookDetail loader and progress-route reader | Remote book snapshots cannot overwrite pending local edits; use the value returned by `upsertRemoteManyPreservingLocal`; obsolete readers do not start later fallback/hydration. |

Source import/JSX census confirms **3 logger consumers, 4 live invokers**, one correction consumer and one `useProgressLogs` consumer. Library and list links reach these real Book Detail/progress destinations; they do not instantiate hidden copies of the logger. No direct repository, schema, sync transport, native wrapper or dependency changes were made. The helper orchestrates existing repository methods in the frontend layer.

## Decisions and preserved contracts

- Keep existing palettes, theme-aware assets, Inter/Merriweather/Playfair roles, Iconoir and shared runtime/Back/overlay owners. Custom composition replaces the former generic all-fields form, correction card and statistics-card wall. The existing chart components remain secondary disclosures; chart rendering is deferred, not their API requests.
- Capture records activity and keeps the saved page monotonic. Correction repairs the position, can move backwards/to zero, and creates no reading log. Existing started/finished/status rules remain authoritative. Known-total completion consequences are visible before either save.
- A pending progress log and its book update are **two separate local commits**. One mounted submission freezes its log identity/payload; a failed book stage retries without adding another log. Ambiguous log responses are checked against local readback. Book-stage retries merge the latest owned local book and use a fresh modification timestamp.
- Save feedback says **on this device**. Background sync scheduling is not server acknowledgement. Presentation/refresh failures cannot turn a completed save into another submission. Activity metrics remain explicitly remote-derived.
- Pending save/upload vetoes task dismissal; dirty dismissal uses the existing guarded confirmation. No custom global gestures, new modal router, competing focus trap, body lock, artificial completion delay or decorative animation was added. Native text selection, zoom and scrolling keep their owners.
- Reviewed official Ionic Input, Textarea and Modal documentation for this component decision. Native labelled controls and the existing adaptive owner provide the required behavior here; no production Ionic adoption is claimed. [Ionic decision](../ui-ionic-fit.md) is component-specific, not a blanket ban. [Living reading contract](../ui-reading-capture.md) owns reusable details.

## Validation record

| Command / run | Result |
| --- | --- |
| `F11B_RUN=baseline-ready`, reading-progress config, Chromium | 8 before captures pass; initial missing fixture export fixed first |
| `F11B_RUN=integration-1`, Chromium | 29 pass / 3 selector failures / 1 unrun; preserved in manifest |
| `F11B_RUN=integration-2`, affected Chromium subset | 4/4 pass |
| `F11B_RUN=matrix-1`, all engines | 120/120 pass, no skips/flaky cases |
| `F11B_RUN=final-followup`, all engines | 39/39 pass: 30 repeated + 9 additional cases |
| `F11B_RUN=touch`, all engines | 3/3 pass, no capability skips |
| Targeted Vitest, listed below | 121 tests / 10 files pass |
| `F11A_RUN=f11b-regressions`, existing Book Detail config | 21/21 pass |
| Existing Book Detail membership config, isolated f11b output | 6/6 pass; initial unquoted PowerShell reporter argument failed before tests and was corrected |
| Client/fixture TypeScript and changed-file ESLint | Final checks pass, including all new tests/fixtures and changed old fixture contracts |
| `npm --workspace @brack/client run build` | Pass, 4314 modules, existing warnings only |
| Source census generator | Pass, 526 modules/styles / 39 routes / 33 screens / 285 components |
| Delivery skill `quick_validate.py` | Pass; narrow reading-contract link added, no generic skill expansion |

Browser config: `tests/playwright/reading-progress.config.ts`. All full matrices ran sequentially, with isolated Vite caches/ports/output. Fixtures render real screens, logger, correction, chart disclosures, Back and modal owners. Controlled boundaries are auth, selected dashboard read model, repositories/network/sync, storage and OS image picking. Rejected/deferred/ambiguous writes count each fake outbox insertion rather than silently deduplicating fixture calls. No browser result certifies real storage or sync transport.

Unit command from `apps/client`: `npx vitest run src/lib/progressCapture.test.ts src/components/QuickProgressWidget.test.tsx src/hooks/useProgressLogs.test.tsx src/screens/ProgressTracking.test.tsx src/components/ReaderHud.test.tsx src/screens/Dashboard.goals.test.tsx src/hooks/useRetainedReaderResource.test.tsx src/services/api/progress.test.ts src/services/api/books.dateOnly.test.ts src/services/local/driver.hydration.test.ts`. Hook/driver tests use real repositories with fake IndexedDB; orchestration/component tests use scoped mocked boundaries. Initial sandbox worker startup failures were retried with approved local process permissions; they are not application failures.

Before/after and responsive captures, exact report summaries and visual observations belong to [evidence/f11b](evidence/f11b/README.md). Fonts are explicitly loaded and their faces asserted in new visual cases. 200% text/320px and short landscape captures may show a scrolled part of the whole task; reachability/overflow assertions verify the rest of the surface. No timing benchmark or device/legal conformance claim follows from these screenshots.

## Validation and unresolved scope

The three F11b units are implemented and verified within scope. This is the requested review stop; all changes remain unstaged and no commit was made. Native devices/AT, live storage/sync, full timer lifecycle, EditBook and global return-scroll remain separately owned. Retry identity lives in the mounted task; closing/reloading/crashing does not persist a recovery session. A repeated ambiguous book update can create another idempotent book-update outbox operation; the protected promise is no duplicated reading log within the retained attempt. An already issued storage upload may finish after task removal, but cannot attach itself to another owner.

Per-log edit/delete has no supported live service path in this audit and is not fabricated; wider history management belongs to F13. Calendar/date-picker reconstruction, reward/loading motion, social/settings/discovery and remaining F12-F21 work are not implied complete by this reading slice. Accessibility remains always active; OS screen readers are not toggled by an application preference.

## Next bounded action

After user review: **F11c timer/session presentation and lifecycle acceptance**, then the separately tracked S08 EditBook child. Start from this ledger, S09 and the actual TimerContext/TimerModal/MiniTimer/reading-session consumers; query Graphify narrowly and verify source. Preserve this capture/correction boundary and all four invokers. Do not restart F11a or the full audit, count F11b as full F11, migrate the router to Ionic from an example, or commit this batch without the user's checkpoint instruction.
