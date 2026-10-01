# CR05 - Messages layout and gesture ownership

Status: **Committed in `a610871`; historical implementation and evidence below.** The user authorized [CR06a continuation](26-social-destinations.md); the older review stop below is superseded.

## Scope and owners

CR05 closes Messages RS02/04/10: stable list/thread ownership, measured available space, retained text/files/reply/GIF/focus/history position through resize, safe local gestures, visible keyboard alternatives, Back and pending/dirty departure. This directly advances original F15/S18 phone/tablet usability; it does not claim complete notifications, durable URL history or native/AT acceptance.

| Owner | Files / work |
| --- | --- |
| Root | Messages parent, pane geometry, contextual Back/departure/refocus, integration, docs/census/graph and final checks |
| cr05_conversations | Actual ConversationsList native controls, guarded row gestures, pending/error outcomes and focused tests |
| cr05_thread | Actual MessageThread local reply/context actions, retained tasks, scroll following/latest affordance, toolbar geometry and focused tests |
| cr05_browser | Real Messages fixture on8098, independent cache/artifacts, sequential one-worker Playwright, baseline/final evidence |

## Source and baseline

- Graphify query returned244 nodes,54 within budget; truncation is not coverage. Generated Obsidian Messages source note was read; incoming source search verifies production callers.
- Messages replaces the entire compact/split ancestor chain at768. Persisted text can recover, but file/reply/DOM/caret/pending ownership does not survive remount.
- Its compact height subtracts a guessed3.5rem header; the wider branch allocates22rem to inbox from768 and requires28rem minimum height. These assumptions ignore actual footer/timer and text size.
- Whole-thread right swipe clears selection directly, competing with child/native interactions. Retire that page recognizer; preserve visible coordinator-owned Back and system edges. Local row/reply gestures use the existing contact guard and visible action alternatives.
- MessageThread currently has no reply-swipe recognizer; it prevents native contextmenu and hides message actions until hover. Do not describe an existing reply swipe as a verified fact. Incoming updates also scroll every change to the end, regardless of reading position.
- Current `OnboardingReadingPractice` has pointer-versus-keyboard motion selection but no swipe recognizer. `SwipeableSheet` has no current source definition/import. These stale CR05 discovery candidates require documented disposition, not fabricated repairs. Readers/UserProfile swipes remain explicitly outside this Messages batch under remaining route/screen work.
- **Baseline `cr05-baseline-1`:0/2** on actual Messages before parent edits.390→834 retains text but replaces the textarea node;834×1112 with200% root text and timer clips the thread offscreen (Send right edge841px). Original traces/screenshots retained; the screenshot confirms the fixed inbox is the primary geometry problem.

## Resume and boundaries

CR01 send/upload/newer-text contracts, existing account/network eligibility, brands/fonts/Iconoir and API ownership are preserved. Lookup/service boundaries and synthetic input are explicit in the fixture evidence. No backend changes, Ionic migration, generic gesture framework or route-history redesign are implied. Whole-frontend visual/native/AT/performance acceptance remains distinct from this checkpoint. Resume instructions follow the final checks below.

## Decisions and corrections during implementation

- `Messages` now has one mounted inbox/thread ancestor chain. Available workspace width and a live rem probe choose the pane arrangement;52rem is the minimum two-pane workspace. Header and actual shell/footer occupancy determine the remaining height. This replaces the768px owner swap, fixed22rem inbox and guessed viewport height.
- The parent owns Back, row selection and transient-file/reply departure; it returns focus to a connected inbox row/heading. Existing direct/start-reader state intents have explicit pending/error/retry and stale-response ownership. Account/auth-loading changes withdraw private task state.
- ConversationsList has real native open/profile controls and a visible named action group with local swipe shortcuts. Confirmed read/mute/hide outcomes remain visible through stale/failed refresh; failure remains retryable. Profile navigation in a split pane was found to bypass the thread's dirty/pending guard during review; it now asks the same parent guard and rejects stale approvals after row/account removal.
- MessageThread owns reply swipe, visible message actions, bounded history scrolling/Latest messages and async block/delete tasks. Native selection/context menus remain available. Send, reaction, delete and block serialize conflicting writes. The unsupported Report toast is removed rather than claiming to send a report.
- First real-screen `cr05-smoke-1` passed7/7 behavioral/geometry assertions, but visual inspection still found phone200% history painting behind the composer and a three-row icon toolbar. Explicit history clipping plus44px icon targets correct those observed defects. Actionable history avatars also use44px targets around36px images, preventing enlarged avatars from squeezing text. The browser fixture's missing `/reading-media.svg` was corrected to a local controlled image; it was not a production media bug.
- Root unit `cr05-parent-unit-1` passed33/34; the old synchronous account-reset test needed to await the newly guarded selection. No assertion was weakened. `cr05-parent-unit-2` passed34/34 across four files.
- Thread unit2 passed32/33 with two unhandled fixture errors from incomplete touch event objects/selection setup; corrected fixtures preserve the gesture requirements. Later added pending/focus regressions bring the final focused thread run to37/37 in `cr05-thread-unit-5-summary.json`. Intermediate passes overlap and must not be added together.
- Browser behavior1 had four fixture failures (error outside action group, actual dialog role, CDP touch setup, duplicate hidden inbox text). Corrected behavior2 passed5/5. Smoke2 passed7/8; its block refresh failure exposed a fixture subscription no-op where production listens to `messages-changed`. The fixture now models that event boundary. Original failures remain retained.

