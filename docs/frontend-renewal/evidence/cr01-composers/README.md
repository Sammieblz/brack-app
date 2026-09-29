# CR01 actual-consumer evidence

Owner: [checkpoint21](../../21-live-composers.md). Baseline HEAD `db076cf`, with the CR01 working-tree changes. This folder is a reviewable record of live writing tasks, not a complete visual or native acceptance record for these screens.

## Captures

Headless installed Playwright browsers render the actual Feed, PostDetail, UserProfile, Messages and BookClubDetail screens through the local fixture at `http://127.0.0.1:8094`. Synthetic account, service and device boundaries are specified in the [fixture README](../../../../tests/fixtures/live-composers/README.md). No real posts, messages, uploads or accounts are used.

These 20 PNGs are Chromium captures from `test-results/cr01-final-matrix-summary.json`, at the relevant task's scroll position. The page uses a nested main scroller, so `fullPage` does not capture all of its offscreen content. They retain the source theme/typography and controlled reading content. They do not simulate an OS keyboard, browser toolbar, native safe area or screen reader. The 200% case sets the root font size to 32px; it is not browser zoom or a physical accessibility setting. Profile's post payload lacks a joined `profiles` object in this fixture, so its post author renders the existing Unknown reader fallback; that is not evidence of a live-server author defect.

| Viewport / text | Feed | PostDetail | Profile Posts | Direct message | Club Chat |
| --- | --- | --- | --- | --- | --- |
|320×844,100%|[Image](narrow-Feed.png)|[Image](narrow-PostDetail.png)|[Image](narrow-UserProfile.png)|[Image](narrow-direct.png)|[Image](narrow-club.png)|
|390×844,100%|[Image](compact-Feed.png)|[Image](compact-PostDetail.png)|[Image](compact-UserProfile.png)|[Image](compact-direct.png)|[Image](compact-club.png)|
|834×1112,100%|[Image](tablet-Feed.png)|[Image](tablet-PostDetail.png)|[Image](tablet-UserProfile.png)|[Image](tablet-direct.png)|[Image](tablet-club.png)|
|390×844,200%|[Image](large-text-Feed.png)|[Image](large-text-PostDetail.png)|[Image](large-text-UserProfile.png)|[Image](large-text-direct.png)|[Image](large-text-club.png)|

[Font evidence](font-evidence.json) records the actual FontFace status for each screen/browser/size, grouping repeated family/status observations with counts. Raw observations remain in the local report. Inter and Playfair Display loaded in all these scenarios; Merriweather also loaded where post/comment prose uses it. A family-level `document.fonts.check()` alone is not used as proof of a downloaded face. The fixture uses the same Google Fonts declarations as the app; this demonstrates the captured font state, not offline font delivery or theme-persistence behavior.

## Behavior and retained diagnostics

[Run results](run-results.json) contains compact per-test outcomes and the paths of the original local reports. The owning checkpoint records commands, unit/type/lint/build results and final status. Keep failed diagnostics and their explanations; do not sum repeated cases into an inflated unique coverage count.

Final result: **75 distinct CR01 cases have passing evidence** (73/75 final-source matrix plus6/6 corrected native-caret expectation rerun), and **63/63 existing shell cases pass**. The rerun corrects the test's assumed caret position, retaining draft, focus, actual header clearance and hit-testing requirements. [Plain native WebKit evidence](native-caret-baseline.json) independently reproduces that engine's Tab-return caret policy without BRACK code. This is not a single clean75-case run. All20 screenshots here come from the final-source matrix's passing visual cases.

- The first chat-only Chromium diagnostic found the missing direct-message failed-image state:9/10 before repair.
- The first full 66-case matrix found actual Send click interception by Scroll to top:64/66 before repair. Screenshot inspection also exposed cramped 200% chat editors and clipped actions; both chat composers now reserve a full-width writing row.
- The expanded 69-case matrix passed 68; a WebKit emoji prelude sent Escape before observable picker focus readiness. After adding expanded/visible/focused readiness and retaining exact dismissal/refocus assertions, the six affected media cases passed across all three engines.
- Final visual inspection separately identified sticky-header overlap in large-text comment captures. The capture helper now honors CSS scroll padding and verifies actual header clearance and multiple pointer hit points. A real keyboard-return gap was independently reproduced and repaired using the shell's existing reveal logic; pointer contacts are excluded so controls do not move during activation. The checkpoint retains the initial failures, the interrupted pointer-regression run and the final outcomes.

Media tests exercise named content, failed images, GIF search/send failure and pending guards, Close/Escape/app Back and exact initiating-control focus. Writing tests exercise the actual parent tabs/collapse, failed/deferred writes/uploads, newer typing, pending duplicate guards and unchanged retry payloads. Browser API boundaries are synthetic; source hook tests cover stale outcomes and message deduplication separately.

## Review boundaries

The chat composer now has usable writing width and wrapping, reachable actions at narrow and large-text sizes. Brack's theme/font/icon identity is preserved. Broader card density, message-bubble proportions, tablet pane composition, oversized large-text headers and clipped 200% post-reaction rows remain assigned to CR05 and F14/F15/CR10. No screenshot here accepts those entire screen families or closes physical-device, AT, performance or legal-conformance requirements.
