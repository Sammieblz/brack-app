# Onboarding and Auth Write-Path Audit

Source date: 2026-08-27

Scope: onboarding-first acquisition, Auth signup/profile creation, idempotent
draft finalization, and post-signup permission routing.

## Current Flow

| Step | Owner | Path | Writes | Notes |
| --- | --- | --- | --- | --- |
| Start acquisition | Landing/client router | `Get Started` -> `/onboarding` | None | Anonymous onboarding is allowed; Sign In remains a direct Auth path. |
| Collect onboarding | `apps/client/src/services/onboardingDraft.ts` | Anonymous `/onboarding` | Active-process memory only | Schema-validated object with a UUID flow id; no browser/native persistence and no database call. |
| Begin signup | Auth screen | `/auth?mode=signup&from=onboarding` | In-memory attempt metadata | Direct signup requires a ready completed-or-skipped draft. Email attempts bind the normalized email; OAuth attempts bind the provider and time window. |
| Email sign-up | Supabase Auth via `apps/client/src/services/api/auth.ts` | `signUpWithEmail` | `auth.users` | One normalized `signUp` request; duplicate UI derives from explicit/obfuscated Auth responses. |
| Auth trigger | Database | `handle_new_user()` | `profiles` | Creates or updates profile defaults with display/avatar/name and onboarding fields. |
| Profile fallback | App service | `ensureUserProfile` in `apps/client/src/services/onboarding.ts` | `profiles` | If the trigger did not create a row, client upserts a profile with `ignoreDuplicates`. |
| Post-auth decision | `resolvePostAuthPath` | Auth callback, sign-in, and restored session | None | Checks a pending native permission intro, ensures the profile, validates any bound draft, and returns one canonical destination. |
| Draft finalization | `resolvePostAuthPath` / onboarding service | Verified new account with a bound draft | Onboarding tables below | Single-flight; applies skip or completion only to a qualifying newly created account. Uses the authenticated user UUID as the stable onboarding-goal row ID. |
| First-run fallback | App service | `shouldEnterFirstRunOnboarding` | None | A new account without an applicable in-memory draft enters authenticated onboarding. Existing accounts are not overwritten by a guest draft. |
| Mark in progress | API service | `updateOnboardingInProgress` | `profiles` | Only updates `not_started` or `in_progress` profiles. |
| Skip onboarding | App service/API service | `skipOnboarding` | `profiles`, `user_learning_profiles` | Dashboard access remains allowed after status `skipped`. |
| Complete onboarding | App service/API service | `saveOnboardingProfile` | `reading_habits`, `goals`, `notification_preferences`, `user_learning_profiles`, `profiles` | Deactivates active yearly book-count goals, creates one new active goal, then marks profile complete. |
| Native permission education | Client-only `/app-permissions` | Capacitor iOS/Android | Per-user/device local marker; push token only after consent | Optional; web/PWA/Electron bypass it. Camera/photos/location remain contextual. |

## Determinism

Profile creation is deterministic because:
- Anonymous answers are isolated in a schema-validated version-1 memory draft.
  A new document/app process starts empty, and invalid/future-version records
  are removed rather than partially interpreted.
- The draft contains onboarding answers and narrowly scoped attempt metadata,
  never a password, session, access/refresh token, Turnstile token, or backend
  credential.
- Auth finalization verifies the account creation time and email/provider bind,
  then requires first-run profile status before applying the draft. A stale
  guest draft cannot mutate an established account.
- `profiles.id` is the user id.
- `profiles.id` is both the primary key and the cascading foreign key to
  `auth.users.id`; `profiles` intentionally has no email column.
- `handle_new_user()` inserts on auth user creation and uses `ON CONFLICT (id) DO UPDATE`.
- `ensureUserProfile()` reads first and then upserts with `onConflict: "id"` and `ignoreDuplicates: true`.
- Onboarding status has a check constraint limited to `not_started`, `in_progress`, `completed`, and `skipped`.
- Existing profiles were migrated to `completed` so older users are not trapped in first-run onboarding.
- The authenticated user UUID becomes the onboarding-created goal id. Repeating
  or restarting finalization upserts that same goal instead of inserting
  another one.

## Default Records

| Record | Created automatically? | Current behavior |
| --- | --- | --- |
| `profiles` | Yes | DB trigger, with client fallback. |
| `reading_habits` | No | Created/updated only when onboarding is completed. |
| `user_learning_profiles` | Conditional | Created on skip or completion. |
| `goals` | No | Created on completion only. |
| `notification_preferences` | No | Upserted on completion based on reminder choice. |

### Process-only state

The pre-auth draft exists only in the current module runtime. It is never
written to `localStorage`, `sessionStorage`, IndexedDB, SQLite, or Supabase, and
is cleared after successful finalization or an explicit flow exit. A browser
refresh, tab close, desktop renderer termination, or mobile process exit starts
empty. The old `brack:pre-auth-onboarding:v1` localStorage key is proactively
removed and never hydrated. Email signup cancellation may return the current
in-memory attempt to `ready` for a retry, but choosing Sign In or returning to
the landing page abandons it.

