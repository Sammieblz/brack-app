# F09 adaptive shell checkpoint

## Historical implementation state — coverage reopened

F09 was subsequently committed as `db076cf`. The user's next review identified missing pages/screens/components; [checkpoint20](20-coverage-reconciliation.md) now owns the active work and corrects this batch's coverage claims. The recorded test results below remain scoped historical evidence. They do not close the original application-wide F09 acceptance.

- Baseline: clean `bd342dc` (F08 committed); implementation authorized by the user's request to analyze previous work, then proceed. No commit requested.
- User correction: recent work delivered too little visible improvement and still looks generic/cluttered. Behavior checks alone are insufficient design acceptance.
- Delivered scope: selected F09 shell/utility implementations and their browser fixtures, now committed `db076cf`. Adaptive-shell63, distinct scroll198 and Back42 passed as recorded. Whole-app consumer coverage and physical device/AT acceptance remain open in20.
- Owners: root — stable layout/runtime policy, headers/nav, dependent positioning, docs; navigation agent — branded destination menu; utilities agent — timer/sync composition; fixture agent — real-shell browser evidence.
- Next action: follow active20's coverage repair sequence. The earlier review stop below is historical; the user did not accept these results as adequate whole-frontend coverage.

## Review of F08

Source and four retained screenshots were reviewed at the baseline above, with Graphify queries and generated Obsidian source links verified against current source. F08 preserved focus and drafts in the listed overlays. It did not complete whole-screen visual renewal. The Goals screenshot still shows three modal layers, duplicate headings and redundant metrics; the tablet action surface follows a generic compact-sheet policy. These are composition limitations, not newly proven functional regressions. Goal creation pending/dirty-close behavior remains pre-existing and belongs to the complete Goals ticket (F13).

The 234 distinct F08 browser checks prove specific fixture contracts, not usability, native feel, performance or legal conformance. Screenshots used fallback fonts. Prior handoffs also contradicted each other about active ticket/commit status; this checkpoint is now the authoritative continuation record.

## F09 intended visible outcome

- Browser compact/medium windows: clearly labeled Menu in the page header, all existing gated destinations, no global bottom tabs or phantom clearance.
- Native iOS/Android and standalone PWA compact/medium windows: calm, labeled bottom destinations anchored to the safe edge, without decorative floating gap/glow.
- Expanded windows: existing desktop sidebar, never simultaneous with global tabs. Medium tablets keep touch-oriented header/menu affordances.
- One stable page/main ancestor through resize; retain live fields, focus and overlays. Runtime remains distinct from width and input.
- Timer and offline/sync state join a normal-flow shell region instead of competing draggable/fixed cards. Preserve timer and sync service semantics.
- Local actions clear actual shell occupancy. Large text wraps; editing prioritizes task space without inventing keyboard detection.

## Acceptance and evidence to collect

Use real shell components around the actual Library screen plus a controlled draft task; mock data/device boundaries only. Check phone browser/native/PWA, tablet portrait/landscape, expanded sidebar, social gating, menu navigation/dismissal/Back, resize retention, active timer with offline status, keyboard focus, 200% text, last-action clearance and reduced motion. Inspect comparable screenshots, not only assertion totals. Existing shell, Back and affected form contracts must still pass.

Physical native safe-area/IME/system Back, actual mobile-browser toolbars shown/hidden, actual PWA installation, foldable hardware and real assistive technology are device gates, not browser-emulation claims. Synthetic visual-viewport changes do not establish mobile browser toolbar behavior. One scroll owner means one vertical page scroller; the bounded utility/footer region intentionally scrolls at extreme text/short heights. Independent native per-destination route stacks and whole-app route retention remain separate navigation work; F09 shell presentation must not be described as implementing them.

## Commands/results

- Initial `git status --short`: clean. `git log -3`: F08 `bd342dc`, F07 `83e032b`, F06 `f90509d`.
- Graphify query `MobileLayout MobileBottomNav MobileHeader NativeHeader AppSidebar ProfileDrawer --budget 1400`: existing 9,118-node graph; result truncated, cited owners verified in source.
- Obsidian `MobileLayout.tsx.md` and Goals notes consulted at baseline. The final local refresh is recorded below; no cloud processing.
- Initial Chromium: 9/15 passed (`test-results/f09-shell-initial`). Four failures expected the mobile heading on wider Library; one expected `textbox` instead of actual `searchbox`; one exposed genuine enlarged tab-icon overflow. Fixed source-verified selectors and changed tabs to a wrapping grid. Corrected run: 14/15 (`f09-shell-corrected`); remaining failure was the old search selector preloaded before the fixture edit, retained in evidence.
- Focused units: `npx vitest run` in `apps/client`, 12 selected shell/header/menu/timer/sync/form files, **95/95 passed**. Includes policy13, menu12, timer8 and affected existing consumers. Further portal/quick-actions changes still require final combined checks.
- Independent review found medium custom-heading screens lost their only Menu; migrated all identified consumers, including loading/error branches. Review also caught missing ResizeObserver fallback, invisible sidebar shortcut, bottom inset removal during editing, width-only header reflow and route-reset utility lifetime. Corrections added; browser coverage being extended.
- Client types passed during integration; final results appear below. Native/device/AT claims remain unverified.

