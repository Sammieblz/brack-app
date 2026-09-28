# Current-state fixture observations

F08's active evidence is in [checkpoint18](../18-adaptive-overlays.md), the [adaptive contract](../../ui-adaptive-overlays.md) and [action/Goals audit](f08-action-goals.md). Its new fixture screenshots and final browser traces stay in the local Playwright artifact directories named by the checkpoint; these are synthetic renderer observations, not physical-device captures.

F07 implementation evidence is recorded separately in [navigation ownership](f07-navigation-ownership.md) and [overlay ownership](f07-overlay-ownership.md), with the current results/review stop in [checkpoint 17](../17-back-ownership.md). It preserves the distinction between synthetic browser policy checks and native-device acceptance.

These Library images preserve the original audit baseline. The later F06 experiment has its own [retained artifacts](ionic-fit/README.md), [modal evidence](ionic-fit-modal.md), [navigation evidence](ionic-fit-navigation.md) and [bundle comparison](ionic-fit-bundle.md); it does not replace these baseline captures or represent a production redesign.

Captured 2026-09-27 from the existing `tests/fixtures/shell-scroll` harness at `http://127.0.0.1:8082/my-books?view=flat`, using installed Playwright Chromium in headless mode. These are baseline screenshots, not redesign mockups.

| Artifact | Viewport in CSS px | Direct observation |
| --- | --- | --- |
| [Phone](library-phone-fixture.png) | 390 × 844 | Library summary/status rail plus a second status row; advanced controls already collapsed; per-book action strip; large floating bottom destination bar |
| [Tablet](library-tablet-fixture.png) | 834 × 1112 | Desktop-style My Library header and collapsed sidebar geometry; two-column book cards; advanced controls remain collapsed |
| [Desktop](library-desktop-fixture.png) | 1440 × 900 | Wide header with contextual actions, expanded sidebar geometry, summary rail plus expanded filter toolbar and two-column cards |

Each viewport had one `[data-app-scroll-container]`; measured body scroll width equaled viewport width. No page errors were reported for the successful tablet/desktop capture run. Phone capture completed, but the first combined run later failed waiting for the tablet heading `Library`: the larger layout uses `My Library`. The subsequent run waited for actual book content and completed. This is capture-script history, not an app failure or a claim that regression tests passed.

## Limits

The fixture uses production Library, layout, navigation/header and library-view components with production CSS, but mocked data/services, minimal sidebar contents and mocked unrelated overlays. It deliberately omits external Google Fonts; these images show fallback font rendering. Thirty fixture books with repeated placeholder covers are not representative real cover variety. No production account or external data was accessed; browser requests were restricted to the fixture origin and service workers were disabled.

No OS status bar, browser address/toolbar, real keyboard, native WebView, live assistive technology, performance trace or touch ergonomics is represented. Viewport resizing is not a physical-device test. The captures support composition and geometry observations only. They must not be used to claim production contrast, type rendering, native feel, perceived latency or legal conformance.

## Redesign comparison to capture later

Use the same deterministic content and viewports to compare hierarchy; separately capture realistic varied covers, actual fonts, every theme, large text and localized long labels. Add native iPhone/Android, iPad/tablet split window, installed PWA and browser-toolbar recordings. Compare visible book content, number of competing action groups, primary-task findability and tap errors—not just screenshot attractiveness.

The intended compact Library has a title/context action, a search field, one status selector with counts, an active-filter summary and explicit Controls trigger, then book content. Each book has a primary action and accessible More menu; details remain available without requiring a swipe. These targets are specified in 04/05 and are not shown in these screenshots.
