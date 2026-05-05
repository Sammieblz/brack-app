# Visibility Semantics

Source date: 2026-05-05  
Scope: ticket 2.3, social/community visibility model.

## Canonical Visibility Levels

| Level | Meaning | Allowed readers |
| --- | --- | --- |
| `private` | Owner-only data. | Row owner, service role, explicit backend jobs. |
| `followers` | Visible to owner and users who follow the owner. | Owner plus `user_follows.follower_id`. |
| `club` | Visible through club membership. | Club members, club admins, service role. |
| `public` | Visible to authenticated community surfaces. | Any authenticated user unless a surface is intentionally anonymous. |

Rules:
- Reading-core data stays `private` by default.
- Community posts and activities should use the same `private/followers/public` vocabulary.
- Club discussions should remain `club` scoped and should not reuse follower visibility.
- Public read behavior should be enforced in RLS, not only filtered in frontend services.

## Current Table Semantics

| Table | Current model | Status |
| --- | --- | --- |
| `profiles` | `profile_visibility`, `show_reading_activity`, `show_currently_reading` | Keep, but align names with feed rules. |
| `social_activities` | `visibility` text with public/followers/owner behavior | Keep, but rename owner semantics to `private` in future migration or normalize in API. |
| `book_reviews` | `is_public` boolean | Keep short-term; future migration can replace with `visibility`. |
| `book_clubs` | `is_private` boolean plus membership helpers | Keep; maps to `public` or `club`. |
| `book_club_discussions` | Club membership RLS | Keep as `club`. |
| `posts` | Public table; no visibility column | Needs migration. |
| `post_comments` | Public through parent post | Needs parent-post visibility after `posts.visibility`. |
| `post_likes` | Public rows | Needs parent-post visibility after `posts.visibility`. |
| `book_lists` | `is_public` exists, but RLS is owner-only | Needs RLS/policy migration. |
| `book_list_items` | Owner-only through parent list | Needs public-list read behavior if lists are shareable. |
| `user_follows` | Public follow graph | Product decision needed: public graph or follower-count-only public surface. |
| `review_likes` | Public rows | Acceptable only for public reviews. |
| `review_comments` | Parent review visibility | Keep, but document joins as policy-sensitive. |

## Migration Plan

Phase 1:
- Add `posts.visibility TEXT NOT NULL DEFAULT 'public'` with a check constraint for `private`, `followers`, and `public`.
- Backfill all existing posts to `public`.
- Update post/comment/like RLS to read through parent post visibility.
- Update `src/services/api/social.ts` create/update paths to accept visibility, defaulting to `public`.

Phase 2:
- Make `book_lists.is_public = true` readable by authenticated users.
- Update `book_list_items` select policy so items are readable when the parent list is public.
- Add service-level filters so private list writes stay owner-only.

Phase 3:
- Normalize `social_activities.visibility = 'owner'` to `private`, or keep `owner` as a compatibility alias in the API layer.
- Decide whether `book_reviews.is_public` should remain boolean or become a shared `visibility` field.

Phase 4:
- Add tests for public, followers-only, private, and club-scoped reads using two users plus one club.

## API Rules

- Frontend calls remain in `src/services/api/*`.
- RLS must be the final access-control layer.
- Feed functions should pass through visibility decisions instead of widening access with service-role queries.
- Any Edge Function that enriches rows should preserve the visibility rule of the root row.

