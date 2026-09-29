# F08 adaptive overlays checkpoint

## Historical state — committed in `bd342dc`

[Checkpoint20](20-coverage-reconciliation.md) now owns current coverage corrections after F09. The listed migrations and recorded results below remain valid within their fixture/consumer scope; the complete active overlay/form matrix identifies additional unmet requirements and responsive parents.

- Baseline: clean `83e032bfc77d240b545cbbbc2a091ceac76538b0` (F07 committed by the user).
- Authorization: proceed with a complete next implementation, keep durable progress, run Playwright and stop for review. No commit requested.
- Status: **implementation and validation complete for the listed F08 scope; subsequently committed in `bd342dc`.** F09 is not included in this record.
- Scope: stable responsive modal foundation, MobileDialog/confirmation, ActionSheet, Goals, journal editors and date-picker presentation. Preserve existing date-only parsing/calendar, domain writes, editor guards, Back ownership, themes, fonts and icons.
- Current continuation: [19 — F09 adaptive shell](19-adaptive-shell.md). The prior review stop was superseded by the user's next implementation request. Retain this document as historical evidence.

## Source findings and decisions

Graphify was queried for MobileDialog, MobileAlertDialog, ActionSheet, DatePicker and useUIEnvironment; generated Obsidian source links were read and verified against source. The bounded graph result was truncated, so source consumer searches also informed scope.

- MobileDialog and Goals replace whole primitive trees at the legacy breakpoint. GoalManager owns local form state; a resize can remount it. Keep one Radix Dialog root/content and adapt geometry without replacing the form.
- DatePicker also switches Dialog/Popover; its calendar owns month/view/decade state. Latch the primitive family per open session, then choose again on the next opening. Keep anchored presentation on suitable wide/fine-pointer windows.
- ActionSheet cannot close its uncontrolled trigger variant through its action/Cancel callbacks. Give it actual controlled/uncontrolled state ownership and a name, bounded scrolling and grouped actions.
- Existing journal hooks already guard pending/dirty exits. Preserve callbacks and same focus owner; migrate only the surface.
- Reuse UIEnvironment visual geometry. No new viewport listeners, keyboard-visible inference, native plugin, body positioning owner, or changes to the layout viewport used by the app shell. Pinch zoom remains browser-owned.
- Compact windows and medium windows with a coarse input capability use sheet presentation; others use a centered task surface. Runtime does not override window geometry.
- One scrollable surface keeps heading, content and actions reachable at short heights and large text. Do not create fixed header/footer budgets that consume all available height. No decorative drag handle or unverified dismiss gesture.
- Utility overlays open/close immediately; no new decorative transition or delayed close. Resizing never animates geometry. Reduced motion and keyboard invocation remain immediate.

## Owners

| Owner | Files / responsibility |
| --- | --- |
| Root | AdaptiveDialog primitive/styles, MobileDialog/confirmation, journal surface migration, integration fixture, checkpoint/living docs and sequential browser validation |
| runtime_policy | Existing-store viewport helper/hook and policy/geometry tests |
| screens | DatePicker presentation, date tests and browser scenarios |
| haptic_gestures | ActionSheet/Goals migrations and focused tests |

## Validation ledger

