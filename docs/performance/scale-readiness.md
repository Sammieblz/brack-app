# Scale Readiness

Source date: 2026-05-05  
Scope: Supabase database, Edge Functions, feed, sync, dashboard, and operational readiness.

## Current State

- Remote public schema has 32 tables and all 32 have RLS enabled.
- Dashboard home uses `dashboard_home_snapshots` through the `dashboard-home` Edge Function.
- Edge Functions use distributed rate limiting through `api_rate_limits` and `check_api_rate_limit`.
- Backend-only security-definer RPCs are service-role-only; direct browser-callable RPCs are limited to guarded user-owned reads/actions.
- Public anonymous table privileges were revoked from the public schema.
- Public storage bucket listing policies were removed for `avatars` and `book-covers`.
- Legacy remote-only Edge Functions were deleted.
- A live unauthenticated smoke call to `search-books` succeeded after distributed rate limiting was deployed.

## Efficient Computed Metrics

| Metric | Current efficient source |
| --- | --- |
| `books_read_this_year` | Dashboard snapshot stats from `get_dashboard_home_snapshot`; live refresh currently uses `get_user_dashboard_stats`. |
| `reading_time_this_week` | Dashboard snapshot/today stats and analytics snapshot strategy. |
| `current_reading_streak` | `profiles.current_streak`, maintained from `reading_streak_days`. |
| Active goal progress | Dashboard snapshot `activeGoal`; goals table indexed by active/user/deleted state. |
| Continue reading list | Dashboard snapshot `continueBooks`, backed by user/book activity indexes. |

## Remote EXPLAIN ANALYZE Checks

These checks were run on the current remote data set. The data volume is small, so PostgreSQL still prefers sequential scans in some cases; use the timing as smoke validation, not as proof of production-cardinality behavior.

| Path | Result |
| --- | --- |
| Dashboard snapshot RPC | `EXPLAIN (ANALYZE, BUFFERS)` completed in about 64 ms while refreshing/writing a snapshot. |
| Social feed base query | Completed in about 1.5 ms. Follow lookup used `idx_user_follows_follower`; activity table was too small for index preference. |
| Sync books cursor query | Completed in about 0.14 ms. Books table was too small for index preference. |
| Conversation summary query shape | Completed in about 1.4 ms on zero matching conversations for the sample user. |

## Applied Scale Prep

- Dashboard hot-path indexes: `20260505090000_dashboard_hot_path_indexes.sql`.
- Dashboard read model: `20260505100000_dashboard_home_snapshots.sql`.
- Conversation summary RPC: `20260505095000_conversation_summary_rpc.sql`.
- Reading completion transaction: `20260505101000_reading_completion_transaction.sql`.
- Distributed rate limiting: `20260505102000_api_rate_limits.sql`.
- Analytics snapshot RLS tightening: `20260505103000_tighten_analytics_snapshot_rls.sql`.
- Backend RPC exposure tightening: `20260505104000_restrict_rate_limit_rpc.sql`, `20260505105000_restrict_exposed_database_api.sql`.
- Storage listing hardening: `20260505106000_prevent_public_storage_listing.sql`.
- Advisor foreign-key indexes: `20260505107000_advisor_performance_indexes.sql`.

## Deferred Scale Work

- Activity fanout tables are still deferred. Current `social_activities` queries are indexed and not proven to be a bottleneck on current data.
- Dashboard snapshot refresh still falls back to live aggregation when stale. If dashboard traffic grows, add targeted invalidation/refresh on high-value writes or move more metrics into incremental tables.
- Analytics snapshots are hybrid/manual today. Add scheduled refresh jobs before relying on them for retention or weekly business reporting.
- Load testing still needs seeded production-like data and real authenticated test tokens; the current remote data set is too small to prove high-cardinality behavior.
