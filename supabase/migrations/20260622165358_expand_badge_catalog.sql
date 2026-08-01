-- Expand the original ten-title badge implementation into a categorized,
-- progress-aware catalog. Badge rules stay server-owned and exactly-once
-- ownership remains protected by user_badges(user_id, badge_id).

ALTER TABLE public.badges
ADD COLUMN IF NOT EXISTS code TEXT,
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'journey',
ADD COLUMN IF NOT EXISTS tier SMALLINT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS rarity TEXT NOT NULL DEFAULT 'common',
ADD COLUMN IF NOT EXISTS metric_key TEXT,
ADD COLUMN IF NOT EXISTS target_value NUMERIC NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS event_types TEXT[] NOT NULL DEFAULT ARRAY['manual_check']::TEXT[],
ADD COLUMN IF NOT EXISTS icon_key TEXT,
ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS is_secret BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.user_badges
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'earned',
ADD COLUMN IF NOT EXISTS reward_eligible BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS progress_value NUMERIC;

ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS badges_enabled BOOLEAN NOT NULL DEFAULT true;

UPDATE public.user_badges
SET source = 'legacy',
    reward_eligible = false
WHERE source = 'earned'
  AND earned_at < now();

UPDATE public.badges
SET
  code = CASE title
    WHEN 'First Book' THEN 'first-book'
    WHEN 'Bookworm' THEN 'bookworm'
    WHEN 'Century Reader' THEN 'century-reader'
    WHEN 'Speed Reader' THEN 'speed-reader'
    WHEN 'Dedicated Reader' THEN 'dedicated-reader'
    WHEN 'Marathon Reader' THEN 'marathon-reader'
    WHEN 'Genre Explorer' THEN 'genre-explorer'
    WHEN 'Night Owl' THEN 'night-owl'
    WHEN 'Early Bird' THEN 'early-bird'
    WHEN 'Consistent Reader' THEN 'consistent-reader'
    ELSE code
  END
WHERE code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_badges_code
ON public.badges(code);

CREATE INDEX IF NOT EXISTS idx_badges_catalog_order
ON public.badges(is_active, category, sort_order, tier);

ALTER TABLE public.badges
DROP CONSTRAINT IF EXISTS badges_category_check;
ALTER TABLE public.badges
ADD CONSTRAINT badges_category_check
CHECK (category IN (
  'collection',
  'completion',
  'streak',
  'time',
  'pages',
  'exploration',
  'craft',
  'journey'
));

ALTER TABLE public.badges
DROP CONSTRAINT IF EXISTS badges_tier_check;
ALTER TABLE public.badges
ADD CONSTRAINT badges_tier_check CHECK (tier BETWEEN 1 AND 5);

ALTER TABLE public.badges
DROP CONSTRAINT IF EXISTS badges_rarity_check;
ALTER TABLE public.badges
ADD CONSTRAINT badges_rarity_check
CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary'));

ALTER TABLE public.badges
DROP CONSTRAINT IF EXISTS badges_target_value_check;
ALTER TABLE public.badges
ADD CONSTRAINT badges_target_value_check CHECK (target_value > 0);