## Frontend read-receipt adapter

Source review established that `markConversationRead` ignored the `error` returned by its existing Supabase fallback update. It could resolve after both the primary request and fallback failed. The change destructures that error and throws it; it adds no query, policy, schema, payload or service operation. Four contract tests cover primary success, successful fallback, failed fallback and missing-account rejection. Actual backend behavior remains outside those controlled tests.

Installed `@supabase/supabase-js` is2.53.0; the installed PostgrestBuilder's default nonthrowing response handling was inspected. The [official update reference](https://supabase.com/docs/reference/javascript/update), retrieved2026-09-30, likewise shows checking the returned `error`. The skill's requested `changelog.md` retrieval failed with unsupported text/markdown; the [HTML changelog](https://supabase.com/changelog) was read as fallback. Current docs do not establish the installed version; no dependency upgrade or live database operation occurred.

## Durable consumer contract

[Messages ownership](../ui-messages.md) maps live route/entry/list/thread/media/task owners and states. It records unchanged network/draft semantics, stale discovery candidates and F15/native/AT limits. Root owns final combined verification, count deduplication, manifest, census and Graphify/Obsidian export; browser agent owns fixture evidence. Do not mark this checkpoint accepted from focused units or the smoke runs alone.

## Final integration and screen findings

- A confirmed hide can temporarily leave the parent hook's old catalog while the list correctly hides its row. The raw parent conversation count could contradict the empty list; the subtitle is now stable descriptive copy. The first combined lint run also caught an effect reading the user object while depending on its ID; the effect now consistently uses a primitive reader ID, preserving request identity across equivalent auth-object refreshes.
- Review found inherited reaction/delete continuations in `useMessages` could emit obsolete error toasts or success events after account/unmount/conversation replacement. Mounted identity plus the existing generation now guards these outcomes, including leave/reopen of the same ID. Actual return outcomes remain true/false, with service arguments unchanged. Thirteen added lifecycle regressions pass.
- `cr05-full-1` passed59 runnable checks with four explicit CDP skips across21 scenarios/three engines. Source review corrections landed around this run, so it is not a full final-source matrix. Root screenshot review also found the phone200% Hide control clipped by the pinned inbox header despite the old center-hit assertion passing. The header now scrolls inside the inbox's own region. The stronger predicate checks the full control against clipping ancestors and top/middle/bottom hit ownership.
- `cr05-final-geometry` passed30/30 on final source: entry/recovery, inbox actions, deletion, viewport contraction and all five visual profiles across Chromium/WebKit/Firefox. These checks overlap the full run. Latest distinct browser acceptance is **59 passed, four declared skips**, not89 passes. No complete63-case final-source rerun is claimed.
- Root inspected final WebKit phone200% thread and action captures, comparing the latter with the clipped earlier image. Hide is now fully reachable; history no longer paints over the composer. Its long label still wraps at200%, reply/file context can require bounded scrolling, and timer/header chrome remains large. These are explicit F15/shared visual-composition obligations, not a claim that the entire messaging design is finished.

## Final verification

| Check | Evidence and result |
| --- | --- |
| Combined source/lifecycle units | **138/138 across seven files**, `cr05-unit-final-2-summary.json`. Earlier combined125/125 is superseded by thirteen additional hook cases. No overlapping focused totals are added. |
| Real-screen Playwright | **59 distinct passes, four declared CDP skips**; full21-scenario matrix plus the30-case final-source correction described above. Actual Messages/children/hooks and shell; controlled service/auth/device boundaries. |
| Static checks | Client app/node types, Messages fixture types, changed-file ESLint with zero warnings and diff whitespace check pass. Initial lint warning is retained in `cr05-eslint-final.log`; corrected final log is `cr05-eslint-final-3.log`. |
| Production integration | Client build exits0 in33.88s;124 PWA precache entries. Existing tooling-age, ambiguous-easing, mixed-import and bundle-size warnings remain. |
| Source/navigation evidence | Final census, local graph update/clustering, Obsidian/HTML export and bounded source-note readback completed; details below. |

The [verification manifest](evidence/cr05-messages-layout/verification.json) records exact cases, reports, hashes and limits. [Thirty retained screenshots and observations](evidence/cr05-messages-layout/README.md) include26 final captures, four diagnostics,15 loaded-font records and66 geometry records. Ignored local `test-results/cr05-*` contains complete console/reporter output and original failed traces.

Representative executed commands (PowerShell; Vitest paths run from `apps/client`, others from root):

```powershell
npx vitest run src/screens/Messages.tasks.test.tsx src/screens/social-loading.test.tsx src/hooks/social-loading.test.tsx src/components/messaging/ConversationsList.test.tsx src/components/messaging/MessageThread.test.tsx src/services/api/messaging.read-receipt.test.ts src/services/api/social-read-access.test.ts --reporter=default --reporter=json --outputFile=../../test-results/cr05-unit-final-2-summary.json
$env:CR05_RUN='cr05-full-1'
npx --no-install playwright test --config tests/playwright/messages-layout.config.ts
# Exact executed final selection; the report retains its30 selected cases.
$env:CR05_RUN='cr05-final-geometry'
npx --no-install playwright test --config tests/playwright/messages-layout.config.ts --grep 'route entry|actual inbox|conversation actions|message deletion|Visual'
npm --workspace @brack/client run check-types
npx tsc -p tests/playwright/tsconfig.messages-layout.json --noEmit
npm --workspace @brack/client run build
```

## Local graph, Obsidian and census

Final local `graphify update .`, `cluster-only . --no-label --no-viz`, `export obsidian` and `export html` completed: **10,104 nodes,22,580 edges,689 communities and10,791 Obsidian notes**. Three existing Android Gradle parse warnings remain. Export pruned58 obsolete generated notes and preserved two pre-existing conflicting files, `Editor().md` and `editor()_1.md`. No forced overwrite, model labels, cloud extraction, database introspection, hook or watcher was enabled. The CLI prints a `[graphify watch]` logger prefix during its one-shot update; that is not a newly configured watcher.

The final bounded query found211 nodes and displayed42 at its1400-token budget; this is navigation evidence, not exhaustive coverage. The generated Messages source note was read back. The earlier10,100-node update predates the last parent/hook corrections and is superseded. Logs use `cr05-graph-*` and `cr05-obsidian-export.log`.

Refreshed census remains39 routes,511 runtime modules/styles,310 presentation modules,273 components and33 screens, with47 presentation modules lacking a static path from main. Counts describe static discovery, not rendered acceptance. Its baseline is `ef5b2f9`, with this checkpoint describing the uncommitted diff.

## Review stop and next implementation

CR05 is complete within the named Messages correction scope. No stage or commit was made. After user continuation, recheck HEAD/worktree and start **CR06 — route recovery and complete shell consumers** from checkpoint20. Start with a complete bounded child for live Readers/Post/Review/Club destination semantics (RC-03/RS05/06/07/08), then separately close remaining recovery/header-utility branches; use real source-to-entry evidence and actual screen tests. Do not expand one child into a half-finished entire application navigation pass.

CR06-CR10 and remaining main tickets overlap. Main F15 still owns durable conversation URL/history, notification recovery and composition acceptance. Main F10 Library composition is still open. Physical iOS/Android/iPad/foldable interactions, actual keyboard/AT, all-theme contrast, live backend integration and route performance were not verified by this browser fixture. Preserve the implemented task contracts while completing that work.
