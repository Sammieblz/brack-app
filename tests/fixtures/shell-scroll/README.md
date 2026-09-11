# App-shell scroll regression fixture

Run from the repository root:

```sh
npx playwright test --config playwright.shell-scroll.config.ts
```

The dedicated configuration starts a local Vite fixture on `127.0.0.1:8082`.
It does not use the normal developer server, credentials, Supabase data, or a
running preview build. Tests block all requests outside the fixture origin.

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
no screenshots are captured. Chromium, WebKit, and Firefox are configured. The
default Playwright configuration excludes this suite to avoid accidentally
running fixtures against a real app or backend.