INSERT INTO public.badges (
  code,
  title,
  description,
  category,
  tier,
  rarity,
  metric_key,
  target_value,
  event_types,
  icon_key,
  sort_order
)
VALUES
  ('first-book', 'First Book', 'Add your first book to Brack.', 'collection', 1, 'common', 'library_books', 1, ARRAY['book_added'], 'book', 101),
  ('shelf-starter', 'Shelf Starter', 'Build a library of 10 books.', 'collection', 2, 'common', 'library_books', 10, ARRAY['book_added'], 'book-stack', 102),
  ('home-library', 'Home Library', 'Build a library of 25 books.', 'collection', 3, 'uncommon', 'library_books', 25, ARRAY['book_added'], 'bookshelf', 103),
  ('shelf-keeper', 'Shelf Keeper', 'Build a library of 50 books.', 'collection', 4, 'rare', 'library_books', 50, ARRAY['book_added'], 'bookmark-book', 104),
  ('grand-library', 'Grand Library', 'Build a library of 100 books.', 'collection', 5, 'legendary', 'library_books', 100, ARRAY['book_added'], 'library', 105),

  ('first-finish', 'First Finish', 'Complete your first book.', 'completion', 1, 'common', 'completed_books', 1, ARRAY['book_completed'], 'badge-check', 201),
  ('chapter-closer', 'Chapter Closer', 'Complete 5 books.', 'completion', 2, 'common', 'completed_books', 5, ARRAY['book_completed'], 'check-circle', 202),
  ('bookworm', 'Bookworm', 'Complete 10 books.', 'completion', 2, 'uncommon', 'completed_books', 10, ARRAY['book_completed'], 'open-book', 203),
  ('reading-veteran', 'Reading Veteran', 'Complete 25 books.', 'completion', 3, 'rare', 'completed_books', 25, ARRAY['book_completed'], 'medal', 204),
  ('bibliophile', 'Bibliophile', 'Complete 50 books.', 'completion', 4, 'epic', 'completed_books', 50, ARRAY['book_completed'], 'medal-first', 205),
  ('century-reader', 'Century Reader', 'Complete 100 books.', 'completion', 5, 'legendary', 'completed_books', 100, ARRAY['book_completed'], 'trophy', 206),

  ('three-day-spark', 'Three-Day Spark', 'Read on 3 consecutive days.', 'streak', 1, 'common', 'longest_streak', 3, ARRAY['reading_session_created','progress_logged','reading_activity_updated'], 'fire', 301),
  ('dedicated-reader', 'Dedicated Reader', 'Maintain a 7-day reading streak.', 'streak', 2, 'common', 'longest_streak', 7, ARRAY['reading_session_created','progress_logged','reading_activity_updated'], 'fire', 302),
  ('fortnight-focus', 'Fortnight Focus', 'Maintain a 14-day reading streak.', 'streak', 2, 'uncommon', 'longest_streak', 14, ARRAY['reading_session_created','progress_logged','reading_activity_updated'], 'calendar-check', 303),
  ('consistent-reader', 'Consistent Reader', 'Maintain a 30-day reading streak.', 'streak', 3, 'rare', 'longest_streak', 30, ARRAY['reading_session_created','progress_logged','reading_activity_updated'], 'calendar-check', 304),
  ('season-reader', 'Season Reader', 'Maintain a 60-day reading streak.', 'streak', 4, 'epic', 'longest_streak', 60, ARRAY['reading_session_created','progress_logged','reading_activity_updated'], 'leaderboard-star', 305),
  ('hundred-day-habit', 'Hundred-Day Habit', 'Maintain a 100-day reading streak.', 'streak', 4, 'epic', 'longest_streak', 100, ARRAY['reading_session_created','progress_logged','reading_activity_updated'], 'leaderboard-star', 306),
  ('yearbound', 'Yearbound', 'Maintain a 365-day reading streak.', 'streak', 5, 'legendary', 'longest_streak', 365, ARRAY['reading_session_created','progress_logged','reading_activity_updated'], 'medal-first', 307),

  ('first-hour', 'First Hour', 'Record 1 hour of focused reading.', 'time', 1, 'common', 'total_minutes', 60, ARRAY['reading_session_created','progress_logged'], 'clock', 401),
  ('ten-hour-reader', 'Ten-Hour Reader', 'Record 10 hours of reading.', 'time', 2, 'common', 'total_minutes', 600, ARRAY['reading_session_created','progress_logged'], 'clock', 402),
  ('deep-focus', 'Deep Focus', 'Record 25 hours of reading.', 'time', 3, 'uncommon', 'total_minutes', 1500, ARRAY['reading_session_created','progress_logged'], 'timer', 403),
  ('long-haul', 'Long Haul', 'Record 50 hours of reading.', 'time', 4, 'rare', 'total_minutes', 3000, ARRAY['reading_session_created','progress_logged'], 'timer', 404),
  ('hundred-hour-reader', 'Hundred-Hour Reader', 'Record 100 hours of reading.', 'time', 5, 'epic', 'total_minutes', 6000, ARRAY['reading_session_created','progress_logged'], 'hourglass', 405),
  ('early-bird', 'Early Bird', 'Complete 5 qualifying reading sessions before 8 AM.', 'time', 3, 'uncommon', 'early_sessions', 5, ARRAY['reading_session_created'], 'sunrise', 406),
  ('night-owl', 'Night Owl', 'Complete 5 qualifying reading sessions after 10 PM.', 'time', 3, 'uncommon', 'late_sessions', 5, ARRAY['reading_session_created'], 'moon', 407),

  ('page-turner', 'Page Turner', 'Advance through 100 pages.', 'pages', 1, 'common', 'pages_read', 100, ARRAY['progress_logged','book_completed'], 'page', 501),
  ('margin-maker', 'Margin Maker', 'Advance through 500 pages.', 'pages', 2, 'common', 'pages_read', 500, ARRAY['progress_logged','book_completed'], 'page-right', 502),
  ('thousand-pages', 'Thousand Pages', 'Advance through 1,000 pages.', 'pages', 3, 'uncommon', 'pages_read', 1000, ARRAY['progress_logged','book_completed'], 'multiple-pages', 503),
  ('page-voyager', 'Page Voyager', 'Advance through 2,500 pages.', 'pages', 3, 'rare', 'pages_read', 2500, ARRAY['progress_logged','book_completed'], 'multiple-pages', 504),
  ('five-thousand-pages', 'Five Thousand Pages', 'Advance through 5,000 pages.', 'pages', 4, 'epic', 'pages_read', 5000, ARRAY['progress_logged','book_completed'], 'book-stack', 505),
  ('ten-thousand-pages', 'Ten Thousand Pages', 'Advance through 10,000 pages.', 'pages', 5, 'legendary', 'pages_read', 10000, ARRAY['progress_logged','book_completed'], 'library', 506),

  ('genre-hopper', 'Genre Hopper', 'Complete books in 3 different genres.', 'exploration', 1, 'common', 'completed_genres', 3, ARRAY['book_completed'], 'compass', 601),
  ('genre-explorer', 'Genre Explorer', 'Complete books in 5 different genres.', 'exploration', 2, 'uncommon', 'completed_genres', 5, ARRAY['book_completed'], 'compass', 602),
  ('wide-horizons', 'Wide Horizons', 'Complete books in 10 different genres.', 'exploration', 4, 'rare', 'completed_genres', 10, ARRAY['book_completed'], 'map', 603),
  ('author-acquaintance', 'Author Acquaintance', 'Complete books by 10 different authors.', 'exploration', 2, 'common', 'completed_authors', 10, ARRAY['book_completed'], 'user', 604),
  ('author-atlas', 'Author Atlas', 'Complete books by 25 different authors.', 'exploration', 4, 'epic', 'completed_authors', 25, ARRAY['book_completed'], 'community', 605),
  ('series-reader', 'Series Reader', 'Complete 3 books from the same series.', 'exploration', 3, 'rare', 'largest_completed_series', 3, ARRAY['book_completed'], 'bookmark-book', 606),
  ('marathon-reader', 'Marathon Reader', 'Complete a book with at least 500 pages.', 'exploration', 3, 'rare', 'long_books_completed', 1, ARRAY['book_completed'], 'flash', 607),

  ('list-maker', 'List Maker', 'Create your first book list.', 'craft', 1, 'common', 'lists_created', 1, ARRAY['list_created'], 'list', 701),
  ('curator', 'Curator', 'Create 5 book lists.', 'craft', 3, 'uncommon', 'lists_created', 5, ARRAY['list_created'], 'bookmark-book', 702),
  ('first-review', 'First Review', 'Publish your first book review.', 'craft', 1, 'common', 'reviews_written', 1, ARRAY['review_created'], 'star', 703),
  ('thoughtful-critic', 'Thoughtful Critic', 'Publish 10 book reviews.', 'craft', 4, 'rare', 'reviews_written', 10, ARRAY['review_created'], 'reports', 704),
  ('goal-setter', 'Goal Setter', 'Complete your first reading goal.', 'craft', 2, 'common', 'goals_completed', 1, ARRAY['goal_completed'], 'flag', 705),
  ('goal-getter', 'Goal Getter', 'Complete 5 reading goals.', 'craft', 4, 'rare', 'goals_completed', 5, ARRAY['goal_completed'], 'target', 706),

  ('quest-begun', 'Quest Begun', 'Complete your first Brack quest.', 'journey', 1, 'common', 'quests_completed', 1, ARRAY['quest_completed'], 'spark', 801),
  ('quest-runner', 'Quest Runner', 'Complete 10 Brack quests.', 'journey', 2, 'uncommon', 'quests_completed', 10, ARRAY['quest_completed'], 'calendar-check', 802),
  ('quest-master', 'Quest Master', 'Complete 50 Brack quests.', 'journey', 5, 'epic', 'quests_completed', 50, ARRAY['quest_completed'], 'medal-first', 803),
  ('league-debut', 'League Debut', 'Finish your first Reader League week.', 'journey', 2, 'common', 'league_weeks', 1, ARRAY['league_finalized'], 'leaderboard', 804),
  ('podium-reader', 'Podium Reader', 'Finish in the top three of a Reader League.', 'journey', 4, 'epic', 'league_podiums', 1, ARRAY['league_finalized'], 'medal', 805),
  ('first-edition-champion', 'First Edition Champion', 'Win a Reader League.', 'journey', 5, 'legendary', 'league_wins', 1, ARRAY['league_finalized'], 'trophy', 806),
  ('speed-reader', 'Speed Reader', 'Complete 5 books within 30 days.', 'journey', 4, 'rare', 'completed_books_30d', 5, ARRAY['book_completed'], 'flash', 807)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  tier = EXCLUDED.tier,
  rarity = EXCLUDED.rarity,
  metric_key = EXCLUDED.metric_key,
  target_value = EXCLUDED.target_value,
  event_types = EXCLUDED.event_types,
  icon_key = EXCLUDED.icon_key,
  sort_order = EXCLUDED.sort_order,
  is_active = true;

