# Edge Function Catalog

Source of truth: local `supabase/functions/`, `supabase/config.toml`, and remote project `waftnaqgkcgufzapcihe`, last aligned on 2026-06-13.

Brack currently has 56 maintained local Edge Function directories, excluding `_shared`. All maintained functions use the shared distributed limiter in `_shared/rateLimit.ts`. The limiter stores buckets in `api_rate_limits` through the service-role-only `check_api_rate_limit` RPC, with an instance-memory fallback if the RPC is temporarily unavailable.

## Current Remote State

- `search-books` is public with `verify_jwt = false`.
- All other maintained functions require JWT verification.
- The direct-message function group was deployed on 2026-06-13.
- The `modern_direct_messaging` database migration is applied remotely.
- The private `message-media` storage bucket exists remotely.
- The scalable reviews function group was deployed on 2026-06-13 after applying `20260613183356_scalable_reviews_feed.sql`.
- The legacy 2025 functions `get-book-details`, `update-reading-progress`, and `daily-summary` had no local consumers and were deleted remotely on 2026-05-05.

## Shared Utilities

| Utility | Purpose |
| --- | --- |
| `_shared/cors.ts` | CORS response headers and preflight support. |
| `_shared/errorHandler.ts` | Consistent error responses and diagnostics. |
| `_shared/rateLimit.ts` | Distributed Edge Function rate limiting. |
| `_shared/validation.ts` | Request parsing and validation helpers. |
| `_shared/messaging.ts` | Direct-message normalization, participant checks, media/reaction helpers. |
| `_shared/clubs.ts` | Club discovery, permissions, membership, and preview helpers. |
| `_shared/reviews.ts` | Review feed cursor, visibility, enrichment, and summary helpers. |

## Maintained Functions

### Reading and Library

| Function | Auth | Purpose | Retry concerns |
| --- | --- | --- | --- |
| `search-books` | Public | Book search. Google Books is primary; Open Library is the fallback when Google returns 403, 429, or 5xx. | Safe to retry, but repeated calls still count against Brack and upstream limits. |
| `add-book` | JWT required | Protected library insert, duplicate detection, and soft-delete restore through `add_library_book`. | Safe when payload identity is stable; duplicate responses are expected. |
| `complete-reading` | JWT required | Consolidated reading completion transaction. | Retry safe when client IDs are supplied. |
| `create-reading-session` | JWT required | Timer session persistence through the completion transaction. | Retry safe when `client_session_id` is supplied. |
| `log-progress` | JWT required | Progress logging through the completion transaction. | Retry safe when `client_log_id` is supplied. |
| `calculate-book-progress` | JWT required | Book-level progress analytics. | Read-only; retry safe. |
| `monthly-stats` | JWT required | Monthly reading statistics. | Read-only; retry safe. |
| `sync-pull` | JWT required | Pull reading-core sync records and tombstones. | Cursor should advance only after local apply. |
| `sync-push` | JWT required | Push reading-core outbox mutations. | Retry per item; idempotency depends on client IDs. |

### Dashboard, Analytics, Activity

| Function | Auth | Purpose | Retry concerns |
| --- | --- | --- | --- |
| `dashboard-home` | JWT required | Snapshot-backed dashboard payload. | Retry safe; refreshes stale snapshots. |
| `compute-analytics` | JWT required | Daily analytics snapshot generation. | Retry safe for same user/date because snapshots are upserted. |
| `award-badges` | JWT required | Badge awarding for user events. | Safe due unique badge ownership. |
| `enhanced-activity` | JWT required | Enriched activity feed. | Read-only; retry safe. |
| `social-feed` | JWT required | Mutual/followed-reader reading activity feed. | Read-only; retry safe. |
| `discover-readers` | JWT required | Reader discovery sections and ranked search. | Read-only; retry safe. |
| `update-presence` | JWT required | Reader online/status heartbeat. | Retry safe; client should throttle. |

### Social Posts

| Function | Auth | Purpose | Retry concerns |
| --- | --- | --- | --- |
| `posts-feed` | JWT required | Cursor-paginated social posts feed. | Read-only; retry safe. |
| `create-post` | JWT required | Transactional post and media metadata creation. | Retrying may duplicate if client IDs are not supplied. |
| `post-comments` | JWT required | Threaded comment reads. | Read-only; retry safe. |
| `create-post-comment` | JWT required | Create threaded post comments. | Retrying can duplicate comments. |
| `toggle-post-like` | JWT required | Toggle post engagement. | Retry safe as a toggle only when client intent is clear. |
| `share-post` | JWT required | Register/share post engagement. | Retrying can duplicate share side effects if not deduped. |
| `blocked-users` | JWT required | List blocked users. | Read-only; retry safe. |
| `block-user` | JWT required | Block a user. | Safe if implemented as idempotent upsert. |
| `unblock-user` | JWT required | Unblock a user. | Safe if row absence is accepted. |

### Reviews

