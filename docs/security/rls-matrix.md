# RLS Matrix

Source of truth: remote Supabase project `waftnaqgkcgufzapcihe`, public schema, updated for club workflow changes on 2026-06-07.

All listed public tables currently have RLS enabled.

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
| `book_club_discussions` | Club member | Club member and owner | Author or moderator/admin | Author or moderator/admin | Soft delete, media validation, and pin/type moderation are Edge-owned. |
| `book_club_invites` | Invited user or club admin | Club admin | Invited user or club admin | None | Invite response is Edge-owned. |
| `book_club_join_requests` | Requester or club admin | Requester | Club admin | None | Private-club request review is Edge-owned. |
| `book_club_members` | Club member | Club admin or self-join | Club admin | Self or club admin | Admin management now goes through Edge APIs. |
| `book_clubs` | Public/private/member rule | Creator | Club admin | Club admin | Private clubs are discoverable as limited previews through Edge. |
| `book_list_items` | Owner through parent list | Owner through parent list | Owner through parent list | Owner through parent list | Public list read behavior is not implemented. |
| `book_lists` | Owner | Owner | Owner | Owner | `is_public` exists but RLS is owner-only. |
| `book_reviews` | Public if `is_public`, or owner | Owner | Owner | Owner | Visibility differs from profile/activity semantics. |
| `books` | Owner | Owner | Owner | Owner | Private library. |
| `conversation_reads` | Participant | Participant self cursor | Participant self cursor | None | Per-user read cursor replaces fragile shared `messages.is_read` semantics. |
| `conversation_user_settings` | Owner participant | Owner participant | Owner participant | None | Per-user mute, pin, archive, hidden inbox state. |
| `conversations` | Participant | Participant | None | None | One-to-one conversation lifecycle is Edge-owned. |
| `dashboard_home_snapshots` | Owner | None | None | None | Derived read model; writes are through security-definer RPC/service role. |
| `goals` | Owner | Owner | Owner | Owner | Private with soft deletes. |
| `journal_entries` | Owner | Owner | Owner | Owner | Private with soft deletes. |
| `message_media` | Participant if not blocked | Sender participant if not blocked | None | None | Private `message-media` bucket reads use signed URLs from messaging Edge Functions. |
| `message_reactions` | Participant | Participant self reaction if not blocked | Owner reaction | Owner reaction | One fixed reaction per user/message. |
| `message-media` Storage | Signed URL from messaging Edge Functions | Owner path prefix | Owner path prefix | Owner path prefix | Private bucket for direct-message image/GIF attachments. |
| `messages` | Participant | Sender and participant | Sender | None | Sender soft-delete and heavy writes go through messaging Edge Functions. |
| `notification_preferences` | Owner | Owner | Owner | None | No delete policy. |
| `post_comments` | Parent post visibility | Visible post commenter | Owner | Owner | Thread metadata supports root/reply pagination. |
| `post_likes` | Parent post visibility | Visible post liker | None | Owner | Like rows are no longer broadly public. |
| `post_media` | Parent post visibility | Owner | None | Owner | Private Storage read uses signed URLs from Edge Functions. |
| `club-media` Storage | Signed URL from club Edge Functions | Owner path prefix | Owner path prefix | Owner path prefix | Private bucket for club banners, profile images, and discussion attachments. |
| `post_shares` | Owner | Owner | None | None | Share count is denormalized onto posts. |
| `posts` | Public/followers/private plus block filters | Owner | Owner | Owner | `deleted_at` hides posts without hard delete. |
| `profiles` | Owner plus public/followers visibility | Owner | Owner | None | `profile_visibility` supports public/followers/private; presence fields are filtered by discovery APIs. |
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
| `user_blocks` | Blocker | Blocker | None | Blocker | Block relationships hide social/profile surfaces both directions. |
| `user_follows` | Public | Follower | None | Follower | Follow graph is public today. |
| `user_learning_profiles` | Owner | Owner | Owner | Owner | Private onboarding/personalization data. |

## Security Follow-Ups

- Ticket 2.2: controlled remote auth trigger validation passed; keep a UI signup smoke test in manual QA before releases.
- Ticket 2.3: define one visibility model for public/followers/club/private and decide how it applies to posts, lists, activities, reviews, profiles, and clubs.
- `analytics_snapshots` insert/update policies were removed on 2026-05-05; snapshot writes now go through service-role `compute-analytics`.
- Anonymous direct table privileges were revoked from the public schema on 2026-05-05. Authenticated clients still rely on RLS for app data access through `apps/client/src/services/api/*`.
- Public storage bucket listing policies for `avatars` and `book-covers` were removed. Direct public object URLs still work through public buckets; Storage API listing is blocked.
- `get_conversation_summaries`, `use_reading_streak_freeze`, `is_club_member`, and `is_club_admin` remain callable by authenticated clients by design and include `auth.uid()` guards. Backend-only security-definer RPCs are service-role-only.
- Social posts/comments/likes were tightened on 2026-06-06. Smart discovery now excludes blocked/private readers and hides online presence when disabled. Remaining broad social surfaces to review are follows, review likes, and public review comments.
