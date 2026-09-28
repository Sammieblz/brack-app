# F04 + F05 implementation checkpoint

## Historical checkpoint

**Superseded:** F04/F05 are committed at `2ddc1c25c3b453a5b3f923c99f4d3e58b45b7754`. The next authorized batch is the F06 experiment in [16](16-ionic-fit-experiment.md). The completed work and original review stop below are historical.

- Baseline: clean worktree at `06d519044155d1cb1d9f6e6ab3a0e23a2397e801` (F02/F03 committed by the preceding review cycle).
- Selected batch: **F04 action feedback/haptics + F05 runtime/window/capability policy**.
- Status: **F04/F05 implemented and browser-verified; STOP for user review. Uncommitted and unreleased.**
- User authorization: proceed to the next implementation; multiple tickets are permitted only if completed. Finish both, test with Playwright and relevant checks, keep durable continuation, then stop for review. No new commit is requested.
- Next action: **STOP for user review. Do not commit or start F06+ without the user's next instruction.** If review finds an issue, fix the affected batch behavior and rerun relevant checks. No additional ticket is in scope.
- Scope boundary: no F06 Ionic experiment, F07 global gesture/back owner, F09 navigation redesign, database/schema, auth-redirect behavior, dependency upgrades, theme/font/icon replacement or commit.

This is the single detailed checkpoint for the active batch. [14](14-next-implementation-batch.md) preserves F02/F03; [09](09-execution-plan.md) is the summary ledger and [11](11-agent-handoff.md) routes future agents here. Check HEAD and worktree before continuing; source and observed tests outrank old graph notes.

## Scope and ownership

| Slice | Owner | Completion contract |
| --- | --- | --- |
| F04 Add Book | Root | Confirmed create navigates immediately with existing highlight ID; no decorative 1.5s wait or postcommit first-book read that turns success into failure; preserve duplicate/error/draft and pending behavior |
| F04 haptics/long press | haptic_gestures agent | Semantic selection feedback, one haptic owner, haptics-off/capability fallback; bounded long-press cancellation, keyboard/visible alternatives and consumer compatibility |
| F05 environment | runtime_policy agent | Observable canonical runtime, separate display mode/layout width/visual viewport/input capabilities/reduced motion, reactive updates and safe missing-API fallback; preserve legacy width breakpoints and auth identity; unit and separate browser fixture |
| Integration/handoff | Root | Deterministic F04 Playwright fixture, independent review, relevant regressions/types/lint/build, living docs, explicit native/AT limits, graph/vault refresh, review stop |

F05 provides the foundation and compatible existing-hook adapters. It does not claim the later browser/native shell difference is delivered: F09 owns that rollout. Physical device, haptic hardware, native keyboard and real assistive-technology evidence remain separate from browser fixture results.

## Verified discovery

- Clean baseline HEAD `06d5190` contains the prior F02/F03 batch. Its previous uncommitted stop is historical; this user message authorizes the next implementation.
- Ran scoped Graphify query for AddBook/useHapticFeedback/ContextMenuNative/useLongPress/usePlatform/platform, read generated AddBook/usePlatform Obsidian notes, then inspected actual source. The graph result was budget-truncated; no claim relies on omitted edges.
- Manual Add Book awaits successful `bookOperations.create`, then does a separate `booksRepo.list`, shows a blocking success overlay, schedules confetti and delays navigation by 1,500ms. A failed postcommit list read can report failure despite a created book. Quick-add already navigates immediately after create.
- Native `selection` falls through the haptic impact mapping to Heavy. `ContextMenuNative` requests medium feedback after `useLongPress` has its own feedback path.
- `services/platform.ts` already owns native/Electron/PWA detection. `lib/platform.ts` instead infers iOS/Android from user-agent text; `usePlatform` initially returns web until an effect. Existing 768px layout hooks must not be globally changed to the new proposed window bands.

## Validation ledger

