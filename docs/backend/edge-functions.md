# Edge Function Catalog

Source of truth: local `supabase/functions/`, `supabase/config.toml`, and remote project `waftnaqgkcgufzapcihe`, inspected on 2026-05-05.

All maintained functions use the shared distributed limiter in `_shared/rateLimit.ts`. The limiter stores buckets in `api_rate_limits` through the service-role-only `check_api_rate_limit` RPC, with an instance-memory fallback if the RPC is temporarily unavailable.

## Maintained Functions

| Function | Auth | Inputs | Outputs | Secrets/integrations | Side effects | Retry concerns |
| --- | --- | --- | --- | --- | --- | --- |
| `add-book` | JWT required | Book payload, at least title. | Added/restored book or duplicate response. | Supabase service role. | Calls `add_library_book`; writes/restores `books`. | Safe to retry when payload identity is stable; duplicate response is expected. |
| `award-badges` | JWT required | Optional `event`. | Award summary and badge list. | Supabase service role. | Calls `award_badges`; may insert `user_badges` and trigger activity. | Safe due unique `user_badges(user_id,badge_id)`. |
| `calculate-book-progress` | JWT required | `book_id`. | Book progress analytics. | Supabase service role/client. | Read-only. | Retry safe. |
| `complete-reading` | JWT required | `book_id` plus optional session, progress, and `mark_complete` payload. | Book/session/progress/streak/goal/activity/badge result. | Supabase service role. | Calls `complete_reading_transaction`; can write sessions, progress logs, books, streak rows, goals, activity, and badges. | Retry safe when `client_session_id` and/or `client_log_id` are supplied; completion activity is deduped. |
| `compute-analytics` | JWT required | Optional date. | Daily analytics snapshot. | Supabase service role. | Calls `compute_daily_analytics`; upserts `analytics_snapshots` for authenticated user. | Retry safe for same date because snapshot is upserted. |
| `create-reading-session` | JWT required | `book_id`, start/end time, duration, optional `client_session_id`. | Session/book/streak/badge result. | Supabase service role. | Calls `create_reading_session`, which delegates to `complete_reading_transaction`. | Retry safe when `client_session_id` is supplied. |
| `dashboard-home` | JWT required | Optional `recent_limit`. | Dashboard home JSON. | Supabase service role. | Calls `get_dashboard_home_snapshot`; refreshes snapshot when stale. | Retry safe; five-minute snapshot freshness by default. |
| `discover-readers` | JWT required | Search, distance, limit. | Smart reader sections and ranked search. | Supabase service role. | Read-only; filters profile visibility and blocks. | Retry safe; section queries should stay indexed as profiles grow. |
| `enhanced-activity` | JWT required | Limit/offset. | Enriched activity list. | Supabase service role/client. | Read-only. | Retry safe; should respect feed visibility. |
| `log-progress` | JWT required | Progress payload plus optional `client_log_id`. | Progress log and book progress. | Supabase service role. | Calls `log_progress_transaction`, which delegates to `complete_reading_transaction`. | Retry safe when `client_log_id` is supplied. |
| `monthly-stats` | JWT required | Month/year. | Monthly reading stats. | Supabase service role/client. | Read-only. | Retry safe. |
| `search-books` | Public (`verify_jwt = false`) | Query and max results. | Google Books-style book results. | Optional `GOOGLE_BOOKS_API_KEY`. | External Google Books request only. | Retry can hit external rate limits. |
| `send-push-notification` | JWT required | User id/title/body/data. | Send count/status. | `FCM_SERVER_KEY`, push tokens. | Sends FCM notifications; reads `push_tokens`. | Retrying can duplicate user-visible notifications. |
| `social-feed` | JWT required | Limit/offset. | Enriched social activity feed. | Supabase anon/service context. | Read-only. | Retry safe; current pattern pulls followed user IDs then `social_activities`. Fanout is deferred to Epic 6. |
| `update-presence` | JWT required | Optional reader status badge. | Online-enabled flag, status, last seen. | Supabase service role. | Updates `profiles.last_seen_at` only when online status is enabled. | Retry safe; client throttles heartbeats. |
| `sync-pull` | JWT required | Cursor. | Reading-core records and next cursor. | Supabase service role. | Read-only; includes tombstones. | Retry safe; cursor should only advance after local apply. |
| `sync-push` | JWT required | Outbox items. | Accepted/failed item lists. | Supabase service role. | Writes reading-core entities, soft deletes journals/goals/books, calls RPCs. | Retry per item; idempotency depends on client IDs. |

## Retired Remote Functions

No remote-only Edge Functions remain active as of 2026-05-05. The legacy 2025 functions `get-book-details`, `update-reading-progress`, and `daily-summary` had no local consumers and were deleted remotely.

## Auth and Secrets Notes

- Local JWT settings live in `supabase/config.toml`.
- Intended state: every maintained function requires JWT except `search-books`.
- Public `search-books` is still rate limited by IP through the distributed limiter.
- Backend-only secrets must not be exposed with `VITE_` prefixes.
- `SUPABASE_SERVICE_ROLE_KEY` is required for trusted functions that bypass caller RLS after authenticating the user.
- `GOOGLE_BOOKS_API_KEY` is optional but recommended for `search-books`.
- `FCM_SERVER_KEY` is required for `send-push-notification`.
