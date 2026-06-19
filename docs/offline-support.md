# Offline Support

Comprehensive guide to Brack's local-first reading core, durable offline storage, and sync behavior.

## Overview

Brack supports offline-first reading workflows for the data users are most likely to change while reading:

- Library books
- Reading sessions
- Progress logs
- Journal entries
- Goals
- Profile theme preferences

Social, discovery, clubs, messages, reviews, search, push notifications, and image uploads are still online-first unless a specific screen adds its own cache.

## Current Architecture

```
User action
    |
    v
API wrapper / hook
    |
    +-- online: write through Supabase, then mirror into local storage
    |
    +-- offline: write into local repository and enqueue an outbox item
                    |
                    v
             readingCoreSync
                    |
                    +-- push pending outbox items to sync-push
                    |
                    +-- pull remote changes from sync-pull
                    |
                    v
             update local repositories and notify UI
```

The old localStorage-only `offlineQueue` service has been replaced by durable local repositories plus an outbox.

## Key Files

| Area | Files |
| --- | --- |
| Local driver | `apps/client/src/services/local/driver.ts` |
| Local repositories | `apps/client/src/services/local/repositories.ts`, `apps/client/src/services/local/index.ts` |
| Sync engine | `apps/client/src/services/sync/engine.ts` |
| Sync types | `apps/client/src/services/sync/types.ts` |
| Sync API wrappers | `apps/client/src/services/api/sync.ts` |
| App sync facade | `apps/client/src/services/syncService.ts` |
| Offline wrappers | `apps/client/src/utils/offlineOperation.ts` |
| Status UI | `apps/client/src/components/OfflineIndicator.tsx` |
| Failed sync review | `apps/client/src/components/SyncReviewDialog.tsx` |
| Edge Functions | `supabase/functions/sync-pull/index.ts`, `supabase/functions/sync-push/index.ts` |
| Database migrations | `supabase/migrations/20260505010000_offline_reading_core_sync.sql`, `supabase/migrations/20260505070118_journal_goal_delete_tombstones.sql` |

## Local Storage Layers

### Web

Web uses Dexie/IndexedDB through the local driver. This keeps local records and outbox items durable across refreshes and PWA restarts.

### Native

iOS and Android use `@capacitor-community/sqlite` through the same driver interface. Native validation still needs to be completed on macOS/iOS, but the JavaScript side is wired for Capacitor SQLite.

### Desktop

Electron desktop uses native SQLite through the preload bridge and Electron IPC. The database is stored as `brack_offline.sqlite` under Electron `app.getPath("userData")`, so it follows each desktop OS's normal per-user app data location. The renderer still talks to the same `LocalDriver` interface and cannot execute arbitrary SQL.

### Outbox Records

Outbox items use these fields:

- `client_mutation_id` for idempotent mutation tracking
- `client_entity_id` for local entity identity before or during sync
- `entity` for the synced table/domain
- `operation` as `create`, `update`, `delete`, or `restore`
- `status` as `pending`, `syncing`, `failed`, or `synced`
- retry metadata such as `attempt_count`, `last_error`, and `next_attempt_at`

Supported entities are:

- `books`
- `reading_sessions`
- `progress_logs`
- `journal_entries`
- `goals`
- `profile_preferences`

## Sync Functions

### sync-push

`sync-push` accepts pending outbox items for the authenticated user and applies them server-side.

Important behavior:

- Rejects outbox items for any user other than the authenticated user.
- Uses `add_library_book` for book creates/restores so duplicate prevention stays centralized.
- Uses `create_reading_session` for timer sessions.
- Uses `log_progress_transaction` for progress logs.
- Soft-deletes books, journal entries, and goals by setting `deleted_at`.
- Marks deleted goals inactive with `is_active = false`.
- Returns accepted and failed item lists so the client can clear, retry, or review failures.

### sync-pull

`sync-pull` returns records changed since the client's `reading_core` cursor.

Pulled data includes:

- Books
- Reading sessions
- Progress logs
- Journal entries
- Goals
- Profile theme preferences

Deleted books, journal entries, and goals are included as tombstones so other devices can remove or hide them locally.

## Delete Consistency

Books, journal entries, and goals use soft deletes for cross-device consistency.

| Entity | Delete marker | Active UI behavior |
| --- | --- | --- |
| Books | `books.deleted_at` | Hidden from library and search unless explicitly included |
| Journal entries | `journal_entries.deleted_at` | Hidden from journal and quote queries |
| Goals | `goals.deleted_at` plus `is_active = false` | Hidden from active/current goal queries |

