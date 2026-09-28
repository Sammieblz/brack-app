# F06 Ionic feasibility fixture

Private, isolated Ionic9.0.5 experiment; it is not an application dependency or production migration. The [decision](../../../docs/ui-ionic-fit.md) and [checkpoint](../../../docs/frontend-renewal/16-ionic-fit-experiment.md) own interpretation and current results.

From repository root:

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
```

Keep the nested lockfile and exact React/type peers; do not use force or legacy-peer-deps. The root Vite/compiler/Playwright toolchain is reused. Vite deduplicates React/ReactDOM/Router across the fixture and shared production component imports. The root/client manifests and lockfile stay unchanged.

Run fixture package operations with the fixture as the working directory and `--workspaces=false`. The fixture has no local dependency on the monorepo package; Vite's source alias and allowed workspace path provide the shared component imports. An unintended `brack-monorepo: file:../../..` entry from the initial installation was removed, including its orphan lockfile record, before the final reproducible install. Do not add that link back to make source imports work.

Manual inspection: `npx vite --config tests/fixtures/ionic-fit/vite.config.ts`, then:

| Entry | Purpose |
| --- | --- |
| `http://127.0.0.1:8090/` | Ionic modal with BRACK reading form, existing inline calendar/parser and deferred synthetic save |
| `http://127.0.0.1:8090/baseline.html` | The same page/form using the existing Radix Dialog for a matched comparison |
| `http://127.0.0.1:8090/navigation.html/library` | One actual Ionic9 router/outlet/tab tree, Library/detail and Reading/session histories |

Primitive options: `runtime=native&mode=ios` or `mode=md`; default runtime is browser. `locale=en-US|en-GB|fr-FR`, `required=1`, `min=YYYY-MM-DD`, `max=YYYY-MM-DD`, `palette=<actual BRACK theme id>`, `theme=light|dark`, `text=200` exercise renderer conditions. These are explicit fixture values, not real device detection. Navigation options use `runtime=native|browser`, `mode=ios|md` and the same palette/text helper. Route-query preservation is fixture-local.

`window.ionicFitFixture` exposes `snapshot`, `resolveSave`, `rejectSave`, and `dismiss(role)` for controlled observations. A pending save does not resolve by itself; the browser test or manual operator settles it. It does not write local production storage or a backend. `window.ionicNavigationFixture` exposes state/lifecycle snapshots and deterministic timer/subscription probes; inspect the spec for exact methods. It does not replace BRACK's real reading-session service.

Tests block non-local requests and service workers, use fresh Chromium/WebKit/Firefox contexts, and store output under `test-results/ionic-fit/`; JSON is `tests/playwright/test-results/ionic-fit-report.json`. Do not run another server on port8090 concurrently. Selected screenshots and JSON telemetry are persisted inside individual test output folders. Bundle evidence is outside the browser output directory to survive its cleanup.

**Interpret the gates correctly:** tab lifecycle adoption is expected to fail in all three engines; the modal Tab-cycle gate fails in Chromium/WebKit and passes in Firefox. They are explicit failed adoption requirements. A Playwright summary counting expected failures as successful outcomes must not be presented as universal compatibility. Unexpected passes should prompt an upstream-fix investigation; do not silently update the expectation from the observed result.

Core CSS is confined to the Ionic entries; structure CSS only enters the route-shell experiment. The primitive adapter owns its color-variable boundary, single modal scroller, explicit label, title focus and local dismissal guard. No nested Radix date overlay or parallel focus trap is used. The form's action group is the sole CSS safe-bottom inset owner. Software-keyboard/OS inset behavior is not established by resizing browser windows.

Rollback is removal of this isolated fixture, its two specs/config/tsconfig and related documentation after preserving evidence; no application or data rollback is required. Production adoption must be a separately scoped change that satisfies the decision's reopening criteria.
