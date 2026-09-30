# CR02 — Responsive post and club creation

## Current checkpoint

**Historical checkpoint: implemented and subsequently committed in `4dadc37`. The user authorized continuation to [CR03/checkpoint23](23-settings-continuity.md).** The user authorized continuation on 2026-09-30. Baseline HEAD remains `3e11d31`; the worktree was initially clean. CR01 and coverage reconciliation are committed in `93b63bc`. CR02 has passing evidence for 84 unit tests and 123 distinct browser cases, with the original failures and overlapping reruns recorded below. CR03 status now belongs to checkpoint23.

## Scope and actual consumers

| Entry | Production owner | Completed implementation |
| --- | --- | --- |
| Feed `/feed` | CreatePostDialog outside MobileHeader/NativeHeader | One dialog/editor/media owner across responsive headers; header renders only its trigger. |
| BookClubs `/clubs` | CreateClubDialog outside both headers | One club draft, fields, image selections and submission owner. |
| Readers `/readers`, Book Clubs tab | Independent CreateClubDialog outside both headers | The second live club entry has the same ownership and lifecycle contract. |

All three retain their actual dialog, focused input/editor and file-input nodes through 390 → 767 → 768 → 834 → 1024 → 1280 → 390. Text, selection/caret, post type, audience, book/club choice, genre, club privacy/location/tags/member limit and selected media are included. A ref identifies the current connected trigger after header replacement.

This closes the CR02 creation subset of checkpoint20/RS01, OF-01/02 and RC-08. It does not close those findings for Settings, Messages, header utilities, reviews, lists or other task owners. F14 retains full social-screen composition work.

## Final behavior

- Controlled task API matches the established Goals pattern: `open`, `onOpenChange`, `trigger={null}` and `returnFocusRef`; default internal triggers remain supported.
- A synchronous pending guard owns the complete upload/write attempt. Fields, formatting, selections and media changes are disabled. Close, Cancel, Escape, backdrop and app Back cannot dismiss pending work or start a duplicate attempt.
- Dirty state includes metadata-only and media-only drafts. Dismissal opens MobileAlertDialog with initial focus on Keep editing. Keeping the draft preserves it; Discard draft resets and closes. Confirmed success resets/closes once. Ordinary reopening starts clean.
- Failures retain the draft and inline error. Confirmed post uploads are reused for unchanged files. Club uploads wait for both results and cache each successful File/path separately, so a partial failure cannot unlock the form while the other upload is pending.
- Account changes, auth loading and unmount invalidate obsolete outcomes. A late upload cannot start a write for an abandoned task; obsolete results cannot close or announce into a replacement task.
- `useBookClubs.createClub` separates confirmed creation from list refresh. It returns the confirmed result immediately, suppresses stale feedback, and refreshes the current same-reader filter. A slow or failed read cannot report creation failure.
- Post writing/media sections wrap according to their available space and text size. Club hidden file controls use native inputs with explicit labels and visible label focus indication, avoiding full-width invisible overflow.

Shared corrections discovered by real consumers are included: MobileDialog/MobileAlertDialog use Radix's description IDs when a description exists; Select poppers respect Radix's available height and width. Item-aligned Select placement and selection/Back logic remain unchanged. The living contracts are [adaptive overlays](../ui-adaptive-overlays.md) and [form accessibility](../ui-form-accessibility.md).

## Source evidence and shared footprint

Read the frontend delivery/UX and Graphify skills, relevant feature/accessibility guidance, living Back/overlay contracts and coverage reports before implementation. The initial bounded graph query matched 275 nodes but displayed 52, so source imports and actual JSX callers were also checked. Generated Obsidian notes for both creation dialogs and Select were read before/after updates. Graph links are discovery evidence, not runtime acceptance.

Independent peer review identified a delayed-filter edge: a create begun under filter A could finish after filter B, while the captured A refresh was correctly rejected as stale. The hook now uses the latest refresh only after its account/generation check; a regression proves B refreshes.

