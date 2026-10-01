# F10a Library reconstruction evidence

Baseline `d944fef`; actual production MyBooks/BookDetail/Lists and shared Library consumers, with controlled local service/device boundaries. [Checkpoint28](../../28-library-reconstruction.md) is the authoritative handoff. Fonts are loaded Inter, Merriweather and Playfair Display; covers are deterministic branded placeholders. These are rendered application captures, not mockups or physical-device proof.

| View | Before | After |
| --- | --- | --- |
| Phone 390x844 | [Baseline](f10-baseline-000-0-0-initial-library.png) | [Reconstructed Library](f10-final-000-0-2-initial-library.png) |
| Tablet 834x1112 | [Baseline](f10-baseline-001-0-0-initial-library.png) | [Reconstructed Library](f10-final-001-0-2-initial-library.png) |
| Desktop 1280x1112 | [Baseline](f10-baseline-002-0-0-initial-library.png) | [Reconstructed Library](f10-final-002-0-2-initial-library.png) |

Additional inspected captures: [tablet at 200% text](f10-final-004-0-2-initial-library.png), [320px/200% controls](f10-final-003-0-4-controls.png), [dark tablet](f10-final-005-0-2-initial-library.png), [Paper phone](f10-final-006-0-2-initial-library.png), [native presentation](f10-final-007-0-2-initial-library.png). The native-presentation capture uses a bridge adapter; no native-device or screen-reader acceptance is claimed.

[verification.json](verification.json) preserves 15 run records, exact case outcomes/errors/annotations, fixture diagnostics, source/report hashes and 104 captures. Raw full Playwright reports and traces remain at the recorded `test-results` paths; those ignored files are local artifacts. The manifest retains failures and diagnostic outcomes even if local artifacts are later cleaned. Check logs are retained beside this README. Baseline cases intentionally failed the new-design assertions after capturing the old screen; they are not baseline defect counts.

Final acceptance within scope: 48 new reconstruction browser passes; 97 distinct Library/list task passes established by the full run and nine-case focus correction; 51 primary/gesture passes; 29 destination passes; 12 loading-geometry passes; 66 unit passes. Nine existing capability skips remain across the suites: eight Chromium-CDP-only touch cases in other engines and one Windows WebKit anchor-Tab case. Follow-up passes overlap previous passes and are not added twice.

The first visual iteration was rejected because phone controls displaced content. Existing-task failures first exposed outdated tooltip expectations, then the real two-target carousel focus defect; both are described in checkpoint28. The loading regression was fixed by matching actual action wrapping rather than increasing the existing shift tolerance. Build/types/lint passed; pre-existing build/tool warnings remain documented. Whole F10, Ionic integration, large-library performance, native hardware, assistive technology and human design approval remain open.
