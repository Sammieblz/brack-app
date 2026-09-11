# Application shell scrolling

Scope: [issue #77](https://github.com/Sammieblz/brack-app/issues/77), the Library and Reader Journey header/page jump when scrolling down and then reversing direction.

## Root cause

Both desktop screens used `NativeHeader`. Its scroll listener switched between expanded and compact layouts at `scrollTop > 50` on the application scroll container. Crossing that threshold changed padding, title font size, subtitle presence, and Back-button dimensions. `transition-all` animated several of those layout changes for 300 ms.

A sticky header still occupies space in its scrolling document. Changing its height therefore moves the content below it and changes the scrollable range. Browser scroll anchoring or end-of-range clamping can then change the same scroll position used to select the header layout. Near the threshold, especially when reversing direction, that creates additional jumps or repeated layout changes. The geometry change itself is undesirable even where a browser does not exhibit a feedback loop.

Two related Journey behaviors need the same scrolling contract:

- The current-reader fallback status panel used a fixed `top: 8rem`, which does not account for the expanded header, its tab rail, larger text, or native safe areas.
- `JourneyTabsRail` called a tab's `scrollIntoView()`. That API can scroll vertical ancestors while trying to reveal a horizontally clipped tab.

The cross-browser regression also exposed a separate WebKit jump on entering League: mounting the mobile Radix scope picker reset the page from 180px to zero, despite the new panel being taller and without a focus/vertical-scroll call. Isolating the real League table or the desktop scope tabs preserved the position. The mobile scope filter now uses a labelled, styled native `select` with the same options; desktop scope tabs remain unchanged. This avoids the transient hidden native-select mount inside the custom picker and provides the system picker on mobile.

`useScrollDirection` is not used by these screens. The fix does not add direction detection, disable scroll anchoring globally, or introduce another vertical scroller.

## Ownership and layout contract

| Concern | Owner and rule |
| --- | --- |
| Vertical page scrolling | `MobileLayout` marks the page's single vertical owner with `data-app-scroll-container="true"`. Listen to or restore this container, not `window`. |
| Page content | Library's `#library-scroll` and Journey's `#journey-scroll` identify content regions. They are not additional vertical page scrollers. `NativeScrollView` remains non-scrollable by default. |
| Desktop header | `NativeHeader` retains its expanded, content-sized geometry. It does not shrink its title, remove its subtitle, resize actions, or subscribe to scroll position. |
| Header measurement | `useAppHeader` measures the complete header border box, including safe-area padding and secondary controls, and publishes `--app-header-height` on its nearest marked scroll owner. |
| Safe area | `--app-safe-top` uses `env(safe-area-inset-top, 0px)` for both Capacitor and installed PWAs; ordinary web/desktop viewports report zero. The header reserves this space as internal top padding and sticks at `top: 0`, painting its background beneath the status bar. Do not put the same inset on both the scroll owner's padding and the sticky offset: browsers add them. |
| Revealing content | The owner's `scroll-padding-top` includes the measured complete header height and a `0.75rem` breathing gap. Safe-area padding is already included in that measurement. |
| Journey fallback status | The sticky current-reader panel uses the same header-height + `0.75rem` sum. Do not restore a fixed pixel/rem estimate for this offset or count the safe area twice. |
| Horizontal navigation | Journey reveals an off-screen selected tab by scrolling only the rail horizontally. Selection, including keyboard selection, does not request a smooth vertical page movement. |
| Scrollbar space | The application scroll owner reserves a stable scrollbar gutter where supported, avoiding width changes as content becomes scrollable. |
| Smooth movement | Automatic restoration, focus-related positioning, and selected-tab visibility are immediate. Smooth scrolling is an explicit user-action behavior, such as Scroll to top, and respects reduced motion. |

The header measurement is layout-driven, not scroll-driven. `ResizeObserver` observes its border box so delayed secondary content, font loading, text scaling, and sidebar-induced wrapping update the offset. Measuring only `contentRect.height` would omit padding and borders. The header's own dimensions must not depend on `--app-header-height`, which would create a measurement/layout feedback loop.

Journey renders its tab rail from the first loading frame, with tabs disabled until data is available. This reserves the navigation footprint without a second header-height jump when the request completes. Mobile page padding and scroll-padding also reserve bottom-navigation clearance (including the safe inset) so the last focusable action can be fully revealed.

Keep the variable scoped to its scroll container rather than the document root. A header must release its observer and restore/remove its published value when it unmounts. Responsive navigation can replace the desktop header with the mobile header without leaving another route's dimensions behind.

Content sizing remains intrinsic: do not replace the old collapse behavior with a fixed-height header that clips subtitles or actions. Let controls wrap when space is constrained, and remeasure the resulting header. Deliberate content changes can legitimately change page height; the invariant is that scrolling alone does not change header geometry.

## Screen coverage

- **Library:** test Flat view, Bookshelf view, and Carousel view. Flat view is a single-column list on phones and a multi-column grid at wider sizes; these are not separate view settings. Cover loading, empty states, and additional loaded books must retain predictable scrolling.
- **Reader Journey:** test Overview, Quests, Shop, Badges, and League. The route's internal `rankings` value is presented as **League**. Test the current-reader fallback status panel with enough leaderboard content to reach its sticky position.
- **Shared shell:** other `NativeHeader` consumers inherit stable sizing. Dashboard, Back actions, utility actions, and mobile header controls must remain usable.

## Reproducing the pre-fix behavior

Use a development/test account or controlled local fixtures with enough content to scroll. Do not create or alter production reading data just to reproduce this UI defect.

1. Open Library at a desktop/tablet width of at least 768 CSS pixels. Start with the expanded title and subtitle visible.
2. Scroll down slowly through approximately 50 pixels. Stop near the transition and reverse direction with small wheel or trackpad movements. Repeat several times rather than testing only a large jump to the bottom.
3. Watch the title, subtitle, header bottom edge, and the first content row. In the old implementation, the subtitle disappears/reappears and the header's changing height moves page content. Repeat near the bottom of a short-but-scrollable result set, where a shrinking scroll range can clamp the position.
4. Repeat in Reader Journey, including with the secondary tab rail visible. Navigate between its sections after scrolling and observe whether tab visibility handling moves the vertical page.
5. With a League fixture whose current reader is outside the visible result list, scroll far enough to pin the fallback status panel. Check its clearance beneath the header and rail.

For diagnostics, inspect the marked application container's `scrollTop` and `scrollHeight`, and the header's bounding rectangle. `window.scrollY` is not a useful substitute for the application container's position. Browser automation should compare stable geometry after assets settle and separate intentional content loading from scroll-triggered layout changes.

## Regression checklist

The items below are validation requirements, not a claim that every platform has been tested. Record the browser/runtime, viewport, input method, theme, and results when running them.

- [ ] Widths **320, 390, 768, 834, 1024, and 1440 CSS pixels**: verify the correct mobile/desktop shell, usable actions, readable title/subtitle, and no unintended horizontal page overflow.
- [ ] Slowly cross the former 50-pixel threshold in both directions, rapidly alternate direction, pause after releasing input, and reverse near the bottom of short content. Scrolling alone must not change header height or scrollable content height.
- [ ] Run Library's three actual view settings and all five Journey sections. Include empty, populated, and loading/slow-asset states where applicable.
- [ ] Toggle the sidebar, resize its width where supported, and resize the window while scrolled. Header measurement must update when wrapping changes, without hiding controls or leaving stale sticky offsets.
- [ ] Delay cover images, fonts, and Journey data/secondary controls. Legitimate content changes may alter height; they must not reintroduce scroll-threshold header collapse.
- [ ] Test **200% text scaling/zoom**. Allow natural wrapping; verify the measured header bottom stays above the pinned League status panel and revealed content.
- [ ] Test light and dark modes using Brack's supported palettes. Header surfaces, separators, and sticky layering must remain legible.
- [ ] Test reduced motion. State remains usable with no decorative scroll animation; automatic positioning remains immediate.
- [ ] Tab through header controls and navigate Journey sections with the keyboard. The active tab is visible without a vertical ancestor scroll. Confirm controls obscured by sticky chrome can be brought into view.
- [ ] Test Scroll to top, route departure/return, and saved-position restoration. Restore the correct application container; do not animate automatic restoration.
- [ ] Confirm there is one vertical page scroll owner and that horizontal tab-rail movement does not change its vertical position.

### Native, installed PWA, and Electron checks

Responsive browser tests do not establish physical-device or packaged-runtime behavior. Track these separately and report any unavailable coverage explicitly:

- **Physical iOS and Android devices:** momentum scrolling, reverse gestures, overscroll, notch/status-bar clearance, portrait/landscape rotation, OS text scaling, and keyboard opening/closing. Include the Library pull-to-refresh interaction without changing normal page scroll ownership.
- **Installed PWA:** standalone viewport and safe-area behavior, app resume, orientation changes, and keyboard behavior on the target device. A normal browser tab is not equivalent evidence.
- **Electron build:** small and maximized windows, live resizing, wheel/trackpad input, keyboard navigation, sidebar resizing, and display scaling in the packaged desktop shell. A desktop Chromium web test does not verify Electron window integration.

Automated regression results and their exact invocation should be recorded with the tests that accompany the fix. Do not infer pass counts or native coverage from this checklist.

## Automated checks

```sh
npm test
npm run test:e2e:shell:check
npx playwright install chromium firefox webkit
npm run test:e2e:shell
```

`tests/playwright/shell-scroll.config.ts` starts a separate, local-only Vite fixture on port 8082. It renders the production Library and Journey screens, shell, headers, tab rail, and Library views with controlled data and selected unrelated components replaced. It does not sign in to or mutate a real backend. Position assertions run in Chromium, Firefox, and WebKit; the main preview smoke suite excludes this fixture-specific spec. CI runs both suites.

The supporting checks have distinct responsibilities:

- `NativeHeader.test.tsx` checks DOM continuity and working controls through scroll reversals, and verifies that the complete header is connected to the measurement hook. jsdom does not provide real layout, so these are not browser geometry assertions.
- `useAppHeader.test.tsx` controls `ResizeObserver` deliveries to check border-box measurement, fallback measurement, unchanged/empty notifications, nearest-owner scoping, observer cleanup, restoring a previous height, and React StrictMode effect replay. Scroll events must not install a measurement loop.
- `JourneyTabsRail.test.tsx` checks horizontal-only navigation with controlled element bounds; browser tests verify actual ancestor scroll positions.
- `test:e2e:shell:check` type-checks and lints the root-level Playwright configuration, spec, and fixture explicitly. These files are outside the client workspace's usual `src` quality gates. CI runs this check before browser tests.

Failed shell runs retain diagnostic traces, and CI uploads `test-results/` for seven days. Browser screenshots are not required to assert scroll geometry. Do not loosen position assertions or mock the production header just to obtain a passing regression.

For Library fixture readiness, wait for the requested view itself (Flat, Bookshelf, or Carousel), not just the page heading. Preferences resolve asynchronously, and the original test measured geometry before checking that the selected view was visible. A baseline WebKit run failed with a missing scroll owner during that readiness window; its trace did not establish why the owner was temporarily absent. Do not attribute this to lazy loading or hot reload without further evidence. Delayed-cover checks must establish that images loaded successfully, not merely that the browser finished attempting the request. Keyboard checks must establish both the selected tab and the unchanged vertical position.

The pre-fix Chromium reproduction at 1024px measured Library's header changing from 114px to 69px: a requested 70px scroll settled at 50px. Journey's header changed from 189px to 153px at a requested 80px scroll (settling at 70px), then to 128.25px when requesting 51px (settling at 26px). `window.scrollY` remained zero. The regression checks preserve the header and content geometry while repeatedly crossing that old threshold.

### Local validation — 2026-09-10

- All 198 browser checks (66 scenarios in each engine) passed across the matrix and targeted reruns. This was not one final combined 198-test invocation. A final fresh-server run of the 12 threshold-reversal, Journey-tab, and mobile-scope-picker checks passed in all three engines.
- Eight focused unit/component tests passed for header stability, measurement/cleanup, tab navigation, loading reservations, and the League scope control.
- Type checks and production build passed. Repository lint passed with 53 existing warnings; changed components/hooks and the reading-core lint gate passed without warnings. The `npm ci` dry run passed without dependency changes.
- The fixture uses local fallback fonts and a controlled late font-metrics change; it does not test Google Fonts download behavior. Actual installed PWA, physical iOS/Android, and packaged Electron checks remain outstanding.
- CI configuration includes the regression suite, but no commit, push, or remote workflow run was performed as part of this validation.

### Supporting-test validation — 2026-09-11

- The committed baseline passed 552 client tests; its full browser run passed 197/198, with one WebKit carousel failure before selected-view readiness had been established. No application behavior was changed in this follow-up.
- After the supporting-test fixes, all **564 client tests across 84 files** passed (`npx vitest run --maxWorkers=2` from `apps/client`). The four focused header/Journey test files passed **20 tests**, including a separate shuffled run with seed 77.
- A single fresh-server invocation of `npm run test:e2e:shell` passed **198/198 checks** in 7.2 minutes: 66 each in Chromium, WebKit, and Firefox, with no retries or skips. The updated keyboard, loading, delayed-image, and carousel checks also passed a preceding 12-test targeted run.
- `npm run check-types`, `npm run test:e2e:shell:check`, and `npm run lint` passed. The dedicated fixture gate and changed unit tests were warning-free; repository lint retained its 53 existing warnings. The `npm ci` dry run passed, with no dependency/lockfile changes.
- Default Chromium smoke-test discovery still lists 10 tests and excludes the separate shell suite. The fixture server stopped after the run; the existing developer server was left running.
- This is local Windows browser-engine validation, not a remote Ubuntu CI run or physical-device, installed-PWA, packaged-Electron, or external-font validation. No commit, push, or remote workflow dispatch was performed.
