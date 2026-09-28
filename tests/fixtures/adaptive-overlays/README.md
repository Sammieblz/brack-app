# F08 adaptive overlay fixture

This isolated fixture renders the real `MobileDialog`, `MobileAlertDialog`, `ActionSheet`, `GoalsSheet`/`GoalManager`, adaptive Radix content, overlay Back registration, UI environment store and viewport hook. Capacitor runtime/haptic/external-opening packages and reader/goal-data hooks are synthetic boundaries. Goal writes deliberately throw. The note, pending-write switch and callbacks are synthetic consumers; there is no authentication, backend connection or persistence assertion.

Run from the repository root, sequentially with other browser matrices on this Windows workspace:

```powershell
npx playwright test --config tests/playwright/adaptive-overlays.config.ts
npx tsc --noEmit --project tests/playwright/tsconfig.adaptive-overlays.json
npx eslint tests/fixtures/adaptive-overlays tests/e2e/adaptive-overlays.spec.ts tests/playwright/adaptive-overlays.config.ts
```

Port `8092`, Vite cache `node_modules/.vite/adaptive-overlays`, and artifacts `test-results/adaptive-overlays` are isolated. The JSON reporter writes `tests/playwright/test-results/adaptive-overlays-report.json`. Every page waits for an observable React marker and fixture API before assertions. Chromium, WebKit and Firefox run with two workers, service workers blocked and reduced motion enabled. Requests outside this exact local origin are blocked; remote fonts are unavailable, so screenshots use locally available fallback fonts.

The tests check a genuinely uncontrolled input's same DOM node, value, focus and selection across 390/834/1280px windows and a short window. Synthetic pointer media queries distinguish tablet coarse input from a medium fine-pointer window without using user-agent detection. Real controlled dismissal is refused during a pending write; dirty Close, Escape and backdrop requests open a nested confirmation. Cancel starts focused, retains the draft and restores the invoking control. An uncontrolled ActionSheet closes after an action or dismissal. Long forms/actions at 200% root font size scroll to their final action without horizontal content overflow.

Synthetic VisualViewport geometry exercises shrink/offset handling, stable runtime/window classification and layout-based bounds during pinch scale; it does not physically summon an IME or pinch the browser. Screenshots are explicitly retained via each test's output path for compact browser/Android, tablet coarse/fine, desktop and large-text tasks. They are review artifacts, not screenshot-baseline assertions.

These checks do not establish native keyboard/safe-area behavior, device pinch gestures, actual touch scrolling, hardware haptics, VoiceOver/TalkBack behavior, persistence or legal accessibility conformance. 200% root font size is a text-reflow sample, not browser-zoom or OS Dynamic Type certification. The renewal checkpoint owns exact executed counts and any remaining physical-device checks.

Real Goals coverage retains Target and an invalid start-date draft through window changes, opens its actual nested calendar and checks layer-by-layer Escape/focus return. The separate Dashboard unit integration checks its actual switching-header parent. Forced-colors keyboard focus uses a system outline; live reduced-motion changes leave these routine surfaces unanimated. Dark/light destructive action-label contrast is sampled without claiming full theme conformance. Use `--workers=1` for final sequential matrices on this host.
