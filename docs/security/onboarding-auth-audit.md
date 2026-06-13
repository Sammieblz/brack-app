# Onboarding and Auth Write-Path Audit

Source date: 2026-05-05  
Scope: ticket 2.2, auth signup/profile creation/onboarding defaults.

## Current Flow

| Step | Owner | Path | Writes | Notes |
| --- | --- | --- | --- | --- |
| Email sign-up | Supabase Auth via `apps/client/src/services/api/auth.ts` | `signUpWithEmail` | `auth.users` | Client passes optional metadata. |
| Auth trigger | Database | `handle_new_user()` | `profiles` | Creates or updates profile defaults with display/avatar/name and onboarding fields. |
| Profile fallback | App service | `ensureUserProfile` in `apps/client/src/services/onboarding.ts` | `profiles` | If the trigger did not create a row, client upserts a profile with `ignoreDuplicates`. |
| First-run route decision | App service | `shouldEnterFirstRunOnboarding` | None | New accounts after `2026-05-01T00:00:00.000Z` enter onboarding when status is `not_started` or `in_progress`. |
| Mark in progress | API service | `updateOnboardingInProgress` | `profiles` | Only updates `not_started` or `in_progress` profiles. |
| Skip onboarding | App service/API service | `skipOnboarding` | `profiles`, `user_learning_profiles` | Dashboard access remains allowed after status `skipped`. |
| Complete onboarding | App service/API service | `saveOnboardingProfile` | `reading_habits`, `goals`, `notification_preferences`, `user_learning_profiles`, `profiles` | Deactivates active yearly book-count goals, creates one new active goal, then marks profile complete. |

## Determinism

Profile creation is deterministic because:
- `profiles.id` is the user id.
- `handle_new_user()` inserts on auth user creation and uses `ON CONFLICT (id) DO UPDATE`.
- `ensureUserProfile()` reads first and then upserts with `onConflict: "id"` and `ignoreDuplicates: true`.
- Onboarding status has a check constraint limited to `not_started`, `in_progress`, `completed`, and `skipped`.
- Existing profiles were migrated to `completed` so older users are not trapped in first-run onboarding.

## Default Records

| Record | Created automatically? | Current behavior |
| --- | --- | --- |
| `profiles` | Yes | DB trigger, with client fallback. |
| `reading_habits` | No | Created/updated only when onboarding is completed. |
| `user_learning_profiles` | Conditional | Created on skip or completion. |
| `goals` | No | Created on completion only. |
| `notification_preferences` | No | Upserted on completion based on reminder choice. |

## RLS Review

Required onboarding tables have owner-scoped policies:
- `profiles`: owner update/insert and profile-visibility select rules.
- `reading_habits`: owner select/insert/update/delete.
- `user_learning_profiles`: owner select/insert/update/delete.
- `goals`: owner select/insert/update/delete.
- `notification_preferences`: owner select/insert/update.

No missing RLS policy was identified from the current remote matrix. `profiles` remains the most sensitive surface because public/followers/private read behavior is mixed with owner settings.

## Risks

- The auth trigger has existed in multiple migrations. The latest definition in `20260501010000_unified_onboarding_flow.sql` should be treated as canonical.
- Completion is not one database transaction. `saveOnboardingProfile` performs several sequential client-side writes, so a network failure can leave habits/goals/preferences saved while profile status remains `in_progress`.
- `skipOnboarding` tolerates learning-profile write failure and still saves skipped status. This is intentional for dashboard access, but setup confidence can be missing.
- Controlled remote Auth tests verified profile creation and cleanup:
  - Direct auth-table trigger validation inserted and removed a temporary `auth.users` row.
  - Supabase Admin Auth creation inserted and removed a temporary Auth user through the Auth service.
  - Both paths verified `handle_new_user()` creates one profile with `onboarding_status = 'not_started'` and `onboarding_version = 1`.

## Test Checklist

Remote validation completed on 2026-05-05:
- Controlled auth insert created `auth.users` and exactly one `profiles` row.
- Supabase Admin Auth creation created an Auth user and exactly one `profiles` row.
- Initial `profiles.onboarding_status` was `not_started`.
- Initial `profiles.onboarding_version` was `1`.
- Test auth/profile records were cleaned up.

Manual UI release smoke outside this backlog checklist:
- New account routes to `/onboarding`.
- Skip writes `profiles.onboarding_status = 'skipped'` and allows `/dashboard`.
- Complete writes `reading_habits`, `user_learning_profiles`, one active `books_count` goal, notification preferences, and `profiles.onboarding_status = 'completed'`.
- Existing users created before 2026-05-01 bypass forced onboarding.
