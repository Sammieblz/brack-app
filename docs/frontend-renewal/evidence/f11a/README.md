# F11a Book Detail evidence

Source and ownership: [checkpoint31](../../31-book-detail.md). Baseline HEAD `b97119d` plus inherited, uncommitted F10c changes. All captures use the actual BookDetail screen with controlled service/timer boundaries, synthetic book content and the BRACK mark as the cover. Inter, Merriweather and Playfair Display faces are loaded/asserted; these are browser screenshots, not physical-device evidence.

| View | Before | After |
| --- | --- | --- |
| Phone390×844 |[Baseline](before-phone.png) |[Reconstruction](after-phone-composition.png) |
| Tablet834×1112 |[Baseline](before-tablet.png) |[Reconstruction](after-tablet-composition.png) |
| Desktop1440×1000 |[Baseline](before-desktop.png) |[Reconstruction](after-desktop-composition.png) |
|320px /200% /long title |[Baseline](before-compact200.png) |[Full title](after-compact200-composition.png), [reachable reading controls](after-compact200-reading-controls.png) |
| Dark |[Baseline](before-dark.png) |[Reconstruction](after-dark-composition.png) |
| Paper Library |[Baseline](before-paper.png) |[Reconstruction](after-paper-composition.png) |

Additional final captures: [320px phone](after-phone320-composition.png), [tablet200%](after-tablet200-composition.png), [landscape](after-landscape-composition.png), [emulated Android](after-android-composition.png), [populated progress](after-populated-progress.png). Existing QuickProgressWidget remains visible in the populated capture; its reconstruction/integrity belongs to F11b.

The final gallery contains 6 before and 21 after PNGs. The manifest records report paths/counts, earlier failures, source hashes and limitations. Reports/traces under `test-results` are local artifacts.81 distinct passing browser cases combine the 69 passing main cases, 3 corrected focus cases, 3 populated cases and 6 existing membership regressions.19 unit tests pass. This does not claim one81-case green run, native timer durability, live-service persistence, full assistive-technology acceptance or legal compliance.
