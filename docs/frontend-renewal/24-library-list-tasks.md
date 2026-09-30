# CR04 - Library selection and list outcomes

Status: **Implemented and verified within the source/unit/browser scope below. Stop for user review; uncommitted.** The user authorized continuation after CR03. During startup the user committed CR03 as `74ed7d7`; the worktree was then clean. That is this checkpoint's source baseline. No commit requested for CR04.

## Complete scope

CR04 closes OF-01/06 and RC-06 from [coverage reconciliation](20-coverage-reconciliation.md): actual Library preview ownership through resize, nested membership/removal tasks, truthful list mutation outcomes, and every live AddToList/AddBooks entry. It is the correctness prerequisite to main F10, not F10's complete visual redesign.

| Owner | Files/tasks |
| --- | --- |
| Root | LibraryBookshelfSelection, shared Library book removal, MyBooks bulk removal, BookListDetail membership removal/reorder and one AddBooks owner; final integration/docs/verification |
| cr02_club | useBookLists mutation contract, BookListManager create/edit/delete/duplicate tasks and focused units |
| cr02_post | AddToListDialog/AddBooksToListDialog lookup, pending/failure/partial-completion/identity ownership and units |
| cr01_comments | Actual screen Playwright fixture, isolated port8097/cache/reports, finite scenario matrix and retained visual evidence |

## Source findings and decisions

- Graphify query found the relevant hooks, live parents and services; its 311-node neighborhood was truncated, so source/consumer search supplements it. Generated Obsidian BookListManager note was read. Neither graph breadth nor a listed import proves rendered coverage.
- Bookshelf selection switches Sheet/Dialog at a width boundary, replacing nested tasks. Use one adaptive dialog owner; preserve cover/theme presentation and live trigger restoration.
- `useBookLists` swallows update/delete/membership errors; manager and membership UI then announce success. Mutations must reject failed service writes; confirmed writes remain confirmed if refresh later fails. Preserve current local/outbox services and background sync, not the old audit's assumption of remote-only writes.
- `addBooksToList` loops individual adds. Track each confirmed book so partial failure retains only failed/unattempted choices for retry. `duplicateBookList` may create a partial copy before rejecting; report that possibility and refresh without automatically duplicating again.
- BookListDetail has two independent AddBooks instances and automatic-closing removal confirmation. Use one owned task shared by actual header/empty triggers and async removal with error/retry.
- MyBooks removes book rows optimistically before a nested delete finishes, and closes bulk confirmation before outcome. Keep pending task controls mounted, serialize intent, preserve rejected/partial selections and scope continuation to the current reader.

## Verification and resume

| Check | Actual final evidence |
| --- | --- |
| Focused units | **117 distinct passes /9files**. `cr04-unit-final-summary.json` passed116/116; the later `cr04-focus-unit-summary.json` passed46/46, with45 overlapping and one new fallback regression. |
| Actual Library/list browser tasks | **97 distinct passes, two declared CDP skips** across33 scenarios and Chromium/WebKit/Firefox. Full `cr04-full-1` passed92 with two focus failures and two skips; the corrected `cr04-focus-final` passed16 with two skips, includes three newly exercised flat engine cases, and overlaps prior removal cases. No full99-case rerun is claimed. |
| Existing Library interactions | **33 passes, six declared CDP skips**, `cr04-library-regression-summary.json`. Actual cover/title/metadata activation, Enter/Space/refocus, nested portal actions, shelf keyboard/pointer reorder, carousel drag and trusted Chromium swipe/interruption. |
| Shared shell regressions | **21/21 passed**, `cr04-shell-regression-summary.json`: draft/caret, timer/offline footer, large text, header focus clearance, actual Add/Edit Book forms and320px utility reachability across three engines. |
| Static and production | Client app/node types, fixture types, final changed-file ESLint with zero warnings and diff whitespace check passed. Final production build exited0 in27.75s (4,301 modules,124 precache entries); existing tooling-age, ambiguous-easing, mixed-import and chunk-size warnings remain. |

