# Settings continuity review evidence

Captured 2026-09-30 with the [actual Settings fixture](../../../../tests/fixtures/settings-continuity/README.md). [Checkpoint23](../../23-settings-continuity.md) owns exact verification status and original failures. These are browser-rendered application screens, not mockups or physical-device captures.

The [verification manifest](verification.json) retains individual test outcomes, original failure summaries, artifact hashes and the exact changed source/fixture hashes. Settings' 87 distinct engine/scenario combinations are covered by the 83/87 full run and corrected 18/18 continuity follow-up; three further WebKit repetitions passed. These are overlapping runs, not 108 distinct Settings cases. Shared shell 21/21 and dialog 15/15 checks also passed, with 95 distinct unit tests across 12 files. Checkpoint23 records the final type/lint/build and local Graphify/Obsidian results.

The retained 16 PNGs are selected from `test-results/cr03-visual-review`: 66 Chromium captures, 32 loaded-font records and 32 geometry records from `cr03-visual-1` (four visual scenarios passed, each traversing all eight Settings categories). The later three-engine run is separate evidence. Each writing/action capture follows control fit checks; enabled actions also require pointer hit testing. Account's real Update password action remains disabled because the fixture does not supply an external CAPTCHA; its viewport fit is observed, not a browser password-update claim.

| Profile | Observed scope |
| --- | --- |
| 320 × 844 | All eight actual sections. Retained [reading actions](narrow-reading-actions.png), [profile draft](narrow-profile-writing.png), [personal fields](narrow-personal-writing.png), [notification action](narrow-notifications-actions.png), [import action](narrow-data-actions.png), [account actions](narrow-account-actions.png), [privacy](narrow-privacy-actions.png), [appearance](narrow-app-writing.png). |
| 834 × 1112, 200% root text | Retained [Account actions](tablet-large-text-account-actions.png), [import preview](tablet-large-text-data-actions.png), [reading fields](tablet-large-text-reading-writing.png) and [privacy](tablet-large-text-privacy-actions.png). Export/account actions now wrap; import counts reflow without colliding. |
| 834 × 1112, 200% root text, synthetic coarse pointer | Actual [photo sheet](tablet-touch-large-text-profile-nested.png) and [date sheet](tablet-touch-large-text-personal-nested.png). ScrollToTop stays behind the modal; actions are not covered by shell controls. |
| 390 × 480 | Retained [Profile Save](short-height-profile-actions.png) and [notification Save](short-height-notifications-actions.png). They remain scrollable and reachable. This is a short browser viewport, not a measured virtual keyboard. |

Root visual review checked the corrected Account/import rows, reading header, photo/date sheets, phone privacy and short-height notification action. Inter, Merriweather and Playfair Display are loaded declared faces in the fixture. The theme is the existing light palette; this is not the complete theme/contrast matrix.

Composition debt remains for F16/CR10: repeated section/card/field headings, a long stack of profile cards, settings help/sign-out hierarchy and full preference grouping. The native 320px Readers tab can wrap within its word; the shell's broader typography acceptance remains open. These captures support CR03's continuity/reachability correction, not a declaration that Settings' final visual redesign or the entire frontend is complete.

The service/device boundaries are deterministic. Physical iOS/Android/tablets/foldables, actual browser toolbars, native keyboards and permission sheets, assistive technology, external CAPTCHA, backend storage/import and cold-route performance remain unverified. The selected screenshots and source hashes do not replace those checks.
