# Index Audit

Source date: 2026-05-05  
Scope: ticket 4.2, hot-path indexes for reading, social, reviews, clubs, and messaging.

## New Index Migration

Migration: `supabase/migrations/20260505090000_dashboard_hot_path_indexes.sql`

Applied remotely to project `waftnaqgkcgufzapcihe` on 2026-05-05.

| Index | Query path | Reason |
| --- | --- | --- |
| `idx_books_user_updated_active` | Library and dashboard active books ordered by `updated_at`, `created_at` | Existing `idx_books_user_status` helps status filters but not the primary ordered library page. |
| `idx_progress_logs_user_book_logged_at` | Dashboard continue-reading progress aggregation by user/book/latest log | Supports grouped latest progress per book. |
| `idx_progress_logs_user_logged_at` | Recent progress activity and analytics windows | Supports user-scoped recent progress reads. |
| `idx_reading_sessions_user_book_activity_at` | Dashboard continue-reading session aggregation by user/book/latest session | Supports grouped latest session per book. |
| `idx_reading_sessions_user_activity_at` | Recent sessions, streak/date windows, dashboard activity | Supports user-scoped activity-time reads. |

## Advisor Follow-Up Migration

Migration: `supabase/migrations/20260505107000_advisor_performance_indexes.sql`

Applied remotely to project `waftnaqgkcgufzapcihe` on 2026-05-05 after running the Supabase performance advisor.

| Index/change | Query path | Reason |
| --- | --- | --- |
| `idx_posts_user_id` | User/profile post feeds and FK maintenance | Covers `posts_user_id_fkey`. |
| `idx_posts_book_id` | Book-linked posts and FK maintenance | Covers nullable `posts_book_id_fkey`. |
| `idx_progress_logs_session_id` | Session-linked progress and FK maintenance | Covers nullable `progress_logs_session_id_fkey`. |
| `idx_social_activities_review_id` | Review activity enrichment and FK maintenance | Covers nullable `social_activities_review_id_fkey`. |
| `idx_social_activities_list_id` | List activity enrichment and FK maintenance | Covers nullable `social_activities_list_id_fkey`. |
| `idx_social_activities_badge_id` | Badge activity enrichment and FK maintenance | Covers nullable `social_activities_badge_id_fkey`. |
| `idx_user_badges_badge_id` | Badge definition joins/deletes | Covers `user_badges_badge_id_fkey`. |
| Dropped `idx_journal_entries_user_id_fk` | Journal user lookup | Removed duplicate of `idx_journal_entries_user_id`. |

## Existing Coverage

| Domain | Existing useful indexes | Coverage |
| --- | --- | --- |
| Reading/books | `idx_books_user_status`, duplicate identity indexes, `idx_books_user_source` | Good for status and duplicate checks; new ordered library index fills latest-update path. |
| Reading/progress | `idx_progress_logs_user_book`, `idx_progress_logs_logged_at`, `idx_progress_logs_user_client_log_id` | Good; new composites cover user/date and user/book/date together. |
| Reading/sessions | `idx_reading_sessions_user_id`, `idx_reading_sessions_user_date`, `idx_reading_sessions_user_client_session_id` | Good; new composites cover activity-time and book grouping. |
| Goals/journal sync | `idx_goals_user_updated_deleted`, `idx_goals_user_active_not_deleted`, `idx_journal_entries_user_updated_deleted`, `idx_journal_entries_book_active` | Good for offline sync and active goal reads. |
| Social feed | `idx_social_activities_user_created`, `idx_social_activities_created`, activity foreign-key indexes, `idx_user_follows_follower`, `idx_user_follows_following` | Good for current non-fanout feed and activity enrichment. |
| Reviews | `idx_book_reviews_book`, `idx_book_reviews_user`, `idx_book_reviews_created`, like/comment indexes | Good for current review list/detail paths. |
| Clubs | Club/member/discussion indexes by club/user/current book | Good for current club detail/list paths. |
| Messaging | `idx_messages_conversation_created`, `idx_messages_conversation_id`, `idx_messages_sender_id`, conversation participant indexes | Good for thread fetch; summary model still missing. |

## Validation

Remote `pg_indexes` confirms all dashboard and advisor follow-up indexes exist.

`EXPLAIN (FORMAT JSON)` was run before and after migration for representative queries. The remote development dataset is tiny, so PostgreSQL still chose sequential scans. This does not invalidate the index need; it means runtime improvement cannot be measured on the current data volume.

Production validation plan:
- Re-run `EXPLAIN (ANALYZE, BUFFERS)` against anonymized or production-sized data.
- Confirm library query uses `idx_books_user_updated_active`.
- Confirm dashboard progress/session grouped activity can use the new composite indexes or adjust RPC query shape.
- Add partial/date-range indexes only after query plans prove the date-cast paths remain hot.

## Follow-Ups

- Update `get_user_dashboard_stats` active goal query to filter `deleted_at IS NULL`.
- Replace date casts in dashboard RPC with range conditions if date queries become expensive.
- Do not add activity fanout indexes until ticket 6.1/6.3 feed audit confirms feed bottlenecks.
