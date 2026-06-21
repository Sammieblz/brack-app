# Core Reading-Loop Friction Audit

Source date: 2026-05-05  
Scope: ticket 10.1, add/import, start reading, finish reading, progress, and resume flows.

## Surfaces Reviewed

| Flow | Primary files | Notes |
| --- | --- | --- |
| Add book | `apps/client/src/screens/AddBook.tsx`, `apps/client/src/components/BookSearch.tsx` | Search, quick add, and manual tabs share the same destination. |
| Scan/import book | `apps/client/src/screens/ScanBarcode.tsx`, `apps/client/src/components/BarcodeScannerFlow.tsx`, `apps/client/src/screens/ScanCover.tsx` | Barcode reads ISBN, resolves an exact provider match, previews, then adds directly; cover OCR routes to search query. |
| Resume current book | `apps/client/src/screens/Dashboard.tsx`, `apps/client/src/hooks/useDashboardHomeData.ts` | Dashboard continue section selects recent/current candidates. |
| Start reading | `apps/client/src/screens/BookDetail.tsx`, `apps/client/src/contexts/TimerContext.tsx` | Timer starts from book detail and shared header timer surfaces. |
| Finish reading | `apps/client/src/contexts/TimerContext.tsx` | Finish writes session and can trigger journal prompt for 5+ minute sessions. |
| Update progress | `apps/client/src/components/ProgressLogger.tsx`, `apps/client/src/components/QuickProgressWidget.tsx` | Full logger creates a progress log; quick update only updates book state. |

## Findings

| Flow | What works | Friction / risk | Follow-up |
| --- | --- | --- | --- |
| Add book | Duplicate prevention exists locally and in backend; soft-deleted books restore. | Manual tab uses a large card and fixed save button that can feel form-heavy on small screens. | Keep as-is until usability testing; prioritize scan/search speed first. |
| Search import | Search result quick add is efficient. | Failed search/import recovery depends on user noticing the manual tab. | Add clearer empty-state path after search failure. |
| Barcode scan | Direct scanner flow shows live camera preview, validates ISBN, resolves metadata, prevents duplicates, and can add directly after confirmation. | Requires connectivity for lookup/add; web release depends on reliable `getUserMedia` + ZXing behavior across webcams. | Test web camera, native Android, native iOS, duplicate scan, no-match scan, and network-loss recovery. |
| Cover scan | OCR lets user edit extracted title/author. | Confidence can be low and still pushes to search; no direct "try another photo" prominence until after result. | Keep edit path; consider showing top detected text snippets later. |
| Resume current book | Dashboard puts Continue Reading first and exposes log progress. | Current selection depends on live dashboard aggregation. | Complete Epic 4 read-model work. |
| Start timer | One-tap timer start from book detail. | Starting a new timer requires replacing any running timer; this is correct but should be tested on native background/foreground. | Native QA on Android/iOS. |
| Finish timer | Online path is idempotent by `client_session_id`; offline path queues session. | Finish timer does not ask for pages read, so it cannot update page progress or complete a book. | Ticket 3.2 should add optional page/progress capture to completion. |
| Full progress log | Creates progress history, updates book, counts toward streak. | Progress flow makes a second status check after RPC. | Remove redundant progress-only status check when safe. |
| Quick progress | Fast inline page correction. | Does not create `progress_logs`, does not count toward streaks, and bypasses progress history. | Convert to lightweight `log-progress` or label it as a correction-only edit. |
| Mark done | Simple explicit completion. | Does not create a progress log or session, so goals update only through derived completed-book count and streak does not change. | Completion flow should offer optional final page/session note. |

## Quality Bar

- A user can add a book, start reading, finish a session, and see dashboard/streak feedback without visiting settings.
- Offline reading-core actions must make the UI feel complete immediately and sync later.
- The app should avoid two meanings for "progress": if an action represents reading activity, it should create a `progress_logs` or `reading_sessions` record.
- Destructive or duplicate outcomes should explain the next action and route to the existing book when possible.

