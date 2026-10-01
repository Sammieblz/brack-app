# F10c - Bookshelf and carousel reconstruction

Status: implemented and verified within the scope below; review stop, 2026-10-01. Baseline is committed F10b `b97119d`. No staging or commit authorized in this pass. The old checkpoint29 review stop is historical.

## Complete slice

Reconstruct the actual MyBooks bookshelf/carousel and both previews; retain flat view, the three saved view choices, reading services, selection, themed physical covers, fonts and Iconoir. Size shelf rows from their available pane and text size. Replace per-book carousel dots with bounded navigation and a native book chooser. Bring preview actions before optional descriptive metadata. Retain one preview owner through resize. Add visible shelf movement alternatives with serialized saves, failure rollback and no late account feedback. Restore the carousel's selected book on route return using a bounded, account/entry-scoped memory.

This is the presentation/selected-book context child of F10. Global delayed-load scroll restoration (existing shell hook restores before content is ready), tablet split panes, thousand-book performance, physical native and assistive-technology validation remain open; do not call the whole ticket complete.

## Source evidence and coverage

- Graphify query: `LibraryBookshelfView LibraryCarouselView LibraryBookshelfSelection MyBooks scroll restoration`, budget1600; existing10348-node graph,280 matches/44 displayed. Followed generated Obsidian `LibraryCarouselView.tsx.md`, then verified source.
- MyBooks owns filters/preferences, local book state and reorder service; `/books` and `/my-books` share it. Bookshelf owns dnd-kit; carousel owns Embla. Do not add a competing gesture/router/scroll owner.
- Bookshelf preview uses AdaptiveDialog; carousel preview uses Sheet. Preserve their mounted roots and nested task guards.
- LibraryViewSkeleton is an affected production consumer, as are real reading/removal/membership tasks within both previews. Existing interaction and live-task fixtures must still pass.
- Baseline defects: shelf row count uses window pixels with3/5/7/9 columns; metadata is hidden/tiny; carousel stacks two card borders and one44px dot per book; shelf preview has clipped text and places actions after metadata. Reorder lacks a pending lock; selected carousel position resets on route remount.

## Component decisions

Official Ionic reorder and React Slides docs reviewed 2026-10-01. Reorder offers explicit mode/handle guidance; retain existing dnd-kit grid ownership and add visible movement controls. Ionic's Slides guide delegates to Swiper; replacing the already integrated Embla controller has no demonstrated benefit for this reconstruction. Keep existing accessible Dialog/Sheet roots per F06 while building custom book content, rather than importing Ionic visual defaults. This is a scoped decision, not a rejection of all Ionic components.

Sources: https://ionicframework.com/docs/api/reorder ; https://ionicframework.com/docs/react/slides . Installed versions and actual verification recorded below before closeout.

## Validation / handoff

The intermediate chronology below preserves failures and corrections. Final acceptance and artifact paths follow it; do not treat an intermediate pending note as current status.

### Historical implementation and validation checkpoints

- Custom mode stylesheet and shared LibraryBookPreview replace boxed/clipped preview content. Dialog/Sheet owners stay stable. Cover artwork/wood theme tokens and reading actions remain.
- Shelf pane/rem measurement also drives skeletons. Earlier/Later controls preserve focus across row regrouping and rollback; MyBooks serializes writes, scopes completions to account lifetime and restores only optimistic order fields.
- Carousel uses native select + two arrow controls, pane-based slide widths, named progress, OS reduced motion and immediate keyboard navigation. A40-entry memory stores only book IDs under account/history-entry keys; browser refresh persistence is not claimed.
- Before capture run:2 passed,2 carousel preview pointer-selector failures (primary is covered by deliberately delegated content);4 composition and2 shelf preview captures retained. Corrected the test to activate the native primary with Enter; production delegation remains covered by existing interaction tests.
- First new Chromium run:19 passed,5 failed. Real defects: narrow chooser at200% and move-control pointer CSS specificity. Two Back failures used the desktop accessible name on phone; source verified phone name is Go back. Six focused corrections passed. Visual inspection found slide basis overridden by existing utility CSS; raised scoped specificity and added measured tablet width assertion.
- Initial affected unit run:20 passed. Loading/removal unit run:26 passed,6 assertions still encoded the retired viewport3/5/7/9 contract; updated to measured pane cardinality, preserving zero/known-count assertions and adding delayed preference coverage.
- Full browser matrix, final regressions and tooling results still pending. These intermediate counts are not acceptance.

