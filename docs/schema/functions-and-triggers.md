# Database Functions and Triggers Catalog

Source of truth: remote Supabase project `waftnaqgkcgufzapcihe`, public schema, inspected on 2026-05-05.

## Function Catalog

| Function | Kind | Inputs | Outputs | Side effects and notes |
| --- | --- | --- | --- | --- |
| `add_club_creator_as_admin()` | Trigger | `book_clubs` insert row | `book_club_members` | Adds creator as club admin after club creation. |
| `add_library_book(p_user_id uuid, p_book jsonb)` | RPC | User id and book payload | JSON result with book/status | Central duplicate-safe library insert/restore path. Writes `books`; uses normalized ISBN/title-author identity. |
| `award_badges(p_user_id uuid, p_event text)` | RPC | User id and optional event | JSON award summary | Reads books/sessions/badges; inserts `user_badges`; may trigger badge activity. |
| `calculate_distance(lat1, lon1, lat2, lon2)` | Helper | Coordinates | Distance number | Used by discovery/location logic; duplicate migration definitions exist historically. |
| `check_api_rate_limit(p_bucket_key text, p_limit int, p_window_seconds int)` | RPC/helper | Rate-limit bucket key, limit, and window size | JSON allow/deny result | Service-role-only shared Edge Function limiter. Writes `api_rate_limits`; uses an advisory lock per bucket. |
| `complete_reading_transaction(...)` | RPC | User/book plus optional session, progress, and completion payload | JSON completion result | Canonical reading completion transaction. Writes sessions/progress/book state, refreshes streaks, completes active goals, creates deduped book activity, and awards badges. |
| `compute_daily_analytics(p_user_id uuid, p_date date)` | RPC | User id and date | `analytics_snapshots` row | Computes daily snapshot; writes/upserts `analytics_snapshots`. |
| `create_badge_activity()` | Trigger | `user_badges` insert row | Trigger row | Writes `social_activities` for badge awards. |
| `create_book_activity()` | Trigger | `books` update row | Trigger row | Writes `social_activities` for certain book status/progress changes. Potential feed-noise source. |
| `create_follow_activity()` | Trigger | `user_follows` insert row | Trigger row | Writes `social_activities` for follows. Potential feed-noise source. |
| `create_list_activity()` | Trigger | `book_lists` insert row | Trigger row | Writes `social_activities` for list creation. Visibility/list-public semantics need review. |
| `create_post_activity()` | Trigger | `posts` insert row | Trigger row | Writes `social_activities` for posts. |
| `create_reading_session(p_user_id uuid, p_book_id uuid, p_start_time timestamptz, p_end_time timestamptz, p_duration_minutes int, p_client_session_id text)` | RPC wrapper | Completed timer/session payload | JSON session/book/streak/badge summary | Delegates to `complete_reading_transaction`. Idempotent by `client_session_id`. |
| `create_review_activity()` | Trigger | `book_reviews` insert row | Trigger row | Writes `social_activities` for reviews. |
| `get_conversation_summaries(p_user_id uuid)` | RPC | User id | JSON conversation summary array | Reads conversations, latest message, unread count, and other participant profile in one call. |
| `get_dashboard_home_snapshot(p_user_id uuid, p_recent_limit int, p_max_age_seconds int)` | RPC | User id, limit, max snapshot age | Dashboard JSON | Returns fresh `dashboard_home_snapshots.data` or refreshes it. |
| `get_user_dashboard_stats(p_user_id uuid, p_recent_limit int)` | RPC/helper | User id and limit | Dashboard JSON | Live aggregate refresh source used by `refresh_dashboard_home_snapshot`. Reads books, goals, sessions, progress, profiles, badges. |
| `handle_new_user()` | Auth trigger | `auth.users` insert row | Trigger row | Creates/updates profile defaults for onboarding/profile flow. Defined in multiple migrations; latest definition should be treated as canonical. |
| `is_club_admin(club_id uuid, user_id uuid)` | RLS helper | Club id/user id | Boolean | Reads `book_club_members`; used in club RLS. |
| `is_club_member(club_id uuid, user_id uuid)` | RLS helper | Club id/user id | Boolean | Reads `book_club_members`; used in club RLS. |
| `log_progress_transaction(..., p_photo_url text)` | RPC overload | Progress payload without client log id | JSON progress result | Legacy overload. Writes progress through the consolidated completion path. |
| `log_progress_transaction(..., p_photo_url text, p_client_log_id text)` | RPC wrapper | Progress payload with client log id | JSON progress result | Delegates to `complete_reading_transaction`. Idempotent by `client_log_id`. |
| `normalize_book_isbn(value text)` | Helper | ISBN text | Normalized text | Used in duplicate indexes/RPC. |
| `normalize_book_text(value text)` | Helper | Title/author text | Normalized text | Used in duplicate indexes/RPC. |
| `recalculate_user_reading_streak(p_user_id uuid)` | RPC/helper | User id | JSON streak summary | Reads `reading_streak_days`; updates `profiles.current_streak`, `profiles.longest_streak`, `profiles.last_reading_date`. |
| `refresh_reading_streak_day(p_user_id uuid, p_activity_date date)` | RPC/helper | User id/date | Void | Reads sessions/progress; upserts/deletes `reading_streak_days`. |
| `refresh_dashboard_home_snapshot(p_user_id uuid, p_recent_limit int)` | RPC | User id and limit | Dashboard JSON | Recomputes `get_user_dashboard_stats` and upserts `dashboard_home_snapshots`. |
| `sync_profile_streak_from_reading_streak_day()` | Trigger | `reading_streak_days` changes | Trigger row | Calls `recalculate_user_reading_streak`; updates `profiles`. |
| `sync_reading_streak_day_from_progress_log()` | Trigger | `progress_logs` insert/update/delete | Trigger row | Calls `refresh_reading_streak_day`. |
| `sync_reading_streak_day_from_session()` | Trigger | `reading_sessions` insert/update/delete | Trigger row | Calls `refresh_reading_streak_day`. |
| `update_conversation_timestamp()` | Trigger | `messages` insert row | Trigger row | Updates `conversations.updated_at` for latest message ordering. |
| `update_post_comments_count()` | Trigger | `post_comments` insert/delete | Trigger row | Updates `posts.comments_count`. |
| `update_post_likes_count()` | Trigger | `post_likes` insert/delete | Trigger row | Updates `posts.likes_count`. |
| `update_review_comments_count()` | Trigger | `review_comments` insert/delete | Trigger row | Updates `book_reviews.comments_count`. |
| `update_review_likes_count()` | Trigger | `review_likes` insert/delete | Trigger row | Updates `book_reviews.likes_count`. |
| `update_updated_at_column()` | Trigger helper | Updated row | Trigger row | Sets `updated_at = now()` on many tables. |
| `use_reading_streak_freeze(p_user_id uuid, p_activity_date date)` | RPC | User id/date | `reading_streak_days` row | Writes freeze day and profile freeze timestamp; rejects days with real reading activity. |

