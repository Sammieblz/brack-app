# Domain Map

Source of truth: remote Supabase public schema inspected on 2026-05-05 plus current frontend API boundaries under `src/services/api/`.

## Domain Boundaries

| Domain | Responsibility | Tables | Primary API surfaces |
| --- | --- | --- | --- |
| Identity | Auth-adjacent profile state, preferences, onboarding answers, device notification identity. | `profiles`, `reading_habits`, `user_learning_profiles`, `notification_preferences`, `push_tokens` | `auth`, `profiles`, `onboarding`, `readingProfile`, `notifications` |
| Reading | Library, sessions, progress, journals, goals, local-first reading sync. | `books`, `reading_sessions`, `progress_logs`, `journal_entries`, `goals` | `books`, `reading`, `progress`, `journal`, `goals`, `sync` |
| Social | Follow graph, posts, post engagement, activity timelines, direct messaging as a social subdomain. | `user_follows`, `posts`, `post_comments`, `post_likes`, `social_activities`, `conversations`, `messages` | `social`, `activity`, `readers`, `messaging` |
| Reviews | Book reviews and review engagement. | `book_reviews`, `review_likes`, `review_comments` | `reviews` |
| Clubs | Book clubs, membership, roles, and discussions. | `book_clubs`, `book_club_members`, `book_club_discussions` | `clubs` |
| Curation | User-created book lists and list membership. | `book_lists`, `book_list_items` | `bookLists` |
| Motivation/Analytics | Badges, streaks, analytics snapshots, derived progress/read models. | `badges`, `user_badges`, `reading_streak_days`, `reading_streak_history`, `analytics_snapshots`, `dashboard_home_snapshots` | `badges`, `streaks`, `analytics`, `dashboard` |
| Operations | Backend operational controls and runtime protection state. | `api_rate_limits` | Edge Function shared utilities |

## Ownership Rules

- Frontend code should call domain service modules in `src/services/api/*`; components should not add new ad hoc Supabase calls for shared behavior.
- Edge Functions should wrap cross-table, privileged, external, or idempotent flows.
- Database RPCs own transactional writes and derived read models.
- Triggers are allowed for local invariant maintenance, counters, timestamp maintenance, and derived event rows, but new trigger side effects must be documented in `docs/schema/functions-and-triggers.md`.
- Anonymous public-schema table access is intentionally revoked; public unauthenticated behavior should be implemented through explicit Edge Functions.

## Current Boundary Risks

- `books` belongs to Reading but currently mixes canonical metadata and user-specific state. Future `books` + `user_books` split is tracked in Epic 5.
- Direct social activity insertion exists in app code while DB triggers also create activity rows. Epic 6 should choose one canonical activity production pattern.
- Dashboard home now has a snapshot-backed read model, while analytics remains a hybrid of live calculations and `analytics_snapshots`.
- Messaging currently sits under Social; if it grows, it can become a separate top-level domain without changing current table ownership.
