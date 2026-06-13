# Frontend Service Boundaries

Source date: 2026-05-05  
Scope: ticket 8.1, centralize domain API access.

## Rule

React components, screens, hooks, and contexts should not import the Supabase client directly. They should call domain services from `apps/client/src/services/api/*` or local/offline services from `apps/client/src/services/local/*` and `apps/client/src/services/sync/*`.

## Current Audit

Direct `supabase` imports are confined to:
- `apps/client/src/integrations/supabase/client.ts`
- `apps/client/src/services/api/*`

No direct Supabase imports were found in screens or components.

## Domain API Modules

| Domain | Module |
| --- | --- |
| Auth | `apps/client/src/services/api/auth.ts` |
| Books/library | `apps/client/src/services/api/books.ts` |
| Reading sessions/progress | `apps/client/src/services/api/reading.ts`, `apps/client/src/services/api/progress.ts` |
| Dashboard/analytics | `apps/client/src/services/api/dashboard.ts`, `apps/client/src/services/api/analytics.ts` |
| Journals/goals/streaks | `apps/client/src/services/api/journal.ts`, `apps/client/src/services/api/goals.ts`, `apps/client/src/services/api/streaks.ts` |
| Social/activity/readers | `apps/client/src/services/api/social.ts`, `apps/client/src/services/api/activity.ts`, `apps/client/src/services/api/readers.ts` |
| Reviews | `apps/client/src/services/api/reviews.ts` |
| Clubs | `apps/client/src/services/api/clubs.ts` |
| Messaging | `apps/client/src/services/api/messaging.ts` |
| Profiles/onboarding | `apps/client/src/services/api/profiles.ts`, `apps/client/src/services/api/onboarding.ts`, `apps/client/src/services/api/readingProfile.ts` |
| Notifications/storage/sync | `apps/client/src/services/api/notifications.ts`, `apps/client/src/services/api/storage.ts`, `apps/client/src/services/api/sync.ts` |

## Pattern

- API modules own Supabase table/RPC/Edge Function calls.
- Hooks own React state, subscriptions, cache invalidation, and toasts.
- Components own UI and user interaction.
- Offline-first reading writes go through `apps/client/src/utils/offlineOperation.ts` and local repositories.
- Edge Function calls should use `invokeFunction` from `apps/client/src/services/api/client.ts` unless response/error handling needs function-specific behavior.

## Follow-Ups

- Reduce duplicate dashboard data hooks by moving dashboard-only reads into `dashboard-home`.
- Avoid adding new imports from `@/integrations/supabase/client` outside `apps/client/src/services/api`.
- Consider an ESLint no-restricted-import rule after the current backlog pass.

