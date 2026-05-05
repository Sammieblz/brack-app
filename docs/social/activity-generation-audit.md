# Activity Generation Audit

Source date: 2026-05-05  
Scope: ticket 6.1, every path that writes `social_activities`.

## Activity Producers

| Producer | Trigger/function | Source table | Event type | Writes |
| --- | --- | --- | --- | --- |
| Book status update | `create_book_activity` via `create_book_activity_trigger` | `books` update | `book_started`, `book_completed` | `social_activities.user_id`, `book_id`, metadata title/author. |
| Reading completion transaction | `complete_reading_transaction` | sessions/progress/manual completion | `book_started`, `book_completed` | Inserts deduped book activity when the transaction moves a book to `reading` or `completed`. |
| Review creation | `create_review_activity` via `create_review_activity_trigger` | `book_reviews` insert | `book_reviewed` | `social_activities.user_id`, `book_id`, `review_id`, rating metadata. |
| Public list creation | `create_list_activity` via `create_list_activity_trigger` | `book_lists` insert | `created_list` | `social_activities.user_id`, `list_id`, list metadata; only when `is_public = true`. |
| Follow | `create_follow_activity` via `create_follow_activity_trigger` | `user_follows` insert | `followed_user` | `social_activities.user_id`, followed user metadata. |
| Badge award | `create_badge_activity` via `create_badge_activity_trigger` | `user_badges` insert | `earned_badge` | `social_activities.user_id`, `badge_id`, badge metadata. |
| Post creation | `create_post_activity` via `create_post_activity_trigger` | `posts` insert | `post` | `social_activities.user_id`, post metadata. |
| Direct API insert | `createSocialActivityPost` in `src/services/api/social.ts` | App command | `post` | Direct insert into `social_activities`. |

## Duplicate Risks

- `posts` have both a database trigger and a direct `createSocialActivityPost` API helper. Current UI post creation uses `posts`; the direct activity helper should be treated as legacy/compatibility unless a post-like activity without a `posts` row is intentionally needed.
- Book progress/session flows update `books.status`; trigger and transaction activity generation can overlap, so `complete_reading_transaction` checks for an existing user/book/type activity before inserting.
- Re-awarding badges is guarded by unique `user_badges(user_id,badge_id)`, so duplicate badge activities should be prevented by the award insert path.
- Public list activity depends on `book_lists.is_public`, but RLS still treats book lists as owner-only. Public-list feed items may point to data other users cannot read until ticket 2.3 migration phase 2 is implemented.

## Event Naming

Canonical activity types are enforced by `social_activities_activity_type_check`:
- `book_started`
- `book_completed`
- `book_reviewed`
- `followed_user`
- `created_list`
- `earned_badge`
- `post`

Migration `20260505093000_standardize_activity_types.sql` changed the post trigger to emit `post`.
Migration `20260505094000_fix_activity_type_constraint.sql` replaced the legacy constraint so `post` is allowed and old unused names are not.

## Feed Query Path

`social-feed`:
- Authenticates the user.
- Reads `user_follows` for followed ids.
- Queries `social_activities` for followed users plus self.
- Enriches profiles and books.

No fanout table exists yet. Current indexes support the non-fanout model:
- `idx_user_follows_follower`
- `idx_social_activities_user_created`

Fanout should remain deferred until production feed volume or `EXPLAIN ANALYZE` proves the current query is a bottleneck.
