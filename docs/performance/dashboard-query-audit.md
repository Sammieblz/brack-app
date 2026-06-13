# Dashboard Query Audit

Source date: 2026-05-05  
Scope: ticket 4.1, dashboard render query paths and round trips.

## Dashboard Entry Points

Primary screen: `apps/client/src/screens/Dashboard.tsx`

Data hooks/services invoked on initial render:
- `useBooks(user.id)`
- `useBadges(user.id)`
- `useStreaks(user.id)`
- `useRecentActivity(user.id)`
- `useChartData(user.id)`
- `useDashboardHomeData(user.id)`
- `fetchLatestGoal(user.id)`
- `ReadingStatsWidget` -> `fetchUserReadingSessions(user.id)`
- `ProfileContext` -> `fetchProfile(user.id)`

Approximate initial online round trips, excluding auth/session bootstrap:

| Source | Round trips | Query/function path | Heavy work |
| --- | ---: | --- | --- |
| Profile context | 1 | `profiles` by id | Low. |
| Library page cache | 1 | `books` by user, not deleted, ordered by `updated_at`, `created_at` | Needs ordered user/deleted index. |
| Badges | 2 | `badges`, `user_badges` by user | Low, but can be folded into dashboard later. |
| Badge award check | 1 Edge Function | `award-badges` -> `award_badges` RPC | Reads books/sessions and can write `user_badges`. |
| Streak summary | 2 | `reading_streak_days` by user, `profiles` by id | Medium as streak days grow. |
| Recent activity hook | 3 | completed `books`, recent `reading_sessions`, active `goals` | Duplicates dashboard-home recent activity. |
| Analytics charts | 7+ | sessions, books, all books, active goals, streak history | Heavy frontend aggregation. |
| Dashboard home | 1 Edge Function | `dashboard-home` -> `get_dashboard_home_snapshot` RPC | Snapshot-backed main path; stale snapshots refresh through `get_user_dashboard_stats`. |
| Latest goal | 1 | `goals` active/latest | Duplicates dashboard-home `activeGoal`. |
| Reading stats widget | 1 | `reading_sessions` by user | Duplicates dashboard-home reading minutes. |

Current worst-case dashboard load is roughly 20 network round trips plus one badge award mutation check.

## Dashboard-Home RPC Internals

`dashboard-home` calls `get_dashboard_home_snapshot(p_user_id, p_recent_limit, p_max_age_seconds)`. Fresh snapshots are returned from `dashboard_home_snapshots`; stale or missing snapshots refresh through `get_user_dashboard_stats(p_user_id, p_recent_limit)`.

| Section | Tables | Query pattern | Notes |
| --- | --- | --- | --- |
| Continue books | `books`, grouped `progress_logs`, grouped `reading_sessions` | User-scoped activity aggregation by `book_id`, then active/to-read books | Needs progress/session grouped-by-book indexes. |
| Active goal | `goals` | `user_id`, `is_active`, latest created | RPC should include `deleted_at IS NULL` to avoid soft-deleted goals. |
| Today summary | `reading_sessions`, `progress_logs` | User/date filters using `::DATE` | Date casts reduce index usefulness. |
| Streak summary | `profiles` | Profile by id | Low. |
| Core stats | `books`, subqueries over sessions/logs | Counts, sums, filtered status counts | Live aggregation grows with library/session history. |
| Recent activity | `reading_sessions`, `progress_logs`, `books` | Union then order by timestamp | Duplicates `useRecentActivity`. |
| Achievements | `user_badges`, `badges` | Latest earned badges | Low. |

## Heavy Aggregations

- `get_user_dashboard_stats` recomputes continue-reading candidates from all progress logs and sessions.
- `getAnalyticsChartData` fetches broad source rows and aggregates in the browser.
- `ReadingStatsWidget` recomputes reading time after `dashboard-home` already returns reading minutes.
- `useRecentActivity` duplicates part of `dashboard-home.recentActivity`.

## Immediate Consolidation Targets

1. Prefer `dashboard-home.activeGoal` over separate `fetchLatestGoal` on dashboard.
2. Prefer `dashboard-home.stats.readingMinutes` over `ReadingStatsWidget` session-only fetch, or move the widget onto the dashboard response.
3. Prefer `dashboard-home.recentActivity` over `useRecentActivity` for dashboard home.
4. Keep `useChartData` for the analytics page, but dashboard should use a smaller precomputed heatmap/read-model path.

## EXPLAIN Notes

Remote dev data is too small for the planner to prefer indexes; baseline and post-index `EXPLAIN` still used sequential scans for sample zero-row literals. The index migration was still applied because it matches proven ordered/grouped user paths and will matter as production rows grow.

Validated with `EXPLAIN (FORMAT JSON)` on:
- Library ordered books query.
- Progress logs grouped by `book_id`.
- Reading sessions grouped by `book_id`.
- Active latest goal query.
