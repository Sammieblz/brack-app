# F10a — Library reconstruction

Historical checkpoint: F10a is now committed in `8c01615`. Its review stop below was satisfied before the user authorized [F10b](29-lists-reconstruction.md). Retain the original results as historical evidence.

Status: **Implemented and verified within scope. Stopped for user review, uncommitted.** Baseline `d944fef` commits CR06b; clean worktree at startup. User explicitly redirected work toward visible mobile/tablet reconstruction after correctness work displaced the original design goal. No stage/commit requested; stop for review after a complete, tested screen slice.

Scope: actual MyBooks (`/my-books`, `/books`) search/status/controls composition and flat book presentation; shared book actions in flat/carousel and bookshelf/carousel previews; matching loading placeholders. One counted status control, search, one adaptive controls task, content, and visible Add. Preserve all view modes, list membership, selection/reorder, progress, removal/pending/reader boundaries, theme/font/Iconoir identity, and primary-action/gesture contracts. Lists composition and tablet detail-pane routing remain separately owned F10 children. No backend or global router migration.

Source findings: MyBooks repeats status in `renderSummaryChips` and `renderStatusControls`; its compact Collapsible exposes a wall of controls above content. LibraryBookCard uses Card + Accordion and an always-visible five-button footer. LibraryBookActions has four actual callers (flat, carousel, bookshelf preview, carousel preview). Shared LibraryBookPrimaryAction/event delegation must remain intact. F10/S06 calls for exactly this hierarchy and action disclosure. The corrective queue is not a mandatory waterfall: unrelated CR06c/CR07-CR10 work stays open rather than blocking this authorized visual slice.

Ionic decision is component-specific: F06's tested route lifecycle and modal focus failures remain evidence against those integrations, not all Ionic. Re-read official segment/searchbar/action-sheet/item-sliding docs for this screen. Filter selection, search, action disclosure, scroll and gesture ownership must be evaluated separately; do not claim Ionic adoption from CSS imitation or native bridge emulation. Record final choices and reasons below. A new route shell requires its own complete integration verification.

Discovery: bounded Graphify query found253/displayed44 at1500 tokens; read the generated MyBooks Obsidian source note, then actual callers and S06/CR04 contracts. This is scoped source evidence, not whole-app coverage.

Required closeout: before/after actual-font screenshots, real tasks for all affected callers, reduced motion/keyboard/touch/200% text/phone/tablet/browser-native presentation, retained failures, types/lint/build and appropriate existing regressions. Record exact implementation files, Ionic choices, visual findings, outstanding acceptance, refreshed Graphify/Obsidian/census and one next step. No claim that inventory counts or test totals prove design approval.

## Implemented changes

- `MyBooks` uses one `LibraryToolbar`: native search, one counted reading-status group, result count and inline Quick actions. Visible Add stays in the header; genre/sort/view/selection/reorder and native Lists/Analytics links live in one adaptive controls task. Duplicate status summaries and the expanded wall of controls are removed. Selection/reorder modes have visible Done controls outside the closed sheet.
- Search/status/genres/sort live in validated URL parameters, replaced without adding history entries for every keystroke. Clearing filters is atomic and preserves unrelated parameters and route state. The existing preference boundary still owns the three Library modes. Real BookDetail Back is tested; general scroll restoration remains open.
- Flat books are semantic, border-separated rows using existing physical covers, full wrapping titles, authors, reading status, genre and progress. The shadcn Card/Accordion composition and five permanent icon actions are removed. Description, dates, notes and other expanded metadata remain available in Book Details; the flat row no longer duplicates that detail view.
- `LibraryBookActions` exposes Log progress as a native Router link and a labelled More disclosure. View details, Edit, Add to list and Delete retain their task/service owners. All four consumers are verification targets: flat row, carousel card, bookshelf preview, carousel preview. `BookDetail` has its own unchanged actions and remains a regression boundary.
- `FloatingActionButton` receives optional inline placement; default placement stays compatible for other consumers. The Library instance occupies normal flow and restores focus to its connected trigger through resizing. Timer/stats and capture capabilities remain available.
- Flat skeletons share the new grid/row geometry; carousel action placeholders match two visible controls. The grid uses a text-relative minimum width so large text can collapse columns. Existing selection, primary keyboard activation, card delegation, swipe and carousel gesture owners remain intact.

## Component-specific Ionic decision

