# F11b reading capture evidence

Baseline `ee0081e`, 2026-10-01. [Checkpoint32](../../32-reading-capture.md) owns the review stop; [verification.json](verification.json) preserves exact report summaries, failures, test cases, source hashes and limits. **132 distinct new browser cases plus 27 existing regressions pass**, across Chromium, WebKit and Firefox. Repeated follow-up checks are not counted again. Eight baseline captures are separate from acceptance results. No native or remote-service execution is implied.

## Before and after

| Surface | Before | After |
| --- | --- | --- |
| Phone progress destination | [Statistics/card wall](baseline-ready-baseline-route-390-baseline.png) | [Saved place, capture and dated activity](composition-phone-route.png) |
| Phone capture | [All optional fields upfront](baseline-ready-baseline-log-390-baseline.png) | [Focused page task](composition-phone-capture.png), [disclosed optional fields](composition-phone-optional-fields.png) |
| Tablet progress destination | [Before](baseline-ready-baseline-route-834-baseline.png) | [After](composition-tablet-route.png) |
| Tablet correction | [Before](baseline-ready-baseline-correction-834-baseline.png) | [Distinct inline correction](correction-composition-tablet-correction.png) |
| Touch tablet | No matching coarse-pointer baseline | [Reachable sheet](chromium-touch-tablet-capture.png); verified same draft after expanded-window presentation |
| Dark palette | No matching baseline | [Capture](composition-dark-capture.png), [correction](correction-composition-dark-correction.png) |
| 320px / 200% text | No matching baseline | [Capture](composition-compact200-capture.png), [optional fields](composition-compact200-optional-fields.png), [correction](correction-composition-compact200-correction.png) |
| Short landscape | No matching baseline | [Reachable scrolled capture](composition-landscape-capture.png) |

46 retained PNGs: 8 before, 35 main-matrix Chromium captures and 3 touch-tablet engine captures. Brand font faces are asserted loaded in the new visual cases. The test deliberately scrolls controls into view; large-text/landscape captures can show only the current section of the whole-surface scroller. Separate assertions check every visible control's reachability, target dimensions and horizontal bounds.

## Observations and limits

Visual review inspected phone/tablet before/after, touch-tablet sheet, dark capture, large-text correction/optional fields and short landscape. The page now exposes logging before statistics; activity reads as a dated list; optional input is progressively disclosed; correction has distinct intent without another generic card. A fine-pointer tablet uses a centered task, while a verified coarse-pointer medium window uses a sheet. Screenshots of emulated iOS/Android do not establish physical native feel.

The real Book Detail, Dashboard (both invokers), ProgressTracking, ProgressLogger, QuickProgressWidget, nested image chooser and shared Back/modal owners render in the fixture. Controlled repository/API responses cover offline/local saves, rejection/deferred completion, ambiguous postcommit response, stale refresh, current-account replacement and upload selection/replacement/cancellation. These boundaries are listed explicitly in the checkpoint; no mock is credited as proof of IndexedDB/SQLite, remote synchronization, native camera permissions or real assistive technology.

The initial integration run's three selector failures and one unrun case remain in the manifest, followed by their successful corrected run. The main matrix passed 120; the final subset passed39 (30 repeats +9 new); touch passed3; existing Book Detail regressions passed21 and membership passed6. Browser errors are asserted empty in the dedicated new suite. The two-stage helper and real local hydration invariants have separate unit evidence; total targeted unit result121/121.

No measured production latency, crash-persistent capture recovery, legal certification or wider F11 acceptance is claimed. Physical iOS/Android/tablet input, safe areas, system Back/edge gestures and VoiceOver/TalkBack remain release checks.