| Check | Status | Evidence |
| --- | --- | --- |
| Scope/source/graph/vault discovery | Completed | Findings above; individual agents verify their consumers |
| F04 focused regressions | Passed: 45 | Nine AddBook cases and 36 haptic/gesture/context cases |
| F05 focused regressions | Passed: 35 | New observable/adapters plus existing canonical platform/auth regressions |
| Combined focused suite | Passed: 80 across 6 files | Final integrated run, 9.82 seconds |
| F04 Playwright | Passed: 60 (20 × 3 engines) | Real AddBook/BookSearch and long-press/context primitives; synthetic services/device adapters; 1.2 minutes |
| F05 Playwright | Passed: 33 (11 × 3 engines) | Real environment/hooks and stateful probe, synthetic runtime/browser capability boundaries; 38.6 seconds |
| Existing relevant browser regressions | Passed: 117 | F01 journal 54 (2.9 minutes); final F02/F03 semantics 63 (1.3 minutes), following the two fixture readiness corrections recorded below |
| Final browser acceptance matrix | Passed: 210; zero skipped, unexpected or flaky in final reports | F04 60 + F05 33 + F01 54 + F02/F03 63, Chromium/WebKit/Firefox; isolated investigation reruns are not added to this total |
| Types/lint/build | Passed | Final workspace types; both fixture type/lint checks; changed client source lint zero warnings; production build 27.85 seconds |
| Independent review | Completed | Add lifecycle invariants applied; environment/legacy consumer review found no remaining blocker |
| Current docs/skills/links | Passed | Updated contracts/ledger/index/skill references; 345 local link targets across 21 changed/new Markdown files resolve; `git diff --check` passed |
| Graphify/Obsidian refresh | Completed locally after final test edit | Final AST graph: 8,714 nodes, 20,321 edges, 615 communities; final Obsidian export: 9,046 notes, 32 obsolete generated notes pruned, four unowned notes preserved |

## Final source and behavior inventory

Paths below are relative to `apps/client/src` unless stated otherwise. Current behavior lives in [action feedback](../ui-action-feedback.md) and [UI environment](../ui-environment.md); those documents are the source for future implementation constraints.

| Area | Changes |
| --- | --- |
| Add completion | `screens/AddBook.tsx`: removed page-level first-book reread, success overlay/confetti and delayed navigation; one completion helper preserves highlight ID and truthful local-save feedback; shared ref lock and disabled acquisition fieldset; unmount guards for save/initial lookup; existing Genre label now reaches its trigger |
| Haptics | `hooks/useHapticFeedback.ts`: native plugin capability check, serialized selection start/change/end with cleanup, semantic impacts/notifications, explicit current enabled opt-out, retained guarded web vibration fallback |
| Local context gesture | `hooks/useLongPress.ts`: one primary pointer, movement/cancellation/cleanup, active-contact-only global listeners, native interactive/text selection exclusions, no duplicate synthesized short click, bounded click suppression |
| Context actions/dialog | `components/ui/context-menu-native.tsx`, `action-sheet.tsx`, `dialog.tsx`: one feedback owner, visible/keyboard context trigger, focus return, fallback sheet title, additive open/disabled haptic props; outer wrapper retains one grid item per existing BookCard |
| Environment owner | New `services/uiEnvironment.ts` and `hooks/useUIEnvironment.ts`: cached observable snapshots, shared subscriptions, primitive selectors, independent canonical runtime/display/layout/visual geometry/capabilities/reduced motion |
| Compatibility adapters | `hooks/usePlatform.ts`, `hooks/useBreakpoint.ts`, `hooks/useAppViewportHeight.ts`, `lib/platform.ts`: canonical runtime without first-render web flash, unchanged 768/1024/1440 breakpoints and layout-height CSS token; no UA-to-native inference |

New tests: `screens/AddBook.feedback.test.tsx`, `hooks/useHapticFeedback.test.tsx`, `hooks/useLongPress.test.tsx`, `components/ui/context-menu-native.test.tsx`, `hooks/useUIEnvironment.test.tsx`. Existing `services/platform.test.ts` is rerun, not changed.

