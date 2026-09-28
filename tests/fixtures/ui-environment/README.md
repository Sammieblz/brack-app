# UI environment browser fixture

Run from repository root:

```powershell
npx playwright test --config tests/playwright/ui-environment.config.ts
npx tsc -p tests/playwright/tsconfig.ui-environment.json --noEmit
```

The fixture binds only `127.0.0.1:8089`, requires a fresh server, blocks service workers and external requests, and runs Chromium, WebKit and Firefox. Artifacts are isolated in root `test-results-ui-environment/`, outside the default Playwright output cleanup tree. Do not commit generated artifacts.

Real implementation: canonical platform service, observable UI environment, usePlatform/useBreakpoint/useAppViewportHeight adapters, BrowserRouter, MobileBackButton and NativeScrollView. F07 retired the route/drawer edge hooks; this fixture continues to assert unprevented browser-edge input and an unchanged route without retaining deleted owners. A local note and page counter prove component state survives adaptive updates. No live backend, authenticated records or database access.

Controlled boundaries: a Capacitor module adapter reads `?runtime=web|ios|android|unknown`; the desktop bridge is injected before page load; standalone MediaQueryList and keyboard/pinch VisualViewport changes are synthetic test inputs. Haptics are disabled in this fixture because F04 verifies that boundary separately. No screen or route is redesigned here.

The platform service's lazy Browser/AppLauncher imports resolve to adapters that throw if invoked; the fixture does not exercise external native operations. The initial incomplete shim caused a fixture build failure, corrected before the successful matrix of 33 checks (11 scenarios per browser).

Coverage: phone-size runtime/auth identity, browser iPad desktop UA, browser edge-gesture noninterception, split-view draft/session preservation, visual versus layout geometry, standalone changes, missing-capability fallback, reduced-motion changes and visible Back. Unknown runtime uses the web fallback. Existing 768px consumers remain compatible while new window classes use 600/1024 bands.

This is controlled browser evidence, not packaged-device, real keyboard/zoom, installed PWA, real reader timer or screen-reader validation. See [living contract](../../../docs/ui-environment.md) and [batch checkpoint](../../../docs/frontend-renewal/15-feedback-environment-batch.md) for scope and actual run results.
