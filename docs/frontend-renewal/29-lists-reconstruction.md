# F10b — Lists and list detail reconstruction

Historical checkpoint; committed as `b97119d` before F10c. The original implementation/review evidence below remains scoped to F10b (2026-10-01). Baseline `8c01615` (F10a committed); worktree clean at entry. F10 remains open. No commit is authorized by this pass.

## Scope and source evidence

Follow S11 in 05-screen-specifications and checkpoint28's explicit continuation. Graphify queried `BookLists BookListDetail BookListManager AddBooksToListDialog`; local Obsidian `BookListManager.tsx.md` read, then actual source and tests verified. No live Obsidian connector is installed; use the local generated vault.

Production path: App routes → BookLists/auth return → BookListManager, and BookListDetail/account-keyed owner → SortableBookItem/AddBooksToListDialog. Existing service hooks, serialized writes, dirty editors, confirmed-removal projection, pagination lookup and focus fallback remain authoritative. No schema or service migration.

Source findings: Lists duplicates the compact title, boxes every section, sums memberships as books, repeats the largest collection, and gives each collection two open controls. Detail exposes drag instructions and handles during ordinary browsing, repeats detail buttons, and truncates titles. List records provide counts and metadata, **not cover previews**; this slice must not fabricate covers or add per-list reads for decoration.

## Completed-slice requirements

- One heading per screen; compact Lists retains its shell heading. Flat, themed collection rows with native destination links, full names, honest count/visibility and separate actions.
- Search plus adaptive filter/sort task retains all five filters/four sorts and selected state. Preserve URL context on detail/Back and unknown parameters.
- Detail uses genuine book covers, full titles, progress and explicit removal wording. Reorder is deliberate, with existing drag/keyboard support and visible up/down alternatives; same write serialization, rollback and read refresh.
- Preserve create/edit/delete/duplicate and membership ownership, failure/pending/dirty/account/resize contracts. Retain truthful loading/empty/error presentation.
- Preserve fonts, theme tokens, Iconoir, routing, shell runtime distinction, one overlay owner and offline/service boundaries.

## Verification and handoff

Completed: baseline and after captures, bounded reconstruction, Playwright behavior/visual checks, unit/types/lint/build checks, screenshot inspection and durable documentation/graph updates. Exact outcomes and original failures follow. Physical native/AT acceptance remains open.

The scope above is implemented. Final regression/graph closeout follows below. No F11 or unrelated reconciliation work in this pass.

## Implementation progress

2026-10-01: before captures completed in Chromium at390/834 (4/4). Manager rebuilt as collection links and sibling actions; duplicate intro/statistics/featured collection removed. Search/filter/sort use validated URL parameters while preserving unknown parameters and route state. The stable adaptive filter sheet retains five filters/four sorts; manual Load more supplements the existing observer. List records still use honest count/metadata and the existing Iconoir list mark.

Detail now uses flat cover/title/author/progress rows, native book links, explicit Remove from list, and deliberate Reorder/Done. Drag, keyboard and visible move controls share one serialized `moveBook` function and rollback path. Reorder disables browsing/addition until Done; movement is direct, without decorative scaling/transitions. Loading placeholders match the new geometry. Shared membership/editor/confirmation owners remain unchanged.

Initial focused tests:43/43 passed. First Chromium Playwright pass:19/21. Real failure: long list name at320px/200% text made the sticky header obstruct controls. Fix: short Book List shell heading; full name scrolls in the page. Test-assumption failure: BookDetail uses Go back on phone; the test incorrectly queried desktop Back to library. Corrected the selector against source and the captured accessibility snapshot. Original failure artifacts retained in `test-results/f10b-first`.

Final refinements: narrow-pane container queries give large-text titles the full reading width; the empty manager has one Create action; default skeleton dead branches are removed without changing other variants. Drag announcements identify books and positions, with keyboard instructions and no storage IDs. The actual empty-detail Add Books to List button is now selected by the inherited fixture helper; previously it accidentally used the header button for both cases.