## Trigger Catalog

| Trigger | Table | Timing/events | Function | Side effects |
| --- | --- | --- | --- | --- |
| `update_book_club_discussions_updated_at` | `book_club_discussions` | Before update | `update_updated_at_column` | Maintains `updated_at`. |
| `add_creator_as_admin` | `book_clubs` | After insert | `add_club_creator_as_admin` | Inserts creator into `book_club_members` as admin. |
| `update_book_clubs_updated_at` | `book_clubs` | Before update | `update_updated_at_column` | Maintains `updated_at`. |
| `create_list_activity_trigger` | `book_lists` | After insert | `create_list_activity` | Inserts `social_activities`. |
| `update_book_lists_updated_at` | `book_lists` | Before update | `update_updated_at_column` | Maintains `updated_at`. |
| `create_review_activity_trigger` | `book_reviews` | After insert | `create_review_activity` | Inserts `social_activities`. |
| `update_book_reviews_updated_at` | `book_reviews` | Before update | `update_updated_at_column` | Maintains `updated_at`. |
| `create_book_activity_trigger` | `books` | After update | `create_book_activity` | Inserts `social_activities`; can overlap with progress/session flows. |
| `update_conversations_updated_at` | `conversations` | Before update | `update_updated_at_column` | Maintains `updated_at`. |
| `update_dashboard_home_snapshots_updated_at` | `dashboard_home_snapshots` | Before update | `update_updated_at_column` | Maintains snapshot `updated_at`. |
| `update_goals_updated_at` | `goals` | Before update | `update_updated_at_column` | Maintains `updated_at`; affects sync cursors. |
| `update_journal_entries_updated_at` | `journal_entries` | Before update | `update_updated_at_column` | Maintains `updated_at`; affects sync cursors. |
| `update_conversation_on_message` | `messages` | After insert | `update_conversation_timestamp` | Updates parent conversation timestamp. |
| `update_messages_updated_at` | `messages` | Before update | `update_updated_at_column` | Maintains `updated_at`. |
| `update_notification_preferences_updated_at` | `notification_preferences` | Before update | `update_updated_at_column` | Maintains `updated_at`. |
| `update_post_comments_count_trigger` | `post_comments` | After insert/delete | `update_post_comments_count` | Recounts post comments. |
| `update_post_comments_updated_at` | `post_comments` | Before update | `update_updated_at_column` | Maintains `updated_at`. |
| `update_post_likes_count_trigger` | `post_likes` | After insert/delete | `update_post_likes_count` | Recounts post likes. |
| `create_post_activity_trigger` | `posts` | After insert | `create_post_activity` | Inserts `social_activities`. |
| `update_posts_updated_at` | `posts` | Before update | `update_updated_at_column` | Maintains `updated_at`. |
| `trg_sync_reading_streak_day_from_progress_log` | `progress_logs` | After insert/update/delete | `sync_reading_streak_day_from_progress_log` | Refreshes `reading_streak_days`; cascades profile streak trigger. |
| `update_push_tokens_updated_at` | `push_tokens` | Before update | `update_updated_at_column` | Maintains `updated_at`. |
| `update_reading_habits_updated_at` | `reading_habits` | Before update | `update_updated_at_column` | Maintains `updated_at`. |
| `trg_sync_reading_streak_day_from_session` | `reading_sessions` | After insert/update/delete | `sync_reading_streak_day_from_session` | Refreshes `reading_streak_days`; cascades profile streak trigger. |
| `trg_sync_profile_streak_from_reading_streak_day` | `reading_streak_days` | After insert/update/delete | `sync_profile_streak_from_reading_streak_day` | Updates profile streak fields. |
| `update_review_comments_updated_at` | `review_comments` | Before update | `update_updated_at_column` | Maintains `updated_at`. |
| `update_review_likes_count_trigger` | `review_likes` | After insert/delete | `update_review_likes_count` | Recounts review likes. |
| `create_badge_activity_trigger` | `user_badges` | After insert | `create_badge_activity` | Inserts `social_activities`. |
| `create_follow_activity_trigger` | `user_follows` | After insert | `create_follow_activity` | Inserts `social_activities`. |
| `update_user_learning_profiles_updated_at` | `user_learning_profiles` | Before update | `update_updated_at_column` | Maintains `updated_at`. |

## Duplicate or Overlapping Logic

- `log_progress_transaction` has a legacy overload without `p_client_log_id` and a current overload with idempotency support; both should remain wrappers around `complete_reading_transaction`.
- `handle_new_user` is defined in older auth setup and again in unified onboarding; audit latest deployed body before changing sign-up behavior.
- Streak updates happen through session/progress triggers, explicit calls from `complete_reading_transaction`, and profile sync triggers. Persistence is centralized around `reading_streak_days`.
- Activity generation happens from several triggers plus direct app insertion in `apps/client/src/services/api/social.ts`; ticket 6.1 should decide whether direct inserts remain valid.
- Dashboard metrics use `get_dashboard_home_snapshot` for reads; stale snapshots still refresh through live `get_user_dashboard_stats`.
- Backend-only RPCs now revoke direct `anon`/`authenticated` execute privileges and are intended to run through service-role Edge Functions. Direct client RPCs that remain (`get_conversation_summaries`, `use_reading_streak_freeze`, club helper checks) include `auth.uid()` ownership checks.
