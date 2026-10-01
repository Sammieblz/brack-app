# CR05 Messages evidence

Owner: [checkpoint25](../../25-messages-layout-gestures.md). Scope and controlled service/device boundaries: [actual Messages fixture](../../../../tests/fixtures/messages-layout/README.md). This folder preserves selected browser evidence for the completed responsive task and gesture checkpoint; it does not close the broader visual renewal, native or assistive-technology acceptance.

The retained set contains **30 images: 26 final captures and four diagnostic failures**. [Artifact manifest](artifact-manifest.json) records each source run/path and SHA-256, selected source hashes and the latest scenario/engine result. [Visual observations](visual-observations.json) contain 15 loaded-font records and 66 geometry records. Generated traces and complete JSON reports remain in the independently named `test-results/cr05-*` folders.

The full matrix passed 59 checks with four declared CDP skips. After final parent scroll/copy and obsolete-hook feedback corrections, the targeted final-source matrix passed 30/30 checks. Merging the latest result per scenario and engine leaves **59 distinct passes and four skips**; repeated checks are not added. The main checkpoint records the separate unit/build/static results and source verification.

## Reading the images

Final profiles cover 320×740, 390×844 with 200% root text, 834×1112 with 200% root text, 390×480, and 1280×900. Each has an inbox, expanded row actions, message thread and nested GIF task. The phone 200% and short-height profiles also show reply/file context. Screenshots are taken after actual control hit/viewport checks and loaded Inter, Merriweather and Playfair Display faces; geometry records retain the observed viewport, root text size, pane mode and scroll boxes.

The diagnostic images retain two initial failures: replacing the real textarea on compact-to-tablet reflow, and the fixed-width inbox clipping the tablet thread at 200% text. A later smoke image preserves the phone history/composer overlap that passed the earlier geometric assertions but failed visual inspection. This prompted a production overflow/icon-sizing correction and an explicit history/composer separation assertion.

The fourth diagnostic image preserves a wrapped Hide action clipped by the pinned inbox header. The final parent scroll owner includes that header, allowing it to scroll away. Final controls must be entirely inside every clipping/scroll ancestor and pass top/middle/bottom hit checks. Final phone 200% row actions were visually inspected in all three engines.

| Profile | Inbox | Row actions | Thread | GIF |
| --- | --- | --- | --- | --- |
| 320×740 | [Image](chromium-compact320-inbox.png) | [Image](chromium-compact320-row-actions.png) | [Image](chromium-compact320-thread.png) | [Image](chromium-compact320-gif.png) |
| 390×844, 200% | [Image](chromium-phone200-inbox.png) | [Image](chromium-phone200-row-actions.png) | [Image](chromium-phone200-thread.png) | [Image](chromium-phone200-gif.png) |
| 834×1112, 200% | [Image](chromium-tablet200-inbox.png) | [Image](chromium-tablet200-row-actions.png) | [Image](chromium-tablet200-thread.png) | [Image](chromium-tablet200-gif.png) |
| 390×480 | [Image](chromium-short390-inbox.png) | [Image](chromium-short390-row-actions.png) | [Image](chromium-short390-thread.png) | [Image](chromium-short390-gif.png) |
| 1280×900 | [Image](chromium-expanded1280-inbox.png) | [Image](chromium-expanded1280-row-actions.png) | [Image](chromium-expanded1280-thread.png) | [Image](chromium-expanded1280-gif.png) |

Additional captures: [phone reply/files](chromium-phone200-reply-file.png), [short-height reply/files](chromium-short390-reply-file.png), [WebKit row actions](webkit-phone200-row-actions.png), [Firefox row actions](firefox-phone200-row-actions.png), [WebKit thread](webkit-phone200-thread.png), [Firefox thread](firefox-phone200-thread.png).

Diagnostic captures: [replaced textarea](diagnostic-remounted-composer.png), [clipped tablet thread](diagnostic-tablet-fixed-inbox.png), [history/composer overlap](diagnostic-history-composer-overlap.png), [clipped row action](diagnostic-clipped-row-action.png).

## Limits and remaining visual work

The phone 200% reply/file task keeps each control reachable through bounded overflow. After revealing Send, the long reply banner can be above the visible area. This remains a dense composition; larger attachment previews and broad shell typography/utility density belong to the remaining visual tickets. It is not recorded as a completely redesigned messaging experience.

Synthetic observed viewport contraction establishes available-height handling, not a physical software keyboard. CDP contact checks establish browser-local row/reply ownership only. Browser Back, native system edges, predictive Back, screen readers, hardware input and physical tablet/foldable behavior need their separate device/AT acceptance.