- Service boundary review: reorderLibraryShelf writes existing local book records and emits per-book events; this pass does not make that service transactional. Frontend rollback is a local projection correction, not proof that partial persistence was undone. Failure copy therefore says save failed and offers retry, without claiming a database rollback. Partial local-write failure/offline sync acceptance remains a service/integration gate. Mode/selection changes are ignored while the reorder write is pending.
- New matrix:72 passed and3 live-motion reset failures; Embla8.3.0 source showed React option reinitialization reapplied the initial index. Using Embla's media breakpoint preserves the current index; the three-browser focused rerun passed. Interaction matrix is running; its keyboard test must account for the now-leading chooser and Next control before requiring book focus.

- Loading regressions: two early runs were interrupted after repeated selector/geometry failures; their trace folders remain under test-results/f10c-loading and f10c-loading-final. No completed JSON summary was produced for those interrupted runs; do not reuse the old default reporter file. An isolated regression config now sets an absolute per-run report path. The12-case Chromium geometry run recorded6 shelf passes and6 carousel failures (oversized optional placeholders). Final estimate reserves two title lines plus one optional summary line; all36 existing geometry/refresh cases then passed without relaxing the48px/CLS thresholds.
- Interaction regression run:48 passes,6 existing CDP-only capability skips,3 failures from the retired first-book-first Tab assumption. The correction explicitly requires chooser -> Next -> native book primary, then retains Enter/Space and close-focus assertions. Three focused corrected cases passed.
- Final84 new cases and affected actual task regressions pending at this checkpoint; production build started. No commit/staging.

## Changed ownership map