## Final implementation inventory

- Runtime policy: `lib/shellPresentation.ts`; stable layout, visual geometry, editing policy, measured footer and focused-field/header reflow in `MobileLayout.tsx`/`index.css`.
- Destinations: `MobileBottomNav`, `MobileHeader`, `NativeHeader`, `AppSidebar`, `ShellNavigation`, `ProfileDrawer`; custom-heading screen families migrated through medium width, including error/loading states. Existing route IDs and feature gates retained.
- Persistent utilities: `ShellUtilitiesProvider` in App, with route-owned slots. `FloatingTimerWidget` is now an in-flow session row/adaptive Details; `HeaderTimerWidget` retains its idle picker. `OfflineIndicator` is a wrapping status; no sync service changes.
- Local tasks: Add/Edit save actions clear chrome; Quick actions and Quick Stats use adaptive surfaces, preserving all routes/actions and open-task ownership. `MyBooks` keeps that owner mounted, fixes large-text control wrapping. `PullToRefresh` keeps its ancestor across width/capability changes, preserving the real search input and caret. `ScrollToTop` uses measured clearance.
- Continuation: updated current UI contracts, component/testing references, Graphify/Obsidian source navigation and frontend skill guidance. Prior active-state contradictions corrected. No dependency, database, auth policy, theme/font/icon identity or native build changes.

## Validation corrections retained

- Expanded full matrix initially finished **60/63** (`f09-shell-full`). Real Library search DOM replacement came from PullToRefresh switching its wrapper to a Fragment; retaining the wrapper fixes the defect. At 320px/200%, the Library controls button inherited nowrap/fixed height; its wrapping intrinsic layout fixes horizontal overflow. Desired assertions were retained. Source changed while this diagnostic run progressed, so final acceptance uses the subsequent frozen-source matrix, not that mixed run.
- An initial shell-scroll regression run was deliberately interrupted after 22 passes to align its sidebar-resize assumption with the new medium Menu policy and disable HMR. It is not a completed matrix. The full final regression is recorded below.
- Final focused units: **134/134 across 15 files**, one combined run. Client app/node and both adaptive-shell/shell-scroll fixture types pass. Changed/new TypeScript ESLint has zero errors and exactly two existing warnings (`ui/sidebar.tsx` refresh-export, `Profile.tsx` hook dependency), reproduced independently from `git show HEAD`; `--max-warnings=2` passes without source suppression. Both updated skills pass `quick_validate.py`.
- Final `npm run build`: passed, log `test-results/f09-build.log`. Existing browser-data/easing and sync mixed-import diagnostics remain; current app chunk is approximately 1,096kB and emits the configured size warning. No measured route-performance improvement is claimed.
- Final frozen-source adaptive-shell matrix: **63/63**, zero skips/failures/retries, Chromium/WebKit/Firefox. Report `test-results/f09-adaptive-shell-summary.json` (start 2026-09-28 17:36:29 UTC, duration 291.5s); artifacts `test-results/f09-shell-final`. Current screenshots and candid composition review: [evidence](evidence/f09-shell/README.md).
- Existing shell-scroll matrix: **195/198** on unchanged final application source (`f09-shell-scroll-summary.json`, 8.1m). The three failures waited for bottom navigation in the browser, an obsolete expectation under the documented Menu policy. Updated only that scenario to verify Menu, no primary bottom navigation, focused last control within the page viewport and zero document scroll. A first correction wrongly looked for Quick actions, which this older fixture intentionally mocks; two timed out before that run was stopped (`f09-shell-scroll-corrected`), and no pass is claimed. Corrected scoped run **3/3 passed**, all engines, 19.6s (`f09-shell-scroll-verified-summary.json`). Thus all **198 distinct scroll checks** have passing evidence across the final runs; not a claimed single 198/198 run. Real Quick actions/native tab clearance is covered by the separate 63-case matrix. Application code was unchanged throughout these runs.
- Final changed/new TypeScript lint and `git diff --check` passed after the PullToRefresh/control-wrap fixes. The two existing warnings above remain; no suppression added.
- Final Back regression: **42/42**, all three engines, zero skips/failures/retries; `test-results/f09-back-summary.json`, artifacts `test-results/f09-back-final`. Across the final accepted runs there are **303 distinct passing browser checks** (63 + 198 + 42), separate from the 134 focused unit/integration tests. These counts are scoped fixture evidence, not visual approval or device conformance.
- Graphify: local `update .`, `cluster-only . --no-label --no-viz`, `export obsidian`, `export html` workflow; final graph/report after the test correction: **9,250 nodes, 20,984 edges, 657 communities**, zero API token cost; three existing Gradle parser warnings. Follow-up query `ShellUtilities ShellNavigation MobileLayout --budget 900` resolved current owners (truncated graph neighborhood, not proof of every dependency). Generated Obsidian `ShellUtilities.tsx.md` and `ShellNavigation.tsx.md` source links verified. No semantic extraction, automatic LLM labeling, hooks or watcher enabled.
- Final exports completed: **9,905 Obsidian notes**, canvas and aggregated HTML. Exporter preserved two pre-existing notes it did not own (`Layout.md`, `layout_1.md`); it did not overwrite them. Generated graph/vault artifacts are navigation aids, not manually curated source truth or an Obsidian GUI/device test.

