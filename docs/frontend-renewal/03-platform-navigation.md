# Platform, shell, navigation, and responsive architecture

Status: implementation specification, not an implemented migration. Source inspection and external documentation review: 2026-09-27. No packaged-device tests, navigation traces, or performance measurements were run for this document. Numbers called targets below are proposed acceptance budgets, not measured results.

Implementation update: F05 supplies the observable [UI environment contract](../ui-environment.md), committed with F04 at `2ddc1c25c3b453a5b3f923c99f4d3e58b45b7754`; [checkpoint 15](15-feedback-environment-batch.md) preserves that validation. The committed F06 experiment selects **DEFER for the tested Ionic 9.0.5 route shell and modal**. Follow the [current integration decision](../ui-ionic-fit.md) and [checkpoint 16](16-ionic-fit-experiment.md), including failed adoption gates and reopening conditions. F07 uses the existing React Router 6 and Radix foundations, as recorded below. No independent native route stack or adaptive shell migration is included. Baseline findings and conditional Ionic proposals remain historical specifications, not evidence of adoption.

## 1. What exists and what that implies

F07 update: [checkpoint 17](17-back-ownership.md) records the implemented Back coordinator, observed ancestry, overlay/task guards, Android callback policy and local gesture cancellation. The duplicate edge handlers in the baseline table below are retired. Browser history stays browser-owned; independent native stacks, shell adaptation and physical-device/IME acceptance remain outstanding. Use the [living Back contract](../ui-back-navigation.md) for current behavior.

Discovery used `graphify query "frontend application shell navigation routing platform detection responsive layout"`, then the existing Obsidian notes `graphify-out/obsidian/App.tsx.md` and `graphify-out/obsidian/MobileLayout.tsx.md`, then the source below. The graph query returned a truncated scoped result; source inspection, not graph labels, establishes these findings. `graphify-out/wiki/index.md` was absent in this checkout.

Paths below are relative to the repository root. Line numbers are discovery anchors and must be rechecked after changes.

| Verified evidence | Current behavior | Consequence / implementation requirement |
| --- | --- | --- |
| `package.json:100`, `apps/mobile/package.json` | React 18, React Router 6, Capacitor 7 dependency ranges; no Ionic React packages declared | Ionic is an adoption option. Do not describe it as the current shell or copy a v5 router recipe into this app. Resolve actual lockfile versions before implementation. |
| `apps/client/src/App.tsx:134` | One outer Suspense boundary contains BrowserRouter, route tree, navigation wrappers, timer and feedback observers | A lazy route can expose the global fallback. Introduce route-local boundaries while keeping the authenticated shell stable; retain a boot fallback for actual boot. Profile before claiming this is the whole lag cause. |
| `components/MobileLayout.tsx:17` and `hooks/useBreakpoint.ts` under `apps/client/src` | Phone means width below 768; phones get bottom navigation, wider windows get sidebar | Runtime and input capability are not used for shell selection. Tablets inherit desktop presentation too early. |
| `components/MobileBottomNav.tsx:7`, `index.css:684` | Floating decorative nav, 72px content token (4rem below 400px), outer padding, at least 24px bottom gap | Browser and native pay the same chrome cost. Reduce ornament and measure the entire bar; do not merely reduce text size. |
| `services/platform.ts:63`, `:83` | Existing canonical checks distinguish native Capacitor, desktop bridge and installed PWA | Reuse these checks as the source of runtime truth. Preserve existing authentication redirect semantics. |
| `lib/platform.ts:5`, `hooks/usePlatform.ts` | UI platform hook uses user-agent text and starts as `web` before an effect | This is a separate, inconsistent platform definition. Migrate consumers to capability/runtime context; avoid initial web-to-native layout flash. |
| `hooks/useAppBack.ts:12`, `components/AppBackButton.tsx` | Shared visible Back supports explicit destination, callback, fallback; history uses `location.key !== "default"` | Back infrastructure exists. Audit callers and strengthen return-origin semantics rather than creating another back component. |
| `App.tsx:141`, `components/MobileHeader.tsx:42`, `hooks/useSwipeBack.ts:11` | Global swipe handler and eligible mobile headers both mount the hook; document listeners; history-length check; delayed `navigate(-1)`; effect depends on swipe distance | Duplicate gesture ownership is a source-level risk. Native/browser edge conflicts and per-move listener churn require removal of overlapping owners and physical-device verification. |
| `hooks/useSwipeToOpenDrawer.ts` | Right-edge document gesture opens profile drawer based on UA mobile detection | Can contend with Android system Back and browser forward. Navigation drawers require a visible trigger; no reserved system-edge takeover. |
| `hooks/useScrollPosition.ts:71` | Session-storage writes on every scroll; restoration keyed only by pathname and a zero-delay timer | Profile synchronous storage cost; distinguish history entries, filters, anchors and pane state. Restore when content geometry is ready. |
| `hooks/useAppViewportHeight.ts`, `index.css:660` | Listens to visualViewport resize but assigns `window.innerHeight`; viewport min-height is `100svh` | Keyboard/chrome resizing behavior needs device tests; event subscription alone does not prove visible-viewport sizing. |
| `docs/ui-shell-scrolling.md`, `hooks/useAppHeader.ts` | Explicit single page-scroll owner, measured sticky header, safe-area and focus-clearance contract | Preserve this regression fix. Replacing the scroller requires migrating its consumers and tests in the same slice. |
| Scoped search of `apps/client/src`, `apps/mobile`, native entry paths | No application `backButton` listener found; App lifecycle listeners exist in timer/sync services | This does not prove native Back fails. Define and verify the missing centralized behavior; do not install competing listeners. |
| `apps/mobile/capacitor.config.ts` | Native projects point to root `android`/`ios`; iOS `contentInset: 'always'`; splash plugin configuration is commented | Audit actual native insets/splash before layering web offsets or asserting plugins are installed. |