| Files | Result / retained owner |
| --- | --- |
| LibraryBookshelfView.tsx, useShelfColumns.ts, libraryLayout.ts, library-modes.css | Pane/text-aware shelf, readable labels and visible move alternatives; existing dnd-kit sensors retained |
| LibraryCarouselView.tsx | Unboxed pane-aware slides; bounded navigation; selection memory; Embla media breakpoint and portal-safe keyboard handling |
| LibraryBookPreview.tsx, LibraryBookshelfSelection.tsx, LibraryBookDetailSheet.tsx | Shared custom preview content, full headings, early actions and optional details; original Dialog/Sheet roots retained |
| LibraryBookActions.tsx | Existing status badge font becomes rem-based for text scaling; action semantics unchanged |
| MyBooks.tsx | Per-account pending write guard, field-scoped local rollback, honest inline error; carousel entry key |
| LibraryViewSkeleton.tsx, LibraryLoading.test.tsx | Same mode geometry, zero/known-count behavior and delayed view-preference measurement |
| tests/fixtures/library-modes/*, library-modes.spec.ts, library-modes*.config.ts, tsconfig.library-modes.json | Actual screen/route fixture, deterministic deferred/failure/account cases, isolated per-run browser evidence |
| tests/fixtures/library-tasks/{api,state}.ts | Opt-in30-book fixture and controlled shelf write operation; no live service |
| library-interactions.spec.ts, library-renewal.spec.ts | Updated visible keyboard order/current-slide semantic and reorder instruction text; original action/focus assertions kept |
| Renewal indexes, checkpoint30, ui-library-presentation.md, ui-ionic-fit.md, source census and evidence/f10c | Current scope, decisions, limits and continuation |

The only production incoming consumers of the two mode views are MyBooks; the two preview roots are owned by those respective views. LibraryViewSkeleton shares libraryLayout across loading states. The shared status/action family is also used by flat Library rows; its existing interaction coverage remains part of this pass. The source census is520 client runtime modules/styles,39 routes,33 screens,280 component modules; static reachability is not full rendered coverage.


## Remaining acceptance and next bounded work

- **Next main ticket: F11 Book Detail and reading capture.** Start at S08/S09 and the real BookDetail -> progress/logger -> confirmed reading outcome paths. Preserve this slice's preview actions and existing offline/task ownership. Inspect the source census for all live consumers; do not replace real workflows with receipt-only fixtures.
- **F10 return-scroll child / existing RS11:** existing MobileLayout/usePersistentScrollPosition restores by pathname on a timer before delayed content is necessarily present, without per-entry/account identity. Fix this in its existing scroll owner with delayed-data and Back tests, rather than creating a second Library scroller. Carousel selected-book memory here is narrower.
- **F10 tablet pane and performance children:** split/detail panes and1000-item behavior remain open. The30-book chooser check proves bounded navigation controls, not rendering throughput or latency.
- **Native/AT:** physical iOS/Android/foldable gesture conflicts, keyboard/IME, VoiceOver/TalkBack and whole-theme contrast are unverified. App Back callback fixtures do not establish hardware behavior or legal compliance.
- **Persistence boundary:** no sync/schema/native plugin changes. Partial failures of the existing per-book local shelf-write service and multi-device convergence require integration evidence; frontend local rollback is not a transaction guarantee.
- **Existing main/corrective queue:** CR06c/remaining CR06, CR07-CR10 and later F tickets remain as recorded. Do not restart the original audit or claim these close from F10c counts.
- **Review stop:** leave changes unstaged/uncommitted. A further ticket or commit waits for the user's next instruction. A later agent must check actual HEAD and reconcile this stop if the user has committed meanwhile.


## Final acceptance / review stop

**210 distinct Playwright passes,6 existing capability skips;53 unit passes.** No unresolved failure in the implemented scope. Intermediate failure runs are retained in [verification.json](evidence/f10c/verification.json), not counted as successful checks.

| Check | Exact scope and result |
| --- | --- |
| `F10C_RUN=final; npx playwright test --config tests/playwright/library-modes.config.ts` |84 passed across Chromium/WebKit/Firefox: composition, full preview content,200% text, fonts, keyboard/selection, live resize/motion, guarded shelf moves, account changes, actual BookDetail return on both Library routes,30-book navigation and reading-metadata loading |
| `F10C_SUITE=interactions; F10C_RUN=final/keyboard; npx playwright test --config tests/playwright/library-modes-regressions.config.ts` |48 broad passes plus3 corrected keyboard-order passes=51 distinct;6 existing CDP touch-only skips. Desired pointer/keyboard/portal/drag assertions preserved |
| Same regression config, `F10C_SUITE=loading; F10C_RUN=complete; --grep 'bookshelf loading\|carousel loading'` |36 passed:320/390/768/834/1024/1440px in all3 engines, existing48px/CLS thresholds and retained refresh DOM/focus |
| Same regression config, `F10C_SUITE=tasks; F10C_RUN=complete; --grep 'bookshelf\|carousel\|Visual'` |36 passed: actual membership/deletion pending/failure/resize/Back and large-text controls. An interrupted earlier run matched hidden native options during readiness; now requires the real primary/heading |
| `F10_RUN=f10c-view-smoke; npx playwright test --config tests/playwright/library-renewal.config.ts --grep 'view choices preserve modes'` |3 passed; view preferences, selection and reorder exit preserved |
| Five affected Vitest files (exact command in manifest) |53 passed; updated measured skeleton cardinality and delayed preference coverage |
| Client check-types, modes/tasks fixture TypeScript, changed-file ESLint `--max-warnings=0`, `git diff --check` |Passed |
| `npm --workspace @brack/client run build` |Passed,4308 modules; existing stale browser-data, Tailwind easing, mixed sync import and large chunk warnings remain; no measured production speed claim |

[Visual evidence](evidence/f10c/README.md):6 before and29 after captures. Inspected actual phone/tablet/desktop composition, custom previews, dark/paper and large-text controls. Final font faces are asserted loaded. Fixture covers are BRACK marks, not real user cover art. Global shell/reward/toast appearance outside this slice is not redesigned by these screenshots.

Graphify final sequential local update/cluster/export commands all exited0:10391 nodes,23031 edges,705 communities;11088 Obsidian notes plus aggregated HTML. Read back LibraryBookPreview.tsx/useShelfColumns.ts notes and their source connections. Three existing Android Gradle parse warnings remain. Export preserved8 pre-existing note files rather than overwriting them (the log names Task().md, task()_1.md, Dashboard.md, libraryLoading.test.tsx.md, Native.md and abbreviates3 others); those protected notes are not newly verified graph output. No cloud/semantic extraction, labeling API, watcher or database access was enabled. The final graph refresh includes the last test selector correction.

Current HEAD remains `b97119d`. All changes are unstaged/uncommitted. No browser/dev-server session remains from completed checks. Next action is user review; on later continuation follow F11 and the separately owned remaining gates above. Do not infer full F10/frontend completion or native/AT approval from this checkpoint.
