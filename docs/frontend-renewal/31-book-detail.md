# F11a — Book Detail reading hierarchy

Status: **implemented and verified within scope; stopped for user review**, 2026-10-01. Baseline HEAD `b97119d`; the verified F10c working tree is inherited, uncommitted and preserved. No staging/commit. Next implementation is F11b, after review.

## Scope and evidence

Inputs are **S08/S09**, not S07 (Add Book belongs to F12). Graphify query and the generated Obsidian `BookDetail.tsx` note were checked against the live screen, TimerContext, ProgressLogger, QuickProgressWidget, LibraryRemoveDialog and source census. Book Detail renders its reading actions after all tabs in DOM order, repeats progress in At a Glance, and always calls `startTimer`, including for the current session. These are source findings; baseline browser captures follow before edits.

Complete this bounded slice: custom cover/title/progress/action composition; early reading controls with same-book pause/resume and existing other-book replacement flow; visible More disclosure for membership/share/edit/delete; single mounted content navigation through resizing; readable Overview; matching loading geometry. Retain all five tabs and existing reading/correction/journal/review capabilities. Protect the newly grouped deletion and completion actions against duplicate requests and stale presentation.

Do not rewrite timer calculations, local repositories, sync, completion/reward rules or route ownership. F11b owns ProgressTracking, ProgressLogger and QuickProgressWidget capture/correction reconstruction and integrity; F11c owns timer/session presentation and real-device lifecycle acceptance. EditBook remains a separate S08 follow-up. This slice must not be described as all F11 complete.

## Checkpoints

1. Discovery completed; source and generated navigation verified. Ionic v9 Segment/Accordion/Button documentation consulted; component decision and test evidence will be recorded before review.
2. Six Chromium baseline captures passed with all three brand font faces loaded. The first implementation retained all five groups and used a custom reading header/content split. Visual inspection found long titles too narrow at 320px/200% text; the identity now stacks below 16rem of available content.
3. First behavior matrix:20/24 Chromium cases passed. Four failures were test locators assuming `alertdialog`; the existing MobileAlertDialog intentionally renders `dialog`. Corrected the test assumption after checking its source and browser accessibility snapshot.
4. The three-engine matrix exposed an actual missing focus return after Log progress closes; this required an optional external invoker ref on the real Book Detail button. Typecheck and fixture typecheck passed; 19 existing unit tests across the shared removal and Library/List loading modules passed. The following checkpoints record the fix and completed checks.

5. Main three-engine run: 69 passed;3 failed the new Log progress focus-return assertion. Book Detail now supplies its stable invoker to an optional ProgressLogger `returnFocusRef`; all3 focused reruns passed. Dashboard is the other live ProgressLogger consumer and keeps its default behavior because this prop is optional. No logger persistence/dismissal behavior changed.
6. Existing BookDetail membership regressions: 6 passed. Added populated metadata/statistics/logs/missing-cover checks: 3 passed. Total: **81 distinct Playwright cases passing** (75 dedicated cases plus 6 existing regressions),19 unit tests passing. These are combined final evidence, not 81 tests from one run.
7. Final local Graphify update, cluster-only without labels, Obsidian and HTML exports all exited 0. 10444 nodes, 23085 edges, 720 communities; 11160 Obsidian notes. Three existing Gradle parser warnings remain. Four pre-existing note names were preserved/skipped (`Supabase_1.md`, `supabase_3.md`, `Data_3.md`, `data_4.md`); no overwrite was attempted. Read back the new BookReadingHeader and updated BookDetail source notes; a bounded query returned the new relationships. Log: `test-results/f11a-graphify.log`. AST-only, no cloud processing, watcher, hooks or live database access.

## Implemented boundaries

