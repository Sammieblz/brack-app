# F09 shell visual review

Captured from the final adaptive-shell Playwright run in Chromium, 2026-09-28. Actual shell and Library components, deterministic synthetic books; browser/native/PWA identity and viewport are controlled fixture inputs. These are current-state review artifacts, not approved visual baselines or a measured before/after usability study. External font requests are blocked, so the captures use fallback fonts. Native chrome, hardware insets, IME and screen-reader behavior are not represented.

| Capture | What to inspect |
| --- | --- |
| [Browser phone, 390×844](phone-browser.png) | Labeled Menu, no global bottom bar; calmer local Quick actions |
| [Native-style phone, 390×844](phone-native.png) | Labeled edge-anchored destinations without the previous floating gap/glow |
| [Native-style tablet, 834×1112](tablet-native.png) | Touch navigation remains below the Library; compact header rather than early desktop sidebar |
| [Browser destination menu](browser-menu.png) | Primary links first, grouped secondary destinations, theme-aware mark; account section continues within the same scrollable surface |
| [Timer and offline status](timer-offline.png) | Real shared utility components beneath a synthetic note task; last content action clears the utility region |
| [Menu at 200% text](large-text-menu.png) | Wrapping destinations and reachable Settings within one task surface |
| [320px, 200% text with timer/offline](narrow-large-text.png) | Tabs wrap; combined footer scrolls to keep its actions reachable. Capture is scrolled within that region, so timer/status are above its visible portion |

Visible remaining work: Library still repeats status/filter controls and per-book management rows; that is F10, not evidence that the whole Library is redesigned. At enlarged text the header, local action and footer take substantial space; scrolling/reachability is tested, but this is not a claim of completed usability or physical assistive-technology acceptance. Goals composition remains F13. See [checkpoint 19](../../19-adaptive-shell.md) for exact checks/failures and the review stop.
