-- Create analytics_snapshots table for daily analytics rollups
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Snapshot date
  snapshot_date DATE NOT NULL,
  
  -- Daily metrics
  books_completed INTEGER DEFAULT 0,
  books_started INTEGER DEFAULT 0,
  total_reading_minutes INTEGER DEFAULT 0,
  total_pages_read INTEGER DEFAULT 0,
  avg_pages_per_hour DECIMAL(10, 2) DEFAULT 0,
  
  -- Genre breakdown (stored as JSONB)
  genre_distribution JSONB DEFAULT '{}'::jsonb,
  
  -- Author breakdown (stored as JSONB)
  author_distribution JSONB DEFAULT '{}'::jsonb,
  
  -- Time distribution (hour of day, stored as JSONB)
  hourly_distribution JSONB DEFAULT '{}'::jsonb,
  
  -- Status breakdown
  status_breakdown JSONB DEFAULT '{}'::jsonb,
  
  -- Computed at timestamp
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Unique constraint: one snapshot per user per day
  UNIQUE(user_id, snapshot_date)
);

-- Indexes for efficient queries
CREATE INDEX idx_analytics_snapshots_user_date ON analytics_snapshots(user_id, snapshot_date DESC);
CREATE INDEX idx_analytics_snapshots_date ON analytics_snapshots(snapshot_date DESC);

-- RLS Policies
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analytics snapshots"
  ON analytics_snapshots
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert analytics snapshots"
  ON analytics_snapshots
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update analytics snapshots"
  ON analytics_snapshots
  FOR UPDATE
  USING (true);

-- Function to compute daily analytics snapshot
CREATE OR REPLACE FUNCTION compute_daily_analytics(p_user_id UUID, p_date DATE)
RETURNS analytics_snapshots AS $$
DECLARE
  v_snapshot analytics_snapshots;
  v_start_date TIMESTAMP WITH TIME ZONE;
  v_end_date TIMESTAMP WITH TIME ZONE;
  v_books_completed INTEGER;
  v_books_started INTEGER;
  v_total_minutes INTEGER;
  v_total_pages INTEGER;
  v_avg_pages_per_hour DECIMAL(10, 2);
  v_genre_dist JSONB;
  v_author_dist JSONB;
  v_hourly_dist JSONB;
  v_status_dist JSONB;
BEGIN
  -- Set date range for the day
  v_start_date := p_date::timestamp;
  v_end_date := (p_date + INTERVAL '1 day')::timestamp;
  
  -- Compute daily book metrics
  SELECT 
    COUNT(*) FILTER (WHERE status = 'completed' AND date_finished::date = p_date),
    COUNT(*) FILTER (WHERE status = 'reading' AND date_started::date = p_date),
    SUM(pages) FILTER (WHERE status = 'completed' AND date_finished::date = p_date)
  INTO v_books_completed, v_books_started, v_total_pages
  FROM books
  WHERE user_id = p_user_id
    AND deleted_at IS NULL;
  
  -- Compute daily session metrics
  SELECT COALESCE(SUM(duration), 0)
  INTO v_total_minutes
  FROM reading_sessions
  WHERE user_id = p_user_id
    AND created_at >= v_start_date
    AND created_at < v_end_date;
  
  -- Calculate average pages per hour
  IF v_total_minutes > 0 AND v_total_pages > 0 THEN
    v_avg_pages_per_hour := (v_total_pages::decimal / (v_total_minutes::decimal / 60.0));
  ELSE
    v_avg_pages_per_hour := 0;
  END IF;
  
  -- Compute genre distribution (all-time for user)
  SELECT COALESCE(jsonb_object_agg(genre, count), '{}'::jsonb)
  INTO v_genre_dist
  FROM (
    SELECT genre, COUNT(*) as count
    FROM books
    WHERE user_id = p_user_id
      AND genre IS NOT NULL
      AND deleted_at IS NULL
    GROUP BY genre
  ) gs;
  
  -- Compute author distribution (all-time for user)
  SELECT COALESCE(jsonb_object_agg(author, count), '{}'::jsonb)
  INTO v_author_dist
  FROM (
    SELECT author, COUNT(*) as count
    FROM books
    WHERE user_id = p_user_id
      AND author IS NOT NULL
      AND deleted_at IS NULL
    GROUP BY author
  ) ast;
  
  -- Compute hourly distribution (for the day)
  SELECT COALESCE(jsonb_object_agg(hour::text, minutes), '{}'::jsonb)
  INTO v_hourly_dist
  FROM (
    SELECT 
      EXTRACT(HOUR FROM created_at)::integer as hour,
      SUM(duration) as minutes
    FROM reading_sessions
    WHERE user_id = p_user_id
      AND created_at >= v_start_date
      AND created_at < v_end_date
    GROUP BY EXTRACT(HOUR FROM created_at)
  ) hs;
  
  -- Compute status breakdown (all-time for user)
  SELECT COALESCE(jsonb_object_agg(status, count), '{}'::jsonb)
  INTO v_status_dist
  FROM (
    SELECT status, COUNT(*) as count
    FROM books
    WHERE user_id = p_user_id
      AND deleted_at IS NULL
    GROUP BY status
  ) ss;
  
  -- Insert or update snapshot
  INSERT INTO analytics_snapshots (
    user_id,
    snapshot_date,
    books_completed,
    books_started,
    total_reading_minutes,
    total_pages_read,
    avg_pages_per_hour,
    genre_distribution,
    author_distribution,
    hourly_distribution,
    status_breakdown
  )
  VALUES (
    p_user_id,
    p_date,
    COALESCE(v_books_completed, 0),
    COALESCE(v_books_started, 0),
    COALESCE(v_total_minutes, 0),
    COALESCE(v_total_pages, 0),
    COALESCE(v_avg_pages_per_hour, 0),
    COALESCE(v_genre_dist, '{}'::jsonb),
    COALESCE(v_author_dist, '{}'::jsonb),
    COALESCE(v_hourly_dist, '{}'::jsonb),
    COALESCE(v_status_dist, '{}'::jsonb)
  )
  ON CONFLICT (user_id, snapshot_date) 
  DO UPDATE SET
    books_completed = EXCLUDED.books_completed,
    books_started = EXCLUDED.books_started,
    total_reading_minutes = EXCLUDED.total_reading_minutes,
    total_pages_read = EXCLUDED.total_pages_read,
    avg_pages_per_hour = EXCLUDED.avg_pages_per_hour,
    genre_distribution = EXCLUDED.genre_distribution,
    author_distribution = EXCLUDED.author_distribution,
    hourly_distribution = EXCLUDED.hourly_distribution,
    status_breakdown = EXCLUDED.status_breakdown,
    computed_at = now()
  RETURNING * INTO v_snapshot;
  
  RETURN v_snapshot;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION compute_daily_analytics(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_daily_analytics(UUID, DATE) TO service_role;
