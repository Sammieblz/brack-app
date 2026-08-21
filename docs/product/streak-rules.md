# Streak Rules

Source date: 2026-05-05

Last UI review: 2026-08-16
Scope: ticket 3.4, valid reading days, timezone handling, backfill, and ownership.

## Valid Reading Day

A day counts toward a reading streak when `reading_streak_days` has at least one of:
- `session_count > 0`
- `progress_log_count > 0`
- `used_freeze = true`

Reading activity sources:
- `reading_sessions`, grouped by `COALESCE(start_time, created_at)::DATE`
- `progress_logs`, grouped by `logged_at::DATE`

Non-counting actions:
- Direct `books` updates.
- Quick progress updates that only write `books.current_page`.
- Journal entries.
- Goal edits.
- Review/social actions.

## Current Streak

- If today has a streak day, count backward from today.
- Otherwise, if yesterday has a streak day, count backward from yesterday.
- Otherwise, current streak is `0`.
- Freeze days bridge streaks only when no reading activity exists for that date.

## Longest Streak

- Sort all streak days ascending.
- Count contiguous dates.
- `profiles.longest_streak` is preserved as a floor so historical bests are not lowered by partial backfills.
- New best streaks insert `reading_streak_history` rows from backend recalculation.

## Timezone Handling

Core reading-activity persistence still uses database/client UTC dates:
- Backend streak refresh casts timestamps to `DATE`.
- The reusable activity-calendar helper uses
  `new Date().toISOString().split("T")[0]`.

Journey-aware behavior is timezone-aware:

- `use_reading_streak_freeze` resolves and validates the current day from
  `profiles.timezone`, and checks session/progress timestamps in that timezone.
- Dashboard Home corrects its visual date boundary with Journey `server_time`,
  response receipt time, and the Journey/profile timezone.

The mixed model is why the Dashboard presentation is a read-only guard rather
than a new source of truth. A future migration must make canonical
`reading_streak_days` generation timezone-native before removing the UTC
compatibility behavior.

Future timezone migration:
- Add `profiles.timezone` or a dedicated user settings field.
- Resolve activity dates with the user's timezone in `refresh_reading_streak_day`.
- Store the resolved local date in `reading_streak_days.activity_date`.
- Backfill affected users by replaying sessions/progress logs through the timezone-aware resolver.

## Backfill Behavior

Existing backfill path:
- `20260430010000_add_reading_streak_days.sql` populates streak days from historical sessions and progress logs.
- `20260430020000_sync_profile_streaks_from_activity.sql` recalculates profile streak fields from `reading_streak_days`.

Future backfills should:
- Recompute `reading_streak_days` from source tables.
- Preserve freeze days unless the target date has real reading activity.
- Re-run `recalculate_user_reading_streak` per affected user.
- Avoid client-side writes to profile streak fields.

## Ownership

Streak persistence is backend-owned:
- `refresh_reading_streak_day`
- `sync_reading_streak_day_from_session`
- `sync_reading_streak_day_from_progress_log`
- `sync_profile_streak_from_reading_streak_day`
- `recalculate_user_reading_streak`
- `complete_reading_transaction`
- `use_reading_streak_freeze`

Frontend responsibility:
- Fetch streak days/profile.
- Calculate display state and activity calendar.
- Call `use_reading_streak_freeze` for freeze actions.
- Never directly update `profiles.current_streak`, `profiles.longest_streak`, or `profiles.last_reading_date`.

## Authenticated Home presentation

Home maps the persisted summary to five explicit visual states:

| State | Brack artwork | Meaning | Primary action |
| --- | --- | --- | --- |
| Secure today | Happy flame | Reading is recorded for the current streak day. | Keep reading. |
| Protected today | Happy flame | A server-confirmed Freeze covers the current day. | Read anyway or return tomorrow. |
| Needs a page today | Sad flame | Yesterday is contiguous and today's action is still missing. | Read/log progress; optionally request a Freeze. |
| Start today | Sad flame | No streak exists yet. | Complete a timer session or save progress. |
| Fresh chapter | Sad flame | A gap ended the current run; the personal best remains. | Start a new streak. |

The state calculation lives in `apps/client/src/lib/dashboardStreak.ts`. It uses
the combined Dashboard/Journey response, server clock receipt time, and the
profile/Journey timezone. It also treats an old non-zero `profiles.current_streak`
as lapsed once `last_reading_date` is older than yesterday; profile streaks are
event-updated and otherwise may not decay exactly at midnight.

Freeze eligibility is never decided by this presentation helper. Home offers
the action only during the at-risk state, then `use_reading_streak_freeze`
validates ownership, inventory, current date, reading activity, prior-day
continuity, and cooldown atomically. Cached inventory is display-only.

### Completion feedback

Home celebrates a streak only when a mounted, authenticated Dashboard observes
a **live server-confirmed** transition from no reading today to reading today.
The first authoritative response establishes a baseline even when today is
already complete; it never replays historical work on a cold load. Cached,
expired, provisional, Freeze-protected, and initial snapshots do not trigger
the animation.

The completion overlay uses the existing transparent happy-flame asset for an
approximately two-second, theme-aware 3D reveal. It can be dismissed by tapping
anywhere, pressing Escape, or using its 44px close control. It announces the
result once, emits one short success haptic, and substitutes a static treatment
when the operating system requests reduced motion.