## 2. Decision: separate runtime, layout space, and input

Create one small shell-facing context using the existing platform service. Its conceptual outputs are `runtime` (native iOS, native Android, web, Electron), `displayMode` (browser, standalone), available layout space, pointer/hover capabilities, reduced motion, and viewport/keyboard information. Names are proposed; do not create a parallel platform service if the existing one can own this.

1. Determine native runtime using Capacitor and desktop using the existing bridge. A Safari tab on an iPhone remains web. A standalone PWA remains web for auth, capabilities and security.
2. Determine installed display mode through media queries and the existing iOS standalone compatibility check. React to mode changes. Fullscreen alone is not proof of PWA installation; provide a safe compact fallback.
3. Use available CSS space for layout; never infer tablet from a device name. Initial candidate bands are compact below 600 CSS px, medium 600–1023, expanded at least 1024. These are planning bands, not final breakpoints. A pane appears only when both panes retain usable minimum widths after navigation, safe areas and text scaling.
4. Use pointer/hover capability for affordances, not to deny touch UI or keyboard support. Mixed-input iPads and foldables keep all essential actions visible after mouse attachment.
5. Support dynamic resizing without route reset, form loss, timer restart or a duplicate request. Existing 768-based hooks and Tailwind breakpoints must be migrated consumer by consumer; changing one constant globally is unsafe.
6. Default unknown environments to the usable web shell. Never require screen-reader detection to make controls accessible.

## 3. Presentation matrix

The primary destinations remain Home, Library, Lists, Feed and Readers, with the current social feature gates and route labels. Secondary destinations retain the existing navigation groups. A later findability study may propose an IA change; it must not be smuggled into a shell refactor.

