-- Separate saved location data from nearby-discovery visibility.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS show_location BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_profiles_location_visible
ON public.profiles(profile_visibility, show_location, latitude, longitude)
WHERE show_location = true AND latitude IS NOT NULL AND longitude IS NOT NULL;
