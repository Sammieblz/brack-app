# Observability

Source date: 2026-05-05  
Scope: Supabase operational monitoring for Brack.

## What Exists Now

- Edge Functions log errors with function names and, where available, user IDs.
- `createErrorResponse` returns sanitized client errors and keeps full details server-side.
- Distributed rate limiting returns `429` with `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.
- The `api_rate_limits` table can be queried to see hot function/user/IP buckets.
- Supabase advisors were run after the hardening migrations.

## Alerts to Configure in Supabase

Configure these in the Supabase dashboard before production launch:

| Area | Alert |
| --- | --- |
| Edge Functions | Error rate above baseline for `dashboard-home`, `sync-push`, `sync-pull`, `complete-reading`, `search-books`, and `send-push-notification`. |
| Edge Functions | 429 spikes by function, especially `search-books`, `sync-push`, and `dashboard-home`. |
| Database | Slow query threshold for dashboard/feed/sync/messaging queries. |
| Database | CPU, memory, disk, and connection pool saturation. |
| Auth | Signup/login error spikes. |
| Storage | Upload failures for avatars and book covers. |

## Useful SQL Checks

Rate-limit hot buckets:

```sql
SELECT bucket_key, request_count, window_start, window_seconds, updated_at
FROM public.api_rate_limits
ORDER BY updated_at DESC
LIMIT 50;
```

Stale dashboard snapshots:

```sql
SELECT COUNT(*) AS stale_snapshots
FROM public.dashboard_home_snapshots
WHERE generated_at < timezone('utc', now()) - interval '15 minutes';
```

Recent function-side write pressure:

```sql
SELECT date_trunc('hour', created_at) AS hour, COUNT(*) AS sessions
FROM public.reading_sessions
WHERE created_at >= timezone('utc', now()) - interval '24 hours'
GROUP BY 1
ORDER BY 1 DESC;
```

## Remaining Platform Actions

- Enable leaked-password protection in Supabase Auth.
- Reduce email OTP expiry below one hour.
- Plan the Supabase Postgres patch upgrade reported by the security advisor.
- Decide whether authenticated GraphQL object visibility matters for Brack. RLS protects row data, but the advisor will keep warning while authenticated table privileges remain necessary for direct API modules.

