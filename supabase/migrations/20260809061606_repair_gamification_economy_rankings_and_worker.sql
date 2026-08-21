-- Repair the Reader Journey economy, league rank refresh, and scheduled worker.
--
-- Gold Leaf purchases and consumable inventory are server authoritative. The
-- only client-callable mutation in this migration is streak-freeze consumption,
-- which verifies auth.uid(), the reader's local date, streak eligibility, the
-- server-side cooldown, and inventory in one transaction.

BEGIN;

INSERT INTO public.gamification_reward_rules (
  event_type,
  display_name,
  base_ink,
  competitive,
  daily_event_limit,
  config
)
VALUES (
  'shop_purchase',
  'Gold Leaf shop purchase',
  0,
  false,
  NULL,
  '{"debit":true}'::jsonb
)
ON CONFLICT (event_type) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  base_ink = EXCLUDED.base_ink,
  competitive = EXCLUDED.competitive,
  daily_event_limit = EXCLUDED.daily_event_limit,
  config = EXCLUDED.config,
  enabled = true,
  updated_at = now();

CREATE TABLE public.gamification_shop_items (
  code TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  item_type TEXT NOT NULL,
  gold_leaves_cost INTEGER NOT NULL
    CHECK (gold_leaves_cost BETWEEN 1 AND 1000000),
  max_inventory INTEGER NOT NULL CHECK (max_inventory > 0),
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gamification_shop_items_code_format CHECK (
    code ~ '^[a-z0-9_]{1,64}$'
  ),
  CONSTRAINT gamification_shop_items_type_not_blank CHECK (
    length(trim(item_type)) > 0
  )
);

CREATE TABLE public.gamification_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  item_code TEXT NOT NULL REFERENCES public.gamification_shop_items(code),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost_gold_leaves INTEGER NOT NULL CHECK (unit_cost_gold_leaves > 0),
  gold_leaves_spent INTEGER NOT NULL CHECK (gold_leaves_spent > 0),
  ledger_id UUID NOT NULL UNIQUE
    REFERENCES public.gamification_ledger(id) ON DELETE CASCADE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gamification_purchases_user_idempotency_unique
    UNIQUE (user_id, idempotency_key),
  CONSTRAINT gamification_purchases_idempotency_format CHECK (
    idempotency_key ~ '^[A-Za-z0-9._:-]{8,128}$'
  ),
  CONSTRAINT gamification_purchases_total_matches_units CHECK (
    gold_leaves_spent = unit_cost_gold_leaves * quantity
  )
);

CREATE INDEX idx_gamification_purchases_user_created
ON public.gamification_purchases(user_id, created_at DESC, id DESC);

CREATE INDEX idx_gamification_purchases_item
ON public.gamification_purchases(item_code, user_id);

CREATE TABLE public.user_gamification_inventory (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_code TEXT NOT NULL REFERENCES public.gamification_shop_items(code),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_code)
);

CREATE INDEX idx_user_gamification_inventory_item
ON public.user_gamification_inventory(item_code, user_id)
WHERE quantity > 0;

COMMENT ON TABLE public.gamification_shop_items IS
  'Server-owned Gold Leaf catalog. Disable items instead of deleting codes referenced by purchases.';
COMMENT ON TABLE public.gamification_purchases IS
  'Immutable, idempotent audit records for completed Gold Leaf purchases.';
COMMENT ON TABLE public.user_gamification_inventory IS
  'Current per-user quantities for consumable Reader Journey items.';
COMMENT ON COLUMN public.gamification_purchases.idempotency_key IS
  'Caller-generated retry key, unique per user and immutable after purchase.';
COMMENT ON COLUMN public.gamification_purchases.ledger_id IS
  'Negative Gold Leaf ledger entry written atomically with this purchase.';

ALTER TABLE public.gamification_shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_gamification_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read enabled shop items"
ON public.gamification_shop_items
FOR SELECT
TO authenticated
USING (enabled = true);

CREATE POLICY "Users can read their own gamification purchases"
ON public.gamification_purchases
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can read their own gamification inventory"
ON public.user_gamification_inventory
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

