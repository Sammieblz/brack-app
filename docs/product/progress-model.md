# Progress Model

Source date: 2026-05-05  
Scope: ticket 3.3, page, percentage, and session progress semantics.

## Source Fields

| Concept | Source | Meaning |
| --- | --- | --- |
| Total pages | `books.pages` | Optional known length of the book. |
| Current page | `books.current_page` | Highest known current page for the user's library record. |
| Progress log | `progress_logs` | Timestamped manual or timer-based page update. |
| Reading session | `reading_sessions` | Timed reading interval; may not include page movement. |
| Completion date | `books.date_finished` | Date the book was marked complete, usually when page reaches total pages or status is set to completed. |
| Status | `books.status` | One of `to_read`, `reading`, `completed`. |

## Page-Based Progress

- Page progress is the preferred source when `books.pages` is known.
- `books.current_page` should be monotonic for normal updates: backend progress logging uses `GREATEST(existing current_page, logged page)`.
- A progress log records the submitted page number even if the book already had a higher `current_page`.
- Page number must be positive in the full progress logger.
- Quick progress currently permits page `0`; this is acceptable only as a direct book-state edit and should not create a progress log.

## Percentage Progress

Formula:

```text
progress_percentage = min(100, current_page / pages * 100)
```

Rules:
- If `pages` is missing or `0`, percentage is `0`.
- Percent is display-only and should not be stored as source of truth.
- Backend responses may include calculated percent for convenience, but clients should treat `books.current_page` and `books.pages` as canonical.

## Session-Based Progress

- A reading session records time, not page movement.
- Finishing a timer can move a book from `to_read` to `reading`.
- Timer sessions count toward streaks through `reading_streak_days`.
- Timer sessions contribute to total reading time and reading velocity calculations.
- Timer sessions do not complete a book unless paired with an explicit progress/status action.

## Completion Rules

A book is complete when one of these happens:
- `complete_reading_transaction` receives `page_number >= books.pages` for a book with known pages, either through `log-progress` or another consolidated path.
- `updateBookQuickProgress` receives `pageNumber >= books.pages`.
- The user explicitly marks the book `completed`, which online routes through `complete-reading`.

When completed:
- `books.status = 'completed'`.
- `books.date_finished` is set if missing.
- `books.current_page` should be at least the submitted page when completion came from page progress.
- Online completion evaluates active goals and creates a deduped `book_completed` activity.

## Streak and Goal Relationship

- Streaks count sessions and progress logs, not direct book updates.
- Quick progress and manual mark-complete without a session/progress log do not create a new streak day today.
- Book-count goals use completed books as derived progress.
- Reading-time goals should use `reading_sessions.duration + progress_logs.time_spent_minutes`.

## Product Guidance

- Use the full progress logger for meaningful reading activity.
- Use quick progress only as a lightweight state correction unless it is converted to `log-progress`.
- Use timer sessions for time tracking.
- Do not infer pages from time unless a future feature explicitly asks the user to estimate pages read.
