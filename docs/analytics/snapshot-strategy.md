# Analytics Snapshot Strategy

Source date: 2026-05-05  
Scope: ticket 9.3, analytics snapshot generation and consumption.

## Existing Snapshot Surface

| Object | Purpose |
| --- | --- |
| `analytics_snapshots` | Per-user daily rollup table. |
| `dashboard_home_snapshots` | Per-user dashboard home JSON snapshot with five-minute freshness. |
| `compute_daily_analytics(p_user_id, p_date)` | Computes/upserts one user's daily snapshot. |
| `compute-analytics` Edge Function | Authenticated wrapper around `compute_daily_analytics`. |
| `get_dashboard_home_snapshot` | Returns or refreshes the dashboard home snapshot. |

## Chosen Strategy

Use hybrid snapshots:
- Incremental recompute for the current user/day after meaningful reading writes.
- Scheduled backfill/recompute for yesterday and recent days to catch offline sync and late-arriving data.

Rationale:
- Reading actions are user-scoped and small enough to recompute one user/day cheaply.
- Offline sync can replay older events, so a small rolling scheduled recompute is still needed.
- Dashboard should read from a dashboard-specific read model or snapshot-backed RPC, not raw frontend aggregations.

## Generation Rules

After these events, enqueue or call current-day recompute:
- `create_reading_session`
- `log_progress_transaction`
- offline `sync-push` accepted session/progress items
- book completion/status changes
- goal create/update/delete when dashboard goal progress depends on it

Scheduled job:
- Daily recompute for all active users for yesterday.
- Rolling recompute for last 7 days for users with recent sync changes.

## Consumption Rules

- Analytics page reads snapshots for historical daily metrics.
- Dashboard reads `dashboard_home_snapshots` through `get_dashboard_home_snapshot`, which refreshes through the live dashboard stats helper when stale.
- Source tables remain source of truth.
- Snapshots can be rebuilt and should not contain data that cannot be derived again.

## Security

`analytics_snapshots` insert/update policies were tightened on 2026-05-05. Intended writes are service/RPC-owned through `compute-analytics`.
