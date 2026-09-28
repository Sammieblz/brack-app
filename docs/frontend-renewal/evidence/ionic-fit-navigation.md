# F06 Ionic navigation experiment

Status: isolated experiment; route-shell adoption is blocked by the lifecycle defect below. This file records fixture observations, not production or native-device validation. Baseline: `2ddc1c25c3b453a5b3f923c99f4d3e58b45b7754`.

## Reproducible surface and ownership

- Entry: `tests/fixtures/ionic-fit/navigation.html`, serving `navigation.tsx`; deep URLs under `/navigation.html/` are rewritten to this entry by the isolated Vite configuration.
- Pinned packages: `@ionic/react` and `@ionic/react-router` **9.0.5**, React/React DOM **18.3.1**, React Router/DOM **6.30.4**. See [package evidence](ionic-fit-package-evidence.md) for peer metadata and installation boundaries.
- One `IonApp`, one `IonReactRouter` with basename `/navigation.html`, one `IonTabs` and one direct-child `IonRouterOutlet`. Routes use the installed version's `Routes` / `Route element` API. There is no enclosing or nested `BrowserRouter`.
- Ionic owns retained route pages, tab histories, their hidden state and `IonContent` scrolling. The fixture owns synthetic data, a context above the pages for a reading note and deterministic timer, visible safe Back fallback, and a heading focus policy in `useIonViewDidEnter`.
- Every fixture page subscribes to a synthetic event on `useIonViewDidEnter` and unsubscribes on `useIonViewWillLeave` or component unmount. A deterministic pulse exposes background work without depending on timer throttling. This deliberately exercises the lifecycle contract an eventual real page would need.
- `runtime=native|browser` and `mode=ios|md` are explicit **presentation emulation**. Native presentation places destinations at the bottom; browser presentation places them at the top. This is not F09 implementation, a Capacitor bridge, or hardware Back validation. Query parameters survive links and fallback navigation.
- Existing BRACK CSS, actual theme palette tokens, Inter/Merriweather/Playfair font roles and Iconoir icons are retained. The fixture does not establish font-download success or complete contrast conformance merely by checking computed font-family names.
- `core.css` and **`structure.css`** are imported only by this navigation HTML entry. Structure CSS fixes the document, hides body overflow, changes text adjustment/interaction defaults and transfers scrolling to `IonContent`. This broad document impact prevents treating it as a drop-in production stylesheet. The standalone primitive entry has a separate style boundary.

## Confirmed Ionic 9.0.5 tab lifecycle defect

Initial Chromium run: **7 passed, 3 failed**. Browser Back/Forward, deep-entry reload, both safe Back fallbacks, long-scroll restoration and presentation checks passed. The three failures reached the first tab switch and observed the same lifecycle problem. Original artifacts are preserved in `test-results/ionic-fit-navigation-initial/`.

Reproduction: open Library, enter Reading book 1, type in the note, then activate the Reading tab. The URL changes to `/navigation.html/reading`, Reading is visible, and the book page becomes `display:none` / `aria-hidden=true`. However:

- The hidden book has `enters=1`, `leaves=0` and remains marked active by its real lifecycle subscription.
- Reading mounts but has `enters=0`; its `useIonViewDidEnter` handler has not run.
- A pulse still reaches the hidden page's subscriber. The visible page's heading-enter focus policy does not run.

The initial tests polled the expected active page for five seconds, so this was not merely a synchronous assertion before a normal delayed lifecycle event. The URL and visible page had already changed. Independent source review confirmed the mechanism in installed `tests/fixtures/ionic-fit/node_modules/@ionic/react-router/dist/index.js`:

| Source anchor in 9.0.5 | Mechanism |
| --- | --- |
| `StackManager.transitionPage`, line 2581 | `routeDirection='none'` becomes an undefined transition direction. |
| Lines 2697–2700 | A non-animated transition with a leaving page enters a branch that explicitly skips `routerOutlet.commit()`. Tab switches use this path. |
| Lines 2714–2781 | The branch shows the entering page and hides the leaving page, including `aria-hidden`, but dispatches no enter/leave lifecycle events. |
| Other branch, `runCommit` around line 2641 | Calls the core outlet transition that normally dispatches the lifecycle events. |

The shortcut is selected by navigation direction, not the `animated` preference; enabling animations does not repair this tab-switch path. These line numbers are tied to the exact installed 9.0.5 distribution and must be rechecked after any version change.

