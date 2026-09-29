# F06 Ionic fit experiment checkpoint

Historical checkpoint: the user approved this experiment and committed it as `f90509d9ee2092e872d91933020a4a71deb4798a`. The original review-stop statements below describe that completed batch. [Checkpoint20](20-coverage-reconciliation.md) now owns current coverage corrections after F09; the specific Ionic adoption decision remains unchanged.

## Original F06 checkpoint

- Baseline: clean worktree at `2ddc1c25c3b453a5b3f923c99f4d3e58b45b7754` (F04/F05 committed by the preceding review cycle).
- Selected ticket: **F06 only**, a complete isolated feasibility experiment and adoption decision. F07 and later product migrations are not started.
- Status: **F06 complete and browser-verified as an experiment; production Ionic adoption deferred. Awaiting user review, uncommitted.**
- Authorization: user requests the next complete implementation, permits multiple tickets only if finished, requires Playwright and a durable handoff, then review before another batch/commit. No commit is requested.
- Next action: **STOP for user review.** The next implementation after authorization is F07 using the existing router; do not start it or commit in this batch.

This checkpoint supersedes the review stop in [15](15-feedback-environment-batch.md). Source and current tests outrank the historical audit or generated graph labels. Do not repeat a full repository audit to resume this batch.

## Scope and ownership

| Area | Owner | Completion contract |
| --- | --- | --- |
| Published package evidence | runtime_policy agent | Exact registry/tag peer/license evidence against installed React 18.3.1, Router 6.30.4 and Capacitor 7.4.4; no assumption from old docs or upstream main |
| Primitive experiment | Root | Real Ionic modal with BRACK form/date model, token/font bridge, one focus/scroll owner, dismissal/draft/pending/error behavior, responsive/reduced-motion browser checks |
| Navigation experiment | screens agent | Actual Ionic 9 Router 6 integration in an isolated entry, Library/detail/tab stacks, direct links/Back/Forward, draft/timer/lifecycle retention, scroll and focus checks |
| Date/accessibility boundary review | haptic_gestures agent | Existing date-only/parser/calendar and overlay/theme contracts; concrete parity risks and test evidence review |
| Integration and decision | Root | Fixture dependency isolation and bundle/CSS evidence, screenshots, final checks, ownership/adoption report, documents/skills/ledger, local graph/vault and review stop |

The experiment does not modify production routing, schemas, auth behavior, themes, fonts or icon library. Isolated package/lockfile keeps candidate dependencies out of the app build. Fixture runtime/mode emulation does not prove physical Capacitor behavior, OS gestures, real software keyboards or assistive-technology conformance.

## Initial verified evidence

- Existing graph queried for the relevant shell/date/environment owners; generated Obsidian App and date-picker notes read, then source inspected. The bounded query was truncated; omitted graph relationships are not evidence.
- The previous audit's upstream-main Ionic metadata is historical. Published Ionic React/router **9.0.5** accepts React 18.3.1 and React Router 6.30.4. Exact registry, lockfile and release APIs were verified; see [package evidence](evidence/ionic-fit-package-evidence.md).
- Production `DatePicker` owns a Radix Dialog on compact windows and a modal Radix Popover on wide windows. Placing it unchanged inside an Ionic modal would introduce two modal focus owners. The representative Ionic surface will reuse the real date-only parser and inline `DatePickerCalendar` through a fixture-local adapter; this does not replace the production DatePicker or claim IonDatetime parity.
- Official rendered Ionic documentation returned HTTP403 in this environment; official repository docs and exact published package/source are the fallback. Record exact references and version limitations in the decision report.

## Validation ledger

| Check | Status | Evidence |
| --- | --- | --- |
| Published version/peer/license check | Passed | Exact9.0.5 install, peers satisfied, artifact/license checks in [package evidence](evidence/ionic-fit-package-evidence.md); isolated React type peers pinned to installed18 versions |
| Primitives browser checks | Completed | 67 ordinary passes + 2 declared focus-cycle gate failures across three engines |
| Navigation browser checks | Completed | 30 ordinary passes + 3 declared lifecycle gate failures across three engines |
| Scoped types/lint/fixture build | Passed | Final scoped TypeScript and ESLint exit 0; fixture production build completed, 2,785 modules |
| Bundle/CSS/route/lifecycle observations | Measured | Matched initial delta +890,420 raw / +187,754 gzip bytes; [bundle](evidence/ionic-fit-bundle.md), [navigation](evidence/ionic-fit-navigation.md), [modal](evidence/ionic-fit-modal.md) |
| Decision/ownership/docs/skills | Complete | [DEFER production adoption](../ui-ionic-fit.md); retain existing router/primitives for F07–F09 |
| Graphify/Obsidian refresh | Completed locally | 8,888 nodes, 20,164 edges, 620 communities; Obsidian export reported 9,222 notes; source-linked notes inspected |

## Findings during implementation

