# Streak Rules

Source date: 2026-05-05  
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

Current implementation uses database/client UTC dates:
- Backend streak refresh casts timestamps to `DATE`.
- Frontend display helpers use `new Date().toISOString().split("T")[0]`.
- `use_reading_streak_freeze` defaults to `CURRENT_DATE`.

Product rule for now:
- Brack treats the streak day as a UTC calendar day until per-user timezone support is added.

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
