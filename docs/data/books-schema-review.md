# Books Schema Usage Review

Source date: 2026-05-05  
Scope: ticket 5.1, assess whether `books` mixes canonical metadata with user-specific state.

## Current `books` Responsibilities

| Category | Columns/examples | Nature |
| --- | --- | --- |
| Canonical-ish metadata | `title`, `author`, `isbn`, `genre`, `pages`, `chapters`, `cover_url`, `description`, `source_provider`, `source_id`, `metadata` | Could be shared across users, but is currently copied per user. |
| User reading state | `user_id`, `status`, `current_page`, `date_started`, `date_finished`, `rating`, `notes`, `tags` | User-specific. |
| Sync/lifecycle | `id`, `created_at`, `updated_at`, `deleted_at` | User-library record lifecycle. |

`books` currently mixes canonical metadata and user-library state.

## Current Usage Patterns

| Surface | Usage |
| --- | --- |
| Add book | `add_library_book` inserts/restores one `books` row per user. |
| Library | Lists `books` by `user_id`, filters deleted rows, sorts by update time. |
| Book detail | Reads one active `books` row and related sessions/progress/journal/reviews. |
| Progress/session RPCs | Update `books.status`, `current_page`, `date_started`, `date_finished`, `updated_at`. |
| Dashboard | Uses `books` for continue reading, stats, active goal progress, and activity labels. |
| Social/reviews/lists/clubs | Many tables reference `books.id`, which currently means a user-owned library row. |
| Offline sync | Treats `books` as a local-first user-owned entity with client-created IDs. |

## Risks of Current Model

- The same ISBN/title can exist as many rows across users, so metadata corrections do not propagate.
- Public/community references to `books.id` can point to private user-owned rows.
- Reviews and clubs may unintentionally depend on another user's library record remaining present.
- Book search/import can create metadata drift for cover, description, page count, and genre.
- Splitting later will be harder because many tables already reference `books.id`.

## Reasons to Keep Short-Term

- It matches the offline sync model.
- Duplicate prevention and soft-delete restore are already implemented.
- Reading-core queries are simpler and owner-private.
- App surfaces are currently user-library-first, not global-catalog-first.

## Recommendation

Keep `books` as-is for the current offline-reading milestone, but plan a future split into canonical `books` plus user-owned `user_books`.

Do not execute the split yet. First migrate social/review/club/list references intentionally so public objects do not depend on private library rows.