Web/PWA Google signup preserves the requesting document with a controlled
provider window. The callback transports only a same-origin completion signal;
it does not serialize the onboarding payload. If the requesting document no
longer exists, the verified account falls back to authenticated onboarding.
The server never treats a client draft as proof of identity.

Native permission education uses a separate per-user/device marker. That marker
does not store OS permission grants and is not part of `profiles`. Cloudflare
Turnstile state is also separate: a fresh single-use captcha token protects the
Auth request and is never written into either local record.

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
- Completion is not one database transaction. `saveOnboardingProfile` performs
  several sequential owner-scoped writes, so a network failure can leave
  habits/goals/preferences saved while profile status remains `in_progress`.
  The finalizer keeps the draft for an authenticated retry, and the stable goal
  UUID prevents duplicate goals, but the retry path must remain tested.
- Reloading or leaving the owning document/app process removes the anonymous
  draft by design. The supported fallback after a completed Auth callback is
  authenticated onboarding, never a partial server-side anonymous draft.
- `skipOnboarding` tolerates learning-profile write failure and still saves skipped status. This is intentional for dashboard access, but setup confidence can be missing.
- Controlled remote Auth tests verified profile creation and cleanup:
  - Direct auth-table trigger validation inserted and removed a temporary `auth.users` row.
  - Supabase Admin Auth creation inserted and removed a temporary Auth user through the Auth service.
  - Both paths verified `handle_new_user()` creates one profile with `onboarding_status = 'not_started'` and `onboarding_version = 1`.
- Repeated email signup is intentionally obfuscated by Supabase Auth. Brack maps
  explicit existence codes and the empty-identities response from its single
  `signUp` request to **Email already exists** and **This email is already used
  by another reader.** Changing submitted names or passwords cannot create or
  update another profile.
- The public `auth-email-availability` endpoint and service-role-only
  `public.auth_email_exists(text)` predicate remain temporarily for rollback and
  older clients, but they are not on the active write path. Preserve their
  rate limits and grants until a later release/migration removes them after
  supported-client telemetry shows no callers.
- A 2026-08-23 hosted audit found 0 normalized duplicate Auth email groups,
  0 identity emails mapped across users, 0 missing/orphaned profiles, and 2
  recent `user_repeated_signup` events with no Auth/profile inserts or updates.
- Production contracts now fail on duplicate non-SSO Auth emails, cross-user
  identity email mappings, broken profile-to-Auth linkage, or missing identity
  PK/FK/trigger enforcement.

## Device-token ownership

Push registration happens only after an authenticated reader explicitly grants
notifications. `public.claim_push_token(text, text)` atomically assigns an
installation token to `auth.uid()`; a global token uniqueness constraint means
one device token cannot remain attached to two readers after an account switch.
The function validates token/platform input, has a fixed empty `search_path`,
revokes `PUBLIC`/`anon`, and grants execution only to `authenticated`.

The owner UPDATE policy has both `USING` and `WITH CHECK`. Sign-out removes the
current installation token while the session can still authorize the delete,
then unregisters the native provider. It does not delete tokens belonging to
the reader's other devices.

## Test Checklist

Remote validation completed on 2026-05-05:
- Controlled auth insert created `auth.users` and exactly one `profiles` row.
- Supabase Admin Auth creation created an Auth user and exactly one `profiles` row.
- Initial `profiles.onboarding_status` was `not_started`.
- Initial `profiles.onboarding_version` was `1`.
- Test auth/profile records were cleaned up.

Manual UI release smoke outside this backlog checklist:
- Landing **Get Started** enters anonymous onboarding, while **Sign In** remains
  a direct established-reader path.
- Reload restores a valid draft at the saved step; malformed, incompatible, or
  expired drafts are discarded without a database write.
- Direct signup without a ready onboarding draft returns to onboarding.
- One submission sends one Supabase Auth signup request; there is no separate
  email-availability call.
- Known confirmed, unconfirmed, and Google-created emails map explicit or
  obfuscated repeated-signup responses to the duplicate copy without creating
  or updating an Auth user/profile.
- A new email proceeds to normal confirmation and creates exactly one Auth
  user/profile.
- Auth delivery/request `429` responses are caught, shown once, and never
  automatically retried; failed attempts create no user/profile.
- A verified new account with a completed draft writes `reading_habits`,
  `user_learning_profiles`, one stable active `books_count` goal, notification
  preferences, and `profiles.onboarding_status = 'completed'` before routing.
- A verified new account with a skipped draft writes skipped status without
  inventing completed answers.
- A missing or rejected draft routes a qualifying new account to authenticated
  `/onboarding`; an established account bypasses it without consuming the draft.
- Finalization failure retains the draft and `/onboarding?resume=draft` retry
  creates no duplicate goal.
- Capacitor sends a successfully finalized new reader to optional
  `/app-permissions`; web/PWA/Electron go directly to `/dashboard`.
- Notifications are never requested on app boot. Denial is respected; timer
  start is the contextual retry. Camera/photo/location prompts occur only from
  the corresponding feature action.
- Existing users created before 2026-05-01 bypass forced onboarding.
