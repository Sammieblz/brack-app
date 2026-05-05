# Reading Write-Path Audit

Source date: 2026-05-05  
Scope: ticket 3.1, reading sessions, progress, streaks, goals, and journal writes.

## Current Flows

| Flow | Frontend entry | API/service path | Backend path | Writes | Hidden side effects |
| --- | --- | --- | --- | --- | --- |
| Add book by search/manual | `src/screens/AddBook.tsx` | `bookOperations.create` -> `addBookToLibrary` | `add-book` Edge Function -> `add_library_book` RPC | `books` | Duplicate policy uses ISBN first, then title+author when ISBN missing; soft-deleted match is restored. |
| Add book offline | `src/screens/AddBook.tsx` | `bookOperations.create` | Local repo/outbox -> `sync-push` | Local `books`, later remote `books` | Duplicate conflict can surface during sync review. |
| Start session | `BookDetail`, header timer surfaces | `TimerContext.startTimer` | Local browser state only | `localStorage` timer state | No database write until finish. |
| Finish session online | `TimerContext.finishTimer` | `createReadingSession` | `create-reading-session` Edge Function -> `create_reading_session` -> `complete_reading_transaction` RPC | `reading_sessions`, `books`, `reading_streak_days`, `profiles`, `goals`, `social_activities`, `user_badges` | Status moves `to_read` to `reading`; streak and badge recalculation run; start/completion activity is deduped. |
| Finish session offline | `TimerContext.finishTimer` | `sessionsRepo.createPending` | Local repo/outbox -> `sync-push` | Local `reading_sessions`, local `books`, later remote tables | Streak UI refreshes locally through event, then backend triggers catch up after sync. |
| Log progress online | `ProgressLogger` | `logProgress` | `log-progress` Edge Function -> `log_progress_transaction` -> `complete_reading_transaction` RPC | `progress_logs`, `books`, `reading_streak_days`, `profiles`, `goals`, `social_activities`, `user_badges` | Book can move to `reading` or `completed`; streak, goal, activity, and badge flows share the consolidated transaction. |
| Log progress offline | `ProgressLogger` | `progressRepo.createPending` | Local repo/outbox -> `sync-push` | Local `progress_logs`, local `books`, later remote tables | Completion/status updates are applied locally; backend conflict/idempotency uses `client_log_id`. |
| Quick progress online | `QuickProgressWidget` | `updateBookQuickProgress` | Direct Supabase update | `books` only | Does not create `progress_logs`; therefore it does not count toward streaks. |
| Quick progress offline | `QuickProgressWidget` | `updateBookQuickProgress` | Local repo/outbox | Local `books`, later remote `books` | Does not create a progress log; no streak activity. |
| Mark book complete | `BookDetail.handleStatusChange` | `updateBookStatus` -> `completeReading` or offline `bookOperations.update` | `complete-reading` Edge Function -> `complete_reading_transaction` RPC, or local outbox while offline | Online: `books`, `goals`, `social_activities`, `user_badges`, profile streak recalculation. Offline: local `books`, later sync. | Online completion is consolidated; offline explicit completion still syncs as a book update and does not add a synthetic session/progress row. |
| Create journal entry | `useJournalEntries.addEntry` | `journalOperations.create` | Direct Supabase/local outbox | `journal_entries` | Calls `updateBookStatusIfNeeded`, which can mark a `to_read` book as `reading`. |
| Update/delete journal | `useJournalEntries` | `journalOperations.update/delete` | Direct Supabase/local outbox | `journal_entries` soft delete | Does not affect streaks; hard cross-device delete consistency depends on tombstone sync. |
| Create/update/delete goal | Goal screens/hooks | `src/services/api/goals.ts` | Direct Supabase/local outbox | `goals` soft delete | Goal progress is computed from books; no progress counter is stored. |

## Duplicate or Hidden Writes

- `ProgressLogger` no longer calls `updateBookStatusIfNeeded` after `logProgress`; progress completion is handled by `complete_reading_transaction`.
- Quick progress updates `books.current_page` without a `progress_logs` record. This is fast, but it means quick progress does not count toward streaks or detailed progress history.
- Manual online completion now uses `complete-reading`; it can complete goals and create deduped completion activity without fabricating page/session data.
- Timer completion, progress logging, and manual online completion now share `complete_reading_transaction`.
- Streak updates are now backend-owned for persistence through `reading_streak_days`; frontend reads calculate display state but no longer write profile streak fields.

## Recommended Consolidation

1. Keep `add_library_book` as the only online add-book path.
2. Replace quick progress with a lightweight `log-progress` call when the user enters a page number.
3. Keep `complete_reading_transaction` as the only online completion transaction for session, progress, streak, goal, activity, and badge side effects.
4. Keep goals as derived from source tables unless a future snapshot model is introduced.
5. Keep journal entries independent, but remove progress-only calls to `updateBookStatusIfNeeded` once quick progress is converted.
