# F10b Lists evidence

Baseline `8c01615`; see [checkpoint29](../../29-lists-reconstruction.md) and [verification manifest](verification.json). Production screens/hooks/overlays, deterministic in-memory catalog/books, loaded Inter/Merriweather/Playfair fonts. Covers in the fixture deliberately use the existing BRACK mark, so these images do not demonstrate real cover variety.

| View | Before | After |
| --- | --- | --- |
| Phone Lists,390×900 | [Before](baseline--lists-390.png) | [After](composition--lists-phone-composition.png) |
| Phone detail,390×900 | [Before](baseline--lists-list-1-390.png) | [After](composition--lists-list-1-phone-composition.png) |
| Tablet Lists,834×900 | [Before](baseline--lists-834.png) | [After](composition--lists-tablet-composition.png) |
| Tablet detail,834×900 | [Before](baseline--lists-list-1-834.png) | [After](composition--lists-list-1-tablet-composition.png) |

Other after profiles: desktop1280, compact320/200% text with long names, tablet834/200%, dark tablet, Paper Library phone, and emulated Android phone presentation. Each includes the initial screen and the filter or reorder task. All heights900. Compact title-width corrections are from final reruns; ordinary profiles are from the72-case matrix. Browser traces and additional engine screenshots remain in local `test-results` outputs named in the manifest.

Inspected phone/tablet before/after, narrow large-text reorder and final narrow title layout. The screenshot suite asserts no page overflow, full title content, reachable44px controls and loaded fonts. Behavioral tests separately assert retained nodes/focus, aliases/Back, service calls/rollback, and pointer/keyboard reorder. A screenshot alone does not verify these behaviors.

This evidence does not establish production account behavior, real cover diversity, hardware native feel, OS keyboard/system gestures, VoiceOver/TalkBack, legal conformance, or navigation performance. The Android fixture changes runtime presentation; it is not a native build.