| Environment | Navigation and hierarchy | Surfaces and input | Platform behavior |
| --- | --- | --- | --- |
| Native iOS, compact | Branded anchored bottom tabs, icon + label; concise Back header on details | Reachable sheets for short tasks, full route for substantial forms; platform page transitions after gate | Safe areas, keyboard integration, one interactive back owner, optional semantic haptics |
| Native Android, compact | Same destinations in anchored bottom navigation; Material-compatible interaction behavior | Sheets/dialogs appropriate to task; visible back/close and accessible alternatives | Android system Back arbitration; reserve system gesture edges; no copied iOS edge recognizer |
| Browser, compact | Proposed default: compact header with labelled Navigation button opening a grouped drawer; Home and Library remain directly reachable within that surface; no fixed global bottom bar | Same book/action composites; browser-compatible sheet or dialog; reachable local task action when useful | Native browser Back/Forward and pinch zoom stay available; never infer browser toolbar pixels |
| Installed PWA, compact | Bottom tabs as in app presentation because browser toolbar is absent; same canonical URLs | Web-accessible overlays with explicit Close/Back; no assumed native plugin availability | Display-mode detection, safe areas, browser history; installation remains optional |
| Native/PWA, medium tablet | Keep touch-first bottom tabs by default; content can use list/detail if it fits; compact windows collapse to one pane | Constrained sheets or side panels, large targets, keyboard/pencil/mouse coexist | Window/rotation preservation, software keyboard and split-view checks |
| Browser, medium tablet | Labelled navigation drawer or compact rail where content fits; touch-friendly secondary panels | Adaptive sheet/anchored panel based on space and task, not merely pointer | Browser controls remain authoritative; same deep-link semantics |
| Expanded tablet / unfolded device | Compact rail can replace tabs when it gives content more useful space; never display rail and global tabs together | Two-pane Library/details, lists, messages/settings where supported; no forced desktop density | Fold/resizing preserves selection and drafts; put no critical action across a hinge |
| Desktop web / Electron | Sidebar/rail, clear page heading, optional breadcrumbs for depth | Anchored menus, constrained dialogs, keyboard shortcuts; touch remains usable | Web history in browser; desktop bridge for external URLs; Electron small windows use compact structure without pretending to be Capacitor |

The browser drawer choice is a proposed response to the user's chrome concern. Browser Back is not primary app navigation; removing tabs must still leave every destination findable. Validate navigation completion with this shell before broad rollout. If finding destinations is materially worse, use a slim persistent bottom bar as the documented fallback, with no floating gap/glow, no second navigation row, and measured content clearance. Do not ship scroll-hide navigation that disappears during keyboard or assistive-technology use. A persistent user preference for browser bottom navigation is optional only after the default and fallback tests; it is not required scope for the first migration.

### Compact chrome contract

- A normal root screen has one title/header region, primary content and at most one global navigation region. Filters, sort, view controls and rare management actions live in one labelled contextual surface; active filters remain visible with a count and clear action.
- The primary task action may be inline or in a local bottom action region. It must not collide with global tabs, timer, sync indicator, toast or keyboard. Do not stack five fixed floating widgets.
- Native/PWA tabs are anchored to the bottom safe area with a calm surface and separator. Remove the always-present 24px floating gap and redundant decoration during implementation. Use a content-sized token; initial visual target is roughly 56–64px plus safe inset at default text, but text scaling may grow it.
- Browser default has no reserved bottom-nav padding when no bar exists. Local composer/save bars reserve only their own measured height.
- Root destinations show current location with text and shape/state, not color alone. A navigation link uses `aria-current="page"`; the shell is a labelled navigation landmark, not an ARIA tablist for URL pages.
- Top bar controls retain comfortable hit targets and wrap or adapt at large text. A fixed 56px row must not clip an essential long title/control. Never shrink text to squeeze the layout.

## 4. Ionic adoption gate

