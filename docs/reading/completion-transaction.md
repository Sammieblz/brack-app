# Reading Completion Transaction

Source date: 2026-05-05  
Scope: ticket 3.2, consolidated backend write path for reading completion.

## Canonical Path

`complete_reading_transaction` is the backend transaction boundary for reading completion side effects.

Frontend write paths:
- Timer finish: `TimerContext.finishTimer` -> `createReadingSession` -> `create-reading-session` -> `create_reading_session` -> `complete_reading_transaction`.
- Manual progress: `ProgressLogger` -> `logProgress` -> `log-progress` -> `log_progress_transaction` -> `complete_reading_transaction`.
- Mark done: `BookDetail` -> `updateBookStatus(..., "completed")` -> `completeReading` -> `complete-reading` -> `complete_reading_transaction`.

## Side Effects

The transaction can write or refresh:
- `reading_sessions`, idempotent by `client_session_id`.
- `progress_logs`, idempotent by `client_log_id`.
- `books.status`, `books.current_page`, `date_started`, and `date_finished`.
- `reading_streak_days` and persisted profile streak fields through streak helpers.
- Active `goals`, marking reached goals complete.
- `social_activities` for `book_started` or `book_completed`, deduped per user/book/type.
- `user_badges` through `award_badges`.

## Idempotency

- Timer retries are safe when `client_session_id` is supplied.
- Progress retries are safe when `client_log_id` is supplied.
- Completion activity is deduped by `social_activities.user_id`, `activity_type`, and `book_id`.
- Replaying the same session/progress payload returns `idempotent: true` without duplicate rows.

## Validation

Remote validation on 2026-05-05 created a controlled auth user, profile, book, and goal, then called `complete_reading_transaction` twice with the same client IDs. The test confirmed:
- One reading session.
- One progress log.
- Book status `completed`.
- Active book-count goal completed.
- One `book_completed` activity.
- Replay returned idempotent.
- Test records were cleaned up.