The migration `20260505070118_journal_goal_delete_tombstones.sql` adds `deleted_at` to `journal_entries` and `goals` plus indexes for active and cursor-based sync queries.

## Conflict Handling

Current conflict handling is intentionally lightweight:

- Remote pull applies newer remote rows into local repositories.
- Push failures stay in the outbox as `failed`.
- `SyncReviewDialog` lets users retry or discard failed local changes.
- There is not yet a full field-by-field manual merge UI.

## Sync Triggers

Sync can run when:

- The app starts or regains focus.
- Network connectivity returns.
- A screen or user action explicitly requests sync.
- `OfflineIndicator` triggers manual sync.

The sync engine skips work while another sync is already running or while `navigator.onLine` is false.

## Status UI

`OfflineIndicator` listens for `brack:sync-status-changed` events from `readingCoreSync`.

It displays:

- Online/offline state
- Pending outbox count
- Failed outbox count
- Manual sync actions
- Access to `SyncReviewDialog` for failed items

## Developer Guidance

Use the domain API layer and existing offline wrappers instead of writing directly to Supabase for reading-core mutations.

Preferred paths:

- Books: `apps/client/src/hooks/useBooks.ts` and `apps/client/src/services/api/books.ts`
- Progress: `apps/client/src/components/ProgressLogger.tsx`, `apps/client/src/hooks/useProgressLogs.ts`, `apps/client/src/services/api/progress.ts`
- Timer sessions: `apps/client/src/contexts/TimerContext.tsx`, `apps/client/src/services/api/reading.ts`
- Journals: `apps/client/src/hooks/useJournalEntries.ts`, `apps/client/src/services/api/journal.ts`
- Goals: `apps/client/src/services/api/goals.ts`
- Profile preferences: `apps/client/src/services/api/profiles.ts`

Do not add a new localStorage queue. Extend `SyncEntity`, local repositories, `sync-push`, and `sync-pull` when a new domain needs durable offline sync.

## Testing Offline Mode

### Web/PWA

1. Open the app online and load the library once.
2. Use browser DevTools Network settings to go offline.
3. Restart the PWA/browser tab.
4. Add/edit/delete a book.
5. Log progress.
6. Finish a timer session.
7. Create/edit/delete a journal entry.
8. Create/update/delete a goal.
9. Return online and confirm `OfflineIndicator` reaches zero pending/failed items.
10. Confirm Supabase has the expected records and tombstones.

### Android

1. Run `npm run build`.
2. Run `npm run cap:sync:android`.
3. Test airplane-mode workflows on an emulator or physical device.
4. Reconnect and verify local changes sync to Supabase.

### iOS

iOS requires macOS, CocoaPods, and Xcode. JavaScript sync behavior is implemented, but native SQLite/iOS behavior still needs device or simulator validation.

### Desktop

1. Run `npm run desktop:dist:win`, `npm run desktop:dist:mac`, or `npm run desktop:dist:linux` on the matching OS.
2. Install or launch the unsigned artifact from `release/desktop/`.
3. Sign in and load the library once.
4. Disconnect from the network.
5. Restart the desktop app.
6. Add/edit/delete a book.
7. Log progress and finish a timer session.
8. Create/edit/delete a journal entry.
9. Create/update/delete a goal.
10. Reconnect and confirm `OfflineIndicator` reaches zero pending/failed items.

## Known Limitations

- Feed, clubs, messages, reviews, follows, discovery, push notifications, uncached external book search, direct barcode lookup/add, and image uploads remain online-first.
- General book search can display previously cached local results offline. Direct barcode-to-library still requires connectivity because it must resolve an exact ISBN match and call `add-book`.
- `SyncReviewDialog` supports retry/discard, not full manual merge resolution.
- Hard-delete semantics are avoided for reading-core entities that must sync across devices.
- Native SQLite behavior still needs real-device validation, especially iOS.
- Desktop packaging is unsigned in the first pass; signing and notarization are separate release hardening work.

## Related Docs

- [Architecture](./architecture.md)
- [Database Schema](./database-schema.md)
- [API Reference](./api-reference.md)
- [Book Acquisition, Search, And Barcode Scanning](./reading/book-acquisition.md)
- [Testing](./testing.md)
- [Troubleshooting](./troubleshooting.md)
