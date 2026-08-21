# Dashboard Read Model

Source date: 2026-05-05  
Scope: ticket 4.3, snapshot-backed dashboard home response.

## Canonical Path

Dashboard home data is fetched through:

`apps/client/src/services/api/dashboard.ts` -> `dashboard-home` Edge Function -> `get_dashboard_home_snapshot` RPC.

The response shape remains the dashboard contract:
- `continueBooks`
- `activeGoal`
- `today`
- `streak`
- `stats`
- `recentActivity`
- `achievements`

When `include_journey` is enabled, the Edge Function adds the versioned Journey
summary and Streak Freeze inventory. Home's streak card intentionally derives
its emotional state from this combined response; it must not reintroduce the
separate `reading_streak_days` and `profiles` browser queries that the old
Dashboard used.

## Snapshot Table

`dashboard_home_snapshots` stores one user-scoped JSON response:

| Column | Purpose |
| --- | --- |
| `user_id` | Primary key and owner. |
| `data` | Stable dashboard JSON response. |
| `recent_limit` | Limit used to generate the response. |
| `generated_at` | Snapshot freshness timestamp. |
| `created_at`, `updated_at` | Lifecycle timestamps. |

RLS allows users to select their own snapshot. Writes happen through security-definer RPCs and service-role Edge Functions.

## RPCs

| Function | Purpose |
| --- | --- |
| `refresh_dashboard_home_snapshot(p_user_id, p_recent_limit)` | Recomputes the dashboard JSON through `get_user_dashboard_stats` and upserts the snapshot. |
| `get_dashboard_home_snapshot(p_user_id, p_recent_limit, p_max_age_seconds)` | Returns a fresh snapshot when available, otherwise refreshes it. |

`dashboard-home` currently uses `p_max_age_seconds = 300`, so normal dashboard refreshes reuse snapshots for five minutes.

## Home streak presentation

`DashboardStreakCard` uses `streak.currentStreak`, `longestStreak`,
`lastReadingDate`, and `freezeUsedAt`, plus the Journey timezone/server clock.
The UI refreshes its date boundary once per minute and normalizes an event-stale
profile streak to zero when the last reading day is no longer today or
yesterday. This is a presentation safeguard; it does not mutate profile or
streak-day records.

Freeze balances retain their response provenance. Cached quantities may be
shown, but purchase/consumption controls remain disabled until the current app
session has received a live inventory response. Unknown inventory is labelled
unavailable rather than `0`.

## Validation

Remote validation on 2026-05-05 confirmed:
- `dashboard_home_snapshots` exists.
- `refresh_dashboard_home_snapshot` exists.
- `get_dashboard_home_snapshot` exists.
- `dashboard-home` is deployed and calls `get_dashboard_home_snapshot`.
- `EXPLAIN (ANALYZE, BUFFERS)` on the remote snapshot path completed in about 64 ms on the current small dataset. The run refreshed/wrote a snapshot, so it is not a pure cached-read measurement.
- `dashboard-home` is rate limited per authenticated user through the distributed Edge Function limiter.

## Follow-Ups

- Add targeted invalidation or refresh calls after high-value writes if five-minute staleness is too loose.
- Move dashboard-only duplicate frontend hooks onto this response before adding more read models.
- Use `EXPLAIN` on the refresh function with production-like data before adding materialized views.
