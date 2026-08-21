-- Brack Ink, personalized quests, and weekly Reader Leagues.
-- All rewards are derived from canonical reading rows and protected by
-- per-user event keys so retries and offline synchronization are exactly once.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgmq;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS leaderboard_opt_in BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS leaderboard_eligible_from DATE,
ADD COLUMN IF NOT EXISTS gamification_profile_visible BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.books
ADD COLUMN IF NOT EXISTS series_name TEXT,
ADD COLUMN IF NOT EXISTS series_position NUMERIC(8, 2),
ADD COLUMN IF NOT EXISTS series_total INTEGER;

CREATE INDEX IF NOT EXISTS idx_books_user_series_active
ON public.books(user_id, lower(series_name), series_position)
WHERE deleted_at IS NULL AND series_name IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.gamification_reward_rules (
  event_type TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  base_ink INTEGER NOT NULL DEFAULT 0 CHECK (base_ink >= 0),
  competitive BOOLEAN NOT NULL DEFAULT false,
  daily_event_limit INTEGER,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gamification_levels (
  level INTEGER PRIMARY KEY CHECK (level > 0),
  title TEXT NOT NULL,
  ink_threshold BIGINT NOT NULL UNIQUE CHECK (ink_threshold >= 0),
  accent_key TEXT NOT NULL DEFAULT 'primary',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gamification_accounts (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  lifetime_ink BIGINT NOT NULL DEFAULT 0 CHECK (lifetime_ink >= 0),
  gold_leaves INTEGER NOT NULL DEFAULT 0 CHECK (gold_leaves >= 0),
  current_level INTEGER NOT NULL DEFAULT 1 REFERENCES public.gamification_levels(level),
  last_reward_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gamification_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  event_type TEXT NOT NULL REFERENCES public.gamification_reward_rules(event_type),
  source_type TEXT,
  source_id TEXT,
  ink_delta INTEGER NOT NULL DEFAULT 0,
  competitive_ink_delta INTEGER NOT NULL DEFAULT 0,
  gold_leaves_delta INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gamification_ledger_user_event_key UNIQUE (user_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_gamification_ledger_user_created
ON public.gamification_ledger(user_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_gamification_ledger_event_type_created
ON public.gamification_ledger(event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.gamification_daily_scores (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score_date DATE NOT NULL,
  competitive_ink INTEGER NOT NULL DEFAULT 0 CHECK (competitive_ink >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, score_date)
);

CREATE TABLE IF NOT EXISTS public.gamification_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL UNIQUE,
  week_end DATE NOT NULL,
  scoring_closes_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('scheduled', 'active', 'grace', 'finalized')),
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gamification_weekly_scores (
  week_id UUID NOT NULL REFERENCES public.gamification_weeks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  competitive_ink BIGINT NOT NULL DEFAULT 0 CHECK (competitive_ink >= 0),
  quests_completed INTEGER NOT NULL DEFAULT 0 CHECK (quests_completed >= 0),
  qualifying_minutes INTEGER NOT NULL DEFAULT 0 CHECK (qualifying_minutes >= 0),
  reading_days INTEGER NOT NULL DEFAULT 0 CHECK (reading_days >= 0),
  score_attained_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (week_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gamification_weekly_scores_rank
ON public.gamification_weekly_scores(
  week_id,
  competitive_ink DESC,
  quests_completed DESC,
  qualifying_minutes DESC,
  reading_days DESC,
  score_attained_at ASC,
  user_id
);

CREATE TABLE IF NOT EXISTS public.quest_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description_template TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly')),
  metric TEXT NOT NULL CHECK (
    metric IN (
      'reading_minutes',
      'pages_read',
      'reading_days',
      'sessions',
      'books_completed',
      'velocity',
      'series_books_completed'
    )
  ),
  minimum_target NUMERIC NOT NULL CHECK (minimum_target > 0),
  maximum_target NUMERIC NOT NULL CHECK (maximum_target >= minimum_target),
  reward_ink_min INTEGER NOT NULL CHECK (reward_ink_min >= 0),
  reward_ink_max INTEGER NOT NULL CHECK (reward_ink_max >= reward_ink_min),
  gold_leaves_reward INTEGER NOT NULL DEFAULT 0 CHECK (gold_leaves_reward >= 0),
  selection_weight INTEGER NOT NULL DEFAULT 100 CHECK (selection_weight > 0),
  cooldown_days INTEGER NOT NULL DEFAULT 7 CHECK (cooldown_days >= 0),
  eligibility JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_quest_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.quest_templates(id),
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly')),
  assignment_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target_value NUMERIC NOT NULL CHECK (target_value > 0),
  progress_value NUMERIC NOT NULL DEFAULT 0 CHECK (progress_value >= 0),
  reward_ink INTEGER NOT NULL CHECK (reward_ink >= 0),
  reward_gold_leaves INTEGER NOT NULL DEFAULT 0 CHECK (reward_gold_leaves >= 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'expired')),
  completed_at TIMESTAMPTZ,
  reward_event_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_quest_assignment_unique
    UNIQUE (user_id, cadence, assignment_date, template_id)
);

CREATE INDEX IF NOT EXISTS idx_user_quests_user_period
ON public.user_quest_assignments(user_id, cadence, period_start DESC, status);

CREATE INDEX IF NOT EXISTS idx_user_quests_expiration
ON public.user_quest_assignments(status, period_end)
WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.user_quest_progress_events (
  assignment_id UUID NOT NULL REFERENCES public.user_quest_assignments(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  increment_value NUMERIC NOT NULL CHECK (increment_value > 0),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (assignment_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_quest_progress_events_created
ON public.user_quest_progress_events(created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_gamification_week_summaries (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  quests_assigned INTEGER NOT NULL DEFAULT 0,
  quests_completed INTEGER NOT NULL DEFAULT 0,
  quest_ink_earned INTEGER NOT NULL DEFAULT 0,
  gold_leaves_earned INTEGER NOT NULL DEFAULT 0,
  competitive_ink BIGINT NOT NULL DEFAULT 0,
  final_league_name TEXT,
  final_rank INTEGER,
  movement TEXT CHECK (movement IN ('promoted', 'retained', 'demoted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_start)
);

CREATE TABLE IF NOT EXISTS public.reader_leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID NOT NULL REFERENCES public.gamification_weeks(id) ON DELETE CASCADE,
  tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 5),
  group_number INTEGER NOT NULL CHECK (group_number > 0),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'finalized')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reader_leagues_week_tier_group_unique
    UNIQUE (week_id, tier, group_number)
);

CREATE TABLE IF NOT EXISTS public.reader_league_members (
  league_id UUID NOT NULL REFERENCES public.reader_leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  starting_tier INTEGER NOT NULL CHECK (starting_tier BETWEEN 1 AND 5),
  provisional_rank INTEGER,
  final_rank INTEGER,
  final_score BIGINT,
  movement TEXT CHECK (movement IN ('promoted', 'retained', 'demoted')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalized_at TIMESTAMPTZ,
  PRIMARY KEY (league_id, user_id),
  CONSTRAINT reader_league_members_user_week_unique UNIQUE (user_id, league_id)
);

CREATE INDEX IF NOT EXISTS idx_reader_league_members_user
ON public.reader_league_members(user_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key TEXT,
  read_at TIMESTAMPTZ,
  push_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (push_status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),
  push_attempts INTEGER NOT NULL DEFAULT 0,
  last_push_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  CONSTRAINT user_notifications_dedupe UNIQUE (user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_inbox
ON public.user_notifications(user_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_push_pending
ON public.user_notifications(push_status, created_at)
WHERE push_status IN ('pending', 'failed');

ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS quests_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS rank_movement_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS weekly_results_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS gold_leaves_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.gamification_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_daily_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_weekly_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_quest_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_quest_progress_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_gamification_week_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reader_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reader_league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_reward_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their gamification account"
ON public.gamification_accounts FOR SELECT
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can read their Ink history"
ON public.gamification_ledger FOR SELECT
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can read their daily score"
ON public.gamification_daily_scores FOR SELECT
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Authenticated users can read gamification weeks"
ON public.gamification_weeks FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can read their weekly score"
ON public.gamification_weekly_scores FOR SELECT
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Authenticated users can read quest templates"
ON public.quest_templates FOR SELECT TO authenticated
USING (enabled = true);

CREATE POLICY "Users can read their quests"
ON public.user_quest_assignments FOR SELECT
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can read their quest progress events"
ON public.user_quest_progress_events FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_quest_assignments assignments
    WHERE assignments.id = user_quest_progress_events.assignment_id
      AND assignments.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Users can read their gamification week summaries"
ON public.user_gamification_week_summaries FOR SELECT
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Authenticated users can read leagues"
ON public.reader_leagues FOR SELECT TO authenticated
USING (true);

CREATE POLICY "League members can read visible league members"
ON public.reader_league_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.reader_league_members viewer_membership
    WHERE viewer_membership.league_id = reader_league_members.league_id
      AND viewer_membership.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Users can read their notifications"
ON public.user_notifications FOR SELECT
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their notifications"
ON public.user_notifications FOR UPDATE
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Authenticated users can read reward rules"
ON public.gamification_reward_rules FOR SELECT TO authenticated
USING (enabled = true);

CREATE POLICY "Authenticated users can read levels"
ON public.gamification_levels FOR SELECT TO authenticated
USING (true);

INSERT INTO public.gamification_reward_rules (
  event_type,
  display_name,
  base_ink,
  competitive,
  daily_event_limit,
  config
)
VALUES
  ('book_added', 'Book added', 5, false, 3, '{"exclude_imports":true}'::jsonb),
  ('book_started', 'Book started', 15, true, NULL, '{}'::jsonb),
  ('reading_session', 'Reading session', 0, true, NULL, '{"ink_per_minutes":5,"max_ink":12}'::jsonb),
  ('page_progress', 'Page progress', 0, true, NULL, '{"ink_per_pages":5,"max_ink":20}'::jsonb),
  ('daily_activity', 'First reading activity', 10, true, 1, '{}'::jsonb),
  ('book_completed', 'Book completed', 75, true, NULL, '{"max_length_bonus":50}'::jsonb),
  ('series_milestone', 'Series milestone', 0, true, NULL, '{}'::jsonb),
  ('streak_milestone', 'Streak milestone', 0, false, NULL, '{}'::jsonb),
  ('badge_earned', 'Badge earned', 20, false, NULL, '{}'::jsonb),
  ('quest_completed', 'Quest completed', 0, true, NULL, '{}'::jsonb),
  ('weekly_quest_bonus', 'Weekly quest set completed', 250, true, 1, '{"gold_leaves":1}'::jsonb),
  ('league_podium', 'Reader League podium', 0, false, NULL, '{}'::jsonb),
  ('historical_backfill', 'Historical reading credit', 0, false, 1, '{}'::jsonb)
ON CONFLICT (event_type) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  base_ink = EXCLUDED.base_ink,
  competitive = EXCLUDED.competitive,
  daily_event_limit = EXCLUDED.daily_event_limit,
  config = EXCLUDED.config,
  enabled = true,
  updated_at = now();

INSERT INTO public.gamification_levels(level, title, ink_threshold, accent_key)
VALUES
  (1, 'Fresh Ink', 0, 'muted'),
  (2, 'Page Turner', 100, 'primary'),
  (3, 'Bookbound', 293, 'chart-2'),
  (4, 'Shelf Keeper', 549, 'chart-3'),
  (5, 'Archivist', 858, 'chart-4'),
  (6, 'Master Reader', 1211, 'chart-5'),
  (7, 'Story Scholar', 1603, 'primary'),
  (8, 'Library Luminary', 2029, 'chart-2'),
  (9, 'First Edition', 2488, 'chart-3'),
  (10, 'Brack Laureate', 2976, 'chart-4'),
  (11, 'Brack Laureate II', 3492, 'chart-5'),
  (12, 'Brack Laureate III', 4036, 'primary'),
  (13, 'Brack Laureate IV', 4605, 'chart-2'),
  (14, 'Brack Laureate V', 5198, 'chart-3'),
  (15, 'Brack Laureate VI', 5815, 'chart-4'),
  (16, 'Brack Laureate VII', 6454, 'chart-5'),
  (17, 'Brack Laureate VIII', 7116, 'primary'),
  (18, 'Brack Laureate IX', 7800, 'chart-2'),
  (19, 'Brack Laureate X', 8506, 'chart-3'),
  (20, 'Living Library', 9233, 'chart-4')
ON CONFLICT (level) DO UPDATE SET
  title = EXCLUDED.title,
  ink_threshold = EXCLUDED.ink_threshold,
  accent_key = EXCLUDED.accent_key;

INSERT INTO public.quest_templates (
  code,
  title,
  description_template,
  cadence,
  metric,
  minimum_target,
  maximum_target,
  reward_ink_min,
  reward_ink_max,
  gold_leaves_reward,
  selection_weight,
  cooldown_days,
  eligibility
)
VALUES
  ('daily_read_minutes', 'Settle In', 'Read for {target} minutes today.', 'daily', 'reading_minutes', 10, 45, 20, 40, 0, 120, 7, '{}'),
  ('daily_read_pages', 'Turn the Page', 'Read {target} pages today.', 'daily', 'pages_read', 5, 35, 20, 40, 0, 115, 7, '{"requires_pages":true}'),
  ('daily_reading_day', 'Open a Book', 'Record meaningful reading activity today.', 'daily', 'reading_days', 1, 1, 20, 20, 0, 100, 7, '{}'),
  ('daily_session', 'Focused Chapter', 'Complete {target} reading session today.', 'daily', 'sessions', 1, 2, 20, 35, 0, 105, 7, '{}'),
  ('daily_velocity', 'Find Your Flow', 'Sustain at least {target} pages per hour in a qualifying session.', 'daily', 'velocity', 5, 120, 30, 40, 0, 55, 14, '{"requires_velocity_baseline":true}'),
  ('daily_read_minutes_steady', 'Steady Ink', 'Read for {target} focused minutes today.', 'daily', 'reading_minutes', 10, 45, 20, 40, 0, 105, 7, '{}'),
  ('daily_read_minutes_chapter', 'Chapter Time', 'Give a book {target} minutes today.', 'daily', 'reading_minutes', 10, 45, 20, 40, 0, 100, 7, '{}'),
  ('daily_read_minutes_quiet', 'Quiet Pages', 'Set aside {target} minutes for reading today.', 'daily', 'reading_minutes', 10, 45, 20, 40, 0, 95, 7, '{}'),
  ('daily_read_minutes_deep', 'Deep Read', 'Build a {target}-minute reading block today.', 'daily', 'reading_minutes', 15, 50, 25, 40, 0, 85, 7, '{}'),
  ('daily_pages_next_chapter', 'Next Chapter', 'Move forward by {target} pages today.', 'daily', 'pages_read', 5, 35, 20, 40, 0, 105, 7, '{"requires_pages":true}'),
  ('daily_pages_stack', 'Page Stack', 'Add {target} pages to today''s reading.', 'daily', 'pages_read', 5, 35, 20, 40, 0, 100, 7, '{"requires_pages":true}'),
  ('daily_pages_momentum', 'Keep the Story Moving', 'Read {target} more pages today.', 'daily', 'pages_read', 5, 35, 20, 40, 0, 95, 7, '{"requires_pages":true}'),
  ('daily_pages_sprint', 'Page Sprint', 'Complete a {target}-page reading sprint.', 'daily', 'pages_read', 5, 30, 20, 35, 0, 85, 7, '{"requires_pages":true}'),
  ('daily_reading_day_return', 'Return to Reading', 'Record one meaningful reading activity today.', 'daily', 'reading_days', 1, 1, 20, 20, 0, 95, 7, '{}'),
  ('daily_reading_day_streak', 'Keep the Thread', 'Keep your reading rhythm active today.', 'daily', 'reading_days', 1, 1, 20, 20, 0, 90, 7, '{}'),
  ('daily_session_focused', 'One Good Session', 'Finish {target} focused reading session today.', 'daily', 'sessions', 1, 2, 20, 35, 0, 100, 7, '{}'),
  ('daily_session_short', 'Make a Reading Window', 'Log {target} reading session today.', 'daily', 'sessions', 1, 2, 20, 35, 0, 95, 7, '{}'),
  ('daily_session_pair', 'Double Bookmark', 'Complete {target} reading sessions today.', 'daily', 'sessions', 1, 2, 25, 40, 0, 80, 7, '{}'),
  ('daily_velocity_flow', 'Reading Cadence', 'Reach {target} pages per hour in a qualifying session.', 'daily', 'velocity', 5, 120, 30, 40, 0, 50, 14, '{"requires_velocity_baseline":true}'),
  ('daily_velocity_pace', 'Pace Check', 'Meet a pace of {target} pages per hour for at least 15 minutes.', 'daily', 'velocity', 5, 120, 30, 40, 0, 45, 14, '{"requires_velocity_baseline":true}'),
  ('daily_session_anchor', 'Reading Anchor', 'Complete {target} deliberate reading session today.', 'daily', 'sessions', 1, 2, 20, 35, 0, 90, 7, '{}'),
  ('weekly_minutes', 'Reading Rhythm', 'Read for {target} minutes this week.', 'weekly', 'reading_minutes', 60, 300, 100, 180, 0, 120, 21, '{}'),
  ('weekly_pages', 'Page by Page', 'Read {target} pages this week.', 'weekly', 'pages_read', 30, 250, 100, 180, 0, 115, 21, '{"requires_pages":true}'),
  ('weekly_days', 'A Week in Books', 'Read on {target} different days this week.', 'weekly', 'reading_days', 3, 7, 120, 200, 0, 120, 21, '{}'),
  ('weekly_sessions', 'Make Time', 'Complete {target} reading sessions this week.', 'weekly', 'sessions', 3, 10, 100, 180, 0, 110, 21, '{}'),
  ('weekly_complete_book', 'Close the Cover', 'Finish {target} book this week.', 'weekly', 'books_completed', 1, 2, 150, 200, 0, 70, 28, '{"requires_near_completion":true}'),
  ('weekly_series', 'Continue the Story', 'Finish {target} book from a tracked series.', 'weekly', 'series_books_completed', 1, 1, 180, 200, 1, 18, 35, '{"requires_series":true,"rare":true}'),
  ('weekly_minutes_consistency', 'Seven-Day Shelf', 'Build {target} minutes of reading this week.', 'weekly', 'reading_minutes', 60, 300, 100, 180, 0, 110, 21, '{}'),
  ('weekly_pages_momentum', 'Weekly Page Trail', 'Advance {target} pages across your books this week.', 'weekly', 'pages_read', 30, 250, 100, 180, 0, 105, 21, '{"requires_pages":true}'),
  ('weekly_days_habit', 'Reading Habit', 'Read on {target} separate days this week.', 'weekly', 'reading_days', 3, 7, 120, 200, 0, 110, 21, '{}'),
  ('weekly_sessions_focus', 'Focused Week', 'Complete {target} purposeful sessions this week.', 'weekly', 'sessions', 3, 10, 100, 180, 0, 100, 21, '{}'),
  ('weekly_complete_book_finish', 'Finish Line', 'Complete {target} nearly finished book this week.', 'weekly', 'books_completed', 1, 2, 150, 200, 0, 65, 28, '{"requires_near_completion":true}'),
  ('weekly_series_next', 'Series Step', 'Complete {target} tracked series book this week.', 'weekly', 'series_books_completed', 1, 1, 180, 200, 1, 14, 35, '{"requires_series":true,"rare":true}')
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  description_template = EXCLUDED.description_template,
  cadence = EXCLUDED.cadence,
  metric = EXCLUDED.metric,
  minimum_target = EXCLUDED.minimum_target,
  maximum_target = EXCLUDED.maximum_target,
  reward_ink_min = EXCLUDED.reward_ink_min,
  reward_ink_max = EXCLUDED.reward_ink_max,
  gold_leaves_reward = EXCLUDED.gold_leaves_reward,
  selection_weight = EXCLUDED.selection_weight,
  cooldown_days = EXCLUDED.cooldown_days,
  eligibility = EXCLUDED.eligibility,
  enabled = true,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.ensure_gamification_week(p_date DATE DEFAULT CURRENT_DATE)
RETURNS public.gamification_weeks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week public.gamification_weeks;
  v_start DATE := date_trunc('week', p_date::TIMESTAMP)::DATE;
BEGIN
  INSERT INTO public.gamification_weeks(
    week_start,
    week_end,
    scoring_closes_at,
    status
  )
  VALUES (
    v_start,
    v_start + 6,
    (v_start + 7)::TIMESTAMPTZ + INTERVAL '12 hours',
    CASE WHEN v_start <= CURRENT_DATE THEN 'active' ELSE 'scheduled' END
  )
  ON CONFLICT (week_start) DO UPDATE SET
    week_end = EXCLUDED.week_end,
    scoring_closes_at = EXCLUDED.scoring_closes_at
  RETURNING * INTO v_week;

  RETURN v_week;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_gamification_notification(
  p_user_id UUID,
  p_notification_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::jsonb,
  p_dedupe_key TEXT DEFAULT NULL
)
RETURNS public.user_notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification public.user_notifications;
BEGIN
  INSERT INTO public.user_notifications(
    user_id,
    notification_type,
    title,
    body,
    data,
    dedupe_key
  )
  VALUES (
    p_user_id,
    p_notification_type,
    p_title,
    p_body,
    COALESCE(p_data, '{}'::jsonb),
    p_dedupe_key
  )
  ON CONFLICT (user_id, dedupe_key)
  DO UPDATE SET
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    data = EXCLUDED.data
  RETURNING * INTO v_notification;

  PERFORM pgmq.send(
    'gamification_jobs',
    jsonb_build_object(
      'kind', 'push_notification',
      'notification_id', v_notification.id
    )
  );

  RETURN v_notification;
END;
$$;

CREATE OR REPLACE FUNCTION public.quest_target_for_user(
  p_user_id UUID,
  p_metric TEXT,
  p_minimum NUMERIC,
  p_maximum NUMERIC,
  p_cadence TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_minutes NUMERIC := 0;
  v_pages NUMERIC := 0;
  v_sessions NUMERIC := 0;
  v_days NUMERIC := 0;
  v_velocity NUMERIC := 0;
  v_multiplier NUMERIC := CASE WHEN p_cadence = 'weekly' THEN 5 ELSE 1 END;
BEGIN
  SELECT
    COALESCE(AVG(GREATEST(duration, 0)), 0),
    COUNT(*)::NUMERIC,
    COUNT(DISTINCT COALESCE(start_time, created_at)::DATE)::NUMERIC
  INTO v_minutes, v_sessions, v_days
  FROM public.reading_sessions
  WHERE user_id = p_user_id
    AND COALESCE(start_time, created_at) >= now() - INTERVAL '28 days';

  WITH ordered_logs AS (
    SELECT
      book_id,
      logged_at,
      id,
      page_number,
      time_spent_minutes,
      LAG(page_number) OVER (PARTITION BY book_id ORDER BY logged_at, id) AS previous_page
    FROM public.progress_logs
    WHERE user_id = p_user_id
      AND logged_at >= now() - INTERVAL '28 days'
  ),
  deltas AS (
    SELECT
      GREATEST(page_number - COALESCE(previous_page, 0), 0) AS pages_delta,
      GREATEST(COALESCE(time_spent_minutes, 0), 0) AS minutes_delta,
      CASE
        WHEN GREATEST(page_number - COALESCE(previous_page, 0), 0) >= 5
          AND GREATEST(COALESCE(time_spent_minutes, 0), 0) >= 15
        THEN
          GREATEST(page_number - COALESCE(previous_page, 0), 0)::NUMERIC
          / (GREATEST(COALESCE(time_spent_minutes, 0), 0)::NUMERIC / 60.0)
        ELSE NULL
      END AS velocity
    FROM ordered_logs
  )
  SELECT
    COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY NULLIF(pages_delta, 0)), 0),
    COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY velocity) FILTER (WHERE velocity IS NOT NULL), 0)
  INTO v_pages, v_velocity
  FROM deltas;

  RETURN CASE p_metric
    WHEN 'reading_minutes' THEN
      LEAST(p_maximum, GREATEST(p_minimum, ROUND(COALESCE(NULLIF(v_minutes, 0), 20) * v_multiplier)))
    WHEN 'pages_read' THEN
      LEAST(p_maximum, GREATEST(p_minimum, ROUND(COALESCE(NULLIF(v_pages, 0), 10) * v_multiplier)))
    WHEN 'reading_days' THEN
      LEAST(p_maximum, GREATEST(p_minimum, CASE WHEN p_cadence = 'weekly' THEN COALESCE(NULLIF(v_days, 0), 3) ELSE 1 END))
    WHEN 'sessions' THEN
      LEAST(p_maximum, GREATEST(p_minimum, CASE WHEN p_cadence = 'weekly' THEN CEIL(COALESCE(NULLIF(v_sessions, 0), 4) / 4) ELSE 1 END))
    WHEN 'velocity' THEN
      LEAST(p_maximum, GREATEST(p_minimum, ROUND(COALESCE(NULLIF(v_velocity, 0), p_minimum) * 0.95)))
    ELSE p_minimum
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_user_quests(
  p_user_id UUID,
  p_reference_time TIMESTAMPTZ DEFAULT now(),
  p_prefetch_tomorrow BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone TEXT := 'UTC';
  v_local_date DATE;
  v_week_start DATE;
  v_target_date DATE;
  v_template public.quest_templates;
  v_target NUMERIC;
  v_reward INTEGER;
  v_daily_count INTEGER;
  v_weekly_count INTEGER;
  v_rare_count INTEGER;
BEGIN
  SELECT COALESCE(NULLIF(timezone, ''), 'UTC')
  INTO v_timezone
  FROM public.profiles
  WHERE id = p_user_id;

  BEGIN
    v_local_date := (p_reference_time AT TIME ZONE v_timezone)::DATE;
  EXCEPTION WHEN invalid_parameter_value THEN
    v_timezone := 'UTC';
    v_local_date := p_reference_time::DATE;
  END;

  v_week_start := date_trunc('week', v_local_date::TIMESTAMP)::DATE;
  PERFORM public.ensure_gamification_week(v_week_start);

  UPDATE public.user_quest_assignments
  SET status = 'expired', updated_at = now()
  WHERE user_id = p_user_id
    AND status = 'active'
    AND period_end < v_local_date;

  FOR v_target_date IN
    SELECT v_local_date
    UNION ALL
    SELECT v_local_date + 1 WHERE p_prefetch_tomorrow
  LOOP
    SELECT COUNT(*) INTO v_daily_count
    FROM public.user_quest_assignments
    WHERE user_id = p_user_id
      AND cadence = 'daily'
      AND assignment_date = v_target_date;

    FOR v_template IN
      SELECT templates.*
      FROM public.quest_templates templates
      LEFT JOIN LATERAL (
        SELECT MAX(recent.assignment_date) AS last_assigned
        FROM public.user_quest_assignments recent
        WHERE recent.user_id = p_user_id
          AND recent.template_id = templates.id
      ) history ON true
      WHERE templates.enabled
        AND templates.cadence = 'daily'
        AND NOT EXISTS (
          SELECT 1 FROM public.user_quest_assignments same_day
          WHERE same_day.user_id = p_user_id
            AND same_day.template_id = templates.id
            AND same_day.assignment_date = v_target_date
        )
        AND (
          NOT COALESCE((templates.eligibility->>'requires_pages')::BOOLEAN, false)
          OR EXISTS (
            SELECT 1 FROM public.books
            WHERE user_id = p_user_id
              AND deleted_at IS NULL
              AND pages > 0
          )
        )
        AND (
          NOT COALESCE((templates.eligibility->>'requires_velocity_baseline')::BOOLEAN, false)
          OR EXISTS (
            SELECT 1 FROM (
              SELECT
                page_number
                  - LAG(page_number) OVER (PARTITION BY book_id ORDER BY logged_at, id) AS page_delta,
                time_spent_minutes
              FROM public.progress_logs
              WHERE user_id = p_user_id
                AND logged_at >= now() - INTERVAL '28 days'
            ) velocity_logs
            WHERE velocity_logs.page_delta >= 5
              AND velocity_logs.time_spent_minutes >= 15
          )
        )
      ORDER BY
        CASE
          WHEN history.last_assigned IS NULL
            OR history.last_assigned < v_target_date - templates.cooldown_days
          THEN 0 ELSE 1
        END,
        history.last_assigned ASC NULLS FIRST,
        (
          hashtextextended(p_user_id::TEXT || v_target_date::TEXT || templates.code, 0)
          & 9223372036854775807
        )::NUMERIC / templates.selection_weight
      LIMIT GREATEST(0, 3 - v_daily_count)
    LOOP
      v_target := public.quest_target_for_user(
        p_user_id,
        v_template.metric,
        v_template.minimum_target,
        v_template.maximum_target,
        'daily'
      );
      v_reward := LEAST(
      v_template.reward_ink_max,
      GREATEST(
        v_template.reward_ink_min,
        v_template.reward_ink_min
          + COALESCE(FLOOR(
                (v_template.reward_ink_max - v_template.reward_ink_min)
                * (
                  (v_target - v_template.minimum_target)
                  / NULLIF(v_template.maximum_target - v_template.minimum_target, 0)
                )
              )::INTEGER, 0)
        )
      );

      INSERT INTO public.user_quest_assignments(
        user_id,
        template_id,
        cadence,
        assignment_date,
        period_start,
        period_end,
        target_value,
        reward_ink,
        reward_gold_leaves
      )
      VALUES (
        p_user_id,
        v_template.id,
        'daily',
        v_target_date,
        v_target_date,
        v_target_date,
        v_target,
        v_reward,
        0
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  SELECT COUNT(*) INTO v_weekly_count
  FROM public.user_quest_assignments
  WHERE user_id = p_user_id
    AND cadence = 'weekly'
    AND assignment_date = v_week_start;

  SELECT COUNT(*) INTO v_rare_count
  FROM public.user_quest_assignments
  WHERE user_id = p_user_id
    AND cadence = 'weekly'
    AND assignment_date = v_week_start
    AND reward_gold_leaves > 0;

  FOR v_template IN
    WITH candidates AS (
      SELECT
        templates AS template_row,
        history.last_assigned,
        CASE
          WHEN history.last_assigned IS NULL
            OR history.last_assigned < v_week_start - templates.cooldown_days
          THEN 0 ELSE 1
        END AS cooldown_priority,
        (
          hashtextextended(p_user_id::TEXT || v_week_start::TEXT || templates.code, 0)
          & 9223372036854775807
        )::NUMERIC / templates.selection_weight AS weighted_order,
        ROW_NUMBER() OVER (
          PARTITION BY (templates.gold_leaves_reward > 0)
          ORDER BY (
            hashtextextended(p_user_id::TEXT || v_week_start::TEXT || templates.code, 0)
            & 9223372036854775807
          )::NUMERIC / templates.selection_weight
        ) AS rarity_order
      FROM public.quest_templates templates
      LEFT JOIN LATERAL (
        SELECT MAX(recent.assignment_date) AS last_assigned
        FROM public.user_quest_assignments recent
        WHERE recent.user_id = p_user_id
          AND recent.template_id = templates.id
      ) history ON true
      WHERE templates.enabled
        AND templates.cadence = 'weekly'
        AND NOT EXISTS (
          SELECT 1 FROM public.user_quest_assignments same_week
          WHERE same_week.user_id = p_user_id
            AND same_week.template_id = templates.id
            AND same_week.assignment_date = v_week_start
        )
        AND (
          NOT COALESCE((templates.eligibility->>'requires_pages')::BOOLEAN, false)
          OR EXISTS (
            SELECT 1 FROM public.books
            WHERE user_id = p_user_id AND deleted_at IS NULL AND pages > 0
          )
        )
        AND (
          NOT COALESCE((templates.eligibility->>'requires_near_completion')::BOOLEAN, false)
          OR EXISTS (
            SELECT 1 FROM public.books
            WHERE user_id = p_user_id
              AND deleted_at IS NULL
              AND status = 'reading'
              AND pages > 0
              AND COALESCE(current_page, 0)::NUMERIC / pages >= 0.70
          )
        )
        AND (
          NOT COALESCE((templates.eligibility->>'requires_series')::BOOLEAN, false)
          OR EXISTS (
            SELECT 1 FROM public.books
            WHERE user_id = p_user_id
              AND deleted_at IS NULL
              AND series_name IS NOT NULL
          )
        )
    )
    SELECT (candidates.template_row).*
    FROM candidates
    WHERE (candidates.template_row).gold_leaves_reward = 0
       OR (v_rare_count = 0 AND candidates.rarity_order = 1)
    ORDER BY
      candidates.cooldown_priority,
      candidates.last_assigned ASC NULLS FIRST,
      candidates.weighted_order
    LIMIT GREATEST(0, 3 - v_weekly_count)
  LOOP
    v_target := public.quest_target_for_user(
      p_user_id,
      v_template.metric,
      v_template.minimum_target,
      v_template.maximum_target,
      'weekly'
    );
    v_reward := LEAST(
      v_template.reward_ink_max,
      GREATEST(
        v_template.reward_ink_min,
        v_template.reward_ink_min
          + COALESCE(FLOOR(
              (v_template.reward_ink_max - v_template.reward_ink_min)
              * (
                (v_target - v_template.minimum_target)
                / NULLIF(v_template.maximum_target - v_template.minimum_target, 0)
              )
            )::INTEGER, 0)
      )
    );

    INSERT INTO public.user_quest_assignments(
      user_id,
      template_id,
      cadence,
      assignment_date,
      period_start,
      period_end,
      target_value,
      reward_ink,
      reward_gold_leaves
    )
    VALUES (
      p_user_id,
      v_template.id,
      'weekly',
      v_week_start,
      v_week_start,
      v_week_start + 6,
      v_target,
      v_reward,
      v_template.gold_leaves_reward
    )
    ON CONFLICT DO NOTHING;

    IF v_template.gold_leaves_reward > 0 THEN
      v_rare_count := v_rare_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'timezone', v_timezone,
    'local_date', v_local_date,
    'week_start', v_week_start
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_reader_league_rank(
  p_user_id UUID,
  p_week_id UUID,
  p_occurred_at TIMESTAMPTZ DEFAULT now()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership public.reader_league_members;
  v_rank INTEGER;
  v_previous_rank INTEGER;
  v_local_date DATE;
BEGIN
  SELECT memberships.* INTO v_membership
  FROM public.reader_league_members memberships
  JOIN public.reader_leagues leagues ON leagues.id = memberships.league_id
  WHERE memberships.user_id = p_user_id
    AND leagues.week_id = p_week_id
    AND leagues.status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT ranked.rank INTO v_rank
  FROM (
    SELECT
      league_members.user_id,
      ROW_NUMBER() OVER (
        ORDER BY
          COALESCE(scores.competitive_ink, 0) DESC,
          COALESCE(scores.quests_completed, 0) DESC,
          COALESCE(scores.qualifying_minutes, 0) DESC,
          COALESCE(scores.reading_days, 0) DESC,
          scores.score_attained_at ASC NULLS LAST,
          league_members.user_id
      )::INTEGER AS rank
    FROM public.reader_league_members league_members
    LEFT JOIN public.gamification_weekly_scores scores
      ON scores.week_id = p_week_id
     AND scores.user_id = league_members.user_id
    WHERE league_members.league_id = v_membership.league_id
  ) ranked
  WHERE ranked.user_id = p_user_id;

  v_previous_rank := v_membership.provisional_rank;

  UPDATE public.reader_league_members
  SET provisional_rank = v_rank
  WHERE league_id = v_membership.league_id
    AND user_id = p_user_id;

  IF v_previous_rank IS NOT NULL
    AND v_rank IS DISTINCT FROM v_previous_rank
    AND (
      ABS(v_rank - v_previous_rank) >= 3
      OR (v_previous_rank > 10 AND v_rank <= 10)
      OR (v_previous_rank <= 10 AND v_rank > 10)
    ) THEN
    v_local_date := p_occurred_at::DATE;
    PERFORM public.create_gamification_notification(
      p_user_id,
      'rank_movement',
      CASE WHEN v_rank < v_previous_rank THEN 'You moved up' ELSE 'Your rank changed' END,
      format(
        'You are now #%s in your Reader League.',
        v_rank
      ),
      jsonb_build_object(
        'week_id', p_week_id,
        'league_id', v_membership.league_id,
        'rank', v_rank,
        'previous_rank', v_previous_rank
      ),
      'rank-movement:' || p_week_id::TEXT || ':' || p_user_id::TEXT || ':' || v_local_date::TEXT || ':' || v_rank::TEXT
    );
  END IF;

  RETURN v_rank;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_gamification_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_event_key TEXT,
  p_source_type TEXT DEFAULT NULL,
  p_source_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_occurred_at TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule public.gamification_reward_rules;
  v_account public.gamification_accounts;
  v_week public.gamification_weeks;
  v_ledger public.gamification_ledger;
  v_timezone TEXT := 'UTC';
  v_local_date DATE;
  v_ink INTEGER := 0;
  v_competitive INTEGER := 0;
  v_gold INTEGER := 0;
  v_daily_competitive INTEGER := 0;
  v_limit_count INTEGER := 0;
  v_level INTEGER := 1;
  v_duration INTEGER := GREATEST(COALESCE((p_metadata->>'duration_minutes')::INTEGER, 0), 0);
  v_pages INTEGER := GREATEST(COALESCE((p_metadata->>'pages_read')::INTEGER, 0), 0);
  v_book_pages INTEGER := GREATEST(COALESCE((p_metadata->>'book_pages')::INTEGER, 0), 0);
  v_threshold INTEGER := GREATEST(COALESCE((p_metadata->>'threshold')::INTEGER, 0), 0);
  v_rank INTEGER := GREATEST(COALESCE((p_metadata->>'rank')::INTEGER, 0), 0);
BEGIN
  IF p_user_id IS NULL OR NULLIF(trim(p_event_key), '') IS NULL THEN
    RAISE EXCEPTION 'user and event key are required';
  END IF;

  SELECT * INTO v_rule
  FROM public.gamification_reward_rules
  WHERE event_type = p_event_type AND enabled;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'ignored', true, 'reason', 'unknown_event');
  END IF;

  SELECT COALESCE(NULLIF(timezone, ''), 'UTC')
  INTO v_timezone
  FROM public.profiles
  WHERE id = p_user_id;

  BEGIN
    v_local_date := (p_occurred_at AT TIME ZONE v_timezone)::DATE;
  EXCEPTION WHEN invalid_parameter_value THEN
    v_local_date := p_occurred_at::DATE;
  END;

  INSERT INTO public.gamification_accounts(user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_account
  FROM public.gamification_accounts
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM public.gamification_ledger
    WHERE user_id = p_user_id
      AND event_key = p_event_key
  ) THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  IF v_rule.daily_event_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_limit_count
    FROM public.gamification_ledger
    WHERE user_id = p_user_id
      AND event_type = p_event_type
      AND (occurred_at AT TIME ZONE v_timezone)::DATE = v_local_date;

    IF v_limit_count >= v_rule.daily_event_limit THEN
      RETURN jsonb_build_object('success', true, 'ignored', true, 'reason', 'daily_limit');
    END IF;
  END IF;

  v_ink := CASE p_event_type
    WHEN 'reading_session' THEN LEAST(12, FLOOR(v_duration / 5.0)::INTEGER)
    WHEN 'page_progress' THEN LEAST(20, FLOOR(v_pages / 5.0)::INTEGER)
    WHEN 'book_completed' THEN v_rule.base_ink + LEAST(50, FLOOR(v_book_pages / 10.0)::INTEGER)
    WHEN 'series_milestone' THEN CASE v_threshold WHEN 2 THEN 40 WHEN 3 THEN 75 WHEN 5 THEN 150 ELSE 0 END
    WHEN 'streak_milestone' THEN CASE WHEN v_threshold >= 365 THEN 250 WHEN v_threshold >= 100 THEN 150 WHEN v_threshold >= 30 THEN 75 ELSE 0 END
    WHEN 'quest_completed' THEN GREATEST(COALESCE((p_metadata->>'reward_ink')::INTEGER, 0), 0)
    WHEN 'historical_backfill' THEN GREATEST(COALESCE((p_metadata->>'reward_ink')::INTEGER, 0), 0)
    ELSE v_rule.base_ink
  END;

  v_gold := CASE p_event_type
    WHEN 'series_milestone' THEN CASE WHEN v_threshold >= 5 THEN 1 ELSE 0 END
    WHEN 'streak_milestone' THEN CASE WHEN v_threshold >= 365 THEN 5 WHEN v_threshold >= 100 THEN 2 WHEN v_threshold >= 30 THEN 1 ELSE 0 END
    WHEN 'quest_completed' THEN GREATEST(COALESCE((p_metadata->>'reward_gold_leaves')::INTEGER, 0), 0)
    WHEN 'weekly_quest_bonus' THEN 1
    WHEN 'league_podium' THEN CASE v_rank WHEN 1 THEN 3 WHEN 2 THEN 2 WHEN 3 THEN 1 ELSE 0 END
    WHEN 'historical_backfill' THEN GREATEST(COALESCE((p_metadata->>'reward_gold_leaves')::INTEGER, 0), 0)
    ELSE 0
  END;

  IF p_event_type IN ('reading_session', 'page_progress') AND v_ink = 0 THEN
    RETURN jsonb_build_object('success', true, 'ignored', true, 'reason', 'below_threshold');
  END IF;

  IF v_rule.competitive THEN
    INSERT INTO public.gamification_daily_scores(user_id, score_date)
    VALUES (p_user_id, v_local_date)
    ON CONFLICT (user_id, score_date) DO NOTHING;

    SELECT competitive_ink INTO v_daily_competitive
    FROM public.gamification_daily_scores
    WHERE user_id = p_user_id AND score_date = v_local_date
    FOR UPDATE;

    IF p_event_type IN ('quest_completed', 'weekly_quest_bonus') THEN
      v_competitive := v_ink;
    ELSE
      v_competitive := LEAST(v_ink, GREATEST(0, 150 - v_daily_competitive));
    END IF;
  END IF;

  INSERT INTO public.gamification_ledger(
    user_id,
    event_key,
    event_type,
    source_type,
    source_id,
    ink_delta,
    competitive_ink_delta,
    gold_leaves_delta,
    metadata,
    occurred_at
  )
  VALUES (
    p_user_id,
    p_event_key,
    p_event_type,
    p_source_type,
    p_source_id,
    v_ink,
    v_competitive,
    v_gold,
    COALESCE(p_metadata, '{}'::jsonb),
    p_occurred_at
  )
  ON CONFLICT (user_id, event_key) DO NOTHING
  RETURNING * INTO v_ledger;

  IF v_ledger.id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  UPDATE public.gamification_accounts
  SET
    lifetime_ink = lifetime_ink + v_ink,
    gold_leaves = gold_leaves + v_gold,
    last_reward_at = p_occurred_at,
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO v_account;

  SELECT COALESCE(MAX(level), 1)
  INTO v_level
  FROM public.gamification_levels
  WHERE ink_threshold <= v_account.lifetime_ink;

  UPDATE public.gamification_accounts
  SET current_level = v_level
  WHERE user_id = p_user_id;

  IF v_competitive > 0 THEN
    UPDATE public.gamification_daily_scores
    SET competitive_ink = competitive_ink + v_competitive, updated_at = now()
    WHERE user_id = p_user_id AND score_date = v_local_date;

    v_week := public.ensure_gamification_week(p_occurred_at::DATE);
    IF v_week.status <> 'finalized' AND p_occurred_at <= v_week.scoring_closes_at THEN
      INSERT INTO public.gamification_weekly_scores(
        week_id,
        user_id,
        competitive_ink,
        quests_completed,
        qualifying_minutes,
        reading_days,
        score_attained_at
      )
      VALUES (
        v_week.id,
        p_user_id,
        v_competitive,
        CASE WHEN p_event_type = 'quest_completed' THEN 1 ELSE 0 END,
        CASE WHEN p_event_type = 'reading_session' THEN v_duration ELSE 0 END,
        CASE WHEN p_event_type = 'daily_activity' THEN 1 ELSE 0 END,
        p_occurred_at
      )
      ON CONFLICT (week_id, user_id) DO UPDATE SET
        competitive_ink = public.gamification_weekly_scores.competitive_ink + EXCLUDED.competitive_ink,
        quests_completed = public.gamification_weekly_scores.quests_completed + EXCLUDED.quests_completed,
        qualifying_minutes = public.gamification_weekly_scores.qualifying_minutes + EXCLUDED.qualifying_minutes,
        reading_days = public.gamification_weekly_scores.reading_days + EXCLUDED.reading_days,
        score_attained_at = CASE
          WHEN EXCLUDED.competitive_ink > 0 THEN EXCLUDED.score_attained_at
          ELSE public.gamification_weekly_scores.score_attained_at
        END,
        updated_at = now();

      PERFORM public.refresh_reader_league_rank(
        p_user_id,
        v_week.id,
        p_occurred_at
      );
    END IF;
  END IF;

  IF v_gold > 0 THEN
    PERFORM public.create_gamification_notification(
      p_user_id,
      'gold_leaves_earned',
      'Gold Leaf earned',
      format('You earned %s Gold Leaf%s.', v_gold, CASE WHEN v_gold = 1 THEN '' ELSE 's' END),
      jsonb_build_object('gold_leaves', v_gold, 'event_type', p_event_type),
      'gold:' || p_event_key
    );
  END IF;

  IF v_account.current_level < v_level THEN
    PERFORM public.create_gamification_notification(
      p_user_id,
      'level_up',
      'Reader level increased',
      'Your reading has reached a new Brack level.',
      jsonb_build_object('level', v_level),
      'level:' || p_user_id::TEXT || ':' || v_level::TEXT
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'ink_awarded', v_ink,
    'competitive_ink_awarded', v_competitive,
    'gold_leaves_awarded', v_gold,
    'lifetime_ink', v_account.lifetime_ink,
    'level', v_level,
    'ledger_id', v_ledger.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_user_quests(
  p_user_id UUID,
  p_metric TEXT,
  p_increment NUMERIC,
  p_event_key TEXT,
  p_occurred_at TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone TEXT := 'UTC';
  v_local_date DATE;
  v_assignment public.user_quest_assignments;
  v_completed INTEGER := 0;
  v_week_start DATE;
  v_weekly_total INTEGER;
  v_weekly_completed INTEGER;
  v_progress_event_inserted BOOLEAN;
BEGIN
  IF p_increment <= 0 THEN
    RETURN jsonb_build_object('completed', 0);
  END IF;

  PERFORM public.ensure_user_quests(p_user_id, p_occurred_at, true);

  SELECT COALESCE(NULLIF(timezone, ''), 'UTC')
  INTO v_timezone
  FROM public.profiles
  WHERE id = p_user_id;

  BEGIN
    v_local_date := (p_occurred_at AT TIME ZONE v_timezone)::DATE;
  EXCEPTION WHEN invalid_parameter_value THEN
    v_local_date := p_occurred_at::DATE;
  END;
  v_week_start := date_trunc('week', v_local_date::TIMESTAMP)::DATE;

  FOR v_assignment IN
    SELECT assignments.*
    FROM public.user_quest_assignments assignments
    JOIN public.quest_templates templates ON templates.id = assignments.template_id
    WHERE assignments.user_id = p_user_id
      AND assignments.status = 'active'
      AND templates.metric = p_metric
      AND assignments.period_start <= v_local_date
      AND assignments.period_end >= v_local_date
    FOR UPDATE OF assignments
  LOOP
    INSERT INTO public.user_quest_progress_events(
      assignment_id,
      event_key,
      increment_value,
      occurred_at
    )
    VALUES (
      v_assignment.id,
      p_event_key,
      p_increment,
      p_occurred_at
    )
    ON CONFLICT (assignment_id, event_key) DO NOTHING
    RETURNING true INTO v_progress_event_inserted;

    IF NOT COALESCE(v_progress_event_inserted, false) THEN
      CONTINUE;
    END IF;
    v_progress_event_inserted := false;

    UPDATE public.user_quest_assignments
    SET
      progress_value = LEAST(
        target_value,
        CASE
          WHEN p_metric = 'velocity' THEN GREATEST(progress_value, p_increment)
          ELSE progress_value + p_increment
        END
      ),
      status = CASE
        WHEN (
          CASE
            WHEN p_metric = 'velocity' THEN GREATEST(progress_value, p_increment)
            ELSE progress_value + p_increment
          END
        ) >= target_value THEN 'completed'
        ELSE status
      END,
      completed_at = CASE
        WHEN (
          CASE
            WHEN p_metric = 'velocity' THEN GREATEST(progress_value, p_increment)
            ELSE progress_value + p_increment
          END
        ) >= target_value THEN COALESCE(completed_at, p_occurred_at)
        ELSE completed_at
      END,
      reward_event_key = CASE
        WHEN (
          CASE
            WHEN p_metric = 'velocity' THEN GREATEST(progress_value, p_increment)
            ELSE progress_value + p_increment
          END
        ) >= target_value THEN COALESCE(reward_event_key, 'quest:' || id::TEXT)
        ELSE reward_event_key
      END,
      updated_at = now()
    WHERE id = v_assignment.id
    RETURNING * INTO v_assignment;

    IF v_assignment.status = 'completed' THEN
      PERFORM public.apply_gamification_event(
        p_user_id,
        'quest_completed',
        'quest:' || v_assignment.id::TEXT,
        'quest',
        v_assignment.id::TEXT,
        jsonb_build_object(
          'reward_ink', v_assignment.reward_ink,
          'reward_gold_leaves', v_assignment.reward_gold_leaves,
          'cadence', v_assignment.cadence,
          'source_event_key', p_event_key
        ),
        p_occurred_at
      );
      v_completed := v_completed + 1;

      PERFORM public.create_gamification_notification(
        p_user_id,
        'quest_completed',
        'Quest complete',
        'Your reading completed a Brack quest.',
        jsonb_build_object('quest_id', v_assignment.id),
        'quest-complete:' || v_assignment.id::TEXT
      );
    END IF;
  END LOOP;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'completed')
  INTO v_weekly_total, v_weekly_completed
  FROM public.user_quest_assignments
  WHERE user_id = p_user_id
    AND cadence = 'weekly'
    AND assignment_date = v_week_start;

  IF v_weekly_total >= 3 AND v_weekly_completed = v_weekly_total THEN
    PERFORM public.apply_gamification_event(
      p_user_id,
      'weekly_quest_bonus',
      'weekly-quest-bonus:' || v_week_start::TEXT,
      'quest_week',
      v_week_start::TEXT,
      '{}'::jsonb,
      p_occurred_at
    );
  END IF;

  RETURN jsonb_build_object('completed', v_completed);
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_reader_leagues(p_week_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_week_start DATE;
BEGIN
  SELECT week_start INTO v_week_start
  FROM public.gamification_weeks
  WHERE id = p_week_id;

  IF v_week_start IS NULL THEN
    RAISE EXCEPTION 'Gamification week not found';
  END IF;

  WITH eligible AS (
    SELECT
      profiles.id AS user_id,
      COALESCE(previous_members.starting_tier, 1) AS tier,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(previous_members.starting_tier, 1)
        ORDER BY md5(profiles.id::TEXT || p_week_id::TEXT)
      ) AS row_number
    FROM public.profiles
    LEFT JOIN LATERAL (
      SELECT CASE movement
        WHEN 'promoted' THEN LEAST(5, starting_tier + 1)
        WHEN 'demoted' THEN GREATEST(1, starting_tier - 1)
        ELSE starting_tier
      END AS starting_tier
      FROM public.reader_league_members memberships
      JOIN public.reader_leagues leagues ON leagues.id = memberships.league_id
      WHERE memberships.user_id = profiles.id
        AND leagues.status = 'finalized'
      ORDER BY memberships.finalized_at DESC NULLS LAST
      LIMIT 1
    ) previous_members ON true
    WHERE profiles.leaderboard_opt_in = true
      AND profiles.leaderboard_eligible_from <= v_week_start
      AND COALESCE(profiles.is_active, true) = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.reader_league_members existing_members
        JOIN public.reader_leagues existing_leagues ON existing_leagues.id = existing_members.league_id
        WHERE existing_members.user_id = profiles.id
          AND existing_leagues.week_id = p_week_id
      )
  ),
  groups AS (
    SELECT
      user_id,
      tier,
      CEIL(row_number / 50.0)::INTEGER AS group_number
    FROM eligible
  )
  INSERT INTO public.reader_leagues(week_id, tier, group_number, name)
  SELECT DISTINCT
    p_week_id,
    tier,
    group_number,
    CASE tier
      WHEN 1 THEN 'Bookmark'
      WHEN 2 THEN 'Paperback'
      WHEN 3 THEN 'Hardcover'
      WHEN 4 THEN 'Collector'
      ELSE 'First Edition'
    END || ' ' || group_number
  FROM groups
  ON CONFLICT (week_id, tier, group_number) DO NOTHING;

  WITH eligible AS (
    SELECT
      profiles.id AS user_id,
      COALESCE(previous_members.starting_tier, 1) AS tier,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(previous_members.starting_tier, 1)
        ORDER BY md5(profiles.id::TEXT || p_week_id::TEXT)
      ) AS row_number
    FROM public.profiles
    LEFT JOIN LATERAL (
      SELECT CASE movement
        WHEN 'promoted' THEN LEAST(5, starting_tier + 1)
        WHEN 'demoted' THEN GREATEST(1, starting_tier - 1)
        ELSE starting_tier
      END AS starting_tier
      FROM public.reader_league_members memberships
      JOIN public.reader_leagues leagues ON leagues.id = memberships.league_id
      WHERE memberships.user_id = profiles.id
        AND leagues.status = 'finalized'
      ORDER BY memberships.finalized_at DESC NULLS LAST
      LIMIT 1
    ) previous_members ON true
    WHERE profiles.leaderboard_opt_in = true
      AND profiles.leaderboard_eligible_from <= v_week_start
      AND COALESCE(profiles.is_active, true) = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.reader_league_members existing_members
        JOIN public.reader_leagues existing_leagues ON existing_leagues.id = existing_members.league_id
        WHERE existing_members.user_id = profiles.id
          AND existing_leagues.week_id = p_week_id
      )
  ),
  groups AS (
    SELECT
      user_id,
      tier,
      CEIL(row_number / 50.0)::INTEGER AS group_number
    FROM eligible
  )
  INSERT INTO public.reader_league_members(league_id, user_id, starting_tier)
  SELECT leagues.id, groups.user_id, groups.tier
  FROM groups
  JOIN public.reader_leagues leagues
    ON leagues.week_id = p_week_id
   AND leagues.tier = groups.tier
   AND leagues.group_number = groups.group_number
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_gamification_week(p_week_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week public.gamification_weeks;
  v_member RECORD;
  v_finalized INTEGER := 0;
BEGIN
  SELECT * INTO v_week
  FROM public.gamification_weeks
  WHERE id = p_week_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gamification week not found';
  END IF;

  IF v_week.status = 'finalized' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  IF now() < v_week.scoring_closes_at THEN
    RETURN jsonb_build_object('success', false, 'reason', 'grace_period_active');
  END IF;

  FOR v_member IN
    WITH ranked AS (
      SELECT
        memberships.league_id,
        memberships.user_id,
        memberships.starting_tier,
        COALESCE(scores.competitive_ink, 0) AS score,
        ROW_NUMBER() OVER (
          PARTITION BY memberships.league_id
          ORDER BY
            COALESCE(scores.competitive_ink, 0) DESC,
            COALESCE(scores.quests_completed, 0) DESC,
            COALESCE(scores.qualifying_minutes, 0) DESC,
            COALESCE(scores.reading_days, 0) DESC,
            scores.score_attained_at ASC NULLS LAST,
            memberships.user_id
        ) AS final_rank,
        COUNT(*) OVER (PARTITION BY memberships.league_id) AS league_size
      FROM public.reader_league_members memberships
      JOIN public.reader_leagues leagues ON leagues.id = memberships.league_id
      LEFT JOIN public.gamification_weekly_scores scores
        ON scores.week_id = leagues.week_id
       AND scores.user_id = memberships.user_id
      WHERE leagues.week_id = p_week_id
    )
    SELECT * FROM ranked
  LOOP
    UPDATE public.reader_league_members
    SET
      final_rank = v_member.final_rank,
      final_score = v_member.score,
      movement = CASE
        WHEN v_member.final_rank <= LEAST(10, v_member.league_size) AND v_member.starting_tier < 5 THEN 'promoted'
        WHEN v_member.final_rank > GREATEST(LEAST(10, v_member.league_size), v_member.league_size - 10)
          AND v_member.starting_tier > 1 THEN 'demoted'
        ELSE 'retained'
      END,
      finalized_at = now()
    WHERE league_id = v_member.league_id
      AND user_id = v_member.user_id;

    IF v_member.final_rank <= 3 THEN
      PERFORM public.apply_gamification_event(
        v_member.user_id,
        'league_podium',
        'league-podium:' || p_week_id::TEXT || ':' || v_member.user_id::TEXT,
        'reader_league',
        v_member.league_id::TEXT,
        jsonb_build_object('rank', v_member.final_rank),
        now()
      );
    END IF;

    PERFORM public.create_gamification_notification(
      v_member.user_id,
      'weekly_league_result',
      'Your Reader League result is ready',
      format('You finished #%s with %s Ink.', v_member.final_rank, v_member.score),
      jsonb_build_object(
        'week_id', p_week_id,
        'rank', v_member.final_rank,
        'score', v_member.score
      ),
      'league-result:' || p_week_id::TEXT || ':' || v_member.user_id::TEXT
    );

    INSERT INTO public.user_gamification_week_summaries(
      user_id,
      week_start,
      quests_assigned,
      quests_completed,
      quest_ink_earned,
      gold_leaves_earned,
      competitive_ink,
      final_league_name,
      final_rank,
      movement,
      updated_at
    )
    SELECT
      v_member.user_id,
      v_week.week_start,
      COUNT(assignments.id)::INTEGER,
      COUNT(assignments.id) FILTER (WHERE assignments.status = 'completed')::INTEGER,
      COALESCE(SUM(assignments.reward_ink) FILTER (WHERE assignments.status = 'completed'), 0)::INTEGER,
      COALESCE(SUM(assignments.reward_gold_leaves) FILTER (WHERE assignments.status = 'completed'), 0)::INTEGER,
      v_member.score,
      leagues.name,
      v_member.final_rank,
      CASE
        WHEN v_member.final_rank <= LEAST(10, v_member.league_size) AND v_member.starting_tier < 5 THEN 'promoted'
        WHEN v_member.final_rank > GREATEST(LEAST(10, v_member.league_size), v_member.league_size - 10)
          AND v_member.starting_tier > 1 THEN 'demoted'
        ELSE 'retained'
      END,
      now()
    FROM public.reader_leagues leagues
    LEFT JOIN public.user_quest_assignments assignments
      ON assignments.user_id = v_member.user_id
     AND assignments.cadence = 'weekly'
     AND assignments.assignment_date = v_week.week_start
    WHERE leagues.id = v_member.league_id
    GROUP BY leagues.name
    ON CONFLICT (user_id, week_start) DO UPDATE SET
      quests_assigned = EXCLUDED.quests_assigned,
      quests_completed = EXCLUDED.quests_completed,
      quest_ink_earned = EXCLUDED.quest_ink_earned,
      gold_leaves_earned = EXCLUDED.gold_leaves_earned,
      competitive_ink = EXCLUDED.competitive_ink,
      final_league_name = EXCLUDED.final_league_name,
      final_rank = EXCLUDED.final_rank,
      movement = EXCLUDED.movement,
      updated_at = now();

    v_finalized := v_finalized + 1;
  END LOOP;

  UPDATE public.reader_leagues
  SET status = 'finalized'
  WHERE week_id = p_week_id;

  UPDATE public.gamification_weeks
  SET status = 'finalized', finalized_at = now(), updated_at = now()
  WHERE id = p_week_id;

  RETURN jsonb_build_object('success', true, 'finalized_members', v_finalized);
END;
$$;

CREATE OR REPLACE FUNCTION public.run_gamification_rollover()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current public.gamification_weeks;
  v_previous public.gamification_weeks;
  v_assigned INTEGER := 0;
  v_result JSONB := '{}'::jsonb;
BEGIN
  v_current := public.ensure_gamification_week(CURRENT_DATE);
  v_assigned := public.assign_reader_leagues(v_current.id);

  SELECT * INTO v_previous
  FROM public.gamification_weeks
  WHERE status <> 'finalized'
    AND scoring_closes_at <= now()
    AND id <> v_current.id
  ORDER BY week_start
  LIMIT 1;

  IF FOUND THEN
    v_result := public.finalize_gamification_week(v_previous.id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'current_week_id', v_current.id,
    'assigned_members', v_assigned,
    'finalization', v_result
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.read_gamification_jobs(
  p_visibility_timeout INTEGER DEFAULT 60,
  p_batch_size INTEGER DEFAULT 25
)
RETURNS TABLE (
  msg_id BIGINT,
  read_ct INTEGER,
  enqueued_at TIMESTAMPTZ,
  vt TIMESTAMPTZ,
  message JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
  SELECT
    queue_message.msg_id,
    queue_message.read_ct,
    queue_message.enqueued_at,
    queue_message.vt,
    queue_message.message
  FROM pgmq.read(
    'gamification_jobs',
    LEAST(GREATEST(COALESCE(p_visibility_timeout, 60), 10), 600),
    LEAST(GREATEST(COALESCE(p_batch_size, 25), 1), 100)
  ) queue_message;
$$;

CREATE OR REPLACE FUNCTION public.delete_gamification_job(p_message_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
  SELECT pgmq.delete('gamification_jobs', p_message_id);
$$;

CREATE OR REPLACE FUNCTION public.get_gamification_home(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account public.gamification_accounts;
  v_level public.gamification_levels;
  v_next_level public.gamification_levels;
  v_week public.gamification_weeks;
  v_league JSONB := NULL;
  v_quests JSONB := '[]'::jsonb;
  v_tomorrow JSONB := '[]'::jsonb;
  v_recent JSONB := '[]'::jsonb;
  v_timezone TEXT := 'UTC';
  v_local_date DATE;
  v_week_start DATE;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  PERFORM public.ensure_user_quests(p_user_id, now(), true);

  INSERT INTO public.gamification_accounts(user_id)
  VALUES (p_user_id)
  ON CONFLICT DO NOTHING;

  SELECT * INTO v_account
  FROM public.gamification_accounts
  WHERE user_id = p_user_id;

  SELECT * INTO v_level
  FROM public.gamification_levels
  WHERE level = v_account.current_level;

  SELECT * INTO v_next_level
  FROM public.gamification_levels
  WHERE level > v_account.current_level
  ORDER BY level
  LIMIT 1;

  SELECT COALESCE(NULLIF(timezone, ''), 'UTC')
  INTO v_timezone
  FROM public.profiles
  WHERE id = p_user_id;

  BEGIN
    v_local_date := (now() AT TIME ZONE v_timezone)::DATE;
  EXCEPTION WHEN invalid_parameter_value THEN
    v_local_date := CURRENT_DATE;
  END;
  v_week_start := date_trunc('week', v_local_date::TIMESTAMP)::DATE;
  v_week := public.ensure_gamification_week(CURRENT_DATE);

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', assignments.id,
      'template_id', templates.id,
      'code', templates.code,
      'title', templates.title,
      'description', replace(templates.description_template, '{target}', assignments.target_value::TEXT),
      'cadence', assignments.cadence,
      'metric', templates.metric,
      'target_value', assignments.target_value,
      'progress_value', assignments.progress_value,
      'reward_ink', assignments.reward_ink,
      'reward_gold_leaves', assignments.reward_gold_leaves,
      'status', assignments.status,
      'period_start', assignments.period_start,
      'period_end', assignments.period_end,
      'completed_at', assignments.completed_at
    )
    ORDER BY assignments.cadence, assignments.created_at
  ), '[]'::jsonb)
  INTO v_quests
  FROM public.user_quest_assignments assignments
  JOIN public.quest_templates templates ON templates.id = assignments.template_id
  WHERE assignments.user_id = p_user_id
    AND (
      (assignments.cadence = 'daily' AND assignments.assignment_date = v_local_date)
      OR (assignments.cadence = 'weekly' AND assignments.assignment_date = v_week_start)
    );

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', assignments.id,
      'title', templates.title,
      'description', replace(templates.description_template, '{target}', assignments.target_value::TEXT),
      'metric', templates.metric,
      'target_value', assignments.target_value,
      'reward_ink', assignments.reward_ink
    )
    ORDER BY assignments.created_at
  ), '[]'::jsonb)
  INTO v_tomorrow
  FROM public.user_quest_assignments assignments
  JOIN public.quest_templates templates ON templates.id = assignments.template_id
  WHERE assignments.user_id = p_user_id
    AND assignments.cadence = 'daily'
    AND assignments.assignment_date = v_local_date + 1;

  SELECT COALESCE(jsonb_agg(to_jsonb(recent) ORDER BY recent.created_at DESC), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT
      ledger.id,
      ledger.event_type,
      rules.display_name,
      ledger.ink_delta,
      ledger.gold_leaves_delta,
      ledger.metadata,
      ledger.created_at
    FROM public.gamification_ledger ledger
    JOIN public.gamification_reward_rules rules ON rules.event_type = ledger.event_type
    WHERE ledger.user_id = p_user_id
    ORDER BY ledger.created_at DESC, ledger.id DESC
    LIMIT 12
  ) recent;

  SELECT jsonb_build_object(
    'league_id', leagues.id,
    'name', leagues.name,
    'tier', leagues.tier,
    'week_id', leagues.week_id,
    'score', COALESCE(scores.competitive_ink, 0),
    'provisional_rank', ranked.rank,
    'member_count', ranked.member_count,
    'status', leagues.status
  )
  INTO v_league
  FROM public.reader_league_members membership
  JOIN public.reader_leagues leagues ON leagues.id = membership.league_id
  LEFT JOIN public.gamification_weekly_scores scores
    ON scores.week_id = leagues.week_id AND scores.user_id = membership.user_id
  JOIN LATERAL (
    SELECT rank, member_count
    FROM (
      SELECT
        league_members.user_id,
        ROW_NUMBER() OVER (
          ORDER BY
            COALESCE(league_scores.competitive_ink, 0) DESC,
            COALESCE(league_scores.quests_completed, 0) DESC,
            COALESCE(league_scores.qualifying_minutes, 0) DESC,
            COALESCE(league_scores.reading_days, 0) DESC,
            league_scores.score_attained_at ASC NULLS LAST,
            league_members.user_id
        ) AS rank,
        COUNT(*) OVER () AS member_count
      FROM public.reader_league_members league_members
      LEFT JOIN public.gamification_weekly_scores league_scores
        ON league_scores.week_id = leagues.week_id
       AND league_scores.user_id = league_members.user_id
      WHERE league_members.league_id = leagues.id
    ) league_ranking
    WHERE league_ranking.user_id = p_user_id
  ) ranked ON true
  WHERE membership.user_id = p_user_id
    AND leagues.week_id = v_week.id
  LIMIT 1;

  RETURN jsonb_build_object(
    'account', jsonb_build_object(
      'user_id', v_account.user_id,
      'lifetime_ink', v_account.lifetime_ink,
      'gold_leaves', v_account.gold_leaves,
      'current_level', v_account.current_level,
      'level_title', v_level.title,
      'level_threshold', v_level.ink_threshold,
      'next_level', CASE WHEN v_next_level.level IS NULL THEN NULL ELSE jsonb_build_object(
        'level', v_next_level.level,
        'title', v_next_level.title,
        'ink_threshold', v_next_level.ink_threshold
      ) END,
      'leaderboard_opt_in', (SELECT leaderboard_opt_in FROM public.profiles WHERE id = p_user_id),
      'leaderboard_eligible_from', (SELECT leaderboard_eligible_from FROM public.profiles WHERE id = p_user_id),
      'gamification_profile_visible', (SELECT gamification_profile_visible FROM public.profiles WHERE id = p_user_id)
    ),
    'quests', v_quests,
    'tomorrow_quests', v_tomorrow,
    'recent_rewards', v_recent,
    'league', v_league,
    'week', to_jsonb(v_week),
    'server_time', now(),
    'timezone', v_timezone
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_gamification_history(
  p_user_id UUID,
  p_before TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'items',
    COALESCE(jsonb_agg(to_jsonb(history) ORDER BY history.created_at DESC, history.id DESC), '[]'::jsonb),
    'next_cursor',
    MIN(history.created_at)
  )
  FROM (
    SELECT
      ledger.id,
      ledger.event_type,
      rules.display_name,
      ledger.ink_delta,
      ledger.competitive_ink_delta,
      ledger.gold_leaves_delta,
      ledger.metadata,
      ledger.created_at
    FROM public.gamification_ledger ledger
    JOIN public.gamification_reward_rules rules ON rules.event_type = ledger.event_type
    WHERE ledger.user_id = p_user_id
      AND (p_before IS NULL OR ledger.created_at < p_before)
    ORDER BY ledger.created_at DESC, ledger.id DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100)
  ) history;
$$;

CREATE OR REPLACE FUNCTION public.get_reader_leaderboard(
  p_user_id UUID,
  p_scope TEXT DEFAULT 'league',
  p_week_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week public.gamification_weeks;
  v_league_id UUID;
  v_entries JSONB := '[]'::jsonb;
BEGIN
  IF p_scope NOT IN ('league', 'friends', 'global') THEN
    RAISE EXCEPTION 'Unsupported leaderboard scope';
  END IF;

  IF p_week_id IS NULL THEN
    v_week := public.ensure_gamification_week(CURRENT_DATE);
  ELSE
    SELECT * INTO v_week FROM public.gamification_weeks WHERE id = p_week_id;
  END IF;

  IF p_scope = 'league' THEN
    SELECT leagues.id INTO v_league_id
    FROM public.reader_league_members memberships
    JOIN public.reader_leagues leagues ON leagues.id = memberships.league_id
    WHERE memberships.user_id = p_user_id AND leagues.week_id = v_week.id
    LIMIT 1;

    IF v_league_id IS NULL THEN
      RETURN jsonb_build_object('week', to_jsonb(v_week), 'scope', p_scope, 'entries', '[]'::jsonb);
    END IF;
  END IF;

  WITH candidates AS (
    SELECT
      scores.user_id,
      scores.competitive_ink,
      scores.quests_completed,
      scores.qualifying_minutes,
      scores.reading_days,
      scores.score_attained_at
    FROM public.gamification_weekly_scores scores
    JOIN public.profiles candidate_profiles
      ON candidate_profiles.id = scores.user_id
    WHERE scores.week_id = v_week.id
      AND candidate_profiles.leaderboard_opt_in = true
      AND candidate_profiles.leaderboard_eligible_from <= v_week.week_start
      AND (
        p_scope = 'global'
        OR (
          p_scope = 'league'
          AND EXISTS (
            SELECT 1 FROM public.reader_league_members league_member
            WHERE league_member.league_id = v_league_id
              AND league_member.user_id = scores.user_id
          )
        )
        OR (
          p_scope = 'friends'
          AND (
            scores.user_id = p_user_id
            OR (
              EXISTS (
                SELECT 1 FROM public.user_follows following
                WHERE following.follower_id = p_user_id
                  AND following.following_id = scores.user_id
              )
              AND EXISTS (
                SELECT 1 FROM public.user_follows follower
                WHERE follower.follower_id = scores.user_id
                  AND follower.following_id = p_user_id
              )
            )
          )
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.user_blocks blocks
        WHERE (blocks.blocker_id = p_user_id AND blocks.blocked_id = scores.user_id)
           OR (blocks.blocker_id = scores.user_id AND blocks.blocked_id = p_user_id)
      )
  ),
  ranked AS (
    SELECT
      candidates.*,
      ROW_NUMBER() OVER (
        ORDER BY
          candidates.competitive_ink DESC,
          candidates.quests_completed DESC,
          candidates.qualifying_minutes DESC,
          candidates.reading_days DESC,
          candidates.score_attained_at ASC NULLS LAST,
          candidates.user_id
      ) AS rank
    FROM candidates
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'user_id', ranked.user_id,
      'rank', ranked.rank,
      'competitive_ink', ranked.competitive_ink,
      'quests_completed', ranked.quests_completed,
      'qualifying_minutes', ranked.qualifying_minutes,
      'reading_days', ranked.reading_days,
      'display_name', CASE
        WHEN ranked.user_id = p_user_id
          OR (profiles.gamification_profile_visible AND profiles.profile_visibility <> 'private')
        THEN profiles.display_name
        ELSE 'Private Reader'
      END,
      'avatar_url', CASE
        WHEN ranked.user_id = p_user_id
          OR (profiles.gamification_profile_visible AND profiles.profile_visibility <> 'private')
        THEN profiles.avatar_url
        ELSE NULL
      END,
      'level', accounts.current_level,
      'level_title', levels.title,
      'is_current_user', ranked.user_id = p_user_id
    )
    ORDER BY ranked.rank
  ), '[]'::jsonb)
  INTO v_entries
  FROM ranked
  JOIN public.profiles ON profiles.id = ranked.user_id
  LEFT JOIN public.gamification_accounts accounts ON accounts.user_id = ranked.user_id
  LEFT JOIN public.gamification_levels levels ON levels.level = accounts.current_level
  WHERE ranked.rank <= LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);

  RETURN jsonb_build_object(
    'week', to_jsonb(v_week),
    'scope', p_scope,
    'entries', v_entries
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_gamification_settings(
  p_user_id UUID,
  p_leaderboard_opt_in BOOLEAN DEFAULT NULL,
  p_profile_visible BOOLEAN DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
  v_previous_opt_in BOOLEAN;
  v_next_week_start DATE;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_timezone IS NOT NULL THEN
    PERFORM now() AT TIME ZONE p_timezone;
  END IF;

  SELECT leaderboard_opt_in INTO v_previous_opt_in
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  v_next_week_start :=
    date_trunc('week', CURRENT_DATE::TIMESTAMP)::DATE + 7;

  UPDATE public.profiles
  SET
    leaderboard_opt_in = COALESCE(p_leaderboard_opt_in, leaderboard_opt_in),
    leaderboard_eligible_from = CASE
      WHEN p_leaderboard_opt_in = false THEN NULL
      WHEN p_leaderboard_opt_in = true AND NOT COALESCE(v_previous_opt_in, false)
        THEN v_next_week_start
      ELSE leaderboard_eligible_from
    END,
    gamification_profile_visible = COALESCE(p_profile_visible, gamification_profile_visible),
    timezone = COALESCE(NULLIF(p_timezone, ''), timezone),
    updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_profile;

  RETURN jsonb_build_object(
    'success', true,
    'leaderboard_opt_in', v_profile.leaderboard_opt_in,
    'leaderboard_eligible_from', v_profile.leaderboard_eligible_from,
    'gamification_profile_visible', v_profile.gamification_profile_visible,
    'timezone', v_profile.timezone
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_gamification_profile(
  p_viewer_id UUID,
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week public.gamification_weeks;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_viewer_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_blocks blocks
    WHERE (blocks.blocker_id = p_viewer_id AND blocks.blocked_id = p_target_user_id)
       OR (blocks.blocker_id = p_target_user_id AND blocks.blocked_id = p_viewer_id)
  ) THEN
    RETURN NULL;
  END IF;

  IF p_viewer_id IS DISTINCT FROM p_target_user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.profiles profiles
      WHERE profiles.id = p_target_user_id
        AND profiles.gamification_profile_visible = true
        AND profiles.profile_visibility <> 'private'
    ) THEN
    RETURN NULL;
  END IF;

  v_week := public.ensure_gamification_week(CURRENT_DATE);

  SELECT jsonb_build_object(
    'level', accounts.current_level,
    'level_title', levels.title,
    'lifetime_ink', accounts.lifetime_ink,
    'gold_leaves', CASE
      WHEN p_viewer_id = p_target_user_id THEN accounts.gold_leaves
      ELSE NULL
    END,
    'league_name', leagues.name,
    'league_rank', COALESCE(memberships.final_rank, memberships.provisional_rank),
    'league_status', leagues.status
  )
  INTO v_result
  FROM public.gamification_accounts accounts
  JOIN public.gamification_levels levels ON levels.level = accounts.current_level
  LEFT JOIN public.reader_league_members memberships
    ON memberships.user_id = accounts.user_id
  LEFT JOIN public.reader_leagues leagues
    ON leagues.id = memberships.league_id
   AND leagues.week_id = v_week.id
  WHERE accounts.user_id = p_target_user_id
  ORDER BY memberships.joined_at DESC NULLS LAST
  LIMIT 1;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_gamification_quest_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_created INTEGER := 0;
BEGIN
  FOR v_user IN
    SELECT
      profiles.id,
      profiles.timezone,
      (now() AT TIME ZONE profiles.timezone)::DATE AS local_date,
      (now() AT TIME ZONE profiles.timezone)::TIME AS local_time,
      COUNT(assignments.id) FILTER (WHERE assignments.status = 'active') AS active_quests
    FROM public.profiles profiles
    LEFT JOIN public.notification_preferences preferences
      ON preferences.user_id = profiles.id
    JOIN public.user_quest_assignments assignments
      ON assignments.user_id = profiles.id
     AND assignments.cadence = 'daily'
     AND assignments.assignment_date = (now() AT TIME ZONE profiles.timezone)::DATE
    WHERE COALESCE(profiles.is_active, true)
      AND COALESCE(preferences.quests_enabled, true)
      AND (now() AT TIME ZONE profiles.timezone)::TIME >= TIME '18:00'
      AND (now() AT TIME ZONE profiles.timezone)::TIME < TIME '19:00'
    GROUP BY profiles.id, profiles.timezone
    HAVING COUNT(assignments.id) FILTER (WHERE assignments.status = 'active') > 0
  LOOP
    PERFORM public.create_gamification_notification(
      v_user.id,
      'quest_reminder',
      'Today''s quests are still open',
      format(
        '%s quest%s can still be completed today.',
        v_user.active_quests,
        CASE WHEN v_user.active_quests = 1 THEN '' ELSE 's' END
      ),
      jsonb_build_object('date', v_user.local_date, 'active_quests', v_user.active_quests),
      'quest-reminder:' || v_user.local_date::TEXT
    );
    v_created := v_created + 1;
  END LOOP;

  RETURN v_created;
END;
$$;

CREATE OR REPLACE FUNCTION public.compact_gamification_history()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summaries INTEGER := 0;
  v_deleted INTEGER := 0;
BEGIN
  INSERT INTO public.user_gamification_week_summaries(
    user_id,
    week_start,
    quests_assigned,
    quests_completed,
    quest_ink_earned,
    gold_leaves_earned,
    competitive_ink,
    updated_at
  )
  SELECT
    assignments.user_id,
    assignments.assignment_date,
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE assignments.status = 'completed')::INTEGER,
    COALESCE(SUM(assignments.reward_ink) FILTER (WHERE assignments.status = 'completed'), 0)::INTEGER,
    COALESCE(SUM(assignments.reward_gold_leaves) FILTER (WHERE assignments.status = 'completed'), 0)::INTEGER,
    COALESCE(scores.competitive_ink, 0),
    now()
  FROM public.user_quest_assignments assignments
  LEFT JOIN public.gamification_weeks weeks
    ON weeks.week_start = assignments.assignment_date
  LEFT JOIN public.gamification_weekly_scores scores
    ON scores.week_id = weeks.id
   AND scores.user_id = assignments.user_id
  WHERE assignments.cadence = 'weekly'
    AND assignments.period_end < CURRENT_DATE - 90
  GROUP BY assignments.user_id, assignments.assignment_date, scores.competitive_ink
  ON CONFLICT (user_id, week_start) DO UPDATE SET
    quests_assigned = EXCLUDED.quests_assigned,
    quests_completed = EXCLUDED.quests_completed,
    quest_ink_earned = EXCLUDED.quest_ink_earned,
    gold_leaves_earned = EXCLUDED.gold_leaves_earned,
    competitive_ink = GREATEST(
      public.user_gamification_week_summaries.competitive_ink,
      EXCLUDED.competitive_ink
    ),
    updated_at = now();

  GET DIAGNOSTICS v_summaries = ROW_COUNT;

  DELETE FROM public.user_quest_assignments
  WHERE period_end < CURRENT_DATE - 90
    AND status IN ('completed', 'expired');

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'summaries_written', v_summaries,
    'assignments_deleted', v_deleted
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_gamification_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH source_counts AS (
    SELECT
      (
        SELECT COUNT(*)
        FROM public.reading_sessions sessions
        WHERE sessions.user_id = p_user_id
          AND COALESCE(sessions.duration, 0) >= 5
      ) AS qualifying_sessions,
      (
        SELECT COUNT(*)
        FROM public.progress_logs logs
        WHERE logs.user_id = p_user_id
          AND COALESCE(logs.log_type, 'manual') NOT IN ('correction', 'import')
      ) AS progress_logs,
      (
        SELECT COUNT(*)
        FROM public.books books
        WHERE books.user_id = p_user_id
          AND books.deleted_at IS NULL
          AND books.status = 'completed'
      ) AS completed_books
  ),
  ledger_counts AS (
    SELECT
      COUNT(*) FILTER (WHERE event_type = 'reading_session') AS session_rewards,
      COUNT(*) FILTER (WHERE event_type = 'page_progress') AS progress_rewards,
      COUNT(*) FILTER (WHERE event_type = 'book_completed') AS completion_rewards,
      COUNT(*) - COUNT(DISTINCT event_key) AS duplicate_event_keys
    FROM public.gamification_ledger
    WHERE user_id = p_user_id
  )
  SELECT jsonb_build_object(
    'user_id', p_user_id,
    'sources', to_jsonb(source_counts),
    'ledger', to_jsonb(ledger_counts),
    'missing_session_rewards', GREATEST(source_counts.qualifying_sessions - ledger_counts.session_rewards, 0),
    'missing_completion_rewards', GREATEST(source_counts.completed_books - ledger_counts.completion_rewards, 0),
    'duplicate_event_keys', ledger_counts.duplicate_event_keys,
    'checked_at', now()
  )
  FROM source_counts, ledger_counts;
$$;

ALTER FUNCTION public.add_library_book(UUID, JSONB)
RENAME TO add_library_book_without_series;

CREATE OR REPLACE FUNCTION public.add_library_book(
  p_user_id UUID,
  p_book JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_book public.books;
  v_book_id UUID;
BEGIN
  v_result := public.add_library_book_without_series(p_user_id, p_book);
  v_book_id := NULLIF(v_result->>'book_id', '')::UUID;

  IF COALESCE((v_result->>'success')::BOOLEAN, false)
    AND v_book_id IS NOT NULL
    AND COALESCE(v_result->>'action', '') IN ('created', 'restored') THEN
    UPDATE public.books
    SET
      series_name = NULLIF(trim(p_book->>'series_name'), ''),
      series_position = NULLIF(p_book->>'series_position', '')::NUMERIC,
      series_total = NULLIF(p_book->>'series_total', '')::INTEGER,
      updated_at = now()
    WHERE id = v_book_id
      AND user_id = p_user_id
    RETURNING * INTO v_book;

    IF v_book.id IS NOT NULL THEN
      v_result := jsonb_set(v_result, '{book}', to_jsonb(v_book), true);
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.add_library_book_without_series(UUID, JSONB)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_library_book_without_series(UUID, JSONB)
TO service_role;
GRANT EXECUTE ON FUNCTION public.add_library_book(UUID, JSONB)
TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gamification_book_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NULL
    AND COALESCE(NEW.metadata->>'import_source', '') = ''
    AND COALESCE(NEW.source_provider, '') NOT IN ('brack_import', 'goodreads_import') THEN
    PERFORM public.apply_gamification_event(
      NEW.user_id,
      'book_added',
      'book-added:' || NEW.id::TEXT,
      'book',
      NEW.id::TEXT,
      jsonb_build_object('title', NEW.title),
      COALESCE(NEW.created_at, now())
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.gamification_book_status_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_series_completed INTEGER;
  v_threshold INTEGER;
BEGIN
  IF OLD.status = 'to_read' AND NEW.status = 'reading' THEN
    PERFORM public.apply_gamification_event(
      NEW.user_id,
      'book_started',
      'book-started:' || NEW.id::TEXT,
      'book',
      NEW.id::TEXT,
      jsonb_build_object('title', NEW.title),
      now()
    );
  END IF;

  IF OLD.status IS DISTINCT FROM 'completed' AND NEW.status = 'completed' THEN
    PERFORM public.apply_gamification_event(
      NEW.user_id,
      'book_completed',
      'book-completed:' || NEW.id::TEXT,
      'book',
      NEW.id::TEXT,
      jsonb_build_object(
        'title', NEW.title,
        'book_pages', COALESCE(NEW.pages, 0),
        'series_name', NEW.series_name
      ),
      now()
    );
    PERFORM public.advance_user_quests(
      NEW.user_id,
      'books_completed',
      1,
      'book-completed:' || NEW.id::TEXT,
      now()
    );

    IF NEW.series_name IS NOT NULL THEN
      PERFORM public.advance_user_quests(
        NEW.user_id,
        'series_books_completed',
        1,
        'series-book-completed:' || NEW.id::TEXT,
        now()
      );

      SELECT COUNT(*) INTO v_series_completed
      FROM public.books
      WHERE user_id = NEW.user_id
        AND deleted_at IS NULL
        AND status = 'completed'
        AND lower(series_name) = lower(NEW.series_name);

      FOREACH v_threshold IN ARRAY ARRAY[2, 3, 5]
      LOOP
        IF v_series_completed >= v_threshold THEN
          PERFORM public.apply_gamification_event(
            NEW.user_id,
            'series_milestone',
            'series:' || md5(lower(NEW.series_name)) || ':' || v_threshold::TEXT,
            'series',
            NEW.series_name,
            jsonb_build_object('series_name', NEW.series_name, 'threshold', v_threshold),
            now()
          );
        END IF;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.gamification_session_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.duration, 0) >= 5 THEN
    PERFORM public.apply_gamification_event(
      NEW.user_id,
      'reading_session',
      'reading-session:' || NEW.id::TEXT,
      'reading_session',
      NEW.id::TEXT,
      jsonb_build_object('duration_minutes', NEW.duration, 'book_id', NEW.book_id),
      COALESCE(NEW.end_time, NEW.created_at, now())
    );
    PERFORM public.advance_user_quests(
      NEW.user_id,
      'reading_minutes',
      NEW.duration,
      'reading-session:' || NEW.id::TEXT,
      COALESCE(NEW.end_time, NEW.created_at, now())
    );
    PERFORM public.advance_user_quests(
      NEW.user_id,
      'sessions',
      1,
      'reading-session:' || NEW.id::TEXT,
      COALESCE(NEW.end_time, NEW.created_at, now())
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.gamification_progress_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_page INTEGER := 0;
  v_delta INTEGER := 0;
  v_velocity NUMERIC := 0;
BEGIN
  IF COALESCE(NEW.log_type, 'manual') IN ('correction', 'import') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(page_number), 0)
  INTO v_previous_page
  FROM public.progress_logs
  WHERE user_id = NEW.user_id
    AND book_id = NEW.book_id
    AND id <> NEW.id
    AND logged_at <= NEW.logged_at;

  v_delta := GREATEST(NEW.page_number - v_previous_page, 0);

  IF v_delta > 0 THEN
    PERFORM public.apply_gamification_event(
      NEW.user_id,
      'page_progress',
      'page-progress:' || NEW.id::TEXT,
      'progress_log',
      NEW.id::TEXT,
      jsonb_build_object('pages_read', v_delta, 'book_id', NEW.book_id),
      COALESCE(NEW.logged_at, now())
    );
    PERFORM public.advance_user_quests(
      NEW.user_id,
      'pages_read',
      v_delta,
      'page-progress:' || NEW.id::TEXT,
      COALESCE(NEW.logged_at, now())
    );
  END IF;

  IF v_delta >= 5 AND COALESCE(NEW.time_spent_minutes, 0) >= 15 THEN
    v_velocity := v_delta::NUMERIC / (NEW.time_spent_minutes::NUMERIC / 60.0);
    PERFORM public.advance_user_quests(
      NEW.user_id,
      'velocity',
      v_velocity,
      'reading-velocity:' || NEW.id::TEXT,
      COALESCE(NEW.logged_at, now())
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.gamification_streak_day_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_activity BOOLEAN;
BEGIN
  v_has_activity := COALESCE(NEW.session_count, 0) > 0
    OR COALESCE(NEW.progress_log_count, 0) > 0;

  IF v_has_activity THEN
    PERFORM public.apply_gamification_event(
      NEW.user_id,
      'daily_activity',
      'daily-activity:' || NEW.activity_date::TEXT,
      'reading_streak_day',
      NEW.id::TEXT,
      jsonb_build_object('activity_date', NEW.activity_date),
      NEW.activity_date::TIMESTAMPTZ + INTERVAL '12 hours'
    );
    PERFORM public.advance_user_quests(
      NEW.user_id,
      'reading_days',
      1,
      'daily-activity:' || NEW.activity_date::TEXT,
      NEW.activity_date::TIMESTAMPTZ + INTERVAL '12 hours'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.gamification_profile_streak_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold INTEGER;
BEGIN
  IF NEW.current_streak > COALESCE(OLD.current_streak, 0) THEN
    FOREACH v_threshold IN ARRAY ARRAY[30, 100, 365]
    LOOP
      IF NEW.current_streak >= v_threshold AND COALESCE(OLD.current_streak, 0) < v_threshold THEN
        PERFORM public.apply_gamification_event(
          NEW.id,
          'streak_milestone',
          'streak-milestone:' || v_threshold::TEXT,
          'profile',
          NEW.id::TEXT,
          jsonb_build_object('threshold', v_threshold),
          now()
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.gamification_badge_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.apply_gamification_event(
    NEW.user_id,
    'badge_earned',
    'badge-earned:' || NEW.badge_id::TEXT,
    'badge',
    NEW.badge_id::TEXT,
    '{}'::jsonb,
    COALESCE(NEW.earned_at, now())
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gamification_book_insert ON public.books;
CREATE TRIGGER gamification_book_insert
AFTER INSERT ON public.books
FOR EACH ROW EXECUTE FUNCTION public.gamification_book_insert_trigger();

DROP TRIGGER IF EXISTS gamification_book_status ON public.books;
CREATE TRIGGER gamification_book_status
AFTER UPDATE OF status ON public.books
FOR EACH ROW EXECUTE FUNCTION public.gamification_book_status_trigger();

DROP TRIGGER IF EXISTS gamification_session_insert ON public.reading_sessions;
CREATE TRIGGER gamification_session_insert
AFTER INSERT ON public.reading_sessions
FOR EACH ROW EXECUTE FUNCTION public.gamification_session_insert_trigger();

DROP TRIGGER IF EXISTS gamification_progress_insert ON public.progress_logs;
CREATE TRIGGER gamification_progress_insert
AFTER INSERT ON public.progress_logs
FOR EACH ROW EXECUTE FUNCTION public.gamification_progress_insert_trigger();

DROP TRIGGER IF EXISTS gamification_streak_day ON public.reading_streak_days;
CREATE TRIGGER gamification_streak_day
AFTER INSERT OR UPDATE OF session_count, progress_log_count ON public.reading_streak_days
FOR EACH ROW EXECUTE FUNCTION public.gamification_streak_day_trigger();

DROP TRIGGER IF EXISTS gamification_profile_streak ON public.profiles;
CREATE TRIGGER gamification_profile_streak
AFTER UPDATE OF current_streak ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.gamification_profile_streak_trigger();

DROP TRIGGER IF EXISTS gamification_badge_insert ON public.user_badges;
CREATE TRIGGER gamification_badge_insert
AFTER INSERT ON public.user_badges
FOR EACH ROW EXECUTE FUNCTION public.gamification_badge_insert_trigger();

INSERT INTO public.gamification_accounts(user_id)
SELECT id FROM public.profiles
ON CONFLICT DO NOTHING;

INSERT INTO public.gamification_ledger(
  user_id,
  event_key,
  event_type,
  ink_delta,
  gold_leaves_delta,
  metadata,
  occurred_at
)
SELECT
  profiles.id,
  'historical-backfill:v1',
  'historical_backfill',
  LEAST(
    5000,
    COALESCE(completed_books.count, 0) * 25
      + LEAST(1000, FLOOR(COALESCE(reading_minutes.total, 0) / 10.0)::INTEGER)
      + COALESCE(badge_counts.count, 0) * 20
  ),
  CASE
    WHEN COALESCE(profiles.longest_streak, 0) >= 365 THEN 5
    WHEN COALESCE(profiles.longest_streak, 0) >= 100 THEN 2
    WHEN COALESCE(profiles.longest_streak, 0) >= 30 THEN 1
    ELSE 0
  END,
  jsonb_build_object('version', 1, 'historical', true),
  now()
FROM public.profiles
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INTEGER
  FROM public.books
  WHERE books.user_id = profiles.id
    AND books.deleted_at IS NULL
    AND books.status = 'completed'
) completed_books ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(duration), 0)::INTEGER AS total
  FROM public.reading_sessions
  WHERE reading_sessions.user_id = profiles.id
) reading_minutes ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INTEGER
  FROM public.user_badges
  WHERE user_badges.user_id = profiles.id
) badge_counts ON true
ON CONFLICT (user_id, event_key) DO NOTHING;

UPDATE public.gamification_accounts accounts
SET
  lifetime_ink = totals.ink,
  gold_leaves = totals.gold,
  current_level = (
    SELECT COALESCE(MAX(level), 1)
    FROM public.gamification_levels
    WHERE ink_threshold <= totals.ink
  ),
  updated_at = now()
FROM (
  SELECT
    user_id,
    COALESCE(SUM(ink_delta), 0)::BIGINT AS ink,
    COALESCE(SUM(gold_leaves_delta), 0)::INTEGER AS gold
  FROM public.gamification_ledger
  GROUP BY user_id
) totals
WHERE accounts.user_id = totals.user_id;

UPDATE public.profiles
SET leaderboard_eligible_from = date_trunc('week', CURRENT_DATE::TIMESTAMP)::DATE
WHERE leaderboard_opt_in = true
  AND leaderboard_eligible_from IS NULL;

INSERT INTO public.app_feature_flags(key, enabled, config)
VALUES
  ('gamification', true, '{"version":1}'::jsonb),
  ('leaderboards', true, '{"version":1,"opt_in":true}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  config = EXCLUDED.config,
  updated_at = now();

SELECT pgmq.create('gamification_jobs')
WHERE NOT EXISTS (
  SELECT 1 FROM pgmq.meta WHERE queue_name = 'gamification_jobs'
);

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN (
  'brack-gamification-rollover',
  'brack-gamification-quest-reminders',
  'brack-gamification-retention'
);

SELECT cron.schedule(
  'brack-gamification-rollover',
  '17 * * * *',
  $$SELECT pgmq.send('gamification_jobs', '{"kind":"weekly_rollover"}'::jsonb);$$
);

SELECT cron.schedule(
  'brack-gamification-quest-reminders',
  '7 * * * *',
  $$SELECT pgmq.send('gamification_jobs', '{"kind":"quest_reminders"}'::jsonb);$$
);

SELECT cron.schedule(
  'brack-gamification-retention',
  '23 3 * * *',
  $$SELECT public.compact_gamification_history();$$
);

DO $$
DECLARE
  v_project_url TEXT;
  v_worker_secret TEXT;
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE $query$
    SELECT
      MAX(decrypted_secret) FILTER (WHERE name = 'project_url'),
      MAX(decrypted_secret) FILTER (WHERE name = 'gamification_worker_secret')
    FROM vault.decrypted_secrets
  $query$
  INTO v_project_url, v_worker_secret;

  IF v_project_url IS NOT NULL AND v_worker_secret IS NOT NULL THEN
    PERFORM cron.schedule(
      'brack-gamification-worker',
      '* * * * *',
      format(
        $job$
          SELECT net.http_post(
            url := %L || '/functions/v1/gamification-worker',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'X-Brack-Worker-Secret', %L
            ),
            body := '{"source":"cron"}'::jsonb
          );
        $job$,
        v_project_url,
        v_worker_secret
      )
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_gamification_week(DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_gamification_notification(UUID, TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quest_target_for_user(UUID, TEXT, NUMERIC, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_user_quests(UUID, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_reader_league_rank(UUID, UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_gamification_event(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_user_quests(UUID, TEXT, NUMERIC, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_reader_leagues(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_gamification_week(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_gamification_rollover() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_gamification_jobs(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_gamification_job(BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_gamification_home(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_gamification_history(UUID, TIMESTAMPTZ, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_reader_leaderboard(UUID, TEXT, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_gamification_settings(UUID, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_gamification_profile(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_gamification_quest_reminders() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compact_gamification_history() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_gamification_user(UUID) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE
  public.gamification_reward_rules,
  public.gamification_levels,
  public.gamification_accounts,
  public.gamification_ledger,
  public.gamification_daily_scores,
  public.gamification_weeks,
  public.gamification_weekly_scores,
  public.quest_templates,
  public.user_quest_assignments,
  public.user_quest_progress_events,
  public.user_gamification_week_summaries,
  public.reader_leagues,
  public.reader_league_members,
  public.user_notifications
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.user_notifications TO authenticated;
GRANT UPDATE (read_at) ON TABLE public.user_notifications TO authenticated;

GRANT EXECUTE ON FUNCTION public.ensure_gamification_week(DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_gamification_notification(UUID, TEXT, TEXT, TEXT, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.quest_target_for_user(UUID, TEXT, NUMERIC, NUMERIC, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_user_quests(UUID, TIMESTAMPTZ, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_reader_league_rank(UUID, UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_gamification_event(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.advance_user_quests(UUID, TEXT, NUMERIC, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.assign_reader_leagues(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_gamification_week(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_gamification_rollover() TO service_role;
GRANT EXECUTE ON FUNCTION public.read_gamification_jobs(INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_gamification_job(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_gamification_home(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_gamification_history(UUID, TIMESTAMPTZ, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_reader_leaderboard(UUID, TEXT, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_gamification_settings(UUID, BOOLEAN, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_gamification_profile(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_gamification_quest_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.compact_gamification_history() TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_gamification_user(UUID) TO service_role;
