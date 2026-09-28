# UI environment contract

Implemented in frontend renewal F05, based on commit `06d5190` plus this batch. Exact validation and review status belong to [checkpoint 15](frontend-renewal/15-feedback-environment-batch.md). This is the current observable environment foundation; the broader shell redesign remains F09.

## Ownership and outputs

`apps/client/src/services/platform.ts` remains the runtime and authentication authority. `services/uiEnvironment.ts` observes that service and browser presentation inputs. React consumers use `hooks/useUIEnvironment.ts`; there is one shared subscription set, torn down after the final consumer. Snapshot identity changes only when values change. Primitive selectors keep visual-viewport scroll updates from re-rendering runtime-only, width-only and layout-height-only consumers.

| Output | Meaning and fallback |
| --- | --- |
| `runtime` | `web`, `ios`, `android`, or `desktop`, exactly as canonical platform service reports. Native requires Capacitor; Electron requires the existing desktop bridge. UA text is never runtime evidence. Unknown Capacitor platforms fall back to web. |
| `displayMode` | `app` for native/Electron; `standalone` for web with the standalone media query or iOS navigator compatibility value; otherwise `browser`. Fullscreen is not evidence of installation. |
| `layoutWidth`, `layoutHeight`, `windowClass` | CSS layout-window size from `innerWidth/innerHeight`; compact below 600, medium 600–1023, expanded at least 1024. These are policy bands for new adaptive surfaces, not a global Tailwind migration or proof that two panes fit. |
| `visualWidth`, `visualHeight`, offsets, scale | Current VisualViewport geometry; falls back to layout size, zero offsets and scale 1. Keyboard appearance and pinch zoom are not inferred device/runtime changes. No speculative `keyboardOpen` flag. |
| `pointer`, `anyCoarsePointer`, `anyFinePointer`, `hover`, `anyHover` | Primary and mixed input media-query capabilities. Unknown/missing media support yields no pointer/hover enhancement; all essential actions must remain visible and keyboard/touch usable. |
| `reducedMotion` | OS media preference; missing media-query support defaults to reduced effects. This observable does not itself rewrite every existing motion consumer. |
| `supportsMediaQueries`, `supportsVisualViewport` | Actual availability of the optional browser interfaces, not native plugin permissions or hardware capability. |

Media-query changes, window resize/orientation, visual viewport resize/scroll, page foreground/visibility and app-install events refresh the snapshot. The iOS standalone compatibility flag is re-read on those events; it has no independent browser change event. Older MediaQueryList `addListener/removeListener` implementations are supported.

Authentication redirects, custom-scheme policy, PWA service worker decisions, plugin permissions and security never depend on window class. An installed PWA is still a web runtime and retains same-origin HTTPS auth callbacks. No auth-service change was needed for F05.

Safe areas retain their existing CSS `env(safe-area-inset-*)` ownership and [shell-scrolling contract](ui-shell-scrolling.md). The environment does not manufacture inset values or browser-toolbar heights. `useAppViewportHeight` still publishes layout height to `--app-viewport-height`; visual geometry is exposed separately for later, explicitly tested overlay/keyboard consumers. A VisualViewport event alone does not change page-scroller sizing.

## Compatibility migration

`usePlatform` now selects canonical runtime synchronously on its first client render. Its legacy `platform` remains `ios | android | web`, mapping desktop to web styling. Its legacy `isMobile` means **native iOS/Android**, not small layout. `lib/platform.detectPlatform` delegates to the same canonical service. New code should use the explicit environment outputs rather than the ambiguous legacy name.

`useBreakpoint` selects the environment's layout width but preserves all existing 768/1024/1440 thresholds. `useIsMobile` remains `useBreakpoint().isPhone`; all current MobileLayout, sidebar and width-based screen branches therefore retain their existing layout threshold. New 600/1024 policy bands do not silently migrate those consumers. Resize changes state in mounted components, not route keys or form/session ownership.

Source review of every `usePlatform` branch:

| Consumer | Effect of canonical runtime migration |
| --- | --- |
| `MobileBackButton` | Native iOS keeps its radius/icon presentation; browser/PWA receives web presentation with the same visible Back action and fallback contract. |
| `NativeScrollView` | Native iOS/Android retain their platform scroll styling when explicitly scrollable. Browser/PWA use ordinary scroll behavior. Single-page-scroll ownership is unchanged. |
| `NativeSearchBar` | Native-specific radii, focus decoration and iOS Cancel/Back affordances apply only to native. Browser retains input, search, clear and recent-search controls. No query/draft behavior changes. |
| `ActionSheet` | iOS-only placement/radius branch now requires native iOS. Browser/PWA use the existing web dialog branch. Actions and visible Cancel remain. |
| `Toaster` / `native-toast` | Native typography/decoration is selected only for native; browser/PWA use existing web toast variants. `native-toast` has an unused legacy import, not a second detector. F04 owns haptic feedback behavior. |
| `useSwipeBack`, `useSwipeToOpenDrawer` | Custom native edge listeners no longer attach in phone browser/PWA merely because of UA. Browser Back/Forward gestures remain available; visible app navigation remains. Existing native listener ownership/arbitration issues remain F07, not a claim of solved native gesture conflicts. |
| `usePullToDismiss` / `dismissable-sheet` | Pull recognizer only attaches in native runtime; browser/PWA keep Radix Close/Escape. The sheet's own `platform` binding was unused; the hook is the actual gate. Existing native pull dismissal implementation remains for F07 review. |

## Verification boundary

Focused units cover first-render native identity, browser phone/tablet UA, desktop bridge, unknown runtime, reactive standalone and mixed input/reduced motion, exact layout thresholds, visual geometry separation, snapshot/listener lifecycle, older media listeners and auth redirect invariants. The deterministic [Playwright fixture](../tests/fixtures/ui-environment/README.md) uses real hooks, canonical platform service, browser router, Back control and scroll wrapper, with controlled bridge/media geometry and local draft/session state.

F05 implementation checks passed: `npm run test --workspace @brack/client -- src/hooks/useUIEnvironment.test.tsx src/services/platform.test.ts` (35 tests, 2 files), `npx playwright test --config tests/playwright/ui-environment.config.ts` (33 checks: 11 each in Chromium/WebKit/Firefox), fixture TypeScript and scoped ESLint with zero warnings. The first browser attempt failed because the fixture's Capacitor shim omitted exports needed by lazy plugin imports; the fixture now supplies explicit throwing adapters for those out-of-scope operations. The subsequent Chromium run and complete matrix passed. Broader batch checks remain recorded in checkpoint 15.

Fixture runtime emulation is not a packaged Capacitor/Electron run. A synthetic VisualViewport event is not a physical keyboard or pinch gesture. Draft/session preservation evidence applies to the fixture state and adapter lifecycle; screen-specific tablet layout and real reading timers require their own later acceptance. Real iOS/Android/PWA standalone installation, device safe areas, foldables, assistive technology and OS gesture conflicts remain device-unverified.

API references checked during implementation: [Capacitor 7 platform API](https://capacitorjs.com/docs/v7/core-apis/web), [MDN VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport), [MDN matchMedia](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia). Visual and layout viewports are distinct; capability changes are observed with media-query events rather than UA parsing.
