# F07 Back and gesture ownership checkpoint

Historical checkpoint: committed at `83e032bfc77d240b545cbbbc2a091ceac76538b0`. [Checkpoint20](20-coverage-reconciliation.md) now owns coverage corrections after F09, including missed live gesture/chapter-Back consumers. The review-stop statements below describe the original F07 handoff, not whole-application acceptance.

## Current state

- Baseline: clean worktree at committed F06 `f90509d9ee2092e872d91933020a4a71deb4798a`.
- Authorization: user approved the experiment and requested the next implementation, thorough analysis, verified claims and durable tracking. Playwright and review stops remain required; no commit requested.
- Status: **implementation, browser/source validation and local graph/vault synchronization complete; awaiting user review.** No commit made.
- Scope: one app-controlled Back operation, verified internal ancestry/contextual fallback, existing overlay guards, Android event ownership, book-task/Library mode protection, and cancellation/conflict fixes for existing touch interactions.
- Preserve browser Back/Forward, routes, reader data, themes/fonts/icons and timer ownership. F08/F09 are not started. Independent native destination stacks and physical OS gesture/keyboard acceptance require shell/device work and must not be implied by this checkpoint.
- Next: **STOP for user review**. Do not commit or start F08/F09 without the next user instruction.

## Verified source and implementation decisions

1. `useAppBack` trusts positive `history.state.idx`. Installed BrowserRouter preserves an existing index, so this alone does not prove a BRACK predecessor. Track bounded observed keys/indexes and resolved account scope per tab. Persist no URLs, auth parameters, tokens or form values.
2. `App` and `MobileHeader` independently mount the document edge recognizer. `useSwipeBack` rebinds on movement, trusts history length, queues an uncancelled 200ms pop and lacks full cancellation. Remove these competing edge handlers and placeholder parallax; retain visible Back/profile controls. F06 adopted no verified native route stack.
3. Contrary to the older plan, repository searches found no Capacitor Back listener. Add one Android App listener with cleanup; do not also consume its DOM event. Hardware/IME behavior remains device-unverified.
4. Keep Radix/Vaul as overlay focus/dismissal owners. Explicitly register content and request its existing Escape path once. Consume Back even when pending/dirty guards refuse closure; never close an overlay and pop a page from one event.
5. Preserve existing journal guards. Add route-level app-Back protection for current book tasks and Library selection/reorder. Browser Back stays browser-owned.
6. Existing row/refresh handlers can compete on edges/diagonals and lack full contact cancellation. Add bounded start/axis/multitouch/cancellation protection, preserving actions and visible alternatives. Do not redesign unused carousels or globally restrict touch action.

These are source findings/implementation decisions, not browser results. Graphify was queried for actual Back symbols; generated `useAppBack()` and `SwipeBackHandler()` notes were read, then source verified. The bounded query was truncated, so it is not a complete consumer inventory. F06's existing-router/Radix decision remains authoritative.

## Implemented source map

- `contexts/AppNavigationProvider.tsx`, `contexts/appNavigation.ts`, `lib/appHistory.ts`, `config/routeBack.ts`, `services/nativeBack.ts`: one coordinator; scoped observed ancestry; contextual replacement fallback; stable Android subscription; stale async-guard invalidation including loading/account/route/unmount boundaries. [Detailed evidence](evidence/f07-navigation-ownership.md).
- `hooks/useAppBack.ts`, `components/AppBackButton.tsx`, `screens/NotFound.tsx`, `App.tsx`: all app Back delegates to the coordinator; native callbacks can honor the current visible control. Replaced swipe wrapper with plain elements retaining original layout geometry and timer/provider ownership.
- `hooks/useAppBackGuard.ts`, `hooks/useUnsavedAppBack.ts`, `screens/AddBook.tsx`, `screens/EditBook.tsx`, `screens/MyBooks.tsx`: pending/dirty route protection and selection/reorder exit. Edit Book Cancel participates. Its real integration tests exposed and repaired the existing empty-value Radix rating item; null rating remains null in the saved payload.
- `lib/backLayers.ts`, `hooks/useBackLayer.ts`, shared Dialog/AlertDialog/Sheet/Drawer/Popover/Select/menu content and raw DatePicker/Streak content: explicit registration; one primitive-owned Escape; guarded or closing overlays consume Back. ImageLightbox no longer closes twice on Escape. [Overlay evidence](evidence/f07-overlay-ownership.md).
- `components/GoalsSheet.tsx`: controlled existing bottom Sheet with visible 44px Close. Deleted unused `dismissable-dialog.tsx`, `dismissable-sheet.tsx`, `usePullToDismiss.ts`; the old pull callback changed disconnected state and queued uncancelled delayed work. No pretend drag gesture remains. F08 owns any future verified handle gesture.
- Retired `SwipeBackHandler.tsx`, `useSwipeBack.ts`, `useSwipeToOpenDrawer.ts`; MobileHeader keeps visible profile/Back controls and one button haptic owner.
- `utils/touchGesture.ts`, `SwipeableBookCard.tsx`, `PullToRefresh.tsx`: reserved 24px outer contact starts, axis lock, identified single touch, editable/control/selected-text exclusion and cancellation for interruption/multitouch/overlay takeover. The width is an app heuristic, not a measured OS gesture inset. Shared scroll CSS permits pinch zoom and no longer globally suppresses horizontal overscroll. [Local contract](../ui-local-gestures.md).
- New `tests/fixtures/back-ownership`, Playwright config/spec and focused tests; existing action-feedback, Library, shell, UI-environment and semantics fixtures extended. Active fixture Vite caches isolated after a reproduced shared-cache failure.