Reviewed [Segment](https://ionicframework.com/docs/api/segment), [Searchbar](https://ionicframework.com/docs/api/searchbar), [Action Sheet](https://ionicframework.com/docs/api/action-sheet) and [Item Sliding](https://ionicframework.com/docs/api/item-sliding). Native counted buttons are used for this small local filter group: all labels can wrap at large text without a clipped or horizontally hidden segment. The native search input retains browser input semantics. These are BRACK-owned compositions, not an Ionic adoption claim or a claim that Ionic cannot implement them.

Controls and list/removal tasks retain the tested adaptive focus owner. Adding `IonActionSheet` would introduce a second overlay integration requiring its own gate. `IonItemSliding` is not layered over the current swipe recognizer, avoiding competing gesture owners. F06 failures remain specific to its pinned router/modal experiment. An Ionic shell or targeted component integration remains eligible for a separately complete integration test; this screen slice does not declare that goal complete. No package or lockfile changed.

## Review findings and retained failures

Before captures mount actual MyBooks at baseline `d944fef` at 390/834/1280 widths with actual fonts. The first reconstruction placed books too low on the phone because the header/status controls wrapped; that screenshot was rejected. The Library-specific title allocation, shorter All/Filters labels, spacing and reduced summary now keep normal-text phone controls compact while allowing large-text wrapping.

Initial unit run: 18 pass/2 failures. Tests still expected the old AlertDialog role and first focusable action; inspected the actual owned Dialog and Radix's anchor-skipping autofocus, then updated expectations to the existing Delete dialog and More button. Second run: 20 passes. No focus assertion was removed.

Initial expanded Chromium run: 12 pass/4 failures. Three tried to pointer-click the behind-content primary sibling rather than visible content; pointer activation is delegated from actual cover/title/metadata while the primary button owns keyboard activation. Corrected tests use title clicks and primary Space. Fourth expected a raw service error instead of the existing friendly read-error message. Follow-up revealed BookDetail's actual back button name is Back to library, not Go back. The paper fixture parameter was corrected to registered `paper-library` and now asserts the actual surface style. Original reports remain under `test-results/f10-*`; failed runs are not acceptance.

Loading regression: the first geometry run had 11 passes/one failure at 834px carousel (52.55px change against the existing 48px bound). Placeholder action widths did not follow real labels when wrapping. The skeleton now reserves the actual label/icon geometry without interactive content; rerun passed all 12 affected Chromium cases at 320/390/768/834/1024/1440. The tolerance was not changed. Loading metrics now attach before assertions so future failures retain their measurements.

## Verified visual observations

Final actual-font phone captures have a 61px header and first book row beginning at y=272 in Chromium/WebKit/Firefox (390x844). Those are fixture geometry measurements, not latency or usability scores. The first cover/title appears near y=293 after row padding. Status no longer repeats in two separate control groups. Flat rows show Log progress and More, with the other real actions available after disclosure.

Inspected default phone/tablet, long-title tablet at 200% text, Paper phone, dark tablet, native-presentation phone and 320px/200% controls. At 200% text, content reflows and sheets scroll; large text naturally reduces visible content. Native presentation preserves existing bottom destinations while the browser fixture uses its existing menu. The fixture stubs the bridge and uses known branded placeholder covers; it is not proof of device hardware, packaged app behavior or a live reader collection. There is no claimed whole-app visual approval.

## Task regression findings

The full Library/list run had 91 passes, six failures and two existing CDP-only skips. Six cases expected the removed Add-to-list icon tooltip after nested focus restoration. The action is now visibly labelled and has no tooltip layer. Tests now assert its absence and preserve the real parent/checkbox/DOM/focus assertions. The first six-case follow-up passed three bookshelf cases and exposed a real carousel focus defect in all three engines. Diagnostic evidence confirmed the original book button was still connected, but focus ended on the Library main element.

`LibraryCarouselView.onCloseAutoFocus` had two independent if-statements: it focused the originating book, then immediately focused the connected page fallback. It now selects exactly one destination. The primary-action unit harness now supplies a real connected fallback, which the earlier isolated harness lacked. A nine-case follow-up passed both preview Back paths and carousel deletion fallback across all three engines; this establishes 97 distinct task passes, with three already-passing deletion cases repeated. No sleep, forced focus in the test, weakened focus assertion or new focus owner was added. Original failures and diagnostic reports remain retained.

## Verification

All commands run from repository root. The [evidence manifest](evidence/f10-library/verification.json) records report/source hashes, exact cases and retained captures; [evidence README](evidence/f10-library/README.md) indexes representative screenshots and limits.

| Check | Command / result |
| --- | --- |
| Actual reconstructed Library | `npx playwright test --config tests/playwright/library-renewal.config.ts`, `F10_RUN=final`: 48 passes in Chromium/WebKit/Firefox |
| Actual Library/list tasks | `npx playwright test --config tests/playwright/library-tasks.config.ts`: full 91 pass/6 fail/2 skip; nine passes in the focused follow-up after correction; separate output/report paths preserve failures |
| Primary/gesture regressions | `npx playwright test --config tests/playwright/library-interactions.config.ts --workers 1`: 51 passes/six existing CDP-only skips |
| Moved native destinations | `npx playwright test --config tests/playwright/route-recovery.config.ts --grep 'Library\|tablet touch'`, `CR06B_RUN=f10-library`: 29 passes/one previously documented Windows WebKit anchor-Tab skip |
| Loading geometry | `npx playwright test --config tests/playwright/loading.config.ts --project chromium --grep '(library\|carousel) loading geometry'`: final 12 passes; original failure retained |
| Units | `npm --workspace @brack/client run test -- src/components/library src/components/FloatingActionButton.test.tsx src/components/SwipeableBookCard.test.tsx`: 66 passes/five files after focus correction |
| Types | Client `check-types`; `tsc --noEmit` for library-renewal, library-tasks, library-interactions, route-recovery and loading fixture configs; affected checks repeated after final focus correction |
| Lint/build | Changed TS/TSX/config/fixture files with `eslint --max-warnings=0`; client production build; `git diff --check` |

Known warning classes remain: stale Browserslist/baseline-browser-mapping data, ambiguous Tailwind cubic-bezier utilities, and production app chunk exceeding the configured 1000kB warning threshold. Build success is not route-performance acceptance. No dependency update hides these warnings. The new isolated fixture is excluded from the ordinary live-app Playwright runner.

The new fixture mounts actual MyBooks, BookDetail and Lists under existing navigation/task providers. Book/list/preference/service/device boundaries are controlled. Tests verify local UI behavior, not backend durability or packaged native APIs. Delay/error/empty/mixed/long-title controls are fixture-only. Existing regressions now follow actual More/controls entry paths and retain pending, retry, identity, modified-link, gesture and focus checks.

## Knowledge graph and handoff refresh

After final source changes, local AST `graphify update .` completed with process exit 0: **10,311 nodes, 22,960 edges, 706 communities**. Updated graph/report/HTML are generated local artifacts. The final bounded query found 179/displayed33 at1100 tokens; inspected MyBooks and the new LibraryToolbar source links. Final Obsidian export produced **10,990 notes**, preserving eight existing conflicting note files rather than overwriting them. Read back the actual MyBooks/LibraryToolbar notes and confirmed their mutual import/source links. PowerShell reported exit1 while forwarding export prune/conflict warnings; generated affected notes are verified, and no claim of a conflict-free whole vault is made. Three existing Android Gradle parse warnings remain.

The first export began before the initial update finished; it was superseded by the final export after code freeze. Early graph output is retained for provenance, not used as final source evidence. No semantic cloud extraction, model labeling, live database inspection, hooks or watcher was enabled. The update's `graphify watch` prefix is its one-shot logger. Source census regeneration initially hit sandbox `spawnSync git EPERM`; the authorized local retry succeeded. Final census: **39 routes,33 screen modules,276 component modules,516 total client modules/styles**. Counts are inventory, not reviewed-screen coverage.

Updated durable records: checkpoint28; README/09/11/20; historical commit status in27; living Library presentation/interaction/list-task and Ionic decision contracts; generated census; evidence index/manifest. No skill file changed in this slice. Existing frontend-delivery, frontend-UX and Graphify instructions guided the work. Future agents should start at28 and the living presentation contract, then query only the chosen next slice; do not replay every historical report.

## Remaining acceptance and next checkpoint

This is a complete bounded Library flat-view/control/action slice, not all of F10. Lists manager/detail composition, carousel/bookshelf visual renewal beyond their shared actions, tablet list-detail panes, large-library performance and full screen-state acceptance remain open. Native hardware/VoiceOver/TalkBack/manual usability and the Ionic shell require their own evidence. No legal compliance or whole-application acceptance is inferred from browser automation.

Stop for user review without staging/committing. On authorized continuation, next coherent slice is **F10b: BookLists and BookListDetail composition**, starting from S11, CR04 service/task contracts, actual caller census and before captures. Reconstruct the manager/detail content hierarchy while preserving membership, pending/retry, selection, reorder and offline semantics. Keep CR06c/remaining CR06, CR07-CR10 and other main screen tickets visible in the ledger; do not restart that entire corrective queue as a prerequisite waterfall. Reevaluate any Ionic candidate on its concrete component contract, without treating F06 as a blanket rejection.