Further retained diagnostics: states matrix7/9 (Chromium/WebKit separate-tab tests listened for page popup instead of browser-context page; real tabs existed). Corrected against the established route fixture. Correction matrix8/9: Chromium's197px title width failed an arbitrary200px threshold; changed the assertion to require75% of available row width, retaining the actual full-width reading requirement across scrollbar widths. The three-engine title rerun passed3/3. Initial inherited task run was interrupted after repeated queries for the intentionally removed Details button/Card wrapper; its traces remain. The updated check focuses the native book link, Tabs to Remove, and measures the real article. No focus or clipping requirement is removed.

## Component-specific Ionic decision

Read current v9 documentation on2026-10-01: [List](https://ionicframework.com/docs/api/list), [Reorder group](https://ionicframework.com/docs/api/reorder-group), [Item sliding](https://ionicframework.com/docs/api/item-sliding). List supplies platform styling and row grouping; Reorder group owns drag completion through an event and `complete`. These are valid candidates, not rejected by the unrelated F06 router/modal result.

This slice selects custom collection/cover composition and the installed dnd-kit owner. Adopting Reorder group would replace that owner and require equivalent keyboard/grid/rollback/cancellation integration evidence. Adding Ionic list wrappers alone would not solve the duplicated hierarchy; sliding would add a second gesture to a surface whose only secondary action is removal. Visible removal and dedicated reorder handles keep these two tasks explicit. This is an implementation choice, **not evidence that Ionic is incompatible**, and no production Ionic component is claimed. Native shell adoption remains an open component/integration decision; F10b does not close it.

## Consumer coverage and preserved boundaries

| Actual consumer/state | Disposition |
| --- | --- |
| App `/lists` and `/book-lists` → BookLists → manager | Reconstructed; both aliases exercise search/filter/sort/detail Back; auth/sign-in ownership unchanged |
| Manager initial/refresh/error/empty/no-match/catalog paging | New composition/skeletons; cold failure/retry and first-list creation verified; manual pagination remains at the existing hook boundary |
| Manager create/edit/delete/duplicate tasks | Same mounted tasks and service methods; pending, dirty, failure/retry, resize/caret/focus and confirmed-write/read-failure checks pass |
| `/lists/:listId` → detail → SortableBookItem | Flat content, native links, named progress, Remove and explicit reorder; rollback and account guards retained |
| Detail empty/header Add → AddBooksToListDialog | Both actual triggers verified independently; partial-add retry, retained selection and later-page catalog refresh preserve ownership |
| Removal dialog → confirmed removal → list refresh | Same service outcome; Library book preserved, inline failures retained, focus restored to surviving Add control |
| Shared skeleton variants | List variants reconstructed; default/Library branches preserved, with focused loading tests and actual nested Library task regressions |
| F10a Library actions, shared overlay/shell/service primitives | Inherited; no global owner replacement, backend migration, native sync or auth rewrite |

Production files: `BookListManager.tsx`, `BookLists.tsx`, `BookListDetail.tsx`, new `components/library/collections.css`, and the three existing skeleton modules. Existing manager loading test now queries the stable searchbox name. Browser fixture changes add opt-in scenario data and persist mock reorder results faithfully; they never call live services. New Playwright spec/config/typecheck config use independent port8102/cache/output. The default web suite excludes the isolated spec. Existing library-task selectors are updated to the real empty-state trigger and native link/article.

## Verification commands and result ownership

- `F10B_RUN=f10b-matrix npx playwright test --config=tests/playwright/lists-renewal.config.ts`:72/72, three engines. Eight visual profiles for both screens, control continuity, both aliases, search/sorts/filters, native links, serial reorder/rollback/position/focus, pointer/keyboard cancellation, account change and no-match recovery.
- Additional states/corrections are retained separately in the [manifest](evidence/f10b-lists/verification.json); they overlap the matrix. Total new distinct scenarios:27 per engine,81 overall. Do not sum reruns as new coverage.
- `npx playwright test --config=tests/playwright/library-tasks.config.ts --grep 'List |List header action|Empty list action|Later-page|Account replacement|Route abandonment|Visual' --output=test-results/f10b-library-tasks-final --reporter 'line,json'`:54/54. Completed runner output reports54 passes and `.last-run.json` records a passed run with no failed tests. The CLI reporter override did not persist the requested JSON summary; the manifest records this limitation instead of linking a nonexistent report. Initial interrupted artifacts remain under `f10b-library-tasks`.
- `npm run test --workspace=@brack/client -- src/components/BookListManager.tasks.test.tsx src/components/BookListManager.loading.test.tsx src/screens/BookListDetail.tasks.test.tsx src/components/list-membership-dialogs.test.tsx src/components/skeletons/LibraryLoading.test.tsx src/components/skeletons/ReaderLoadingContracts.test.tsx`:64/64 across6 files. Earlier43 are a subset.
- Client `check-types`, isolated `tsconfig.lists-renewal.json` and scoped ESLint `--max-warnings=0`: passed. The manifest records final build and announcement checks.

Screenshots:36 checked-in captures, four before and32 after, with final narrow-layout captures replacing earlier versions. The [evidence index](evidence/f10b-lists/README.md) identifies viewports and limitations. Inspecting the390px screenshots shows all three collections in the first viewport after reconstruction; the baseline first viewport was consumed by repeated intro/metrics/featured collection/filters. At834px rows form two useful columns. Large-text controls remain reachable and titles wrap at useful widths. These are observations of the fixture, not a usability score.

Warnings retained: existing Vite/esbuild deprecation, stale browsers data, ambiguous legacy easing classes and production chunk-size warnings. No dependency upgrade or performance claim is made to silence them.

## Remaining acceptance and continuation

This completes the bounded F10b manager/detail reconstruction. Full F10 acceptance remains open: bookshelf/carousel content beyond shared actions, scroll-position restoration, sufficiently wide tablet list/detail panes, large-library measurements, and native/AT/manual usability. Native Capacitor integration, OS keyboards/safe areas/system edges and VoiceOver/TalkBack need device evidence. Keep CR06c/remaining CR06, CR07–CR10 and F11–F21 visible; they are not closed by this slice.

Stop for user review without staging/committing. On authorized continuation, next bounded slice is **F10c: bookshelf/carousel presentation and return context**, using S06 and the existing interaction/task contracts. Audit the actual two mode components and stable preview owners; preserve selection, reorder, membership, drag suppression and focus return. Then proceed to F11's Book Detail/reading-capture hierarchy. Do not restart a repository-wide audit or require the entire corrective queue as a prerequisite.

## Final closeout

Final drag-announcement checks:6/6 (keyboard cancellation/drop and pointer drop in all three engines). Final production build passed with PWA output; log `test-results/f10b-build-final.log`. All recorded implementation checks are satisfied within the stated fixture scope:135 distinct browser scenarios (81 new,54 inherited) and64 unit cases. Baseline captures and overlapping retries are not additional behavior coverage.

After final code/test edits, `graphify update .`, `graphify cluster-only . --no-label --no-viz`, `graphify export obsidian`, and `graphify export html` completed sequentially with exit0. Final local graph:10,348 nodes,22,992 edges,689 communities. Obsidian export:11,034 notes; three pre-existing protected notes (`Native_2.md`, `Dashboard.md`, `dashboard_1.md`) were intentionally skipped. Read back the generated BookListManager and BookListDetail source notes. HTML uses the tool's aggregated community view. No API extraction, model labels, live database inspection, hook or watcher was enabled. Earlier export is superseded by `test-results/f10b-final-graphify.log`.

Census:39 routes,33 screen modules,277 component modules,517 total modules/styles. Counts are discovery inventory, not whole-app acceptance. README/09/11/20 now point here;28 is historical at committed `8c01615`. Living Lists/Library/task/Ionic contracts and the evidence index/manifest are updated. No skill file required a new rule; existing delivery/UX/animation/Graphify skills were followed, and their existing task-contract link leads to the new presentation contract.

Work remains uncommitted and unstaged. Resume from this checkpoint and its explicit next slice after user review.

Continuation: the later user-authorized pass is [F10c/checkpoint30](30-library-modes.md). Historical uncommitted/no-staging notes above describe the earlier review stop, not current HEAD.