Living references: [Back](../ui-back-navigation.md), [local gestures](../ui-local-gestures.md), [navigation/notifications](../ui-navigation-notifications.md). Frontend delivery/UX skills now route agents to these contracts; hooks/component catalogs no longer recommend deleted gesture APIs.

## Ownership during this batch

| Owner | Work |
| --- | --- |
| Root | Coordinator, route metadata, useAppBack/AppBackButton/NotFound/App, task/mode guards, CSS, real Add Book cases, handoff and integration checks |
| runtime_policy | Ancestry, native cleanup, auth-loading boundary correction, provider/policy/real EditBook tests and installed API evidence |
| screens | Registry/ref adapters, overlay/GoalsSheet integration, focused tests, Back browser fixture and journal/date regressions |
| haptic_gestures | Edge retirement; MobileHeader, row/refresh cancellation, tests and Library regression evidence |

## Validation ledger

| Check | Result |
| --- | --- |
| Core ancestry/native/provider/policy/real EditBook tests | 64 passed across five files; command in navigation evidence |
| Overlay/Goals/journal/celebration/sync focused tests | 53 passed across six files; command in overlay evidence |
| Row/refresh focused tests | 49 passed |
| useAppBack/navigation-recovery/AddBook feedback tests | 28 passed across three files |
| Back-ownership Playwright matrix | Initial 42 passed; final-source run 40 passed + two timeouts; both unchanged sequential retries passed. See overlay evidence for exact commands/traces |
| Action-feedback Playwright | 66 passed (Chromium/WebKit/Firefox), including six new real Add Book Back checks; `test-results/f07-action-feedback-final` |
| Frontend-semantics Playwright | 63 passed (Chromium/WebKit/Firefox), including real recovery and notification consumers |
| Journal-save Playwright | 53 passed + one WebKit timeout; unchanged sequential retry passed |
| Date-picker Playwright | 67 passed + two timeouts; unchanged sequential WebKit/Firefox retries passed |
| Library Playwright | 51 passed, six explicit CDP-only skips, zero failures with one worker; `test-results/f07-library-verified` |
| Shell-scroll Playwright | 198 passed, no skips/failures/flaky cases, all three engines (6.3m); `test-results/f07-shell-scroll-complete`, JSON at `tests/playwright/test-results/f07-shell-scroll-report.json` |
| UI-environment Playwright | 33 passed, all three engines, one worker (41.8s); `test-results/f07-ui-environment-verified` |
| Client types / changed TS(X) lint / production build | Passed; lint has two pre-existing ImageLightbox warnings. Build retains known browser-data/easing/mixed-import warnings |
| Fixture type checks | Back/Library checked by owning agents; root action-feedback, frontend-semantics, shell-scroll and UI-environment scoped configs passed |
| Final local Graphify/Obsidian refresh | Passed; 9,026 nodes, 20,542 edges, 631 communities; 9,360 exported notes. Limitations below |
| Physical native Back/keyboard/gestures and real AT | Unverified; browser emulation is not device evidence |

## Resume

Stop for user review. All implementation and validation owners have finished; no owned browser servers remain. Preserve the uncommitted work and F06 defer decision. Do not repeat the broad audit or add Ionic packages. On the next authorized turn inspect HEAD/worktree, honor any user corrections, and use the next bounded action below. Do not commit or start the following batch without user direction.

## Failures investigated and test infrastructure

