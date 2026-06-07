# Feed Inclusion Policy

Source date: 2026-06-06  
Scope: scalable social posts and mutual-friend activity feeds.

## Posts Feed

- Served through the protected `posts-feed` Edge Function.
- Uses opaque cursor pagination based on timestamp plus row id; no offset pagination.
- Shows followed/self timeline content first, then discovery posts from non-followed readers.
- Does not loop when content runs out. The app shows a caught-up state with follow/create/discovery prompts.
- Excludes deleted posts, blocked users in either direction, private posts, and follower-only posts when the viewer is not allowed.
- Direct broad table subscriptions are intentionally avoided; the client refreshes on demand.

## Activity Feed

- Served through the protected `social-feed` Edge Function.
- Uses `activity_feed_items` as a read-optimized fanout table.
- Includes only mutual-follow friends.
- Respects `profiles.show_reading_activity`; disabling it removes/hides that user from friend activity feeds.
- Excludes blocked users in either direction.

## Main Activity Types

| Event | Include? | Reason |
| --- | --- | --- |
| `book_completed` | Yes | High-signal reading milestone. |
| `book_reviewed` | Yes | Useful community content. |
| `earned_badge` | Yes | Motivational milestone. |
| `post` | Yes | Explicit community contribution. |
| `book_started` | Yes, lower priority | Good signal but noisier for frequent readers. |
| `created_list` | Yes when list visibility allows it | Useful curation event. |
| `followed_user` | Limited | Useful for social discovery but noisy at scale. |

## Media Posts

- Stored in the private `post-media` Supabase Storage bucket.
- Clients upload only to their own user-id folder.
- Feed/detail endpoints return short-lived signed read URLs.
- Limits for this Supabase V1 pass:
  - Images: up to 4 per post, 10 MB each, JPEG/PNG/WebP.
  - Video: 1 per post, 60 MB, 90 seconds, MP4/WebM/QuickTime.
- No external transcoding is used in this pass.

## Fanout Tables

- `post_feed_items`: read-optimized followed/self post timeline.
- `activity_feed_items`: read-optimized mutual-friend activity timeline.
- `social_activities`: canonical event log remains the source of activity truth.

Both fanout tables are safe to rebuild from source tables if needed.