| Check | Actual result / remaining work |
| --- | --- |
| Shared viewport helper/hook | 27/27 focused tests; lint passed |
| Date parser/field/calendar/onboarding | 123 unique focused cases passed across four files after correcting the existing EditBook test's missing ConfirmDialogProvider; first combined run was122/123 |
| Journal/timer/Back registry | 28/28 tests passed; initial root-directory Vitest command found no files, corrected to client working directory |
| ActionSheet/Goals/Dashboard/context menu | 17/17 passed; actual Dashboard parent-type change and real GoalManager form covered |
| Final full focused unit set | 198/198 passed across14 files, including confirmation/action/Goals/timer, viewport, date/parser/consumers, journal and Back registration |
| Journal Playwright | Final 60/60 passed across three engines, `test-results/f08-journal-final`; earlier 60/60 preserved in `test-results/f08-journal-save` |
| Date Playwright | Final81/81 passed, `test-results/f08-date-final`. Initial80/81 and three unchanged WebKit retries retained; initial trace contains Vite reconnect/page reset mid-interaction. Fixture HMR now disabled |
| Adaptive Playwright | First run37/45 exposed focus/occlusion issues. Targeted fixes12/12 passed; full final matrix45/45 passed, `test-results/f08-adaptive-final` |
| Real Goals browser addition | 3/3 passed; target/date draft and intentional nested calendar, `test-results/f08-goals-browser` |
| Forced colors/live motion | Final3/3 passed, `test-results/f08-overlay-accessibility-final`; initial Chromium test exposed inherited global transition, now disabled on surface/backdrop |
| Client and fixture types | Final client app/node checks passed; adaptive/journal/date fixture checks passed |
| Changed TS(X) lint / skills | No errors; one existing TimerContext Fast Refresh warning independently reproduced from HEAD. Both edited skill entrypoints pass quick_validate |
| Production build | Passed; existing browser-data/easing/mixed-import diagnostics and current >1000kB app-chunk warning remain visible |
| Graphify/Obsidian | Final local AST refresh and no-label clustering completed: 9,118 nodes, 20,728 edges, 632 communities; 9,748 exported notes plus HTML/canvas. New primitive/viewport source links verified |
| Back browser regression | 42/42 passed, `test-results/f08-back-regression` |
| Browser total | 234 distinct final checks:51 adaptive/Goals/forced-colors cases,81 date,60 journal and42 Back. Earlier failures/retries and duplicate capture runs are not additional passes |

Original failure artifacts remain under `test-results/f08-adaptive-overlays`, `test-results/f08-overlay-accessibility` and `test-results/f08-date-picker`; retries do not overwrite them. Default JSON summaries may be replaced by a later targeted run of the same config; this ledger records each completed command's result, not a claim that the latest summary contains the entire matrix.

## Observed failures and corrections

- Synthetic visual viewport shrink hid the focused last input in a long form. Adaptive content now scrolls that existing field into view when unscaled geometry changes, preserving focus/selection. Pinch scale remains browser-owned.
- An outside pointer's default focus action could blur a synchronously opened guard confirmation. Prevent that native default while leaving Radix's dismiss request intact. Dirty/pending veto still belongs to feature code.
- Safari pointer activation may not focus its button. Visible adaptive Close explicitly focuses itself before requesting dismissal; external confirmation invokers can supply a ref. Settings sign-out and Library bulk-delete now wire their actual invokers. The synthetic review control uses the same API. The occlusion test clicks the last field before typing to establish a visible user interaction, rather than relying on Playwright fill's programmatic focus to scroll in WebKit.
- Visual review found destructive-colored text hard to read on the dark action surface. Action labels and focused confirmation text now use theme foreground, retaining destructive grouping/border/consequence text. Browser assertions measure at least4.5:1 label-to-surface contrast for sampled light/dark action surfaces; this is not a whole-theme conformance claim.
- Date consumer unit setup lacked the confirmation provider introduced by committed F07. Added the real provider, retaining date/persistence assertions. Testing Library's unsupported `exact` role option was removed without changing its exact string name assertion.
- Chromium's forced-colors/motion check found a global base color/shadow transition inherited by the modal. The adaptive surface/backdrop explicitly opt out; the same test then passed in all three engines. Original assertion and trace remain preserved.

## Source map and review artifacts

Foundation: `components/ui/adaptive-dialog.tsx/.css`, `lib/overlayViewport.ts`, `hooks/useOverlayViewport.ts`. Consumers: MobileDialog/Alert, ActionSheet, GoalsSheet/GoalManager/Dashboard, full/quick journal, Timer recovery, DatePicker, PostCard and explicit Settings/Library confirmation invokers. [Action/Goals evidence](evidence/f08-action-goals.md) records its bounded consumer audit.

