# Activity Types

Source date: 2026-05-05  
Scope: ticket 6.2, canonical social activity event names.

## Canonical Types

| Type | Producer | Feed inclusion | Metadata |
| --- | --- | --- | --- |
| `book_started` | `create_book_activity` on `books.status = 'reading'` transition | Included | `book_title`, `book_author`; `book_id` column. |
| `book_completed` | `create_book_activity` on `books.status = 'completed'` transition | Included | `book_title`, `book_author`; `book_id` column. |
| `book_reviewed` | `create_review_activity` on `book_reviews` insert | Included | `book_title`, `book_author`, `rating`; `book_id`, `review_id` columns. |
| `followed_user` | `create_follow_activity` on `user_follows` insert | Included with low priority | `followed_user_id`, `followed_user_name`. |
| `created_list` | `create_list_activity` on public `book_lists` insert | Included after public-list RLS is fixed | `list_name`, `list_description`; `list_id` column. |
| `earned_badge` | `create_badge_activity` on `user_badges` insert | Included | `badge_title`, `badge_description`; `badge_id` column. |
| `post` | `create_post_activity` on `posts` insert | Included in posts/activity surfaces where visibility allows it | `post_id`, `post_title`, `genre`, `post_type`, attachment metadata. |

## Rules

- Activity types are snake_case.
- Past-tense verbs are allowed only for clear user events (`book_completed`, `earned_badge`).
- Do not add a new activity type without updating:
  - `social_activities_activity_type_check`
  - `src/services/api/social.ts`
  - `src/components/social/FeedItem.tsx`
  - this document
- Feed-only derived events like `progress_logged` and `reading_session` should stay out of `social_activities` unless product decides they belong in the community feed.
- Activity feed delivery is fanout-based through `activity_feed_items`; event creation still writes `social_activities` first.
- Friend activity means mutual follows only, and `profiles.show_reading_activity = false` removes that actor from friend activity feeds.

## Compatibility Notes

- Legacy `created_post` has been replaced with `post`.
- Legacy direct client insertion for post activities is retired; post creation now goes through the `create-post` Edge Function and database trigger.
- Remote legacy constraint values `joined_club`, `joined_challenge`, and `milestone_reached` were removed from the active constraint because the app has no current producers or renderers for them.