| Shared surface | Source-verified consumers | Disposition |
| --- | --- | --- |
| MobileDialog | TimerContext recovery | Public API and Save/Discard policy preserved; direct description, timer and overlay regressions. |
| MobileAlertDialog | MyBooks deletion, Settings sign-out, ConfirmDialogContext and its task/deletion callers, both creation dialogs | Description association corrected without changing confirmation behavior; primitive, Back/editor and actual creation checks. Whole-screen acceptance remains with each ticket. |
| Select | Screens AddBook, EditBook, MyBooks, Onboarding, BookClubDetail; components BookListManager, GoalManager, JournalEntryDialog, JournalEntriesList, ReadingHabitsSection, social/CreatePostDialog, settings/PrivacySettings, settings/SupportContact | 24 instances in 13 live consumer files. Popper-only CSS cap; actual post first/last option checks plus existing journal and nested Back regressions. This does not certify every screen/state. |
| MobileSelect wrapper | `components/mobile/MobileSelect.tsx` | No verified source importer; not counted as a live consumer pass. |

Regenerated the source census at HEAD `3e11d31` plus this working tree: 39 routes, 507 runtime source modules, 309 presentation modules, 33 screens and 272 component modules. Counts are unchanged; imports, JSX and direct-test references reflect CR02. The original coverage-report findings remain historical and now link this continuation.

## Validation

| Check | Command / artifact | Result |
| --- | --- | --- |
| Integrated unit regressions | Command below; `test-results/cr02-unit-final.log` | **84 passed, 10 files**, after final source corrections. |
| Client types | `npm --workspace @brack/client run check-types` | **Pass**, app and Node projects after final source. |
| Fixture types | `npx --no-install tsc --noEmit -p tests/playwright/tsconfig.responsive-composers.json` | **Pass** after final coarse-pointer/selector tests. |
| Scoped ESLint | All changed application/test files; fixture directory, spec and config; `--max-warnings=0` | **Pass**. |
| Production build | `npm --workspace @brack/client run build`; `test-results/cr02-build-final.log` | **Pass**, 26.03s after final source. |
| Actual-consumer matrix | `npx --no-install playwright test --config tests/playwright/responsive-composers.config.ts`; `test-results/cr02-full-2*` | **76/78**, then **9/9 affected follow-ups**: passing evidence for all 78 distinct cases. Original Firefox failures are retained below; no application source changed after the main matrix. |
| Endpoint/capture follow-up | Same config, `--grep 'genre selector|screenshots: short-height'`; `test-results/cr02-endpoint-final*` | **9/9**, all three engines; updated fixture cadence and pre-capture action check. Overlaps the main matrix. |
| Shared overlay regressions | `adaptive-overlays.config.ts --grep 'adapts real tasks|guarded dismissal|long note' --workers 1`; `cr02-adaptive-regression*` | **27/27**, all three engines. |
| Nested Select/Back regression | `back-ownership.config.ts --grep 'native Back closes only the nested surface' --workers 1`; `cr02-back-regression-final*` | **3/3**, all three engines. |
| Full journal Select/retention regression | `journal-save.config.ts --grep 'full:.*(resizing|rejected save)' --workers 1`; `cr02-journal-regression*` | **6/6**, all three engines. |
| Existing actual Feed writing | `live-composers.config.ts --grep 'Feed:' --workers 1`; `cr02-feed-regression*` | **9/9**, all three engines. |
| Geometry/visual prerequisite | `responsive-composers.config.ts --project chromium --grep 'screenshots|genre selector'`; `cr02-visual-3*` | **8/8 passed**; subset of the final matrix, not eight additional unique cases. |
| Documents / diff | Local-link check across 15 touched Markdown files; source-hash check; `git diff --check` | **539 local links resolved; all 22 source/test/fixture hashes match verified files; diff check passed.** |