The requested [Ionic component catalog](https://ionicframework.com/docs/components) covers mobile primitives, while [Ionic native documentation](https://ionicframework.com/docs/native) covers Capacitor capabilities. These are different layers. Ionic UI does not convert React DOM content into native UIKit/Android widgets, and Capacitor does not require Ionic UI.

At review time, the upstream [Ionic router package manifest on `main`](https://raw.githubusercontent.com/ionic-team/ionic-framework/main/packages/react-router/package.json) identified version 9.0.4 with React 18/19 and React Router `>=6.4.0 <7` peers. That is development-branch metadata, not proof of a published stable release. The [official navigation source](https://raw.githubusercontent.com/ionic-team/ionic-docs/main/docs/react/navigation.md) still contained v5-style APIs when fetched; the rendered [navigation page](https://ionicframework.com/docs/react/navigation) returned HTTP 403 in this review. Do not conclude either universal incompatibility or drop-in compatibility from these artifacts.

Before adding dependencies, complete an isolated local feasibility slice:

1. Record exact selected published versions of `@ionic/react`, `@ionic/react-router`, React, React Router, Capacitor and peer dependencies from the lockfile and release artifact. Record release URL/tag and documentation version. Do not force-install peer conflicts, use `latest` blindly, downgrade routing silently, or combine a Capacitor major upgrade with UI renewal.
2. Build a fixture with Library root, book detail, one action sheet, long content and editable date field. Test a native and a browser presentation with the same domain model; no production records.
3. Compare two viable options: selected Ionic primitives with the existing Router6 shell, and a coherent Ionic route-shell adapter using its supported router integration. Measure accessibility behavior, CSS leakage, incremental JS/CSS, route readiness, retained-page memory and build/native integration.
4. Prove one scroll owner. `IonContent` cannot be a nested second full-page scroller inside the existing marked `main`. Provide a tested adapter to obtain the actual scroll element and carry header/scroll-restoration contracts if adopting it.
5. Prove one focus/overlay owner. `IonModal` must not wrap a Radix Dialog or Vaul drawer for the same overlay. Map BRACK intent to one implementation, including dismissal, focus return, reduced motion and large text.
6. Prove back, deep links, route identity, independent tab state, offline detail, active timer, keyboard, 200% text and browser Back/Forward. The route-shell option also proves retained pages do not leave subscriptions or hidden focusable content active.
7. Capture screenshots/interaction recordings of the fixture and a comparison report. Make the architecture decision from this evidence and keep a documented fallback with the existing accessible primitives.

Proceed with the smallest coherent option meeting the requirements. If the route-shell option passes, migrate a whole navigation boundary with `IonPage`/outlet/lifecycle behavior; do not interleave two active router owners in the same tree. If it fails, retain Router6 and fix the shell behavior with adaptive wrappers. Both paths preserve native bottom navigation. A failed Ionic spike is not grounds to defer the UI fixes.

## 5. Route and return contract

Maintain a small route metadata registry adjacent to existing routing/navigation configuration. It defines route identity, primary destination, title, parent fallback, expected return behavior, and whether the route is a root, detail or task. It does not duplicate feature flags, authorization, query keys or data models.

| Route family | Fallback without known origin | Return behavior |
| --- | --- | --- |
| `/book/:id` | `/my-books` | Return to originating Library, list or other valid BRACK context when known, including filter and scroll state |
| `/edit-book/:id`, `/book/:id/progress` | `/book/:id` | Cancel/save returns to the owning book context; unsaved draft handled before dismissal |
| `/add-book` | `/my-books` | Preserve acquisition draft through scan/manual subflows; completed add has a clear book destination |
| `/scan`, `/scan-barcode`, `/scan-cover` | `/add-book` | Cancel restores acquisition draft; camera/native surface closes before route transition |
| `/lists/:listId` | `/lists` | Restore list overview; book navigation preserves list origin |
| `/posts/:postId`, `/reviews/:reviewId`, `/clubs/:clubId` | `/feed`, `/reviews`, `/clubs` respectively | Honor valid origin when present; deep links always have visible fallback |
| `/users/:userId` | Contextual Readers fallback | Preserve feed/reader origin if known, without assuming previous browser entry is inside BRACK |
| Auth callback/reset/onboarding | Existing guarded destination | Preserve security/redirect contracts; no shell history invention or restoration into another account |

Aliases `/books`, `/book-lists`, `/scan` and onboarding entry aliases remain functional. Choose canonical display destinations without breaking external links. Durable detail pages remain URL-addressable even if a tablet renders them next to a list.

### Back arbitration

One shell-level back coordinator owns the application response. UI Back, Android system Back and any native interactive route back call the same logical operation. Registering a listener must return cleanup; mount it once. Application events cannot dismiss an overlay and pop a page from one action.

Priority contract:

1. Let the OS-owned keyboard/system surface handle its normal dismissal; do not pop the route from the same Back event. Verify actual event delivery on Android rather than guessing it.
2. If a topmost temporary application surface is open, close that surface or ask about its dirty draft. Browser `Escape` closes the innermost applicable overlay. Native Back behaves equivalently.
3. Exit selection/reorder mode when the route intentionally owns that mode, with retained selected data as appropriate.
4. Resolve unsaved work before leaving a task. Valid local draft persistence can avoid a disruptive prompt; destructive discard requires explicit intent.
5. Native tab shells pop within the active destination stack. If no local predecessor is known, use the declared parent fallback. Web in-app Back uses a known internal return entry, otherwise a fallback; browser Back/Forward itself remains ordinary browser history.
6. At a native root, use the documented OS policy and existing safe lifecycle behavior. No arbitrary double-back exit, forced `exitApp`, or implicit timer termination. iOS does not receive a fabricated exit action.

[Ionic hardware Back documentation](https://ionicframework.com/docs/developing/hardware-back-button) describes handler priority and native support; browser/PWA Close Watcher handling is conditional and experimental in the reviewed docs. Keep a visible close/back path regardless. [Capacitor 7 App API](https://capacitorjs.com/docs/v7/apis/app) is the version-matched reference for runtime events. Do not use both raw Capacitor Back and Ionic Back to independently pop routes.

### Tab, pane and deep-link state

- Define tab switch versus detail push explicitly. Native/PWA tab return restores the destination's last meaningful detail/list state; root retap may scroll to top only if clearly tested and never resets an active draft silently.
- Keep independent stacks small and bounded. Clear account-owned navigation state on sign-out/account change. Do not persist full React trees or sensitive form content in a global storage record.
- A cold deep link opens the requested route with a declared fallback and appropriate active destination. A warm deep link routes once after auth/feature validation, preserving unrelated in-progress reading capture. Invalid/deleted/private items show recoverable unavailable states.
- Existing `DeepLinkHandler`, trusted-origin checks and auth completion remain the integration boundary. A UI refactor must not reimplement callback parsing or broaden accepted URL origins.
- Tablet list/detail routing uses the same canonical detail URL. Back closes detail selection/returns list as appropriate; collapse to compact retains the selected detail and exposes a visible Back to the list. Resize does not push history.
- Overlay open state is not a substitute for a durable route. For transient web overlays, decide per surface whether a history entry is justified; if used, the coordinator owns it exactly once, including direct load/refresh/Forward. Do not add fake history entries for every tooltip or toast.

## 6. Scroll, focus, keyboard and safe areas

Preserve [the current shell contract](../ui-shell-scrolling.md): one vertical owner per page, measured complete header height, immediate automatic restoration, explicit-only smooth scroll and no scroll-triggered header geometry change. Tablet split panes may each own their own scroll region when their names, focus order and restoration keys are explicit; they are not nested page scrollers.

Store scroll in memory during movement; checkpoint appropriate state at navigation/lifecycle boundaries rather than synchronously writing storage on every pixel. Scope restoration to account, route/history identity, filter/sort/view state and pane. Restore a book anchor plus relative offset when a virtualized list changes, falling back safely if removed. Wait for the relevant content/layout readiness; bound waiting and clean up callbacks on navigation. Preserve hash/focus destinations over stale stored offsets.

On forward navigation, focus the meaningful page heading/content once ready and announce the title without reading the entire screen. On return, restore the originating item if still mounted, otherwise its nearest useful list heading. Do not auto-focus an input solely because a page or sheet mounted; that opens mobile keyboards unexpectedly. Screen-reader focus, keyboard focus and scrolling must cooperate rather than fight with animation.

Use safe-area values once per edge and measure composed chrome. Native status-bar integration, CSS `env` and iOS `contentInset` can overlap; test actual native geometry before adding offsets. The keyboard adapter publishes visibility/occlusion, not device-model constants. Browser chrome has no reliable toolbar-height API; use dynamic/visual viewport measurements for visibility and allow browser zoom.

The current manifests do not declare Keyboard, Status Bar or Splash Screen plugins. Any addition is a deliberate native adapter change, with a supported Capacitor 7 version and platform sync/build verification. [Capacitor 7 Keyboard](https://capacitorjs.com/docs/v7/apis/keyboard) documents events and distinct resize modes; its `ionic` resize option applies to an Ionic app container, not the current arbitrary React shell. Avoid double resizing and preserve useful keyboard accessory navigation.

Acceptance includes: last form field and Save remain reachable above software keyboard; split/floating tablet keyboards do not force giant blank gaps; focus remains visible under sticky chrome; no negative safe-area padding; landscape controls clear left/right insets; rotation while a sheet is open retains input and focus; page pinch zoom is not blocked by blanket `touch-action: pan-y` or `touch-none` rules. Change those rules only with the gesture conflict suite.

## 7. Tablet and foldable behavior

- First tablet targets: portrait reading/library, landscape list/detail, messaging list/conversation, settings category/detail. Touch-sized controls and sheets remain available; desktop density is optional, not width-triggered by default.
- Pane thresholds derive from minimum readable content. Initial feasibility examples: list pane about 280–360px, detail about 360px or more, plus rail/gap/insets. These are trial values to validate with long titles, localization and 200% text, not mandatory pixel locks.
- Use CSS/container constraints before device categories. A narrow iPad split window behaves like compact; a wide phone unfolded can use medium layout.
- Treat hinge/viewport-segment APIs as progressive enhancement. When unsupported, provide a usable continuous layout. When supported and verified, keep content and interactive targets within a segment and avoid placing a dialog action on a fold.
- Folding, rotating or resizing retains route, search text, filter, selected book, unsaved form, timer and pending mutation state. Avoid mode-change remounts as a styling shortcut.
- Browser zoom, OS text size and external keyboards are first-class inputs. Pointer context menus have visible equivalents; keyboard focus never enters hidden offscreen panes.

## 8. Performance investigation and provisional budgets

Measure before attributing lag to shadcn, the monorepo or network. Capture route-chunk load, data-read latency, React commits, synchronous storage, style/layout, paint, image decode and animation work separately. Compare cold launch, first route, warm route, Back, tab return and offline return on a representative slower Android device and iPhone/iPad, plus desktop browser.

Prioritized source hypotheses: outer Suspense fallback; 150ms-out/250ms-in GSAP route animation (`PageTransition.tsx`) around already-changing children; per-route shell remounts; document gesture updates/listener churn; synchronous scroll persistence; always-mounted drawer data hooks; large repeated lists/charts. These are suspects, not measured root causes.

Planned improvements, each contingent on evidence: stable shell outside route fallback; route-specific skeletons/cached content; prefetch likely routes on intentional focus/pointer intent or idle without downloading everything; preserve list state; lazy-load heavy charts/scanning/reward media; virtualize only long lists that justify it; throttle/checkpoint scroll storage; remove unnecessary full-page blur/filters and competing transforms. Avoid blanket memoization or retaining every route indefinitely.

The canonical candidate budgets are in [06, navigation/performance investigation](06-motion-gestures-performance.md#6-navigationperformance-investigation): visible action acknowledgement within 100ms and warm route usable content at p95 within 300ms when data is locally available, with zero decoration-imposed navigation delay. Use that table's metric definitions and baseline/calibration procedure rather than maintaining a second budget here. These are project targets, not legal thresholds, guarantees or assertions about current results. Track device/network conditions; network-dependent completion gets a state contract rather than an invented universal duration.

## 9. Implementation slices and exit evidence

| Slice | Touchpoints | Required proof before expansion |
| --- | --- | --- |
| Runtime boundary | Existing `services/platform.ts`; migrate `usePlatform` consumers; layout context | Safari tab/native iOS/PWA/Electron classification tests; no auth redirect changes; no initial runtime flash |
| Navigation behavior | `useAppBack`, `AppBackButton`, global/header swipe hooks, route metadata | One gesture/back owner; detail cold-link fallback; browser history correct; Android overlay-first behavior |
| Shell experiment | `MobileLayout`, `MobileBottomNav`, `MobileHeader`, `AppSidebar`, `ProfileDrawer`, viewport/header hooks | Same destination set; browser drawer findability; native bottom tabs; safe-area/keyboard/large-text correctness |
| Ionic decision | Isolated fixture then selected coherent boundary | Version/peer report, build results, accessibility and physical native interaction evidence, rollback option |
| Tablet pilot | Library/book detail first; preserve current view settings | Resize/collapse restores state; single-pane fallback; touch/keyboard/screen-reader usability |
| Route performance | `App.tsx`, route boundary, scroll restoration, page transition | Comparable before/after traces; no blank route frame; timer/draft/offline safety; bounded retained memory |

Run existing shell and Library interaction suites after touching shared ownership. Add meaningful routing/system-back/resize integration tests for new behavior. Fixture browser passes do not certify VoiceOver, TalkBack, native predictive-back integration, physical hinge behavior or a packaged runtime. Record those results separately. Keep all changes reversible by coherent shell/feature boundary; do not introduce long-lived duplicated feature implementations.
