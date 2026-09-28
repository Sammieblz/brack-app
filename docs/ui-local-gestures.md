# Local gesture ownership

Current F07 source contract, based on baseline `f90509d` and the [implementation checkpoint](frontend-renewal/17-back-ownership.md). This describes renderer behavior; synthetic touch events and browser CDP input do not establish physical iOS/Android gesture, predictive Back, or assistive-technology support.

## System edges and route navigation

The document-wide `useSwipeBack`, `useSwipeToOpenDrawer` and `SwipeBackHandler` are retired. The former route hook was mounted both by App and by detail headers, rebound listeners as swipe distance changed, and scheduled an uncancelled delayed history pop. The drawer hook also claimed the right system edge. Neither implementation represented a verified native route stack; the apparent previous page was a gradient placeholder. F06 deferred the tested Ionic route shell.

`MobileHeader` retains visible Back and profile buttons. Its profile button uses the shared Button's existing feedback owner. App and the shell-scroll regression fixture retain the previous wrappers' sizing and background without translating the page or fabricating a previous route. The global `html/body/#root` horizontal overscroll policy now uses `auto` instead of suppressing browser overscroll navigation. Browser Back remains a browser operation; application Back coordination has its own owner.

Removing an intercepting recognizer does **not** provide native iOS swipe-to-back. A Capacitor WKWebView alone is not evidence of an integrated native route gesture. Native swipe availability, Android predictive Back and physical system-edge arbitration remain device acceptance work. No JavaScript route or drawer recognizer is reintroduced until ownership and integration are verified.

## Row and refresh arbitration

`utils/touchGesture.ts` is a local contact guard, not a global gesture manager. `SwipeableBookCard` and `PullToRefresh` share these rules:

- Require one identified touch and no selected text or already-prevented event. Contacts in the outer 24 CSS pixels on either side are ignored by these actions. This is a conservative application exclusion margin, not a measured OS gesture-region width.
- Native links, form controls, secondary buttons and editable surfaces keep their interaction. The existing `.library-book-primary` button may start these gestures because it is the deliberate card surface. A subtree can explicitly opt out with `data-gesture-ignore`; this never disables its normal tap or keyboard action.
- Track contact identity. A second finger anywhere, replacement finger, touch cancellation, scrolling, blur, page hiding, selected text, native context menu or document hiding cancels the pending action. An open/closing registered overlay rejects the start or cancels movement/release through the shared layer registry; these gestures never force that overlay closed.
- Cancellation observers are installed only for an eligible active contact and removed on completion, cancellation or unmount. They are passive observers and never capture a pointer or prevent native behavior.
- The first meaningful movement owns the axis. A horizontal row swipe cancels refresh; a vertical scroll/pull cannot later become a row action. The existing refresh container and its app scrolling ancestors explicitly permit both vertical pan and pinch zoom; an ancestor's old `pan-y` policy would otherwise defeat the local pinch allowance. This preserves allowed browser actions without implementing a custom pinch recognizer.

`SwipeableBookCard` retains the existing react-swipeable implementation, thresholds, damping, feedback, reduced-motion release, visible action alternatives and delete confirmation. Only a recognized horizontal contact may prevent scrolling. Cancellation restores the tray's starting offset. A moved/cancelled contact cannot also activate the card; the next independent tap and keyboard/assistive activation remain usable.

`PullToRefresh` retains its existing width eligibility, scroll-boundary requirement, threshold and feedback. A synchronous pending guard prevents a second refresh contact from submitting while the first callback remains unsettled. This slice does not redesign refresh feedback, its error presentation or the browser's own pull-to-refresh policy. The unused book-list carousel and other local gestures are unchanged.

## Evidence and regression entrypoints

Source: `components/MobileHeader.tsx`, `components/SwipeableBookCard.tsx`, `components/PullToRefresh.tsx`, `utils/touchGesture.ts`, and their focused tests. The F05 environment fixture no longer imports deleted edge hooks; it still verifies that synthetic browser-edge events remain unprevented and do not change its current route. The F07 navigation fixture owns integrated Back/overlay behavior. The shell-scroll fixture retains geometry coverage.

Focused command:

```sh
npm run test --workspace=@brack/client -- src/components/SwipeableBookCard.test.tsx src/components/PullToRefresh.test.tsx
```

2026-09-28: **49 focused cases passed** (28 row, 21 refresh), including both real components nested together on the same touch path. They establish reserved-edge rejection, first-axis ownership, cancellation, multi-touch/selection handling, pending refresh deduplication, independent controls, late-overlay rejection and contact-listener cleanup. Client types, scoped lint and `npm run test:library-interactions:check` passed. Initial Vitest startup was blocked by sandbox child-process access; the approved local rerun passed.

Final browser command:

```sh
npx playwright test --config=tests/playwright/library-interactions.config.ts --workers=1 --output=test-results/f07-library-verified
```

**51 passed, 6 skipped, 0 failed** across Chromium, WebKit and Firefox (4.8 minutes). The six skips are the three explicitly Chromium-CDP-only touch cases on the other two engines. Existing keyboard, focus restoration, nested actions, selection, reorder, geometry/theme and carousel checks remain. The touch cases verify normal action reveal, cancellation after translation, a second finger, restoration and an independent later tap. Browser input and computed CSS do not establish actual OS gesture delivery or physical zoom behavior.

The initial full matrix had 47 passes, four failures and six skips. Traces showed Firefox's first Tab reaching the real scrollable `#root`, with `document.hasFocus()` true, and WebKit releasing a drag over the initial item before the target-over state settled. The test now permits exactly that verified scroll-container Tab stop before requiring the first book, and waits for actual drag activation/target-over state before release. It does not focus the expected target, skip arbitrary controls, increase timeouts or weaken the intended result.

An eight-case diagnostic run passed five cases and reproduced the three Firefox assumptions before the scroll-container correction. A later concurrent matrix was interrupted after two WebKit timeouts; its output is not a clean run. The final matrix ran alone with one worker, removed diagnostic foreground manipulation, retained the original timeouts, and used a fixture-specific Vite cache to avoid shared dependency-cache invalidation. These observations support the final result without claiming a proven single cause for every concurrent timeout.

Local artifacts: `test-results/f07-library-first-matrix-report.json`, `test-results/f07-library-isolation-report.json`, `test-results/f07-library-verified-report.json`; corresponding trace directories are `f07-library-matrix`, `f07-library-isolation`, `f07-library-final` (interrupted) and `f07-library-verified`. These generated artifacts are not committed. Broader F07 checks and remaining device acceptance are recorded in the [checkpoint](frontend-renewal/17-back-ownership.md).