Combined accepted coverage is117 unit checks plus151 distinct passing browser checks and eight declared browser touch skips. The [verification manifest](evidence/cr04-library-list-tasks/verification.json) records exact per-case outcomes, retained diagnostic reports and source/fixture hashes. [32 retained screen captures](evidence/cr04-library-list-tasks/README.md) include loaded font and geometry evidence. Local ignored `test-results` holds complete reports, console logs and original failing traces.

Representative final commands (PowerShell; browser matrices sequential, one worker and independent reports):

```powershell
# Unit reports are the complete nine-file command plus the focused three-file correction.
npx vitest run src/components/library/LibraryRemoveDialog.test.tsx src/components/library/LibraryBookshelfView.test.tsx src/components/SwipeableBookCard.test.tsx src/hooks/useBookLists.mutations.test.tsx src/hooks/libraryLoading.test.tsx src/components/BookListManager.tasks.test.tsx src/components/BookListManager.loading.test.tsx src/components/list-membership-dialogs.test.tsx src/screens/BookListDetail.tasks.test.tsx
npx playwright test --config tests/playwright/library-tasks.config.ts --workers 1
npx playwright test --config tests/playwright/library-interactions.config.ts --workers 1 --grep 'native Enter|nested actions|shelf keyboard|shelf pointer|dragging a carousel|touch swipe|interrupted row|cover, title'
npx playwright test --config tests/playwright/adaptive-shell.config.ts --workers 1 --grep 'task node, caret|width-only reflow|active timer and offline|large text retains|real form keeps|320px with large text'
npm --workspace @brack/client run check-types
npx tsc -p tests/playwright/tsconfig.library-tasks.json --noEmit
npm --workspace @brack/client run build
```

Vitest paths above run from `apps/client`; the remaining commands run from the repository root. Exact executed arguments/output paths are retained in the JSON reports and fixture README. Do not rerun into an old evidence directory or add overlapping counts. Earlier root units passed43/43, then the added responsive swipe/focus case failed43/44 because a spread gesture ref replaced its fallback ref; composing both refs repaired44/44. Initial types exposed Testing Library's unsupported `exact` role-query option, then passed after correction. The first browser smoke0/2 incorrectly expected unchecked membership choices while their state was unknown; the corrected test preserves the stricter production checking/error/retry behavior. These failures remain historical evidence.

**Review stop:** CR04 is complete within this bounded implementation and verification scope. Nothing staged or committed for CR04. Current baseline remains `74ed7d7`. After the user approves continuation, recheck HEAD/worktree and start **CR05 - Messages layout and gesture ownership** from checkpoint20. CR05-CR10 and remaining main tickets overlap; F10 composition and native/AT/performance acceptance remain open. Do not restart CR04 or treat its correctness evidence as the full frontend redesign.

## Screen-level findings during verification

