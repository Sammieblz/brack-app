# Frontend Service Boundaries

Source date: 2026-05-05  
Scope: ticket 8.1, centralize domain API access.

## Rule

React components, screens, hooks, and contexts should not import the Supabase client directly. They should call domain services from `src/services/api/*` or local/offline services from `src/services/local/*` and `src/services/sync/*`.

## Current Audit

Direct `supabase` imports are confined to:
- `src/integrations/supabase/client.ts`
- `src/services/api/*`

No direct Supabase imports were found in screens or components.

## Domain API Modules

| Domain | Module |
| --- | --- |
| Auth | `src/services/api/auth.ts` |
| Books/library | `src/services/api/books.ts` |
| Reading sessions/progress | `src/services/api/reading.ts`, `src/services/api/progress.ts` |
| Dashboard/analytics | `src/services/api/dashboard.ts`, `src/services/api/analytics.ts` |
| Journals/goals/streaks | `src/services/api/journal.ts`, `src/services/api/goals.ts`, `src/services/api/streaks.ts` |
| Social/activity/readers | `src/services/api/social.ts`, `src/services/api/activity.ts`, `src/services/api/readers.ts` |
| Reviews | `src/services/api/reviews.ts` |
| Clubs | `src/services/api/clubs.ts` |
| Messaging | `src/services/api/messaging.ts` |
| Profiles/onboarding | `src/services/api/profiles.ts`, `src/services/api/onboarding.ts`, `src/services/api/readingProfile.ts` |
| Notifications/storage/sync | `src/services/api/notifications.ts`, `src/services/api/storage.ts`, `src/services/api/sync.ts` |

## Pattern

- API modules own Supabase table/RPC/Edge Function calls.
- Hooks own React state, subscriptions, cache invalidation, and toasts.
- Components own UI and user interaction.
- Offline-first reading writes go through `src/utils/offlineOperation.ts` and local repositories.
- Edge Function calls should use `invokeFunction` from `src/services/api/client.ts` unless response/error handling needs function-specific behavior.

## Follow-Ups

- Reduce duplicate dashboard data hooks by moving dashboard-only reads into `dashboard-home`.
- Avoid adding new imports from `@/integrations/supabase/client` outside `src/services/api`.
- Consider an ESLint no-restricted-import rule after the current backlog pass.

