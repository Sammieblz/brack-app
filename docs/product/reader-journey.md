# Reader Journey: Ink, Quests, and Reader Leagues

Reader Journey is Brack's server-authoritative reading progression system. It is
available at `/achievements`; the route is retained for compatibility while the
product label is **Journey**.

## Currency and Progression

- **Ink** is permanent experience. It never resets.
- **Competitive Ink** is the weekly leaderboard subset of Ink. It resets by
  week and is capped at 150 per user's local day before quest bonuses.
- **Gold Leaves** are prestige currency. They are not spendable in v1.
- Levels come from `gamification_levels`; clients must not calculate thresholds
  from a hardcoded formula.
- Reward values come from `gamification_reward_rules`; clients must not award or
  infer rewards.

`gamification_ledger` is the source of truth. Its unique
`(user_id, event_key)` constraint makes canonical reading retries exactly once.
Reading sessions, progress logs, status transitions, streak days, badges,
quests, and league podiums emit stable event keys.

Imported/restored/duplicate books and progress corrections do not earn rewards.
Offline activity earns rewards only after the canonical reading mutation reaches
Supabase.

## Badge Progression

Reader Journey includes 51 server-owned badges across eight categories:

- Collection
- Completion
- Streaks
- Reading time
- Pages
- Exploration
- Reading craft
- Journey

Each `badges` row has a stable code, tier, rarity, metric key, target, event
scope, icon key, and display order. `award_badges()` evaluates canonical reading
and Journey records; clients cannot insert `user_badges`.

`get_user_badge_catalog()` returns the full active catalog with current progress
and earned state. Badges are idempotent through the unique
`user_badges(user_id, badge_id)` index. Existing users receive newly applicable
badges as a historical backfill, but those backfilled awards do not mint Ink,
send notifications, or publish social activity. Future organic awards grant the
normal badge Ink reward and create one durable notification.
Badge push delivery can be disabled independently in Notification settings;
the durable in-app notification remains available.

Rarity is descriptive, not random:

- Common: early progression
- Uncommon: established habits
- Rare: substantial milestones
- Epic: long-term accomplishments
- Legendary: the highest category milestones

## Quest Generation

`ensure_user_quests()` lazily creates:

- three daily assignments for the user's current local date;
- three prefetched assignments for tomorrow;
- three weekly assignments beginning Monday in the user's stored IANA timezone.

Targets use the previous 28 days of sessions and progress. Velocity targets use
the median qualifying pace and require at least 15 minutes and five net pages.
Templates that need page counts, near-complete books, series metadata, or a
velocity baseline are excluded when those signals are unavailable.

Selection is deterministic and weighted. Recent templates are deprioritized by
their configured cooldown; if an eligible pool is too small, the oldest prior
template is reused instead of returning fewer than three quests. At most one
Gold Leaf quest can appear in a weekly set.

Quest progress is protected by `user_quest_progress_events`. The same source
event can advance a daily and weekly assignment once each, but retries cannot
advance either assignment twice. Rewards are automatic.

## Reader Leagues

Reader Leagues are opt-in. A new opt-in becomes eligible on the next UTC weekly
cycle.

League tiers:

1. Bookmark
2. Paperback
3. Hardcover
4. Collector
5. First Edition

Users are assigned deterministically into groups of approximately 50. Rankings
use:

1. Competitive Ink
2. Completed quests
3. Qualifying reading minutes
4. Distinct reading days
5. Earliest attainment of the final score

The week closes Monday at 00:00 UTC and accepts canonical offline mutations for
12 hours. After finalization, late activity still earns lifetime Ink but cannot
change the closed leaderboard. The top 10 promote, the bottom 10 demote, and
small groups avoid overlapping promotion/demotion bands.

Global and friends leaderboards include only opted-in eligible users. Friends
means mutual follows. Blocks are filtered in both directions. Private Journey
profiles are anonymized.

## Queue and Scheduled Work

The migration enables Supabase Cron, `pg_net`, and Supabase Queues (`pgmq`).
Cron only enqueues short jobs:

- weekly rollover/finalization checks;
- hourly local-time quest reminders;
- 90-day quest detail compaction.

`gamification-worker` drains `gamification_jobs`, retries failed jobs with queue
visibility timeouts, and discards poison jobs after five reads. Durable in-app
notifications remain in `user_notifications` even when FCM delivery fails.

Required backend secrets:

- `FCM_SERVICE_ACCOUNT_JSON`
- `GAMIFICATION_WORKER_SECRET`

Vault secrets used to create the hosted worker cron invocation:

- `project_url`
- `gamification_worker_secret`

## Feature Flags

- `gamification`: disables Journey UI without changing reading data.
- `leaderboards`: independently disables public rankings while Ink and quests
  continue.

Frontend fallbacks use `VITE_GAMIFICATION_ENABLED` and
`VITE_LEADERBOARDS_ENABLED`.

## Offline Behavior

The latest Journey home and leaderboard snapshots are cached per authenticated
user. Pending reading-core outbox mutations mark Journey values provisional.
Gamification preferences share the existing local `profile_preferences` entity
and sync through `sync-push`.

Journey refreshes should not poll or invalidate aggressively while reading-core
sync has unresolved work. The client only invalidates `gamification-home` after
sync status is clean (`pending = 0`, `syncing = 0`, `failed = 0`) and throttles
that invalidation. Failed sync-review items are not auto-retried, so a stale
timer validation failure cannot create a `gamification-home` 429 loop.

## Reconciliation

`reconcile_gamification_user(user_id)` compares canonical reading counts with
ledger event counts. It is service-role only and is intended for operational
audits, not client use.
