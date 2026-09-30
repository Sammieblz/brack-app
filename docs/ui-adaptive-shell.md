# Adaptive application shell

F09 implementation; exact validation/release limits live in [checkpoint 19](frontend-renewal/19-adaptive-shell.md). This is shell presentation, not independent native stacks or whole-app retained routing.

Coverage reopened at `db076cf`: [checkpoint20](frontend-renewal/20-coverage-reconciliation.md) and the [route matrix](frontend-renewal/coverage-review/03-route-shell-consumers.md) identify remaining live parents/branches, utility-host gaps and messaging/header assumptions. The contract below describes MobileLayout and its migrated consumers; it does not establish every screen uses them correctly.

## Presentation and ownership

CR01 adds one narrow utility rule: live comments and chat mark their active task with `data-shell-composer-active`. While present, Scroll to top (`data-shell-scroll-top`) is hidden independently of field focus. Browser traces showed it could otherwise appear over Send between pointer-down and pointer-up after textarea blur. Local comment collapse and Posts/Chat tab visibility update the marker; other floating actions retain their existing policy. [Checkpoint21](frontend-renewal/21-live-composers.md) owns the real-consumer browser evidence and limits.

`lib/shellPresentation.ts` consumes UIEnvironment runtime, display mode and window class. Below 1024 CSS pixels, native iOS/Android and standalone web PWA use labeled bottom destinations. Browser tabs and small Electron windows use Menu. Expanded windows use sidebar. Pointer capability never turns a browser into native. Feature gates and canonical navigation configuration remain authoritative.

`MobileLayout` retains one SidebarProvider/content/main chain through width changes. Main remains the page scroller. `ShellNavigationProvider` owns the destination dialog outside responsive headers, loads its data after first invocation and retains the open task on resize. Links preserve modifier behavior and `aria-current`. Dismissal restores Menu, or the page heading if expanded layout removed it; navigation avoids outgoing-page refocus.

Custom-heading screens and loading/error branches also need Menu below 1024. The legacy 768px `useIsMobile` check remains for unmigrated screen content, not global navigation availability.

Within Settings, the optional [Settings task context](ui-settings-tasks.md) protects ordinary Menu/sidebar/tab destinations and delegates shell Sign out to the Settings confirmation/transaction owner. Modified/new-tab links remain browser-owned. This is a scoped consumer correction, not a new global browser-history blocker or a claim that other editor routes have the same policy.

Tabs occupy normal flow without ornamental gap/glow/animated scaling. Large text can wrap into rows. Labels and selected shape supplement color. Footer owns bottom safe padding and publishes its measured full height as `--app-shell-bottom-height` for local floating controls. Main adds no second tab estimate. At extreme text/short heights the footer can scroll as a chrome region. The one-scroll-owner invariant means one vertical page scroller, not a prohibition on bounded chrome or horizontal rails scrolling separately.

## Editing and viewport

The shell reuses unscaled visual geometry through `useOverlayViewport`, without another geometry store or keyboard/browser-toolbar inference. Pinch retains layout geometry and browser zoom. Native viewport panning/insets remain device gates.

Editable focus within main hides footer/floating controls. This focus policy includes hardware keyboards; it is not keyboard detection. Read-only and checkbox/button controls do not trigger it. Main takes the safe bottom inset while footer is hidden. Header resize, viewport/footer changes and keyboard/programmatic focus entry reveal obscured content without refocusing or moving the caret; header controls and focus outside the owned main are excluded. Focus entry during an active pointer contact does not scroll the activation target; the guard clears on pointer-up/cancel/window blur. This also leaves intentional scrolling of a focused editor alone. Pinch retains browser ownership. Add/Edit Book actions stay in page flow/sticky regions. Local floating actions use measured chrome clearance and reserve space only when visible.

CR04 reserves4.5rem bottom scroll padding and page-end space while Scroll to top is visible. Previously its absence let the enlarged floating button cover BookListDetail removal controls at200% text. Native keyboard focus revelation uses this clearance; the later5.5rem primary-action rule and editing safe-inset rule retain precedence. This does not promise that arbitrary manual scroll positions never place content behind a floating control: actions must remain reachable by ordinary scrolling and keyboard focus, with actual pointer hit testing after revelation.

## Utilities

CR03's actual Settings Preview action exposed a second contact hazard: focusing a button blurred the editor and restored the footer between pointerdown and pointerup, covering that button before click. Footer editing-state changes now wait until all active pointer contacts end, then update on the next animation frame. Keyboard focus still updates immediately. This does not infer keyboard visibility or interfere with gestures. The retained pointer trail and normal single-click regression belong to checkpoint23. ScrollToTop sits below modal/backdrop layers (`z-40`) so it cannot cover a nested task's actions.

`ShellUtilitiesProvider` keeps one portal host and application-owned timer/sync controllers across routes. Each layout attaches that host through `ShellUtilitiesSlot`; moving presentation does not restart sync subscriptions or reset pending Finish. TimerContext, sync engine, persistence, cancellation confirmation and journal prompting keep their domain ownership.

The provider remains under the existing app contexts and Router, outside individual route screens. The slot moves the same host rather than changing the React portal target. A route without a slot detaches that host; existing auth/hidden-route rules still control sync presentation. Isolated fixtures that need these utilities must supply the provider; a bare slot renders no replacement controllers.

The session row offers title, elapsed time, Pause/Resume and adaptive Details. Details blocks duplicate Finish/dismissal while pending; provider visibility determines success. The wider idle timer picker remains, but active controls have one owner. Sync becomes a polite wrapping status with existing Review/Sync. Timer drag/fling cancellation, tick animation and speculative celebration are removed.

The Library's labelled Quick actions control uses the shared action surface rather than a floating speed dial. It remains available below 1024px and delegates to the existing acquisition routes, reading-timer picker, history and Quick Stats. The timer picker and stats use adaptive task surfaces; resizing to expanded keeps an open task mounted and returns focus to visible page content when its compact trigger disappears. Book data loading/retry and timer-start/replacement decisions remain with their existing owners.

## Evidence boundaries

Use the [real-shell fixture](../tests/fixtures/adaptive-shell/README.md) plus existing shell-scroll/Back/form/timer contracts. Verify width-only resize, route changes, runtime modes, feature gates, large text, focus, utility overlap and final actions. Shims do not prove packaged native/PWA behavior or actual mobile-browser toolbar shown/hidden behavior; blocked-font screenshots show fallback typography.

Review actual composition separately. Library's duplicate filters/per-book action rows remain F10; Goals' stacked composition remains F13. Primitive passes do not complete those tickets or establish latency/accessibility conformance.

References checked 2026-09-28: [Ionic tab bar](https://ionicframework.com/docs/api/tab-bar), [MDN VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport), [W3C focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html). Production retains React Router/Radix under F06.