All browser commands use `npx --no-install playwright test --config tests/playwright/<config>`. Runs are sequential, with one worker, separate output/report/console paths and no server reuse. Reporter overrides preserve older diagnostics. The [fixture README](../../tests/fixtures/responsive-composers/README.md) lists exact service/account/device aliases; production screens, data hooks, editor, task primitives, Router, Back and confirmation ownership remain real.

The final total is **78 distinct CR02 cases + 45 shared-consumer regressions = 123**. The main matrix was 76/78; the 9/9 follow-up completes the two missing Firefox endpoints and repeats seven already-covered cases. Smoke/visual runs also overlap and are not added to that total. The [durable verification record](evidence/cr02-responsive-composers/verification.json) preserves 11 report summaries and SHA-256 hashes for 22 changed application/test/fixture files. No application source changed after the main matrix; only the documented fixture cadence/capture checks changed.

```sh
npm --workspace @brack/client run test -- src/components/social/CreatePostDialog.test.tsx src/components/clubs/CreateClubDialog.test.tsx src/hooks/useBookClubs.test.tsx src/hooks/useRetainedReaderResource.test.tsx src/components/FrontendFormAccessibility.test.tsx src/screens/social-loading.test.tsx src/components/ui/mobile-dialog.test.tsx src/components/ui/back-layers.test.tsx src/contexts/TimerContext.test.tsx src/screens/EditBook.back.test.tsx
```

Browser checks include deferred/rejected uploads and writes, retry payloads, duplicate/pending dismissal guards, every ordinary dismissal route, connected trigger refocus, abandoned uploads, delayed club refresh rejection, nested Select/editor link ownership and actual DOM/selection/file continuity. Auth-loading and late committed-write outcomes also have focused component/hook tests. Selection menus intentionally close on window resize under installed Radix; the parent task and choice survive, and a reopened menu consumes its own Back.

Visual profiles cover 320px, ordinary 834px tablet, 834px/200% text with fine pointer and synthetic coarse pointer, 390px/200% text and 390×480. The coarse tablet asserts sheet presentation on all three entries. Tests load declared Inter, Merriweather and Playfair Display faces before captures, reject horizontal task overflow, and check writing width plus action viewport/pointer reachability. [18 retained screenshots and review notes](evidence/cr02-responsive-composers/README.md) accompany the full local 36-image set.

## Original failures and corrections