| Function | Auth | Purpose | Retry concerns |
| --- | --- | --- | --- |
| `reviews-feed` | JWT required | Cursor-paginated review feed with scopes, search, rating filters, summaries, and block filtering. | Read-only; retry safe. |
| `review-detail` | JWT required | Canonical review detail payload with book context and related reviews. | Read-only; retry safe. |
| `create-review` | JWT required | Create, update, or restore the current user's review for an owned book. | Retry safe for the same user/book because the endpoint updates the existing row. |
| `toggle-review-like` | JWT required | Toggle review like state and return the new like count. | Toggle semantics require clear client intent. |
| `share-review` | JWT required | Generate canonical share URL and increment share count. | Retrying increments share count again. |
| `review-comments` | JWT required | Cursor-paginated comments for a visible review. | Read-only; retry safe. |
| `create-review-comment` | JWT required | Add a comment to a visible review. | Retrying can duplicate comments. |
| `delete-review` | JWT required | Owner soft-delete for a review. | Retry safe after first success. |

### Clubs

| Function | Auth | Purpose | Retry concerns |
| --- | --- | --- | --- |
| `clubs-home` | JWT required | Club discovery, membership, invite, and request summaries. | Read-only; retry safe. |
| `club-detail` | JWT required | Full club home or private limited preview. | Read-only; retry safe. |
| `create-club` | JWT required | Create public/private clubs with discovery metadata. | Retrying can duplicate without stable client identity. |
| `join-club` | JWT required | Join public clubs. | Safe if membership uniqueness holds. |
| `leave-club` | JWT required | Leave joined clubs with last-admin protection. | Retry safe when missing membership is tolerated. |
| `request-club-join` | JWT required | Request access to private clubs. | Safe if request uniqueness holds. |
| `review-club-join-request` | JWT required | Admin approve/decline private club requests. | Retry safe when final status is idempotent. |
| `invite-club-member` | JWT required | Admin invite readers to clubs. | Safe if invite uniqueness holds. |
| `respond-club-invite` | JWT required | Invitee accept/decline club invites. | Retry safe when final status is idempotent. |
| `create-club-discussion` | JWT required | Member discussion/reply and admin announcement creation. | Retrying can duplicate discussion rows. |
| `moderate-club-discussion` | JWT required | Author/moderator/admin discussion moderation. | Retry safe when setting final moderation state. |
| `manage-club-member` | JWT required | Admin member role and removal controls. | Retry safe when setting final role/removal state. |
| `update-club-media` | JWT required | Club cover/avatar media updates. | Retry safe when setting final media URLs. |

### Direct Messaging

| Function | Auth | Purpose | Retry concerns |
| --- | --- | --- | --- |
| `conversations-home` | JWT required | Direct-message inbox summaries, read cursors, and settings. | Read-only plus cursor/settings aggregation; retry safe. |
| `conversation-detail` | JWT required | Selected thread with signed media URLs. | Read-only; retry safe. |
| `get-or-create-conversation` | JWT required | Start or reopen a one-to-one conversation. | Safe if participant uniqueness holds. |
| `send-message` | JWT required | Send text, uploaded image/GIF, or Tenor GIF messages. | Retry safe only with stable `client_message_id`. |
| `mark-conversation-read` | JWT required | Update per-user read cursor. | Retry safe when cursor only moves forward. |
| `toggle-message-reaction` | JWT required | Add, replace, or remove fixed message reactions. | Toggle semantics require clear client intent. |
| `update-conversation-settings` | JWT required | Mute, pin, archive, or hide a conversation for one user. | Retry safe when setting final state. |
| `delete-message` | JWT required | Sender soft-delete/unsend. | Retry safe after first success. |
| `search-message-gifs` | JWT required | Authenticated Tenor GIF search. | Safe to retry, but upstream limits may apply. |

### Notifications

| Function | Auth | Purpose | Retry concerns |
| --- | --- | --- | --- |
| `send-push-notification` | JWT required | Firebase Cloud Messaging delivery. | Retrying can duplicate user-visible notifications. |

## Auth and Secrets Notes

- Local JWT settings live in `supabase/config.toml`.
- Backend-only secrets must not be exposed with `VITE_` prefixes.
- `SUPABASE_SERVICE_ROLE_KEY` is required for trusted functions that bypass caller RLS after authenticating the user.
- `GOOGLE_BOOKS_API_KEY` is optional but recommended for `search-books`.
- `FCM_SERVER_KEY` is required for `send-push-notification`.
- Tenor GIF search requires the configured Tenor integration secret used by `search-message-gifs`.

## Operational Checks

Use these checks when a function works locally but fails remotely:

```bash
npx supabase functions deploy --project-ref waftnaqgkcgufzapcihe --use-api
npx supabase functions deploy conversations-home --project-ref waftnaqgkcgufzapcihe --use-api
npx supabase functions deploy reviews-feed --project-ref waftnaqgkcgufzapcihe --use-api
npx supabase secrets list
```

If direct messaging returns 500 after function deployment, verify the remote schema includes:

- `conversation_reads`
- `conversation_user_settings`
- `message_media`
- `message_reactions`
- modern `messages` columns: `message_type`, `reply_to_message_id`, `client_message_id`, `edited_at`, `deleted_at`, `metadata`
- private `message-media` storage bucket
