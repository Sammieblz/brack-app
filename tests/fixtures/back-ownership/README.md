# F07 Back ownership fixture

This isolated browser fixture uses production `AppNavigationProvider`, `useAppBack`, `AppBackButton`, `useAppBackGuard`, the app ancestry tracker, native Back service, overlay registry and Radix/Vaul primitives. Synthetic routes use the same Library/book/edit/list path shapes as the application. The fixture is not the production app, does not authenticate, and has no backend connection.

Only Capacitor package boundaries are aliased: core runtime identification, App event subscription/backgrounding, haptics and unused external-opening imports. `runtime=android|ios|web` is explicit presentation/capability emulation. The event bridge reports registrations, removals and backgrounding calls; it does not emulate an Android predictive gesture, software keyboard or native WebView lifecycle. StrictMode is enabled to exercise cleanup.

Draft, pending-save and selection controls are synthetic guard consumers. They test coordinator contracts rather than journal persistence, mutation outcomes or account draft privacy. A deterministic elapsed-seconds counter above routes tests component continuity, not real time, background execution or timer accuracy. Reload tests cover ancestry persistence only; fixture writing and the counter are deliberately in memory. The journal fixture remains the production-editor regression gate.

## Run

From the repository root:

```powershell
npx playwright test --config tests/playwright/back-ownership.config.ts
npx tsc --noEmit --project tests/playwright/tsconfig.back-ownership.json
npx eslint tests/fixtures/back-ownership tests/e2e/back-ownership.spec.ts tests/playwright/back-ownership.config.ts
```

The dedicated Vite server uses `127.0.0.1:8091` with `reuseExistingServer: false`; do not share that port with another run. Its optimizer cache is isolated at `node_modules/.vite/back-ownership` so other fixtures cannot invalidate its prebundled modules. The config runs Chromium, Firefox and WebKit with two workers and reduced motion. All requests outside this exact origin are blocked and service workers are disabled. BRACK theme tokens, fonts and icons are declared by production code; network fonts are blocked, so screenshots use available fallback fonts.

For a diagnostic first pass that does not overwrite the combined report:

```powershell
npx playwright test --config tests/playwright/back-ownership.config.ts --project chromium --output test-results/back-ownership-chromium --reporter line
```

The combined report is `tests/playwright/test-results/back-ownership-report.json`; traces and selected presentation screenshots are under `test-results/back-ownership`. Every fresh page/reload waits for an observable fixture marker and API before assertions. State changes published by React use condition-based polling, not sleeps.

## Cases and boundaries

- Positive foreign history indices, observed PUSH/REPLACE, reload, POP/Forward and unknown gaps.
- Browser Back bypasses app-controlled task guards; an in-process reading draft and counter survive route changes.
- Pending task consumption, one active confirmation, Keep/Discard, and stale responses after route/account changes.
- Nested Popover/Select/Menu dismissal, editor dirty/pending refusal, focus return, one action per native event and physical Escape without route navigation.
- Overlay before selection before Android-root backgrounding, deferred listener registration/remount cleanup, and visible explicit Back callback/destination precedence.
- 390px, 834px and 1280px layouts, a 200% text/dark-theme sample, keyboard activation, reduced motion and horizontal overflow checks.

No result from this fixture establishes physical Android/iOS Back behavior, predictive Back, system-edge ownership, OS keyboard dismissal, screen-reader behavior, a live account/service outcome, production performance or legal accessibility conformance. It does not implement independent Ionic tab histories or adopt Ionic.

Implementation source evidence and focused checks: [F07 overlay ownership](../../../docs/frontend-renewal/evidence/f07-overlay-ownership.md). The [execution plan](../../../docs/frontend-renewal/09-execution-plan.md) and current parent checkpoint own final batch status and combined verification counts.