INSERT INTO public.gamification_shop_items (
  code,
  display_name,
  description,
  item_type,
  gold_leaves_cost,
  max_inventory,
  enabled,
  config,
  sort_order
)
VALUES (
  'streak_freeze',
  'Streak Freeze',
  'Protect today''s reading streak when yesterday had qualifying reading activity.',
  'streak_freeze',
  1,
  3,
  true,
  '{"effect":"streak_freeze","cooldown_days":7}'::jsonb,
  10
)
ON CONFLICT (code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  item_type = EXCLUDED.item_type,
  gold_leaves_cost = EXCLUDED.gold_leaves_cost,
  max_inventory = EXCLUDED.max_inventory,
  enabled = EXCLUDED.enabled,
  config = EXCLUDED.config,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.guard_gamification_purchase_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Account deletion is the only supported way to cascade an audit row away.
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Gamification purchases are immutable'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER gamification_purchases_are_immutable
BEFORE UPDATE OR DELETE ON public.gamification_purchases
FOR EACH ROW EXECUTE FUNCTION public.guard_gamification_purchase_immutability();

CREATE OR REPLACE FUNCTION public.get_gamification_shop(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account public.gamification_accounts;
  v_items JSONB := '[]'::jsonb;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Gamification account not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Access denied'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.gamification_accounts(user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_account
  FROM public.gamification_accounts
  WHERE user_id = p_user_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'code', items.code,
        'display_name', items.display_name,
        'description', items.description,
        'item_type', items.item_type,
        'gold_leaves_cost', items.gold_leaves_cost,
        'max_inventory', items.max_inventory,
        'quantity', COALESCE(inventory.quantity, 0),
        'can_purchase',
          v_account.gold_leaves >= items.gold_leaves_cost
          AND COALESCE(inventory.quantity, 0) < items.max_inventory,
        'config', items.config
      )
      ORDER BY items.sort_order, items.code
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM public.gamification_shop_items items
  LEFT JOIN public.user_gamification_inventory inventory
    ON inventory.user_id = p_user_id
   AND inventory.item_code = items.code
  WHERE items.enabled = true;

  RETURN jsonb_build_object(
    'account', jsonb_build_object(
      'user_id', v_account.user_id,
      'gold_leaves', v_account.gold_leaves
    ),
    'items', v_items
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_gamification_item(
  p_user_id UUID,
  p_item_code TEXT,
  p_quantity INTEGER,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item public.gamification_shop_items;
  v_account public.gamification_accounts;
  v_purchase public.gamification_purchases;
  v_inventory_quantity INTEGER := 0;
  v_purchase_id UUID := gen_random_uuid();
  v_ledger_id UUID;
  v_item_code TEXT := trim(COALESCE(p_item_code, ''));
  v_idempotency_key TEXT := trim(COALESCE(p_idempotency_key, ''));
  v_total_cost INTEGER;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Gamification account not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_item_code !~ '^[a-z0-9_]{1,64}$' THEN
    RAISE EXCEPTION 'Invalid shop item code'
      USING ERRCODE = '22023';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 10 THEN
    RAISE EXCEPTION 'Purchase quantity must be between 1 and 10'
      USING ERRCODE = '22023';
  END IF;

  IF v_idempotency_key !~ '^[A-Za-z0-9._:-]{8,128}$' THEN
    RAISE EXCEPTION 'Invalid purchase idempotency key'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.gamification_accounts(user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- This per-user lock serializes balance and inventory decisions, including
  -- concurrent requests carrying the same idempotency key.
  SELECT * INTO v_account
  FROM public.gamification_accounts
  WHERE user_id = p_user_id
  FOR UPDATE;

  SELECT * INTO v_purchase
  FROM public.gamification_purchases
  WHERE user_id = p_user_id
    AND idempotency_key = v_idempotency_key;

  IF v_purchase.id IS NOT NULL THEN
    IF v_purchase.item_code IS DISTINCT FROM v_item_code
      OR v_purchase.quantity IS DISTINCT FROM p_quantity THEN
      RAISE EXCEPTION 'Idempotency key was already used with different purchase parameters'
        USING ERRCODE = '23505';
    END IF;

    SELECT * INTO v_item
    FROM public.gamification_shop_items
    WHERE code = v_purchase.item_code;

    SELECT COALESCE(quantity, 0)
    INTO v_inventory_quantity
    FROM public.user_gamification_inventory
    WHERE user_id = p_user_id
      AND item_code = v_purchase.item_code;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'purchase', jsonb_build_object(
        'id', v_purchase.id,
        'item_code', v_purchase.item_code,
        'quantity', v_purchase.quantity,
        'unit_cost_gold_leaves', v_purchase.unit_cost_gold_leaves,
        'gold_leaves_spent', v_purchase.gold_leaves_spent,
        'created_at', v_purchase.created_at
      ),
      'account', jsonb_build_object(
        'user_id', v_account.user_id,
        'gold_leaves', v_account.gold_leaves
      ),
      'inventory', jsonb_build_object(
        'item_code', v_purchase.item_code,
        'quantity', COALESCE(v_inventory_quantity, 0),
        'max_inventory', v_item.max_inventory
      )
    );
  END IF;

  SELECT * INTO v_item
  FROM public.gamification_shop_items
  WHERE code = v_item_code
    AND enabled = true
  FOR SHARE;

  IF v_item.code IS NULL THEN
    RAISE EXCEPTION 'Shop item is unavailable'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(quantity, 0)
  INTO v_inventory_quantity
  FROM public.user_gamification_inventory
  WHERE user_id = p_user_id
    AND item_code = v_item.code
  FOR UPDATE;

  v_inventory_quantity := COALESCE(v_inventory_quantity, 0);
  IF v_inventory_quantity + p_quantity > v_item.max_inventory THEN
    RAISE EXCEPTION 'Inventory limit reached'
      USING ERRCODE = 'P0001';
  END IF;

  v_total_cost := v_item.gold_leaves_cost * p_quantity;
  IF v_account.gold_leaves < v_total_cost THEN
    RAISE EXCEPTION 'Insufficient Gold Leaves'
      USING ERRCODE = 'P0001';
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
    'shop-purchase:' || v_purchase_id::TEXT,
    'shop_purchase',
    'gamification_shop_item',
    v_item.code,
    0,
    0,
    -v_total_cost,
    jsonb_build_object(
      'purchase_id', v_purchase_id,
      'item_code', v_item.code,
      'quantity', p_quantity,
      'unit_cost_gold_leaves', v_item.gold_leaves_cost,
      'idempotency_key', v_idempotency_key
    ),
    now()
  )
  RETURNING id INTO v_ledger_id;

  UPDATE public.gamification_accounts
  SET
    gold_leaves = gold_leaves - v_total_cost,
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO v_account;

  INSERT INTO public.gamification_purchases(
    id,
    user_id,
    idempotency_key,
    item_code,
    quantity,
    unit_cost_gold_leaves,
    gold_leaves_spent,
    ledger_id,
    metadata
  )
  VALUES (
    v_purchase_id,
    p_user_id,
    v_idempotency_key,
    v_item.code,
    p_quantity,
    v_item.gold_leaves_cost,
    v_total_cost,
    v_ledger_id,
    jsonb_build_object('catalog_config', v_item.config)
  )
  RETURNING * INTO v_purchase;

  INSERT INTO public.user_gamification_inventory(
    user_id,
    item_code,
    quantity,
    updated_at
  )
  VALUES (
    p_user_id,
    v_item.code,
    p_quantity,
    now()
  )
  ON CONFLICT (user_id, item_code) DO UPDATE SET
    quantity = public.user_gamification_inventory.quantity + EXCLUDED.quantity,
    updated_at = now()
  RETURNING quantity INTO v_inventory_quantity;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'purchase', jsonb_build_object(
      'id', v_purchase.id,
      'item_code', v_purchase.item_code,
      'quantity', v_purchase.quantity,
      'unit_cost_gold_leaves', v_purchase.unit_cost_gold_leaves,
      'gold_leaves_spent', v_purchase.gold_leaves_spent,
      'created_at', v_purchase.created_at
    ),
    'account', jsonb_build_object(
      'user_id', v_account.user_id,
      'gold_leaves', v_account.gold_leaves
    ),
    'inventory', jsonb_build_object(
      'item_code', v_item.code,
      'quantity', v_inventory_quantity,
      'max_inventory', v_item.max_inventory
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.use_reading_streak_freeze(
  p_user_id UUID,
  p_activity_date DATE DEFAULT CURRENT_DATE
)
RETURNS public.reading_streak_days
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_day public.reading_streak_days;
  v_timezone TEXT;
  v_local_date DATE;
  v_last_used TIMESTAMPTZ;
  v_inventory_quantity INTEGER;
  v_has_previous_activity BOOLEAN := false;
  v_has_current_activity BOOLEAN := false;
BEGIN
  IF (SELECT auth.uid()) IS NULL
    OR (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not allowed to use a streak freeze for this user'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    COALESCE(NULLIF(timezone, ''), 'UTC'),
    streak_freeze_used_at
  INTO v_timezone, v_last_used
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found'
      USING ERRCODE = 'P0002';
  END IF;

  BEGIN
    v_local_date := (now() AT TIME ZONE v_timezone)::DATE;
  EXCEPTION WHEN invalid_parameter_value THEN
    RAISE EXCEPTION 'Profile timezone is invalid'
      USING ERRCODE = '22023';
  END;

  IF p_activity_date IS NULL OR p_activity_date IS DISTINCT FROM v_local_date THEN
    RAISE EXCEPTION 'Streak freeze date must be the user''s current local date'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_day
  FROM public.reading_streak_days
  WHERE user_id = p_user_id
    AND activity_date = v_local_date
  FOR UPDATE;

  -- A retried request for today's already-consumed freeze is idempotent.
  IF v_day.id IS NOT NULL AND v_day.used_freeze THEN
    RETURN v_day;
  END IF;

  IF (
    v_last_used IS NOT NULL
    AND v_last_used > now() - INTERVAL '7 days'
  ) OR EXISTS (
    SELECT 1
    FROM public.reading_streak_days prior_freezes
    WHERE prior_freezes.user_id = p_user_id
      AND prior_freezes.used_freeze = true
      AND prior_freezes.activity_date > v_local_date - 7
      AND prior_freezes.activity_date < v_local_date
  ) THEN
    RAISE EXCEPTION 'Streak freeze is on cooldown'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.reading_sessions sessions
    WHERE sessions.user_id = p_user_id
      AND (
        COALESCE(sessions.start_time, sessions.created_at)
        AT TIME ZONE v_timezone
      )::DATE = v_local_date
  ) OR EXISTS (
    SELECT 1
    FROM public.progress_logs logs
    WHERE logs.user_id = p_user_id
      AND (logs.logged_at AT TIME ZONE v_timezone)::DATE = v_local_date
  )
  INTO v_has_current_activity;

  IF v_has_current_activity
    OR (
      v_day.id IS NOT NULL
      AND (v_day.session_count > 0 OR v_day.progress_log_count > 0)
    ) THEN
    RAISE EXCEPTION 'Cannot use a streak freeze on a day that already has reading activity'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.reading_sessions sessions
    WHERE sessions.user_id = p_user_id
      AND (
        COALESCE(sessions.start_time, sessions.created_at)
        AT TIME ZONE v_timezone
      )::DATE = v_local_date - 1
  ) OR EXISTS (
    SELECT 1
    FROM public.progress_logs logs
    WHERE logs.user_id = p_user_id
      AND (logs.logged_at AT TIME ZONE v_timezone)::DATE = v_local_date - 1
  )
  INTO v_has_previous_activity;

  IF NOT v_has_previous_activity THEN
    RAISE EXCEPTION 'A streak freeze requires reading activity on the previous local day'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT quantity
  INTO v_inventory_quantity
  FROM public.user_gamification_inventory
  WHERE user_id = p_user_id
    AND item_code = 'streak_freeze'
  FOR UPDATE;

  IF COALESCE(v_inventory_quantity, 0) < 1 THEN
    RAISE EXCEPTION 'No streak freeze is available in inventory'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.reading_streak_days(
    user_id,
    activity_date,
    session_count,
    progress_log_count,
    total_minutes,
    used_freeze,
    updated_at
  )
  VALUES (
    p_user_id,
    v_local_date,
    0,
    0,
    0,
    true,
    now()
  )
  ON CONFLICT (user_id, activity_date) DO UPDATE SET
    used_freeze = true,
    updated_at = now()
  WHERE public.reading_streak_days.session_count = 0
    AND public.reading_streak_days.progress_log_count = 0
  RETURNING * INTO v_day;

  IF v_day.id IS NULL THEN
    RAISE EXCEPTION 'Cannot use a streak freeze on a day that already has reading activity'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.user_gamification_inventory
  SET quantity = quantity - 1, updated_at = now()
  WHERE user_id = p_user_id
    AND item_code = 'streak_freeze'
    AND quantity > 0;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No streak freeze is available in inventory'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles
  SET
    streak_freeze_used_at = now(),
    updated_at = now()
  WHERE id = p_user_id;

  RETURN v_day;
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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_league_id UUID;
  v_member RECORD;
  v_target_rank INTEGER;
  v_notification_date DATE := COALESCE(p_occurred_at, now())::DATE;
BEGIN
  SELECT leagues.id
  INTO v_league_id
  FROM public.reader_league_members memberships
  JOIN public.reader_leagues leagues ON leagues.id = memberships.league_id
  WHERE memberships.user_id = p_user_id
    AND leagues.week_id = p_week_id
    AND leagues.status = 'active'
  LIMIT 1
  FOR UPDATE OF leagues;

  IF v_league_id IS NULL THEN
    RETURN NULL;
  END IF;

  FOR v_member IN
    WITH ranked AS (
      SELECT
        league_members.user_id,
        league_members.provisional_rank AS previous_rank,
        ROW_NUMBER() OVER (
          ORDER BY
            COALESCE(scores.competitive_ink, 0) DESC,
            COALESCE(scores.quests_completed, 0) DESC,
            COALESCE(scores.qualifying_minutes, 0) DESC,
            COALESCE(scores.reading_days, 0) DESC,
            scores.score_attained_at ASC NULLS LAST,
            league_members.user_id
        )::INTEGER AS next_rank
      FROM public.reader_league_members league_members
      LEFT JOIN public.gamification_weekly_scores scores
        ON scores.week_id = p_week_id
       AND scores.user_id = league_members.user_id
      WHERE league_members.league_id = v_league_id
    )
    SELECT * FROM ranked ORDER BY next_rank
  LOOP
    UPDATE public.reader_league_members
    SET provisional_rank = v_member.next_rank
    WHERE league_id = v_league_id
      AND user_id = v_member.user_id;

    IF v_member.user_id = p_user_id THEN
      v_target_rank := v_member.next_rank;
    END IF;

    IF v_member.previous_rank IS NOT NULL
      AND v_member.next_rank IS DISTINCT FROM v_member.previous_rank
      AND (
        ABS(v_member.next_rank - v_member.previous_rank) >= 3
        OR (v_member.previous_rank > 10 AND v_member.next_rank <= 10)
        OR (v_member.previous_rank <= 10 AND v_member.next_rank > 10)
      ) THEN
      PERFORM public.create_gamification_notification(
        v_member.user_id,
        'rank_movement',
        CASE
          WHEN v_member.next_rank < v_member.previous_rank THEN 'You moved up'
          ELSE 'Your rank changed'
        END,
        format('You are now #%s in your Reader League.', v_member.next_rank),
        jsonb_build_object(
          'week_id', p_week_id,
          'league_id', v_league_id,
          'rank', v_member.next_rank,
          'previous_rank', v_member.previous_rank
        ),
        'rank-movement:' || p_week_id::TEXT || ':' || v_member.user_id::TEXT
          || ':' || v_notification_date::TEXT || ':' || v_member.next_rank::TEXT
      );
    END IF;
  END LOOP;

  RETURN v_target_rank;
END;
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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_week public.gamification_weeks;
  v_league_id UUID;
  v_entries JSONB := '[]'::jsonb;
BEGIN
  IF p_scope IS NULL OR p_scope NOT IN ('league', 'friends', 'global') THEN
    RAISE EXCEPTION 'Unsupported leaderboard scope'
      USING ERRCODE = '22023';
  END IF;

  IF p_week_id IS NULL THEN
    v_week := public.ensure_gamification_week(CURRENT_DATE);
  ELSE
    SELECT * INTO v_week
    FROM public.gamification_weeks
    WHERE id = p_week_id;
  END IF;

  IF v_week.id IS NULL THEN
    RAISE EXCEPTION 'Gamification week not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF p_scope = 'league' THEN
    SELECT leagues.id INTO v_league_id
    FROM public.reader_league_members memberships
    JOIN public.reader_leagues leagues ON leagues.id = memberships.league_id
    WHERE memberships.user_id = p_user_id
      AND leagues.week_id = v_week.id
    LIMIT 1;

    IF v_league_id IS NULL THEN
      RETURN jsonb_build_object(
        'week', to_jsonb(v_week),
        'scope', p_scope,
        'entries', '[]'::jsonb
      );
    END IF;
  END IF;

  WITH candidates AS (
    SELECT
      candidate_profiles.id AS user_id,
      COALESCE(scores.competitive_ink, 0) AS competitive_ink,
      COALESCE(scores.quests_completed, 0) AS quests_completed,
      COALESCE(scores.qualifying_minutes, 0) AS qualifying_minutes,
      COALESCE(scores.reading_days, 0) AS reading_days,
      scores.score_attained_at
    FROM public.profiles candidate_profiles
    LEFT JOIN public.gamification_weekly_scores scores
      ON scores.week_id = v_week.id
     AND scores.user_id = candidate_profiles.id
    WHERE candidate_profiles.leaderboard_opt_in = true
      AND candidate_profiles.leaderboard_eligible_from <= v_week.week_start
      AND COALESCE(candidate_profiles.is_active, true) = true
      AND (
        p_scope = 'global'
        OR (
          p_scope = 'league'
          AND EXISTS (
            SELECT 1
            FROM public.reader_league_members league_member
            WHERE league_member.league_id = v_league_id
              AND league_member.user_id = candidate_profiles.id
          )
        )
        OR (
          p_scope = 'friends'
          AND (
            candidate_profiles.id = p_user_id
            OR (
              EXISTS (
                SELECT 1
                FROM public.user_follows following
                WHERE following.follower_id = p_user_id
                  AND following.following_id = candidate_profiles.id
              )
              AND EXISTS (
                SELECT 1
                FROM public.user_follows follower
                WHERE follower.follower_id = candidate_profiles.id
                  AND follower.following_id = p_user_id
              )
            )
          )
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_blocks blocks
        WHERE (blocks.blocker_id = p_user_id AND blocks.blocked_id = candidate_profiles.id)
           OR (blocks.blocker_id = candidate_profiles.id AND blocks.blocked_id = p_user_id)
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
  SELECT COALESCE(
    jsonb_agg(
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
    ),
    '[]'::jsonb
  )
  INTO v_entries
  FROM ranked
  JOIN public.profiles ON profiles.id = ranked.user_id
  LEFT JOIN public.gamification_accounts accounts
    ON accounts.user_id = ranked.user_id
  LEFT JOIN public.gamification_levels levels
    ON levels.level = accounts.current_level
  WHERE ranked.rank <= LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);

  RETURN jsonb_build_object(
    'week', to_jsonb(v_week),
    'scope', p_scope,
    'entries', v_entries
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.invoke_gamification_worker()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_url TEXT;
  v_worker_secret TEXT;
  v_request_id BIGINT;
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RAISE LOG 'Gamification worker was not invoked because Vault is unavailable';
    RETURN NULL;
  END IF;

  EXECUTE $vault$
    SELECT
      MAX(decrypted_secret) FILTER (WHERE name = 'project_url'),
      MAX(decrypted_secret) FILTER (WHERE name = 'gamification_worker_secret')
    FROM vault.decrypted_secrets
  $vault$
  INTO v_project_url, v_worker_secret;

  IF NULLIF(trim(v_project_url), '') IS NULL
    OR NULLIF(trim(v_worker_secret), '') IS NULL THEN
    RAISE LOG 'Gamification worker was not invoked because its Vault configuration is incomplete';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/gamification-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Brack-Worker-Secret', v_worker_secret
    ),
    body := jsonb_build_object('source', 'cron')
  )
  INTO v_request_id;

  RETURN v_request_id;
END;
$$;

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  FOR v_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'brack-gamification-worker'
  LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;

  PERFORM cron.schedule(
    'brack-gamification-worker',
    '* * * * *',
    $cron$SELECT public.invoke_gamification_worker();$cron$
  );
END;
$$;

COMMENT ON FUNCTION public.get_gamification_shop(UUID) IS
  'Returns the active Gold Leaf catalog, balance, inventory, and purchase eligibility for one user.';
COMMENT ON FUNCTION public.purchase_gamification_item(UUID, TEXT, INTEGER, TEXT) IS
  'Atomically and idempotently debits Gold Leaves, writes an audit ledger entry, and grants consumable inventory.';
COMMENT ON FUNCTION public.use_reading_streak_freeze(UUID, DATE) IS
  'Consumes one streak-freeze inventory item for the authenticated owner on their exact current local date.';
COMMENT ON FUNCTION public.refresh_reader_league_rank(UUID, UUID, TIMESTAMPTZ) IS
  'Recomputes every rank in the affected league, including zero-score members, and notifies materially displaced readers.';
COMMENT ON FUNCTION public.invoke_gamification_worker() IS
  'Cron-only worker invocation that resolves URL and secret from Vault at execution time without embedding decrypted values in cron.job.';

-- Prevent clients from bypassing inventory consumption by writing freeze rows.
DROP POLICY IF EXISTS "Users can insert their own streak days"
ON public.reading_streak_days;
DROP POLICY IF EXISTS "Users can update their own streak days"
ON public.reading_streak_days;
DROP POLICY IF EXISTS "Users can delete their own streak days"
ON public.reading_streak_days;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.reading_streak_days
FROM authenticated;

REVOKE ALL ON TABLE
  public.gamification_shop_items,
  public.gamification_purchases,
  public.user_gamification_inventory
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
  public.gamification_shop_items,
  public.gamification_purchases,
  public.user_gamification_inventory
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.gamification_shop_items,
  public.gamification_purchases,
  public.user_gamification_inventory
TO service_role;

REVOKE ALL ON FUNCTION public.guard_gamification_purchase_immutability()
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_gamification_shop(UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purchase_gamification_item(UUID, TEXT, INTEGER, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoke_gamification_worker()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_gamification_shop(UUID)
TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_gamification_item(UUID, TEXT, INTEGER, TEXT)
TO service_role;
GRANT EXECUTE ON FUNCTION public.invoke_gamification_worker()
TO service_role;

REVOKE ALL ON FUNCTION public.use_reading_streak_freeze(UUID, DATE)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.use_reading_streak_freeze(UUID, DATE)
TO authenticated;

REVOKE ALL ON FUNCTION public.refresh_reader_league_rank(UUID, UUID, TIMESTAMPTZ)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_reader_leaderboard(UUID, TEXT, UUID, INTEGER)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_reader_league_rank(UUID, UUID, TIMESTAMPTZ)
TO service_role;
GRANT EXECUTE ON FUNCTION public.get_reader_leaderboard(UUID, TEXT, UUID, INTEGER)
TO service_role;

COMMIT;
