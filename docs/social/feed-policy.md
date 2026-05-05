# Feed Inclusion Policy

Source date: 2026-05-05  
Scope: ticket 6.3, reduce feed noise and define public/private behavior.

## Main Feed Includes

| Event | Include? | Reason |
| --- | --- | --- |
| `book_completed` | Yes | High-signal reading milestone. |
| `book_reviewed` | Yes | Useful community content. |
| `earned_badge` | Yes | Motivational milestone. |
| `post` | Yes | Explicit community contribution. |
| `book_started` | Yes, but lower priority | Good signal but can be noisy for frequent status changes. |
| `created_list` | Yes after public-list read policies are fixed | Useful curation event, but currently can point to owner-only list data. |
| `followed_user` | Limited | Good for social graph discovery but noisy at scale. |

## Main Feed Excludes

- Direct page progress logs.
- Timer sessions.
- Journal entries.
- Goal creation/edits.
- Quick progress corrections.
- Book edits that do not change reading status.
- Private or owner-only list data.

## Visibility Rules

- `public` activity can appear in the main community/following feed.
- `followers` activity appears only to the owner and followers.
- `private`/owner-only activity appears only to the owner.
- Club activity should use club-scoped feeds unless a club explicitly publishes a public event.

## Ordering and Fanout

Current model:
- Query follow graph.
- Query `social_activities` for followed users plus self.
- Sort by `created_at`.

Fanout is deferred. Add `activity_fanout` only when:
- Feed latency is proven high with production-sized data.
- The follow graph makes `.in(user_id, followedIds)` inefficient.
- Notification-style unread feed state is needed.

Future fanout table shape:
- `id`
- `viewer_id`
- `activity_id`
- `actor_id`
- `created_at`
- `seen_at`
- indexes on `(viewer_id, created_at desc)` and `(viewer_id, seen_at)`.

