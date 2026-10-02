# Reading sessions and book editing evidence

Batch: [F11c/F11d](../../33-timer-and-book-editing.md), baseline `6e68b57`. Final acceptance remains pending until the checkpoint and verification manifest record completed checks.

| Surface | Before | Reconstructed |
| --- | --- | --- |
| Phone session | [Immediate finish](before/active-390.png) | [Focused session](after/session-composition-phone-session.png), [finish review](after/session-composition-phone-finish-review.png) |
| Tablet picker | [Header popover](before/picker-834.png) | [Reading shelf rows](after/real-picker-entry-834-starts-selected-book-and-survives-resize-picker.png) |
| Phone picker | [Quick actions chooser](before/picker-390.png) | [Shared app-owned chooser](after/real-picker-entry-390-starts-selected-book-and-survives-resize-picker.png) |
| Phone Edit Book | [Long uniform form](before/edit-390.png) | [Reading-first groups](after/editor-composition-phone-editor-essentials.png) |
| Tablet Edit Book | [All metadata upfront](before/edit-834.png) | [Groups and optional details](after/editor-composition-tablet-editor-essentials.png) |
| Recovery | [Previous review](before/recovery-834.png) | [Strict minute review](after/recovery-validates-raw-minutes-and-blocks-pending-Back-before-one-reviewed-save-recovery.png) |
| Large text | No matching baseline | [Editor actions](after/editor-composition-compact200-editor-details-and-actions.png), [session review](after/session-composition-compact200-finish-review.png) |
| Dark theme | No matching baseline | [Editor](after/editor-composition-dark-editor-essentials.png), [session](after/session-composition-dark-session.png) |

## Observation method

The fixture renders actual TimerProvider, timestamp arithmetic, session controls, both shared picker triggers, BookDetail, MyBooks, EditBook, Dashboard, Achievements/Journey and JournalPromptHandler. Actual Router, Back coordinator, focus/overlay primitives, book-loading hooks and journal hook remain mounted. Repository/API/read-model, auth and native device boundaries are controlled and declared in [the fixture README](../../../../tests/fixtures/reading-session/README.md).

Ten before captures were taken before their respective production surfaces changed. Baseline entry discovery was corrected after four failed attempts to invoke an absent Dashboard header timer: the compact picker is reached from Library Quick actions, and the tablet header picker from Library NativeHeader. Those failures establish a test-entry error, not missing mobile timer capability.

New visual cases assert actual Inter, Merriweather and Playfair Display font faces are loaded. Phone, medium tablet, desktop, short landscape, dark/paper themes,320px at200% text, tablet200%, controlled iOS/Android runtime and coarse-pointer tablet are separate profiles. Large-text and short-height captures show the current section of a scrollable task; button reachability and bounds are asserted independently. No screen-reader, native keyboard, safe-area hardware or physical pinch claim follows from viewport emulation.

Visual inspection led to two corrections before final captures: session footer actions now occupy the task width; large-text tag labels wrap with their Remove control instead of being squeezed into character columns. The initial timer/footer and editor captures remain in raw diagnostic Playwright reports; retained after images are replaced by final verified captures.

## Evidence limits

The fixture can prove frontend request identity, pending/failed behavior, account invalidation, completion restore/readback, local-vs-remote feedback and parent/task continuity under its controlled responses. Its session records survive page reload in fixture sessionStorage; that does not prove production IndexedDB/SQLite, OS process termination, cross-window synchronization, server idempotency or native notification delivery. Separate unit tests exercise adapter/helper branches, including canonical acknowledgement and deleted-session readback.

No production latency improvement, full accessibility/legal conformance, entire F11 acceptance or completion of the original frontend renewal is claimed. Physical device and assistive-technology gates remain open. The execution checkpoint owns final commands, results, failures and the next main ticket.