## Reproduction commands

From repository root in PowerShell; run browser matrices sequentially. Outputs are local ignored artifacts; the seven review screenshots are retained under this dossier.

```powershell
npm run check-types --workspace @brack/client
npx tsc -p tests/playwright/tsconfig.adaptive-shell.json --noEmit
npm run test:e2e:shell:check
npx playwright test --config=tests/playwright/adaptive-shell.config.ts --output=test-results/f09-shell-final
$env:PLAYWRIGHT_JSON_OUTPUT_NAME=Join-Path $PWD 'test-results/f09-shell-scroll-summary.json'
npx playwright test --config=tests/playwright/shell-scroll.config.ts --output=test-results/f09-shell-scroll-final '--reporter=list,json'
$env:PLAYWRIGHT_JSON_OUTPUT_NAME=Join-Path $PWD 'test-results/f09-shell-scroll-verified-summary.json'
npx playwright test --config=tests/playwright/shell-scroll.config.ts --output=test-results/f09-shell-scroll-verified --grep 'last Library control' '--reporter=list,json'
$env:PLAYWRIGHT_JSON_OUTPUT_NAME=Join-Path $PWD 'test-results/f09-back-summary.json'
npx playwright test --config=tests/playwright/back-ownership.config.ts --output=test-results/f09-back-final '--reporter=list,json'
npm run build
$changedTs = @(git diff --name-only -- '*.ts' '*.tsx')
$newTs = @(git ls-files --others --exclude-standard -- '*.ts' '*.tsx')
npx eslint @changedTs @newTs --max-warnings=2
git diff --check
```

Combined units, from `apps/client`:

```powershell
npx vitest run src/lib/shellPresentation.test.ts src/components/NativeHeader.test.tsx src/hooks/useAppHeader.test.tsx src/components/ShellNavigation.test.tsx src/components/FloatingTimerWidget.test.tsx src/components/OfflineIndicator.test.tsx src/components/ReadingSyncIndicator.test.tsx src/components/NestedReaderLoading.test.tsx src/screens/EditBook.back.test.tsx src/screens/Analytics.loading.test.tsx src/screens/navigation-recovery.test.tsx src/components/dateFieldContexts.test.tsx src/components/PullToRefresh.test.tsx src/components/ShellUtilities.test.tsx src/components/FloatingActionButton.test.tsx
```

Some local child-process commands need sandbox escalation because ordinary Windows execution returned `spawn EPERM`. Automatic review authorized the local test/build/Graphify processes; no remote data changes or deployment were requested. An initial shell-scroll launch failed before tests because PowerShell split an unquoted comma in `--reporter=list,json`; the quoted argument above is required.

The executed shell-scroll/Back commands initially used relative reporter paths, which Playwright resolved beneath `tests/playwright/test-results`. Their complete JSON reports were copied unchanged into root `test-results` beside the browser artifacts. The reproduction commands above use absolute paths to avoid this ambiguity. Test servers on ports 8082, 8091 and 8093 closed after verification.

## Review stop and continuation

F09 addresses shell composition and the native/browser distinction. It does not complete Library/Lists composition (F10), Goals (F13), independent native navigation stacks, full route retention, measured navigation performance, actual browser-toolbar behavior, packaged native/PWA QA or real assistive-technology acceptance. Do not translate fixture passes into those claims. Preserved fonts are not visually validated by blocked-font screenshots.

For review, compare the phone browser/native and tablet captures, destination menu, timer/offline composition and large-text cases in [the evidence gallery](evidence/f09-shell/README.md). The most obvious remaining screen debt is duplicated Library filters and per-book action rows. At 200% text the bounded footer scrolls and leaves limited page space; reachability checks pass but usability remains a review concern.

The original next candidate was F10 Library/Lists. That sequencing is superseded by active20 after the user's coverage objection. Reuse valid F09 shell/menu/utility ownership while closing its missing consumers; do not reintroduce viewport-based native inference, remounting responsive ancestors, guessed bottom offsets or route-owned timer/sync controllers.