| Run / finding | Preserved evidence and resolution |
| --- | --- |
| Windows startup / first typecheck | Vitest worker startup required approved escalation. Four unsupported Testing Library `exact` role options in club tests were removed; string-name matching remains exact. Initial reporter CLI quoting failed before tests began and was corrected. A leading `^` in the first Back regression filter matched no full Playwright titles; this zero-test invocation is preserved and does not count as verification. The corrected filters above retain the intended scenario names. |
| `cr02-smoke-1` | **3/3 passed** actual responsive node/draft/selection/file continuity. |
| `cr02-full-1` interrupted | Captured progress proves 21 completed cases: **16 passed / 5 failed**. Remaining unreported cases are not counted; JSON did not flush. Failure traces/screens remain. |
| Narrow post editor at 834px/200% | Fixed 16rem media column squeezed words into fragments. Root inspected the image; intrinsic 22rem/14rem flex bases now stack when space is insufficient. No assertion relaxation. |
| Three dirty-confirmation warnings | Interactions passed, but Radix reported missing descriptions because custom IDs disagreed with its context lookup. Direct tests reproduced **2 failed / 5 passed** before fixing the real association; all seven then passed. No global warning suppression. |
| Nested Select resize expectation | Installed Radix closes Select on resize. The test now verifies selector-only closure, retained parent/choice/focus, then reopens it to test one-layer Back. Production Select/Back logic was not changed for this expectation. |
| `cr02-visual-1` | **3 passed / 2 failed**: genre options were unreachable at 390px/200% and short height. Root inspected the clipped menu; Select now applies the supplied available-space variables. |
| `cr02-visual-2` | **0 passed / 7 failed** under stronger checks: five club overflow cases and two endpoint-scroll test assumptions. Actual Fiction selection already worked in all five post profiles. Styled hidden Input sizing caused 19/409/439px observed overflow; native hidden file inputs remove it. |
| Endpoint scroll assumption | Installed Radix scroll-button mounting repositions the focused option after a one-shot DOM scroll. Tests now use bounded real wheel input, retain all pointer-hit checks, and click first/last options. No forced click or production behavior workaround. |
| `cr02-visual-3` | **8/8 passed** after all corrections, including touch-tablet sheets and no horizontal overflow. Original failed artifacts remain intact. |
| `cr02-full-2` Firefox endpoints | **76 passed / 2 failed**. Traces show only seven wheel inputs over five seconds because the polling interval grew to one second; Firefox visibly progressed through the 45-item list without reaching its endpoint. An unchanged retry reproduced **0/2**. The fixture now sends wheel input at bounded 100ms intervals for up to ten seconds; first/last visibility, all three pointer hit points and actual clicking remain required. Follow-up **9/9 passed**. Firefox required 15 inputs each direction at large text (3657px travel, 330px viewport) and 12 at short height (1550px travel, 188px viewport). No production change was needed. |
| Short-height capture review | Root noticed the saved post action screenshot did not show the full Publish button, although earlier independent action hit checks passed. The fixture now repeats the full viewport/pointer check immediately after its final reveal and before capture. This profile passed in all three engines in the 9/9 follow-up. Corrected captures show both actions fully; original image retained locally. |

Build/test warnings about dataset age, SWC/Vite transform configuration, ambiguous Tailwind easing utilities, the existing static/dynamic sync import and large chunks remain. No dependency/config change or measured navigation/performance improvement is claimed.

## Graphify / Obsidian handoff

Ran local `graphify update .` after the final code/spec changes, followed by `graphify cluster-only . --no-label --no-viz`, `graphify export obsidian` and `graphify export html`. Final graph: **9,630 nodes, 21,631 edges, 663 communities; 10,291 exported Obsidian notes**. Read the regenerated creation/Select source notes. Exports prune obsolete generated notes and preserve pre-existing conflicting files rather than overwriting them; the final export reports two such conflicts.

The first sandboxed update could not start a worker (WinError 5); approved local execution rebuilt the files. Earlier warning captures returned PowerShell status 1 despite completed rebuilds. The final update explicitly propagated the native exit code and returned **0**, as did clustering and both exports. Three existing Gradle parser warnings remain. No semantic/cloud extraction, LLM labeling, database introspection, hooks or watchers were enabled. Obsidian evidence is the generated vault and source-link inspection, not desktop GUI automation.

## Limits and next stop

Social writes remain network-only. Service interfaces do not cancel issued uploads/writes or provide create idempotency keys; upload caches last only for the current in-memory task. Ambiguous backend outcomes and abandoned storage cleanup are not solved by a frontend pending guard. Browser route departure/reload ends the in-memory task rather than persisting its draft.

Physical iOS/Android, OS keyboard/gesture behavior, VoiceOver/TalkBack, all-theme contrast and legal accessibility conformance remain unverified. F14 still owns dense club setup, optional-field grouping, large image areas and whole social-screen composition. Other corrective consumers remain assigned in checkpoint20; no whole F01–F09 or frontend-complete claim follows from this batch.

**Historical CR02 review stop, superseded by commit `4dadc37` and authorized CR03 continuation.** After the user's next approval, review/commit this complete diff and follow checkpoint20's CR03 scope. Check HEAD/worktree first; do not reopen CR01 or advance to F10 merely from test totals. The README, ledger, coverage continuation notes, source census, living contracts and evidence index now point to this completed batch.