- `cr04-smoke-2` passed1/4. An actual flat-card pending dialog backdrop click bubbled through its React portal to SwipeableBookCard, navigated to the book and unmounted the task. Card activation and capture suppression now require actual DOM containment; portaled clicks neither activate the card nor consume a post-swipe suppression flag. The regression passed30/30 in `cr04-portal-unit-summary.json` (29 overlap the combined run).
- The combined unit run passed112/112 across9files before that additional portal case. Client app/node types, changed-file lint and production build passed after the containment fix. Later screen corrections require their own final checks; these intermediate totals are not final acceptance.
- First full Chromium matrix `cr04-chromium-1` passed26/31. Three fixture entries tried to pointer-click the semantic button behind deliberately delegated visible carousel text; corrected entry uses the real title surface. Bulk selection must open the actual collapsed Library controls. All original failed reports remain retained.
- The expanded targeted run `cr04-chromium-2` passed5/9 and found real BookListDetail row geometry defects:75px overflow at390px/200% text and a clipped removal control at834px/200%. Card drag/remove actions now have a separate toolbar with44px icon targets, and columns use a content/text-size-aware minimum. The modal-only checks in the first run had missed the underlying row; subsequent checks include its reachable controls and overflow.
- Both nested preview Back assertions still failed after the child dialog fully disconnected. `cr04-back-diagnostic` passed0/2 and captured an actual restored-focus Add to list tooltip above each preview. The existing Radix top-layer contract closes that tooltip before the preview. Final tests must explicitly observe that layer sequence; do not claim two Back presses close both task and preview.
- Source review confirmed a later-page ownership defect: catalog refresh replaces its loaded pages with page1, briefly dropping metadata for an open later-page list and unmounting its AddBooks task. The route/account owner now retains verified metadata through incomplete catalog lookup/transient errors, while a complete missing result or access failure withdraws the task. All11 actual list-detail units pass, including three new continuity/withdrawal cases. The actual later-page browser case passed1/1 in `cr04-later-page`; the final full matrix includes it.
- `cr04-chromium-3` passed7/8: the corrected row fit exposed Scroll to top covering Remove at390px/200% text. The shell now reserves4.5rem bottom scroll/page-end space while that floating control is visible; later primary-action/editing rules retain CSS precedence. The browser check tabs from actual Details into Remove and requires full visibility plus three pointer hit points. `cr04-visual-final` passed5/5: all four profiles plus carousel Enter reopening and explicit layered Back. A floating button may overlap content at arbitrary manual scroll positions; the verified contract is reachable controls through ordinary scrolling and keyboard revelation.
- The complete32-scenario, three-engine `cr04-full-1` run passed92 checks, failed two WebKit preview-removal focus checks and explicitly skipped two non-Chromium CDP touch cases. Replacing the immediate generic focus assertion with polling for the named Library books main still failed0/2 in `cr04-focus-diagnostic`; this was a settled product defect. MyBooks had focused the page before the preview focus scope released. Both previews now receive its connected page ref as a fallback in their close-autofocus callback. `cr04-focus-final` passed16 runnable checks with two declared skips across all engines, adding flat inline deletion and checking final-book removal as well as nested preview, list, bulk and swipe focus. Latest per-case coverage is97 passes and two declared skips across33 scenarios; no full99-case rerun is claimed. The focused units passed46/46 with one new removed-trigger fallback case, bringing the distinct total to117 across9files.

## Source and visual acceptance boundaries

The [living Library/list contract](../ui-library-list-tasks.md) records every live entry and owner, partial outcomes, identity/abandonment behavior and dormant source-only candidates. The [fixture map](../../tests/fixtures/library-tasks/README.md) lists real components/hooks and controlled API/auth/local-repository/sync/device boundaries. Main F10 still owns Library/list composition. Other BookDetail editing and deletion are not closed by its membership regression.

Root inspected the retained320px selection, AddBooks and actual list card plus200% phone/tablet card captures. The card actions fit and receive pointer input after keyboard revelation. Remaining composition debt includes empty selected-book metadata decoration, icon-heavy preview actions, and the large share of viewport consumed by wrapped native tabs at200% text. These are visual observations for F10/remaining shell acceptance, not newly claimed resolved defects. Fixture BRACK-mark covers are deterministic substitutes for real book covers. Theme/font/icon source is preserved; the full theme/contrast matrix remains open.

## Local indexing

After the final focus correction, local `graphify update .`, `cluster-only . --no-label --no-viz`, Obsidian and HTML export completed:9,978 nodes,22,340 edges,686 communities and10,660 Obsidian notes. Three pre-existing Android Gradle syntax warnings remain; final export preserved four conflicting existing notes (`Layout.md`, `mutation.md`, `Mutation_1.md`, `layout_1.md`). No force overwrite, model labeling, cloud extraction, database introspection, watcher or hook was enabled. The earlier bounded query (138 matches,33 shown) and generated LibraryRemoveDialog source note were read; truncation is explicitly not coverage. The earlier9,974-node export preceded the focus correction and is superseded.

Refreshed source census:39 routes,511 runtime modules/styles,310 presentation modules,273 component modules and33 screens;47 presentation modules lack a static path from main. The census is static discovery, not rendered acceptance. Logs use `test-results/cr04-graph-*`, `cr04-obsidian-export.log` and `cr04-census.log`.