ALTER TABLE public.badges
ALTER COLUMN code SET NOT NULL,
ALTER COLUMN metric_key SET NOT NULL;

CREATE OR REPLACE FUNCTION public.get_badge_metric_snapshot(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_timezone TEXT := 'UTC';
  v_metrics JSONB;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User is required';
  END IF;

  SELECT COALESCE(NULLIF(timezone, ''), 'UTC')
  INTO v_timezone
  FROM public.profiles
  WHERE id = p_user_id;

  WITH book_metrics AS (
    SELECT
      COUNT(*)::NUMERIC AS library_books,
      COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC AS completed_books,
      COUNT(*) FILTER (
        WHERE status = 'completed'
          AND date_finished >= CURRENT_DATE - 29
      )::NUMERIC AS completed_books_30d,
      COUNT(*) FILTER (
        WHERE status = 'completed'
          AND COALESCE(pages, 0) >= 500
      )::NUMERIC AS long_books_completed,
      COUNT(DISTINCT lower(trim(genre))) FILTER (
        WHERE status = 'completed'
          AND NULLIF(trim(genre), '') IS NOT NULL
      )::NUMERIC AS completed_genres,
      COUNT(DISTINCT lower(trim(author))) FILTER (
        WHERE status = 'completed'
          AND NULLIF(trim(author), '') IS NOT NULL
      )::NUMERIC AS completed_authors,
      COALESCE(SUM(
        CASE
          WHEN status = 'completed' AND COALESCE(pages, 0) > 0 THEN pages
          ELSE GREATEST(COALESCE(current_page, 0), 0)
        END
      ), 0)::NUMERIC AS pages_read
    FROM public.books
    WHERE user_id = p_user_id
      AND deleted_at IS NULL
  ),
  series_metrics AS (
    SELECT COALESCE(MAX(series_count), 0)::NUMERIC AS largest_completed_series
    FROM (
      SELECT COUNT(*) AS series_count
      FROM public.books
      WHERE user_id = p_user_id
        AND deleted_at IS NULL
        AND status = 'completed'
        AND NULLIF(trim(series_name), '') IS NOT NULL
      GROUP BY lower(trim(series_name))
    ) completed_series
  ),
  session_metrics AS (
    SELECT
      COALESCE(SUM(GREATEST(COALESCE(duration, 0), 0)), 0)::NUMERIC AS session_minutes,
      COUNT(*) FILTER (
        WHERE COALESCE(duration, 0) >= 15
          AND EXTRACT(HOUR FROM COALESCE(start_time, created_at) AT TIME ZONE v_timezone) >= 5
          AND EXTRACT(HOUR FROM COALESCE(start_time, created_at) AT TIME ZONE v_timezone) < 8
      )::NUMERIC AS early_sessions,
      COUNT(*) FILTER (
        WHERE COALESCE(duration, 0) >= 15
          AND (
            EXTRACT(HOUR FROM COALESCE(start_time, created_at) AT TIME ZONE v_timezone) >= 22
            OR EXTRACT(HOUR FROM COALESCE(start_time, created_at) AT TIME ZONE v_timezone) < 2
          )
      )::NUMERIC AS late_sessions
    FROM public.reading_sessions
    WHERE user_id = p_user_id
  ),
  standalone_log_metrics AS (
    SELECT COALESCE(SUM(GREATEST(COALESCE(time_spent_minutes, 0), 0)), 0)::NUMERIC AS log_minutes
    FROM public.progress_logs
    WHERE user_id = p_user_id
      AND session_id IS NULL
  ),
  profile_metrics AS (
    SELECT GREATEST(COALESCE(longest_streak, 0), COALESCE(current_streak, 0))::NUMERIC AS longest_streak
    FROM public.profiles
    WHERE id = p_user_id
  ),
  craft_metrics AS (
    SELECT
      (SELECT COUNT(*) FROM public.book_lists WHERE user_id = p_user_id AND deleted_at IS NULL)::NUMERIC AS lists_created,
      (SELECT COUNT(*) FROM public.book_reviews WHERE user_id = p_user_id AND deleted_at IS NULL)::NUMERIC AS reviews_written,
      (SELECT COUNT(*) FROM public.goals WHERE user_id = p_user_id AND deleted_at IS NULL AND is_completed = true)::NUMERIC AS goals_completed
  ),
  journey_metrics AS (
    SELECT
      (SELECT COUNT(*) FROM public.user_quest_assignments WHERE user_id = p_user_id AND status = 'completed')::NUMERIC AS quests_completed,
      (SELECT COUNT(*) FROM public.reader_league_members WHERE user_id = p_user_id AND finalized_at IS NOT NULL)::NUMERIC AS league_weeks,
      (SELECT COUNT(*) FROM public.reader_league_members WHERE user_id = p_user_id AND final_rank BETWEEN 1 AND 3)::NUMERIC AS league_podiums,
      (SELECT COUNT(*) FROM public.reader_league_members WHERE user_id = p_user_id AND final_rank = 1)::NUMERIC AS league_wins
  )
  SELECT jsonb_build_object(
    'library_books', books.library_books,
    'completed_books', books.completed_books,
    'completed_books_30d', books.completed_books_30d,
    'long_books_completed', books.long_books_completed,
    'completed_genres', books.completed_genres,
    'completed_authors', books.completed_authors,
    'largest_completed_series', series.largest_completed_series,
    'pages_read', books.pages_read,
    'total_minutes', sessions.session_minutes + logs.log_minutes,
    'early_sessions', sessions.early_sessions,
    'late_sessions', sessions.late_sessions,
    'longest_streak', COALESCE(profile.longest_streak, 0),
    'lists_created', craft.lists_created,
    'reviews_written', craft.reviews_written,
    'goals_completed', craft.goals_completed,
    'quests_completed', journey.quests_completed,
    'league_weeks', journey.league_weeks,
    'league_podiums', journey.league_podiums,
    'league_wins', journey.league_wins
  )
  INTO v_metrics
  FROM book_metrics books
  CROSS JOIN series_metrics series
  CROSS JOIN session_metrics sessions
  CROSS JOIN standalone_log_metrics logs
  LEFT JOIN profile_metrics profile ON true
  CROSS JOIN craft_metrics craft
  CROSS JOIN journey_metrics journey;

  RETURN COALESCE(v_metrics, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.award_badges(
  p_user_id UUID,
  p_event TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metrics JSONB;
  v_awarded JSONB := '[]'::jsonb;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User is required';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not allowed to award badges for this user';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('badge-award:' || p_user_id::TEXT, 0));
  v_metrics := public.get_badge_metric_snapshot(p_user_id);

  WITH eligible_badges AS (
    SELECT
      badges.*,
      COALESCE((v_metrics->>badges.metric_key)::NUMERIC, 0) AS progress_value
    FROM public.badges
    WHERE badges.is_active = true
      AND COALESCE((v_metrics->>badges.metric_key)::NUMERIC, 0) >= badges.target_value
      AND (
        p_event IS NULL
        OR p_event IN ('manual_check', 'historical_backfill')
        OR p_event = ANY(badges.event_types)
      )
  ),
  inserted_badges AS (
    INSERT INTO public.user_badges (
      user_id,
      badge_id,
      source,
      reward_eligible,
      progress_value
    )
    SELECT
      p_user_id,
      eligible_badges.id,
      CASE WHEN p_event = 'historical_backfill' THEN 'historical_backfill' ELSE 'earned' END,
      p_event IS DISTINCT FROM 'historical_backfill',
      eligible_badges.progress_value
    FROM eligible_badges
    ON CONFLICT (user_id, badge_id) DO NOTHING
    RETURNING badge_id, earned_at, progress_value
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', badges.id,
        'code', badges.code,
        'title', badges.title,
        'description', badges.description,
        'icon_url', badges.icon_url,
        'icon_key', badges.icon_key,
        'category', badges.category,
        'tier', badges.tier,
        'rarity', badges.rarity,
        'target_value', badges.target_value,
        'progress_value', inserted_badges.progress_value,
        'created_at', badges.created_at,
        'earned_at', inserted_badges.earned_at
      )
      ORDER BY badges.sort_order
    ),
    '[]'::jsonb
  )
  INTO v_awarded
  FROM inserted_badges
  JOIN public.badges ON badges.id = inserted_badges.badge_id;

  RETURN jsonb_build_object(
    'success', true,
    'event', p_event,
    'awarded_badges', v_awarded,
    'awarded_count', jsonb_array_length(v_awarded)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_badge_catalog(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_metrics JSONB;
  v_badges JSONB;
  v_earned JSONB;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User is required';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not allowed to view badges for this user';
  END IF;

  v_metrics := public.get_badge_metric_snapshot(p_user_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', badges.id,
        'code', badges.code,
        'title', CASE WHEN badges.is_secret AND user_badges.id IS NULL THEN 'Hidden badge' ELSE badges.title END,
        'description', CASE WHEN badges.is_secret AND user_badges.id IS NULL THEN 'Keep reading to reveal this badge.' ELSE badges.description END,
        'icon_url', badges.icon_url,
        'icon_key', badges.icon_key,
        'category', badges.category,
        'tier', badges.tier,
        'rarity', badges.rarity,
        'metric_key', badges.metric_key,
        'target_value', badges.target_value,
        'event_types', badges.event_types,
        'sort_order', badges.sort_order,
        'is_active', badges.is_active,
        'is_secret', badges.is_secret,
        'progress_value', LEAST(COALESCE((v_metrics->>badges.metric_key)::NUMERIC, 0), badges.target_value),
        'progress_percentage', LEAST(
          100,
          ROUND((COALESCE((v_metrics->>badges.metric_key)::NUMERIC, 0) / badges.target_value) * 100, 1)
        ),
        'earned_at', user_badges.earned_at
      )
      ORDER BY badges.sort_order
    ),
    '[]'::jsonb
  )
  INTO v_badges
  FROM public.badges
  LEFT JOIN public.user_badges
    ON user_badges.badge_id = badges.id
   AND user_badges.user_id = p_user_id
  WHERE badges.is_active = true;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', user_badges.id,
        'user_id', user_badges.user_id,
        'badge_id', user_badges.badge_id,
        'earned_at', user_badges.earned_at,
        'source', user_badges.source,
        'reward_eligible', user_badges.reward_eligible,
        'progress_value', user_badges.progress_value
      )
      ORDER BY user_badges.earned_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_earned
  FROM public.user_badges
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'badges', v_badges,
    'earned_badges', v_earned,
    'metrics', v_metrics,
    'earned_count', jsonb_array_length(v_earned),
    'total_count', jsonb_array_length(v_badges)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gamification_badge_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_badge public.badges;