New browser source/config: `tests/fixtures/action-feedback/`, `tests/e2e/action-feedback.spec.ts`, `tests/playwright/action-feedback.config.ts`, `tests/playwright/tsconfig.action-feedback.json`; equivalent `ui-environment` fixture/spec/config/tsconfig. The existing `tests/e2e/frontend-semantics.spec.ts` now waits for popup and reopened-overlay readiness before asserting navigation or Escape. `.gitignore` now excludes `test-results-ui-environment/`, the independent generated output directory. No dependencies changed.

Living contracts, acquisition/device/hook references, docs indexes/testing guidance, renewal status and the frontend skill's platform/motion references have been updated. The runtime contract is a foundation; existing screen layout and bottom-navigation redesign remain F09, Ionic fit remains F06, and native global Back/gesture ownership remains F07.

## Reproduction commands

Run from repository root. Keep browser output directories separate (the journal override below avoids parent-folder cleanup):

```powershell
npm --workspace @brack/client run test -- src/screens/AddBook.feedback.test.tsx src/hooks/useHapticFeedback.test.tsx src/hooks/useLongPress.test.tsx src/components/ui/context-menu-native.test.tsx src/hooks/useUIEnvironment.test.tsx src/services/platform.test.ts
npx playwright test --config tests/playwright/action-feedback.config.ts
npx playwright test --config tests/playwright/ui-environment.config.ts
npx playwright test --config tests/playwright/journal-save.config.ts --output test-results/journal-save-f04-f05
npx playwright test --config tests/playwright/frontend-semantics.config.ts
npx tsc -p tests/playwright/tsconfig.action-feedback.json --noEmit
npx tsc -p tests/playwright/tsconfig.ui-environment.json --noEmit
npx eslint tests/playwright/action-feedback.config.ts tests/e2e/action-feedback.spec.ts tests/fixtures/action-feedback --max-warnings=0
npx eslint tests/playwright/ui-environment.config.ts tests/e2e/ui-environment.spec.ts tests/fixtures/ui-environment --max-warnings=0
npm run check-types
npm --workspace @brack/client run build
```

Scoped ESLint also covered every changed/new client TS/TSX file with `--max-warnings=0`. Existing build warnings remain: outdated browser metadata, ambiguous easing utilities, mixed static/dynamic sync-engine imports and a >1000kB application chunk. No performance budget or physical-device latency improvement was measured.

Local JSON reports: `tests/playwright/test-results/action-feedback-report.json`, `test-results-ui-environment/report.json`, and prior fixture reports under `tests/playwright/test-results/`. Production build output is ignored at `test-results/frontend-feedback-environment-build.log`. Generated artifacts are reproducible evidence, not new tracked product assets.

## Integration findings and resolved failures

1. Source review required one ref lock across manual and quick-add plus pending field/tab disabling: an old create must not discard a newly edited draft. Late initial user lookup and save results now lose navigation/toast ownership after unmount. Generic quick errors stay with BookSearch.
2. Native selection previously fell through to Heavy. Long press had both hook and component feedback, plus the dialog's opening feedback. The final contract owns one recognized-hold impact and separates other semantic actions.
3. Initial long-press implementation registered listeners on every idle card. Review narrowed global listeners to active contact lifetime and added cleanup regression coverage. The new trigger's wrapper preserves one grid item per BookCard.
4. Both new browser fixtures initially had incomplete Capacitor shims: lazy Browser/AppLauncher imports required missing core exports. Explicit throwing adapters now bound those unexercised native operations; no production plugin workaround was added.
5. F04 frozen-clock tests first expected Sonner to mount while its scheduled rendering was paused. Destination assertions already passed. The fixture now verifies navigation before allowing the announcement timer to run. A separate paused-clock/CSS exit mismatch delayed Radix focus cleanup; resuming time after recognition lets real dismissal/focus complete. Final three-engine checks passed after these fixture corrections.
6. AddBook unit tests initially used Playwright's `exact` option with Testing Library's role query. Removed that invalid option; final client types and all nine cases pass.
7. The prior F02/F03 regression run passed 62/63. Its Firefox new-tab test started a default five-second assertion before popup bootstrap completed under concurrent suite load. The trace shows the correct URL, successful module requests and the expected destination after that deadline. An isolated unchanged Firefox rerun passed (1/1). The main fixture already allows 15 seconds for readiness; the popup now uses the same helper before its unchanged destination assertion. Original trace and report are preserved in ignored `test-results/frontend-semantics-initial-popup-failure/`.
8. The next complete semantics run passed the popup cases but ended 62/63 after WebKit sent Escape immediately after reopening notifications. Explicit Close focus return passed; the trace shows the reopened overlay stayed open. The test did not wait for reopened content/focus before Escape. The correction waits for visible dialog and the auto-focused Close control, then sends Escape from that control and checks both dismissal and trigger focus. No production change, fixed delay or broad assertion timeout is added. The original trace/report are preserved in ignored `test-results/frontend-semantics-initial-escape-failure/`. The corrected focus check passed nine repeated cases (three per engine, 30.1 seconds); updated spec lint and fixture types passed. The final full semantics matrix passed **63/63** in 77.9 seconds with no skipped or flaky cases.