- Core tests reproduced Router case-insensitive metadata mismatch, auth-loading boundary retention and Edit Book's empty Radix Select item. Source fixed; focused regressions pass.
- Initial new Back browser tests used ambiguous status selectors (HTML output also has role=status). Accessible fixture status names disambiguate; no product expectation was removed.
- Add Book fixture initially lacked its new low-level App plugin adapter and could not load. Added the synthetic plugin boundary; real coordinator remains in the fixture. Its two Chromium Back cases then passed.
- Concurrent fixture runs reproduced `504 Outdated Optimize Dep` for a shared `node_modules/.vite/deps` chunk. Interrupted the failed Add Book run; assigned independent caches; final 66 passed. Incomplete/failed matrices are not counted as passes.
- Library's prior first-Tab assumption failed because Firefox stops first at the actual scrollable root. The test verifies that exact scrollable container, then requires the next Tab to reach the primary book control. Pointer reorder now waits for actual DnD activation and target-over state before releasing. Target outcome/focus assertions remain intact.
- New horizontal-overscroll assertion found WebKit's unsupported CSS property reports empty computed value. The test checks CSS.supports and requires browser fallback for that engine; it still requires auto where supported. Physical browser navigation is unverified.
- Too many concurrent browser/build processes slowed several correct intermediate states beyond test budgets. Preserved failure traces, stopped the incomplete shell/Library runs, and scheduled final suites/retries sequentially without raising timeouts or relaxing product assertions. Final outcomes must be entered above before review.
- Final client typing found two test-only Testing Library options copied from Playwright (`exact` on getByRole). Removed the unsupported option; string-name matching remains exact by default. Client types and all four Edit Book tests passed afterward. A sandbox-only SWC module-loading failure was retried with the required local execution permission.
- Shell regression exposed an old cover-button label in its focus-clearance test. Current unchanged LibraryBookPrimaryAction and the captured accessibility tree use the semantic whole-card button `Open Reading collection 13`; corrected the locator while retaining focus/header-clearance assertions. One separate case failed before page load with Chromium `ERR_NO_BUFFER_SPACE`. Stopped that incomplete run and retained its traces before the final matrix with the corrected selector.
- Shell's targeted Journey/focus check then passed 4/4; the complete rerun passed 198/198. Quote `'--reporter=list,json'` in PowerShell (the unquoted comma was parsed into an invalid reporter name before any tests ran). Final command: `$env:PLAYWRIGHT_JSON_OUTPUT_NAME = 'test-results/f07-shell-scroll-report.json'`, then `npx playwright test --config tests/playwright/shell-scroll.config.ts --output=test-results/f07-shell-scroll-complete '--reporter=list,json'`.
- UI-environment's overloaded run had 31 passes, the unsupported-CSS expectation failure and a Firefox resize timeout. The complete final run with the capability-aware CSS assertion passed 33/33 unchanged product scenarios: `npx playwright test --config tests/playwright/ui-environment.config.ts --workers=1 --output=test-results/f07-ui-environment-verified`.

## Reproduction and local knowledge refresh

Use the final ledger above, not an old JSON file left by an interrupted run. All browser matrices use their named config under `tests/playwright`; pass a distinct output directory when retaining a diagnostic run. Native callbacks are synthetic in the Back fixture. No live account writes, native packaging or deployment occurred.

Core tests: commands in the two linked evidence files. Root screen checks: `npm --workspace @brack/client run test -- src/hooks/useAppBack.test.tsx src/screens/navigation-recovery.test.tsx src/screens/AddBook.feedback.test.tsx`. Gesture checks: `npm --workspace @brack/client run test -- src/components/SwipeableBookCard.test.tsx src/components/PullToRefresh.test.tsx`. Client checks: `npm --workspace @brack/client run check-types`, ESLint on changed/new TS(X) files, and `npm run build`. All 74 new/changed local Markdown links resolved; final diff whitespace check passed. Both changed skills passed skill-creator's `quick_validate.py`.

Totals exclude diagnostic reruns: 194 focused tests passed. Across eight browser fixtures, 576 distinct cases reached a passing result and six CDP-only cases were explicitly skipped. Back/journal/date required the five unchanged sequential retries documented above; their preceding concurrent runs must not be described as clean passes. No measured production latency or device-conformance claim follows from these counts.

Ran local-only `graphify update .`, `graphify export obsidian`, then `graphify query "AppNavigationProvider registerBackLayer useUnsavedAppBack" --budget 700`. Verified the refreshed generated `AppNavigationProvider().md` and `registerBackLayer().md` source links. Query output was truncated and is navigation evidence, not an exhaustive consumer inventory. No semantic/API extraction, watcher, hook or database access was enabled; the update's log prefix `graphify watch` did not start a watcher.

After the final test-selector/CSS-capability edits, update and export were run again; the table records that final result. Graph warnings: three existing Gradle parser failures; community relabel suggestions were not sent to a model. The first export pruned 71 obsolete generated notes and preserved five pre-existing files it did not own (`Snapshot_1.md`, `native.md`, `mobile.md`, `dashboard.md`, `Dashboard_1.md`). The final export pruned 28 notes and preserved two further filename collisions (`LibraryLoading.test.tsx.md`, `libraryLoading.test.tsx_1.md`). No preserved note was overwritten to force completeness. Generated graph/vault files remain ignored and were not committed. Some generated notes have a Community None label; source links, not labels, remain authoritative.

## Acceptance limits and next bounded work

This delivers the app-controlled Back/overlay/task/gesture foundation of F07. Browser Back, browser reload and arbitrary links do not gain universal draft blocking. Session ancestry is bounded, per-tab and best-effort; it is not authorization. No URL, draft, token or history payload is stored in that ledger. Existing offline writes and timer semantics are unchanged.

Physical Android Back/IME/predictive gestures, packaged iOS system behavior, real VoiceOver/TalkBack, and process-death recovery remain unverified. No native stack, keyboard plugin, independent primary-destination stacks or cross-route scroll/focus restoration was added. Those gates remain explicit in F09/device acceptance; F07 browser evidence does not complete them. Native release requires on-device verification.

After approval/commit, the next implementation is F08 adaptive overlay/input ownership with existing Radix/Vaul, following the F06 defer decision. Start from real current consumers and Goals/DatePicker/Journal evidence. Do not reintroduce the retired disconnected pull hook or infer native ownership from phone width.
