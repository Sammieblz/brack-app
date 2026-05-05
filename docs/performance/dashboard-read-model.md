# Dashboard Read Model

Source date: 2026-05-05  
Scope: ticket 4.3, snapshot-backed dashboard home response.

## Canonical Path

Dashboard home data is fetched through:

`src/services/api/dashboard.ts` -> `dashboard-home` Edge Function -> `get_dashboard_home_snapshot` RPC.

The response shape remains the dashboard contract:
- `continueBooks`
- `activeGoal`
- `today`
- `streak`
- `stats`
- `recentActivity`
- `achievements`

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