Focused investigation commands (the final complete suite is the acceptance result):

```powershell
npx playwright test --config tests/playwright/frontend-semantics.config.ts --project firefox --grep 'history progress links' --output test-results/frontend-semantics-popup-investigation --reporter line
npx playwright test --config tests/playwright/frontend-semantics.config.ts --grep 'explicit close and Escape' --repeat-each 3 --output test-results/frontend-semantics-focus-investigation --reporter line
npx eslint tests/e2e/frontend-semantics.spec.ts
npx tsc --noEmit --project tests/playwright/tsconfig.frontend-semantics.json
```

## Local knowledge refresh

Ran `graphify update .` against the existing index with AST-only extraction, then `graphify export obsidian`, repeated after the final test edit. No semantic/cloud extraction, live database introspection, hooks or watchers were enabled. Graphify warned about its existing partial extraction of three Android Gradle files and replaced stale community names with hub names; no LLM relabeling was run. The first export preserved unowned `Badge().md` and `badge()_1.md`; the final export reported preserving `mutation.md`, `Data.md`, `Mutation_1.md` and `data_1.md`. No user notes were overwritten to remove these warnings. A bounded follow-up query locates the new `UIEnvironment`/`useUIEnvironment` and changed `useLongPress` owners; generated source notes were read back. A truncated graph query is navigation aid, not exhaustive evidence. Current behavior remains established by source and tests.

## Evidence limits and existing follow-ups

- No packaged native/Electron run, physical haptic sensation, installed-PWA transition, real soft keyboard/pinch, foldable hinge behavior, screen reader, visual approval or accessibility conformance evaluation is claimed. Fixture viewports and synthetic bridges demonstrate renderer contracts only.
- Haptics has an explicit opt-out API, not a newly persisted settings preference; F16 owns that UI/ownership. Reduced visual motion is a separate channel.
- The acquisition adapter and account model were not rewritten. AddBook's mounted account-switch ownership and adapter-internal ancillary exceptions after local upsert are existing follow-ups for the acquisition/write-path work. Removing this page's postcommit reread does not certify every persistence outcome. Scanner semantics remain unchanged.
- Existing native swipe/pull ownership remains F07. Browser/PWA no longer receives those native-gated handlers just because its UA resembles iOS/Android; visible Back, Close and navigation alternatives remain.
- The next sequenced candidate is F06, a bounded Ionic fit experiment. It requires installed-version/peer compatibility evidence and an explicit adopt/limit/defer decision; this batch does not silently install Ionic or migrate routing.

## Resume protocol

Read this checkpoint and `git status`. **The selected implementation and browser validation are complete; preserve the review stop.** Do not rerun a repository-wide audit or infer commit/next-ticket authorization from passing tests. If the user requests a correction, inspect its relevant specification and source, implement the complete fix, rerun affected checks with independent artifact directories, and refresh this checkpoint/graph. If the user authorizes the next ticket, F06 is the sequenced candidate, subject to its documented experiment/adopt/limit/defer contract. Physical-device/AT evidence remains explicitly outstanding for release.