- `BookDetail.tsx`: reading actions precede tabs; same-session Pause/Resume; existing different-book start decision; one inline More owner; confirmed/pending/error-safe Mark finished; guarded deletion and obsolete-response handling; screen-owned content sections replace repeated Cards. All five content groups remain.
- `BookReadingHeader.tsx` and `book-detail.css`: custom book identity/action composition, named native progress, no percent for unknown totals, content-width split, narrow-text stacking, wrapping tabs, 44px controls. Foreground/background tokens provide primary text contrast while the primary theme token remains the accent. No new page gesture or animation.
- `BookDetailSkeleton.tsx`: matching reading/content geometry; separate BookListDetail skeleton retained.
- `ProgressLogger.tsx`: additive return-focus ref only. The Book Detail button survives resizing; closing via coordinated Back restores it. Its full form/save lifecycle stays with F11b.
- Dedicated fixture and 81 browser cases use real screens/primitives/hooks with explicit service/timer boundaries. Existing Library task entry helper now opens the actual More group for BookDetail too.
- [Living contract](../ui-book-detail.md), [Ionic decision](../ui-ionic-fit.md), source census and active plan/handoff updated. No production Ionic adoption is claimed; Segment/Accordion/Button were evaluated specifically. No dependency or native wrapper change.

## Final validation

| Check | Actual result |
| --- | --- |
| `F11A_RUN=baseline`, dedicated Playwright config, Chromium |6 baseline captures passed; brand font faces loaded |
| `F11A_RUN=final`, dedicated config, all engines |69 pass /3 focus failures, corrected by the following run |
| `F11A_RUN=focus`, dedicated config, `--grep 'log entry'` |3/3 pass after actual focus fix |
| `F11A_RUN=populated`, dedicated config, `--grep 'populated metadata'` |3/3 pass |
| `npx playwright test --config tests/playwright/book-detail-regressions.config.ts` |6/6 existing membership cases pass |
| `npx vitest run src/components/skeletons/LibraryLoading.test.tsx src/components/library/LibraryRemoveDialog.test.tsx` from `apps/client` |19 tests, 2 files pass |
| Client `check-types`, fixture `tsconfig.book-detail.json`, changed-file ESLint `--max-warnings=0` |Pass; initial unsupported `replaceAll` replaced with a regex compatible with the current TS target |
| `npm --workspace @brack/client run build` |Pass, 4310 modules. Existing large-chunk, mixed sync imports, ambiguous easing and stale browser-data warnings remain |
| `git diff --check` |Pass; no staged files |
| Source census generator |522 runtime modules/styles, 39 routes, 33 screens, 282 components. First sandboxed attempt could not spawn local git; elevated rerun passed |

Browser commands use `tests/playwright/book-detail.config.ts`. All full matrices ran sequentially with isolated output. The fixture supports 320/390/834/1440 widths, short landscape, 200% text, default/dark/Paper Library, and emulated Android navigation. Tests check early DOM/viewport order, primary text contrast, targets, keyboard tabs, retained correction draft during resizing, current/other timer dispatch, real log opener and close-focus, nested membership, deletion pending/failure/retry, completion consequences, obsolete account/route responses and loading region placement. [Evidence gallery](evidence/f11a/README.md) and its manifest preserve exact reports and limitations.

Final source/fixture lint and typechecks pass, including the added populated branch. No browser or dev-server session remains from these checks. All changes remain unstaged; user review is the current stop.

## Handoff and remaining work

**Next authorized continuation: F11b — progress capture and correction.** Read S09 and `ProgressTracking.tsx`, `ProgressLogger.tsx`, `QuickProgressWidget.tsx`, `useProgressLogs`, the current reading APIs/local repository contracts, and every live consumer (ProgressLogger also serves Dashboard). Build real capture/correction flows into the fixture before redesigning them. In the logger source, creation of a pending log precedes a separate local-book update; examine partial failure before claiming once-only retry. Explicitly handle dirty/pending dismissal, current-page initialization, validation, attachments, local versus remote save messaging and correction semantics. The open-task resize evidence here does not validate these save paths.

F11c owns timer/session controls, provider start reentry/permission/recovery checks, Finish/cancel decisions and physical background/resume acceptance. S08 EditBook remains unimplemented by this slice; F13 owns full journal composition and F14 full reviews. Global scroll restoration RS11 and other corrective/release gates remain open. Full F11 and frontend renewal are not complete.

The timer adapter in this fixture verifies Book Detail dispatch and the real confirmation surface, not production timer persistence or elapsed-time calculations. Service failures and offline state are controlled boundaries, not a real offline database/outbox test. Native/AT/hardware keyboards, legal conformance and performance claims remain unverified. Screenshots use synthetic books and a BRACK mark as cover; fonts are explicitly loaded. Broad viewport and populated branch checks do not constitute every theme/content combination.
