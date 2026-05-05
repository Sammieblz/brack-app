# Books and User Books Migration Plan

Source date: 2026-05-05  
Scope: ticket 5.2, future split plan only. No migration is approved or executed by this ticket.

## Proposed Tables

### `books`

Canonical/shared book metadata.

| Column | Notes |
| --- | --- |
| `id uuid primary key` | Canonical book id. |
| `title text not null` | Normalized for matching, display title preserved. |
| `author text` | Display author. |
| `isbn text` | Raw ISBN. |
| `normalized_isbn text` | Indexed unique when present. |
| `normalized_title text` | Indexed with normalized author when ISBN missing. |
| `normalized_author text` | Indexed with normalized title when ISBN missing. |
| `genre text` | Best known canonical/default genre. |
| `pages integer` | Best known page count. |
| `chapters integer` | Optional. |
| `cover_url text` | Best known cover. |
| `description text` | Best known description. |
| `source_provider text` | Google Books/Open Library/manual/etc. |
| `source_id text` | Provider id. |
| `metadata jsonb` | Raw provider details. |
| `created_at`, `updated_at` | Metadata lifecycle. |

### `user_books`

User-owned reading/library state.

| Column | Notes |
| --- | --- |
| `id uuid primary key` | User-library id, can keep current `books.id` during transition. |
| `user_id uuid not null references profiles(id)` | Owner. |
| `book_id uuid not null references books(id)` | Canonical metadata id. |
| `status text not null default 'to_read'` | User state. |
| `current_page integer default 0` | User progress summary. |
| `date_started date`, `date_finished date` | User dates. |
| `rating integer`, `notes text`, `tags text[]` | User annotations. |
| `created_at`, `updated_at`, `deleted_at` | Sync lifecycle. |
| `client_id text` or stable UUID strategy | Offline idempotency if needed. |

## Reference Migration Strategy

Phase 1:
- Create canonical `books_catalog` or new `canonical_books` table without touching current `books`.
- Backfill from distinct ISBN first, then title+author fallback.
- Add `canonical_book_id` to current `books`.
- Update `add_library_book` to find/create canonical metadata and still write current `books`.

Phase 2:
- Add `user_books` as a mirror of current user-owned `books`.
- Dual-write current `books` and `user_books` from backend RPCs.
- Update reading-core services to read from `user_books` joined to canonical metadata.

Phase 3:
- Move public/community tables to canonical references where appropriate:
  - `book_reviews.book_id`
  - `book_clubs.current_book_id`
  - `book_lists` can remain user-library-oriented or gain canonical list items.
- Keep progress, sessions, journals tied to `user_books`.

Phase 4:
- Rename current `books` to `user_books` only after all app services use the split model.
- Preserve compatibility views/RPCs during migration.
- Rebuild offline sync around `user_books`.

## Impact Assessment

High-impact areas:
- Offline sync and local repositories.
- Duplicate prevention.
- Reviews and public book detail pages.
- Dashboard and analytics.
- Book lists and club current books.
- Generated Supabase types.

Do not run this split until:
- Offline reading-core sync has stable real-device coverage.
- Public/community book references have a product decision.
- Migration rollback and compatibility views are designed.