BEGIN
  IF NOT NEW.reward_eligible THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_badge
  FROM public.badges
  WHERE id = NEW.badge_id;

  PERFORM public.apply_gamification_event(
    NEW.user_id,
    'badge_earned',
    'badge-earned:' || NEW.badge_id::TEXT,
    'badge',
    NEW.badge_id::TEXT,
    jsonb_build_object(
      'badge_code', v_badge.code,
      'badge_title', v_badge.title,
      'rarity', v_badge.rarity
    ),
    COALESCE(NEW.earned_at, now())
  );

  PERFORM public.create_gamification_notification(
    NEW.user_id,
    'badge_earned',
    'Badge unlocked: ' || v_badge.title,
    COALESCE(v_badge.description, 'A new badge was added to your Reader Journey.'),
    jsonb_build_object(
      'badge_id', v_badge.id,
      'badge_code', v_badge.code,
      'tab', 'badges'
    ),
    'badge-earned:' || NEW.badge_id::TEXT
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_badge_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  badge_data RECORD;
BEGIN
  IF NEW.source <> 'earned' THEN
    RETURN NEW;
  END IF;

  SELECT title, description
  INTO badge_data
  FROM public.badges
  WHERE id = NEW.badge_id;

  INSERT INTO public.social_activities (
    user_id,
    activity_type,
    badge_id,
    metadata
  )
  VALUES (
    NEW.user_id,
    'earned_badge',
    NEW.badge_id,
    jsonb_build_object(
      'badge_title', badge_data.title,
      'badge_description', badge_data.description
    )
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.evaluate_badges_after_domain_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_event TEXT;
  v_new JSONB := to_jsonb(NEW);
  v_old JSONB := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
BEGIN
  IF TG_TABLE_NAME = 'books' AND TG_OP = 'INSERT' THEN
    v_user_id := (v_new->>'user_id')::UUID;
    v_event := 'book_added';
  ELSIF TG_TABLE_NAME = 'book_lists' AND TG_OP = 'INSERT' THEN
    v_user_id := (v_new->>'user_id')::UUID;
    v_event := 'list_created';
  ELSIF TG_TABLE_NAME = 'book_reviews' AND TG_OP = 'INSERT' THEN
    v_user_id := (v_new->>'user_id')::UUID;
    v_event := 'review_created';
  ELSIF TG_TABLE_NAME = 'goals'
    AND COALESCE((v_new->>'is_completed')::BOOLEAN, false) = true
    AND COALESCE((v_old->>'is_completed')::BOOLEAN, false) = false
  THEN
    v_user_id := (v_new->>'user_id')::UUID;
    v_event := 'goal_completed';
  ELSIF TG_TABLE_NAME = 'user_quest_assignments'
    AND v_new->>'status' = 'completed'
    AND v_old->>'status' IS DISTINCT FROM 'completed'
  THEN
    v_user_id := (v_new->>'user_id')::UUID;
    v_event := 'quest_completed';
  ELSIF TG_TABLE_NAME = 'reader_league_members'
    AND v_new->>'finalized_at' IS NOT NULL
    AND v_old->>'finalized_at' IS NULL
  THEN
    v_user_id := (v_new->>'user_id')::UUID;
    v_event := 'league_finalized';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.award_badges(v_user_id, v_event);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evaluate_badges_book_added ON public.books;
CREATE TRIGGER evaluate_badges_book_added
AFTER INSERT ON public.books
FOR EACH ROW EXECUTE FUNCTION public.evaluate_badges_after_domain_event();

DROP TRIGGER IF EXISTS evaluate_badges_list_created ON public.book_lists;
CREATE TRIGGER evaluate_badges_list_created
AFTER INSERT ON public.book_lists
FOR EACH ROW EXECUTE FUNCTION public.evaluate_badges_after_domain_event();

DROP TRIGGER IF EXISTS evaluate_badges_review_created ON public.book_reviews;
CREATE TRIGGER evaluate_badges_review_created
AFTER INSERT ON public.book_reviews
FOR EACH ROW EXECUTE FUNCTION public.evaluate_badges_after_domain_event();

DROP TRIGGER IF EXISTS evaluate_badges_goal_completed ON public.goals;
CREATE TRIGGER evaluate_badges_goal_completed
AFTER INSERT OR UPDATE OF is_completed ON public.goals
FOR EACH ROW EXECUTE FUNCTION public.evaluate_badges_after_domain_event();

DROP TRIGGER IF EXISTS evaluate_badges_quest_completed ON public.user_quest_assignments;
CREATE TRIGGER evaluate_badges_quest_completed
AFTER UPDATE OF status ON public.user_quest_assignments
FOR EACH ROW EXECUTE FUNCTION public.evaluate_badges_after_domain_event();

DROP TRIGGER IF EXISTS evaluate_badges_league_finalized ON public.reader_league_members;
CREATE TRIGGER evaluate_badges_league_finalized
AFTER UPDATE OF finalized_at ON public.reader_league_members
FOR EACH ROW EXECUTE FUNCTION public.evaluate_badges_after_domain_event();

-- Grandfather valid historical progress without awarding retroactive Ink,
-- push notifications, or social activity rows.
SELECT public.award_badges(id, 'historical_backfill')
FROM public.profiles;

DROP POLICY IF EXISTS "Users can earn badges" ON public.user_badges;
DROP POLICY IF EXISTS "Users can view their own earned badges" ON public.user_badges;
CREATE POLICY "Users can view their own earned badges"
ON public.user_badges
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

REVOKE SELECT ON TABLE public.badges FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_badges FROM anon, authenticated;
GRANT SELECT ON TABLE public.badges TO authenticated;
GRANT SELECT ON TABLE public.user_badges TO authenticated;

REVOKE ALL ON FUNCTION public.get_badge_metric_snapshot(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_badge_metric_snapshot(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.get_user_badge_catalog(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_badge_catalog(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.evaluate_badges_after_domain_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gamification_badge_insert_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_badge_activity() FROM PUBLIC, anon, authenticated;