- Ionic 9.0.5 actually supports the installed React Router 6 API; the experiment uses the published `element` API and one `IonReactRouter`, not stale Router 5 recipes. The isolated install initially resolved optional React 19 types; explicit fixture-only type pins now match the app's React 18.3.12/ReactDOM 18.3.1 types. Fixture TypeScript passed after this correction.
- A tab switch changes visible page/URL but omits Ionic page enter/leave callbacks, leaving the hidden page's lifecycle-owned subscription active and the newly visible page without its entry focus in all three engines. Installed 9.0.5 `StackManager.transitionPage` skips `routerOutlet.commit` on its `none`/root direction branch and only changes visibility. Independent source review confirmed this branch. The desired-behavior gate remains explicitly expected to fail; no fake lifecycle events or node_modules patch hides the result.
- Modal Tab traversal reaches BODY with `document.hasFocus() === false` at Tab 10 in Chromium/WebKit; Firefox retains focus for all 12 observations. This persists with Ionic's supported background root and without manual inert state. The matched Radix form cycles correctly in all three. The full evidence distinguishes observation from inferred source mechanism.
- The final decision is **DEFER both tested production boundaries**, replacing the earlier provisional standalone-primitives option. A compatible peer range and working form integration do not waive lifecycle or keyboard-access requirements. Keeping the existing foundations is the explicitly allowed completed outcome of F06, not a partially migrated app.
- Fixture integration corrections include the Shadow DOM accessible name, HSL-channel/full-color token boundary, one safe-area owner, inline calendar instead of nested modal DatePicker, live motion preference ownership, and presentation/focus ordering. `onDidPresent` fires before Ionic's synchronous focus/accessibility cleanup; the adapter hands off heading focus in a guarded microtask after that transaction. No second focus trap is added.
- Initial combined verification found two intermittent heading-focus failures and one WebKit state-snapshot race. The focus handoff above resolves the ownership ordering; timer/save snapshots now poll the unchanged expected values after React publication. Actual WAAPI playback is checked when reduced motion changes, because an `animated` prop alone did not reveal Ionic's initially false global animation veto. Initial failures and final rerun results remain distinct evidence.

## Delivered file map

| Files under `tests/fixtures/ionic-fit/` | Responsibility |
| --- | --- |
| `package.json`, `package-lock.json`, `README.md` | Exact isolated dependencies, reproducibility, interpretation and rollback |
| `vite.config.ts`, `index.html`, `baseline.html`, `navigation.html` | Dedicated build/server, three separate entry points, route fallback, shared dependency deduplication |
| `main.tsx`, `baseline.tsx`, `surface.ts`, `ionic-surface.tsx`, `radix-surface.tsx` | Matched modal adapters and single overlay ownership |
| `experience.tsx`, `reading-form.tsx` | Same form, raw date draft, existing parser/calendar, pending/failure/retry and discard guards; synthetic save only |
| `theme.ts`, `style.css`, `device.ts`, `haptics.ts` | Actual palette/font/icon preservation, narrow Ionic token boundary, explicit emulated runtime and no-op device feedback |
| `navigation.tsx`, `navigation.css` | Actual Ionic router/tab integration, independent histories, synthetic shared draft/timer and lifecycle subscriptions |
| `measure-build.mjs` | Manifest-based static/lazy closure and per-file gzip measurement, outputs restricted to local test artifacts |

Browser specs are `tests/e2e/ionic-fit.spec.ts` and `ionic-navigation.spec.ts`; configuration and scoped types are `tests/playwright/ionic-fit.config.ts` and `tsconfig.ionic-fit.json`. Current behavior, provenance and ownership are linked from [ui-ionic-fit](../ui-ionic-fit.md). Existing plan/index/skills link that decision without copying its full evidence.

## Commands and evidence boundaries

Run from repository root; port 8090 must be free:

```powershell
Push-Location tests/fixtures/ionic-fit
try {
  npm ci --workspaces=false --ignore-scripts --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'The isolated fixture install failed.' }
} finally {
  Pop-Location
}
npx playwright test --config tests/playwright/ionic-fit.config.ts
npx tsc -p tests/playwright/tsconfig.ionic-fit.json --noEmit
npx eslint tests/fixtures/ionic-fit tests/e2e/ionic-fit.spec.ts tests/e2e/ionic-navigation.spec.ts tests/playwright/ionic-fit.config.ts --max-warnings=0
npx vite build --config tests/fixtures/ionic-fit/vite.config.ts
node tests/fixtures/ionic-fit/measure-build.mjs --output test-results/ionic-fit-measurements/bundle-report.json
git diff --exit-code -- package.json package-lock.json apps/client/package.json apps/client/src
```

The setup used isolated `npm install`, then exact React 18 type pins; installs completed without force/legacy-peer flags. Final package review caught an unintended `brack-monorepo: file:../../..` dependency and orphan root lock record. Both were removed; the nested lockfile was regenerated and a clean install passed with the fixture as working directory (53 installed packages, 54 lock records, no local link/parent-path records). The original install logs do not establish the cause; do not infer that `--prefix` alone caused it. Use the explicit working-directory `npm ci` command above for reproduction.

