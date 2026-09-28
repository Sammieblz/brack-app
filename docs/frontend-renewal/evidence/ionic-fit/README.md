# Retained F06 artifacts

Selected artifacts from the final isolated Ionic 9.0.5 experiment, following baseline `2ddc1c25c3b453a5b3f923c99f4d3e58b45b7754`. These are representative fixture surfaces, **not the redesigned production app**. [Checkpoint](../../16-ionic-fit-experiment.md) records commands and results; the [integration decision](../../../ui-ionic-fit.md) explains why production adoption is deferred.

## Visual observations

All five images were inspected from the local Playwright Chromium run. They preserve actual BRACK palette tokens and configured font roles, with remote fonts blocked and available fallbacks rendered. Reduced motion was active at capture. No OS/browser chrome, real keyboard or native WebView is represented.

| Image | CSS viewport / conditions | Direct observation |
| --- | --- | --- |
| [Modal, paper palette](modal-phone-paper.png) | 390×844, 100% root text, emulated Android presentation, paper-library/light | Labeled header, raw date input and optional calendar trigger; content continues in one internal scroller |
| [Modal, large phone text](modal-phone-text200.png) | 390×844, 200% root text, emulated iOS, default/light; scrolled to actions | Header wraps Close onto its own row; Save and Cancel wrap vertically and are reachable |
| [Modal, large tablet text](modal-tablet-text200.png) | 834×1112, 200% root text, emulated iOS, default/light; scrolled to actions | Wide text field and side-by-side actions fit the window; header remains visible |
| [Navigation, phone](navigation-phone.png) | 390×1000, emulated iOS, default/dark | Labeled bottom Library/Reading tabs, single-column synthetic content, visible heading focus |
| [Navigation, browser](navigation-browser.png) | 1280×1000, browser presentation, default/dark | Top destination strip and two-column synthetic content; this is experimental placement, not F09 approval |

The screenshots support geometry/token observations only. They do not establish actual font rendering, full contrast, native feel, accessibility conformance, or performance. The modal's forward Tab gate and route lifecycle gate remain failed regardless of screenshot appearance.

## Machine-readable observations

The retained gate JSON records synthetic content only. Modal records contain per-Tab active-element containment and document focus; navigation records contain actual lifecycle counters and visible/hidden page state. File names identify the engine. The bundle report records emitted JS/CSS closure sizes, not production network performance.

| Record | Chromium | WebKit | Firefox |
| --- | --- | --- | --- |
| Modal focus | [JSON](modal-focus-boundary-chromium.json) | [JSON](modal-focus-boundary-webkit.json) | [JSON](modal-focus-boundary-firefox.json) |
| Tab lifecycle | [JSON](ionic-9-0-5-missing-tab-lifecycle-chromium.json) | [JSON](ionic-9-0-5-missing-tab-lifecycle-webkit.json) | [JSON](ionic-9-0-5-missing-tab-lifecycle-firefox.json) |
| Retention/timing | [JSON](synthetic-navigation-retention-and-timing-chromium.json) | [JSON](synthetic-navigation-retention-and-timing-webkit.json) | [JSON](synthetic-navigation-retention-and-timing-firefox.json) |

The [102-case result record](browser-results.json) distinguishes 97 ordinary passes from 5 declared failed adoption gates; there are no unexpected outcomes. The [bundle report](bundle-report.json) contains the matched static/lazy closure measurement described in the [measurement method](../ionic-fit-bundle.md).

Raw traces and the full JSON test report remain in ignored test-output folders described by the checkpoint. Rerunning Playwright replaces those folders; the small retained artifacts here keep the decision reviewable across sessions. Rebuild/retest after changing the pinned release; do not treat these snapshots as current results for another version.
