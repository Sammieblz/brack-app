# F08 renderer review captures

Captured on2026-09-28 using Playwright Chromium and the [local fixture](../../../../tests/fixtures/adaptive-overlays/README.md). These are real components/CSS with synthetic reader/task data; no production account was accessed. Requests outside the local origin are blocked, so font rendering uses locally available fallbacks. Native status bars, browser toolbars, real keyboards and assistive technology are not represented.

| Capture | Viewport | Observation |
| --- | --- | --- |
| [Phone note](phone-note.png) | 390×844 | Bottom task surface, visible title/Close, focused field and reachable Save; parent page remains dimmed |
| [Tablet actions](tablet-actions.png) | 834×1112, synthetic coarse input | Constrained sheet with contextual actions, separated destructive group and Cancel |
| [Large-text actions](large-text-actions.png) | 390×720,200% root text,dark | Scrolled to the final action; text wraps and controls remain reachable; foreground text replaced the hard-to-read destructive text color |
| [Goals calendar](tablet-goals-calendar.png) | 834×1112, synthetic coarse input | Actual goal form and nested calendar; Escape returns one layer at a time; local brand image is served by the fixture |

No screenshot-baseline assertion or whole-theme/accessibility conformance is implied. [Checkpoint18](../../18-adaptive-overlays.md) records DOM/focus/draft, contrast sample and final automated results separately. Goal form/calendar screenshots are retained with the browser artifacts named there.