After that metadata cleanup, scoped TypeScript and `npm ls` passed again. The rebuilt fixture retained the exact manifest SHA-256, content-hashed assets and per-file sizes from the browser-tested source; no additional full browser repeat was needed for removal of the unused link. Root/client package and lockfile hashes stayed unchanged. The final rebuild completed in 9.98 seconds; [package](evidence/ionic-fit-package-evidence.md) and [bundle](evidence/ionic-fit-bundle.md) evidence own the detailed verification.

The final combined browser suite completed in **147.5 seconds, exit 0: 97 ordinary passes + 5 declared adoption failures, zero unexpected outcomes**, verified directly from the JSON report. The reporter's `102 passed` means 102 expected test outcomes, not 102 passed requirements. The primitive group has 69 cases and navigation 33 across Chromium, WebKit and Firefox. Preserve the failed gates' desired assertions. Additional focused checks passed: 3 cross-browser actual animation-playback cases and 10 Chromium repetitions of the two corrected initial-focus cases. The final combined run includes those behavior assertions once per engine.

Browser output is `test-results/ionic-fit/`; JSON report is `tests/playwright/test-results/ionic-fit-report.json`. Gate JSON and navigation timing/retention data are persisted in individual output folders. `test-results/ionic-fit-measurements/first-combined-report.json` preserves the initial combined failure report; measurement artifacts live outside the Playwright cleanup directory. [Retained evidence](evidence/ionic-fit/README.md) includes five inspected screenshots, per-engine gate/timing JSON, the bundle report and a compact case-by-case browser result record. All browser traffic is restricted to the local fixture; no account/backend writes occur.

Nonfatal build/test warnings: stale Browserslist/baseline metadata, existing ambiguous Tailwind easing classes, fixture device adapter imported both statically/dynamically, and a chunk above 500kB. The large chunk is explicitly included in the measured cost; no warning was hidden by arbitrary threshold changes. Root production tests/build were not rerun because no production source or dependency changed; shared source was exercised through the real fixture imports.

Final documentation checks found **422 local links with zero missing targets**; new text files had no trailing whitespace. `git diff --check` passed with the repository's normal line-ending configuration. The production-source/manifests diff check passed, and HEAD remained the baseline commit above. No commit, deployment or native sync occurred.

## Graphify and Obsidian handoff

Ran the installed local CLI's `graphify update .` after the last dependency change, then `graphify export obsidian`. The final graph contains **8,888 nodes, 20,164 edges and 620 communities**; the export reported **9,222 notes** and regenerated its canvas. Read the generated `IonicSurface.md` and `ReadingForm().md` source links and verified the corresponding implementation. The bounded post-update query surfaced these owners and their existing date/environment dependencies; truncated output is not complete dependency evidence.

The AST parser reported three pre-existing Gradle syntax warnings (`android/app/build.gradle`, `android/app/capacitor.build.gradle`, `android/build.gradle`), so those files may be partially extracted. Community labels changed and may remain generic; no LLM labeling was enabled. The final vault export pruned 29 obsolete generated notes and preserved two unowned files (`data.md`, `Data_1.md`) rather than overwriting them. Treat these export limits explicitly. No semantic/cloud extraction, hooks, watchers or database introspection were enabled; generated graph/vault files remain ignored by Git. Maintained documents, source and the retained browser evidence outrank generated labels.

This is a production-build experiment and browser fixture, not a shipped product UI change. No root/client manifest, lockfile, production source, native plugin or database was modified. No authenticated flow, real OS keyboard, hardware Back, system gesture, native safe-area, installed PWA, VoiceOver/TalkBack or legal-conformance claim follows from it. Font families are preserved, but remote font requests are blocked, so screenshots use available fallbacks. Synthetic timers and warm route samples are not production performance measurements.

## Review stop and continuation

This batch completes F06 as an experiment and a DEFER decision. It does not ship Ionic or implement F07–F09. The work is uncommitted and undeployed. Stop for the user's review; do not infer permission to commit from test completion.

When the user authorizes the next implementation, read this checkpoint, inspect HEAD/worktree and use [F07](09-execution-plan.md#f07--unify-back-overlays-and-gesture-arbitration-large-p1), [the navigation specification](03-platform-navigation.md), [gesture ownership](06-motion-gestures-performance.md) and [the current Ionic decision](../ui-ionic-fit.md). First scope one complete Back/overlay/gesture ownership implementation using the existing router; include another ticket only if it can be finished and verified at the same review stop. Preserve dirty drafts, timer state, direct-link fallback and visible alternatives to gestures. F08/F09 remain later work, with native compact bottom tabs still the planned shell direction.

Do not repeat the full audit, reopen completed F01–F05 without a regression, install Ionic into root/client packages, patch upstream lifecycle events or add another modal focus trap to conceal failed gates. The retained failure evidence is a future reevaluation gate, not an instruction to keep debugging the rejected candidate before frontend renewal can continue.
