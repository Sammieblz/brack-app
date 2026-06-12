-- Smart reader discovery and lightweight online presence.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS reader_status TEXT NOT NULL DEFAULT 'available',
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NULL;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_reader_status_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_reader_status_check
CHECK (
  reader_status IN (
    'available',
    'reading_now',
    'buddy_reads',
    'looking_for_club',
    'taking_recommendations',
    'quiet'
  )
);

CREATE INDEX IF NOT EXISTS idx_profiles_display_name_trgm
ON public.profiles
USING gin (lower(COALESCE(display_name, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_presence_visible
ON public.profiles(show_online_status, last_seen_at DESC)
WHERE show_online_status = true AND profile_visibility <> 'private';

CREATE INDEX IF NOT EXISTS idx_profiles_visibility_location
ON public.profiles(profile_visibility, latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
