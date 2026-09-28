# Adaptive shell fixture (F09)

This fixture renders the production MyBooks, AddBook and EditBook screens, MobileLayout, MobileHeader/NativeHeader, MobileBottomNav, AppSidebar, ProfileDrawer and shell navigation provider, app-owned ShellUtilitiesProvider, reading timer, OfflineIndicator/ReadingSyncIndicator, JournalPromptHandler, quick actions, overlays and AppNavigationProvider. It reuses the shell-scroll fixture's deterministic 30-book collection. No screen, shell, header, navigation link, Library view or timer presentation is replaced.

Only service and data boundaries are controlled: reader/profile/books, theme preferences, social flag, notifications, network/sync state, image caching, timer session state, journal/scanner/image-picker hooks and Capacitor plugins. Theme colors come from the real palette definitions. Backend/device writes cannot reach production; book and journal saves and unexercised destructive operations throw. Preference updates and successful timer completion resolve locally. Timer completion can emit the real journal-prompt event before hiding the session, matching the production provider's ordering; the journal form is not saved. The browser suite blocks non-local requests. Google Fonts therefore fall back; screenshots do not establish deployed font rendering.

The synthetic `/note` route demonstrates an uncontrolled shell ancestor with a controlled local draft. Other destinations render a route receipt rather than their feature screens. Link behavior is real; this fixture does not claim coverage for those destination screens. Runtime, pointer, standalone display mode and visual viewport inputs are simulated. Physical IME, safe-area values, hardware Back/gestures and screen readers need device checks.

Run from the repository root, sequentially with other browser matrices on Windows:

```powershell
npx tsc -p tests/playwright/tsconfig.adaptive-shell.json --noEmit
npx playwright test --config tests/playwright/adaptive-shell.config.ts
```

The server uses port 8093, an independent Vite cache and disabled HMR. The suite runs Chromium, WebKit and Firefox with one worker. It waits for the React fixture API and real Library heading before assertions. Screenshots in each test's output directory are review artifacts, not approved visual baselines. The default JSON report is overwritten by each invocation; record exact run scope and result in the F09 checkpoint.

Scenarios cover browser/native/PWA phone and tablet shells, expanded sidebars, labelled tabs, scroll clearance, menu links and focus/Back ownership, social gates, real Library search retention, local note node/caret retention across resize, editing chrome policy, mounted menu retention through header replacement, active timer plus offline status, large text, and unscaled visual viewport versus pinch geometry. Additional cases cover width-only focus clearance under a reflowed header, actual Add/Edit Book draft and save-action geometry, timer DOM retention across routes, focus handoff into the real journal prompt, 320px combined utility/tab/quick-action reachability at 200% text, forced colors and live reduced-motion changes. Book persistence, camera scanning and journal persistence are outside this fixture's claims.
