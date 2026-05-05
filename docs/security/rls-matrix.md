# RLS Matrix

Source of truth: remote Supabase project `waftnaqgkcgufzapcihe`, public schema, inspected on 2026-05-05.

All 32 public tables currently have RLS enabled.

Legend:
- Owner: `auth.uid()` must match the row's user/profile id.
- Participant: user is a conversation participant.
- Club member/admin: helper functions `is_club_member` / `is_club_admin`.
- Public: readable by any authenticated/public role under current policy.
- Service: service role or security-definer function is expected to write.
- None: no direct policy found for that operation.

## Matrix

| Table | Select | Insert | Update | Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| `analytics_snapshots` | Owner | None | None | None | Derived analytics; writes are service/RPC only. |
| `api_rate_limits` | None | None | None | None | Backend-only operational table. RLS has no policies; service-role RPC writes buckets. |
| `badges` | Public | None | None | None | Reference data. |
| `book_club_discussions` | Club member | Club member and owner | Author | Author or club admin | Club-scoped. |
| `book_club_members` | Club member | Club admin or self-join | Club admin | Self or club admin | Role semantics need ticket 7.1. |
| `book_clubs` | Public/private/member rule | Creator | Club admin | Club admin | Uses `is_private`, not a shared visibility enum. |
| `book_list_items` | Owner through parent list | Owner through parent list | Owner through parent list | Owner through parent list | Public list read behavior is not implemented. |
| `book_lists` | Owner | Owner | Owner | Owner | `is_public` exists but RLS is owner-only. |
| `book_reviews` | Public if `is_public`, or owner | Owner | Owner | Owner | Visibility differs from profile/activity semantics. |
| `books` | Owner | Owner | Owner | Owner | Private library. |
| `conversations` | Participant | Participant | None | None | Conversation lifecycle is minimal. |
| `dashboard_home_snapshots` | Owner | None | None | None | Derived read model; writes are through security-definer RPC/service role. |
| `goals` | Owner | Owner | Owner | Owner | Private with soft deletes. |
| `journal_entries` | Owner | Owner | Owner | Owner | Private with soft deletes. |
| `messages` | Participant | Sender and participant | Sender | None | No delete policy. |
| `notification_preferences` | Owner | Owner | Owner | None | No delete policy. |
| `post_comments` | Public | Owner | Owner | Owner | Feed visibility is public today. |
| `post_likes` | Public | Owner | None | Owner | Like rows are public today. |
| `posts` | Public | Owner | Owner | Owner | No private/followers visibility field today. |
| `profiles` | Owner plus public/followers visibility | Owner | Owner | None | `profile_visibility` supports public/followers/private. |
| `progress_logs` | Owner | Owner | Owner | Owner | Private reading data. |
| `push_tokens` | Owner | Owner | Owner | Owner | Private device state. |
| `reading_habits` | Owner | Owner | Owner | Owner | Duplicate all/manage-specific policies exist. |
| `reading_sessions` | Owner | Owner | Owner | Owner | Private reading data. |
| `reading_streak_days` | Owner | Owner | Owner | Owner | Derived/private streak activity. |
| `reading_streak_history` | Owner | Owner | None | None | Insert policy exists for users; can also be written by backend flows. |
| `review_comments` | Public review visibility or review owner | Owner | Owner | Owner | Select joins to `book_reviews`. |
| `review_likes` | Public | Owner | None | Owner | Like rows are public today. |
| `social_activities` | Public/followers/owner | Owner | Owner | Owner | Trigger-created activities use security definer functions. |
| `user_badges` | Owner | Owner | None | None | Award RPC also inserts; no update/delete. |
| `user_follows` | Public | Follower | None | Follower | Follow graph is public today. |
| `user_learning_profiles` | Owner | Owner | Owner | Owner | Private onboarding/personalization data. |

## Security Follow-Ups

- Ticket 2.2: controlled remote auth trigger validation passed; keep a UI signup smoke test in manual QA before releases.
- Ticket 2.3: define one visibility model for public/followers/club/private and decide how it applies to posts, lists, activities, reviews, profiles, and clubs.
- `analytics_snapshots` insert/update policies were removed on 2026-05-05; snapshot writes now go through service-role `compute-analytics`.
- Anonymous direct table privileges were revoked from the public schema on 2026-05-05. Authenticated clients still rely on RLS for app data access through `src/services/api/*`.
- Public storage bucket listing policies for `avatars` and `book-covers` were removed. Direct public object URLs still work through public buckets; Storage API listing is blocked.
- `get_conversation_summaries`, `use_reading_streak_freeze`, `is_club_member`, and `is_club_admin` remain callable by authenticated clients by design and include `auth.uid()` guards. Backend-only security-definer RPCs are service-role-only.
- Social public surfaces are intentionally permissive today but should be reviewed before feed growth: posts, comments, likes, follows, review likes, and public activities.