## Gate test and interpretation

`tests/e2e/ionic-navigation.spec.ts` retains the desired contract in the explicitly named **ADOPTION GATE: tab switches stop hidden-page subscriptions and enter the visible page** test. After reproducing the transition and attaching real lifecycle/DOM observations, it calls `test.fail(true, ...)` with the specific 9.0.5 defect explanation, then asserts that only Reading is active. It does not synthesize lifecycle events, patch dependencies or substitute URL matching for lifecycle correctness.

This expected failure is a **failed adoption requirement**, not a successful router qualification. An unexpected pass requires investigating an upstream fix and removing the expected-failure declaration only after the underlying contract is restored. Other tests use visible-page readiness so URL, tab-history, state and scroll behavior can be evaluated independently without silently claiming lifecycle success.

Focused commands from the repository root:

```powershell
npx eslint tests/fixtures/ionic-fit/navigation.tsx tests/e2e/ionic-navigation.spec.ts
npx tsc --noEmit --project tests/playwright/tsconfig.ionic-fit.json
npx playwright test --config tests/playwright/ionic-fit.config.ts tests/e2e/ionic-navigation.spec.ts --output test-results/ionic-fit-navigation --reporter line
```

The fixture uses port 8090; do not launch competing fixture servers on that port. The parent F06 ledger records final combined run counts, including declared gate failures separately from normal passing cases.

Revised focused matrix: **30 ordinary checks passed and 3 declared lifecycle gate failures**, across Chromium, WebKit and Firefox (33 expected test outcomes, 1.0 minute, exit 0). Playwright's line reporter prints `33 passed` because expected failures count as successful test outcomes; that phrase must not be used as evidence that 33 behavioral requirements passed. Scoped ESLint and the fixture TypeScript check passed.

The final combined 102-case run reproduced the same navigation result:30 ordinary passes and 3 declared lifecycle failures, no unexpected outcomes. [Retained artifacts](ionic-fit/README.md) include the per-engine lifecycle and retention/timing JSON plus the [case result summary](ionic-fit/browser-results.json).

A later combined run exposed a WebKit test-readiness race: immediately after queuing the additional 29 synthetic seconds, the snapshot still held 61 instead of the expected 90. Both timer milestones now poll for React's published state, and the reduced-motion test polls the outlet's actual `animated` property. Expected values and the lifecycle adoption gate are unchanged; there are no arbitrary sleeps. The parent ledger records the final rerun result.

Verified ordinary behavior includes browser Back/Forward, deep-entry reload, safe direct-entry fallback, independent tab history, shared reading note and synthetic timer continuity, retained Library scroll, already-loaded offline navigation, live reduced-motion selection and presentation-specific tab placement. Six repeated Library/Reading round trips did not increase retained page count; the test enforces a maximum of four retained pages in this four-page scenario. Hidden text fields are excluded from role queries and keyboard tab traversal; this does **not** repair the missing visible-page enter focus in the declared gate.

Selected 390px iOS-presentation, 834px Material-presentation and 1280px browser-presentation screenshots are saved as `navigation.png` in each presentation case's output directory. The Chromium phone and desktop captures were visually inspected. Final combined-run artifacts also persist `synthetic-navigation-retention-and-timing.json` and `ionic-9-0-5-missing-tab-lifecycle.json` so evidence does not depend on an in-memory reporter attachment. The first contains actual sampled transition durations and DOM counts; the second records lifecycle counts, pulse outcomes and visible/hidden DOM state.

## Evidence limits and reopening the gate

The synthetic timer advances only when the test invokes `advanceTimer`; it proves ownership across navigation, not elapsed-time accuracy, background execution or the production reading-session service. Drafts are process memory, not durable storage. Offline checks cover already-loaded client navigation, not an offline reload or production synchronization. Retained-page counts and transition durations describe this small, warm synthetic fixture and are not production performance targets or native memory measurements.

The experiment has no live accounts, database writes, native plugins, authentication redirects, real keyboard occlusion or physical device gestures. Browser keyboard checks do not establish VoiceOver/TalkBack compliance. Native iOS/Android packages, actual safe-area chrome and hardware Back remain unverified.

Keep the existing production router. Reopen route-shell adoption only with a supported upstream lifecycle fix, removal of the expected-failure declaration, passing tab enter/leave/subscription/focus checks in all supported browsers, and then native-device validation. Standalone primitive adoption is a separate decision governed by its own evidence.
