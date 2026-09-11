# App-shell scroll regression fixture

Run from the repository root:

```sh
npm run test:e2e:shell:check
npm run test:e2e:shell
```

The dedicated configuration starts a local Vite fixture on `127.0.0.1:8082`.
Port 8082 must be free: this suite always starts its own server and will not reuse
an existing developer server. Playwright stops that server when the run ends.
It does not use the normal developer server, credentials, Supabase data, or a
running preview build. Tests block all requests outside the exact fixture origin
and disable service workers. The dedicated check type-checks these files and
their production imports, then lints the fixture, browser spec, and configuration
with no warnings allowed. Fixture data uses type-only production contracts;
component mocks are kept separate so React Fast Refresh boundaries remain valid.

The fixture renders the production `MyBooks` and `Achievements` route screens,
`MobileLayout`, sidebar primitives, `NativeHeader`, `MobileHeader`, scroll hooks,
`JourneyTabsRail`, the actual League/standings panel, and all three actual Library
view components using production styles. The route wrappers (`SwipeBackHandler`,
`PageTransition`) and viewport-height hook also match the application. Data hooks,
persistence/telemetry calls, unrelated account overlays, and the other interior
Journey panels are replaced by test-only Vite aliases. The sidebar
has its real sizing/collapse behavior with minimal contents. This is a geometry
regression, not coverage of remote data, Journey panel internals, or native OS
gestures.

The fixture uses local fallback fonts and deliberately omits the application's
external Google Fonts stylesheet. `document.fonts.ready` only settles fonts in
this fixture. A deterministic late font-family/size/line-height change tests
header remeasurement; actual delayed Google Fonts downloads are not covered.

Coverage includes down/up movement around the original 50px threshold, compact
phones through desktop, expanded/collapsed sidebars, 200% text, Journey tab
navigation, delayed data/covers, late font metrics, palette/motion combinations,
and simulated safe-inset arithmetic. Position assertions use numeric DOM bounds;
no screenshots are captured, including in retained failure traces. Chromium,
WebKit, and Firefox are configured (66 scenarios per engine, 198 tests total).
The tests wait for the selected Library view to render before
measuring geometry, assert that keyboard navigation actually changes focus and
selection, require delayed images to decode successfully, and fail on unexpected
browser errors throughout each test. A delayed request gate is always released,
including when an earlier assertion fails. Test-only source files are excluded
from the fixture stylesheet scan and watcher to prevent unrelated unit-test
edits from reloading a running browser test. Production and fixture source files
should still remain unchanged during a run.

The default Playwright configuration excludes this suite to avoid accidentally
running fixtures against a real app or backend.
