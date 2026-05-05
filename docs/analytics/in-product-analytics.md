# In-Product Analytics Review

Source date: 2026-05-05  
Scope: ticket 9.2, user-facing analytics and expensive live calculations.

## User-Facing Metrics

| Surface | Metrics |
| --- | --- |
| Dashboard | Continue reading, current streak, today's reading minutes, active goal progress, compact library stats, recent activity. |
| Analytics page | Weekly reading, heatmap, genre distribution, velocity, completion rate, monthly goals, pace, top authors, time distribution, status funnel. |
| Book detail | Current page, percent complete, pages/hour, total time, session count, estimated completion. |
| Profile/stats | Total books, completed books, current streak, badges, public stats if profile visibility allows. |

## Expensive Live Calculations

| Calculation | Current path | Precompute candidate |
| --- | --- | --- |
| Dashboard continue reading | `get_user_dashboard_stats` groups progress/sessions by book | Dashboard snapshot/read model. |
| Dashboard total reading minutes | Live subqueries over sessions/logs | Daily analytics snapshots plus current-day delta. |
| Analytics chart bundle | `getAnalyticsChartData` fetches multiple source sets and aggregates in browser | `analytics_snapshots` plus chart-specific RPC. |
| Book progress analytics | `calculate-book-progress` Edge Function | Keep live per-book unless book histories grow large. |
| Streaks | `reading_streak_days` derived table | Already precomputed enough. |
| Conversation unread counts | Per-conversation live count | Conversation summary/read cursor. |

## Product Decision

- Dashboard metrics should be fast and snapshot-backed.
- Deep analytics can tolerate slightly more latency, but should not require broad raw table scans in the browser.
- User-facing charts should use `analytics_snapshots` where daily granularity is enough.
- Real-time reading actions should update source tables first, then refresh snapshots incrementally or on schedule.