Living contract: [adaptive surfaces](../ui-adaptive-overlays.md), with date/journal/environment/Back and skill entrypoints updated. New synthetic browser fixture lives under `tests/fixtures/adaptive-overlays` (port8092, isolated cache); real journal/date suites remain separate.

Visual review inspected compact reading-note, tablet action-sheet, desktop task, nested Goals/calendar and enlarged dark-action screenshots. Four portable [review captures](evidence/f08-overlays/README.md) are retained with these documents. Fonts use locally available fallbacks because fixture requests outside the local origin are blocked. Other screenshots remain in Playwright output; they are not screenshot-baseline assertions. The Goals fixture now serves the existing local brand images from client public assets; its capture-only Chromium rerun also passed.

## Reproduce this checkpoint

Run browser matrices sequentially from the repository root, with distinct artifact directories:

```powershell
npx playwright test --config tests/playwright/adaptive-overlays.config.ts --workers=1 --output=test-results/f08-adaptive-review
npx playwright test --config tests/playwright/date-picker.config.ts --workers=1 --output=test-results/f08-date-review
npx playwright test --config tests/playwright/journal-save.config.ts --workers=1 --output=test-results/f08-journal-review
npx playwright test --config tests/playwright/back-ownership.config.ts --workers=1 --output=test-results/f08-back-review
npm run check-types --workspace @brack/client
npm run build --workspace @brack/client
```

The final focused unit command, run from `apps/client`, was:

```powershell
npx vitest run src/lib/overlayViewport.test.ts src/hooks/useOverlayViewport.test.tsx src/lib/dateOnly.test.ts src/components/ui/date-picker.test.tsx src/components/dateFieldContexts.test.tsx src/screens/Onboarding.substance.test.tsx src/components/ui/mobile-dialog.test.tsx src/components/ui/action-sheet.test.tsx src/components/ui/context-menu-native.test.tsx src/components/GoalsSheet.test.tsx src/screens/Dashboard.goals.test.tsx src/contexts/TimerContext.test.tsx src/hooks/useJournalEditor.test.tsx src/lib/backLayers.test.ts
```

Fixture typing: `npx tsc -p tests/playwright/tsconfig.<fixture>.json --noEmit` for adaptive-overlays, journal-save and date-picker. Scoped ESLint covered every changed/new TS(X) file. Strict zero-warning invocation identified the existing TimerContext warning; `git show HEAD:apps/client/src/contexts/TimerContext.tsx | npx eslint --stdin --stdin-filename apps/client/src/contexts/TimerContext.tsx` reproduced it, and the final scope passed with `--max-warnings=1`. No warning was suppressed in source. Skill validation used the installed skill-creator's `scripts/quick_validate.py` on each edited skill.

Native IME/safe-area/OS Back and real assistive-technology acceptance remain device-unverified. Browser geometry injection is a synthetic layout check, not a native keyboard test.

Knowledge refresh commands were `graphify update .`, `graphify cluster-only . --no-label --no-viz`, `graphify export obsidian` and `graphify export html`, using the installed local executable and UTF-8 output. No semantic/cloud extraction, live database introspection, watcher, hooks or model labels were enabled. The existing three Gradle parser warnings remain; two case-colliding Library-loading notes were preserved rather than overwritten. The generated graph/vault is ignored by Git. Generated community names remain navigation aids, not architectural proof.

## Resume

Stop for user review; no owned browser servers remain. Implementation and verification are finished, with native/AT release gates recorded above. Do not restart the broad audit or install Ionic.

On the next user-authorized batch inspect HEAD/worktree and review any corrections first. F09 owns the browser/native/PWA shell distinction, native bottom navigation, medium-tablet behavior and shared chrome/scroll occupancy. Query Graphify for the actual MobileLayout/header/navigation/timer owners, then inspect the platform plan's relevant sections. Reuse this stable modal boundary and F07 Back coordinator; do not infer verified native tab stacks or hardware IME behavior from F08's browser fixtures. A commit requires user direction.
