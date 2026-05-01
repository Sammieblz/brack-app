-- Unified onboarding flow and reading profile learning signals.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_status TEXT NOT NULL DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS onboarding_version INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS onboarding_last_step TEXT,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS onboarding_skipped_at TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_onboarding_status_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_onboarding_status_check
    CHECK (onboarding_status IN ('not_started', 'in_progress', 'completed', 'skipped'));
  END IF;
END $$;

UPDATE public.profiles
SET
  onboarding_status = 'completed', 
  onboarding_completed_at = COALESCE(onboarding_completed_at, created_at, now())
WHERE onboarding_status = 'not_started';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id,
    display_name,
    avatar_url,
    first_name,
    last_name,
    onboarding_status,
    onboarding_version
  )
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NULLIF(CONCAT_WS(' ', NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'last_name'), '')
    ),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    'not_started',
    1
  )
  ON CONFLICT (id) DO UPDATE
  SET
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    first_name = COALESCE(public.profiles.first_name, EXCLUDED.first_name),
    last_name = COALESCE(public.profiles.last_name, EXCLUDED.last_name),
    updated_at = now();

  RETURN NEW;
END;
$function$;

ALTER TABLE public.reading_habits
ADD COLUMN IF NOT EXISTS preferred_session_minutes INTEGER,
ADD COLUMN IF NOT EXISTS preferred_reading_time TEXT,
ADD COLUMN IF NOT EXISTS reading_frequency TEXT,
ADD COLUMN IF NOT EXISTS motivation TEXT,
ADD COLUMN IF NOT EXISTS book_format TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

DELETE FROM public.reading_habits
WHERE user_id IS NULL;

WITH ranked_habits AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS row_num
  FROM public.reading_habits
  WHERE user_id IS NOT NULL
)
DELETE FROM public.reading_habits habits
USING ranked_habits ranked
WHERE habits.id = ranked.id
  AND ranked.row_num > 1;

ALTER TABLE public.reading_habits
ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reading_habits_user_id_key'
      AND conrelid = 'public.reading_habits'::regclass
  ) THEN
    ALTER TABLE public.reading_habits
    ADD CONSTRAINT reading_habits_user_id_key UNIQUE (user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_reading_habits_updated_at ON public.reading_habits;
CREATE TRIGGER update_reading_habits_updated_at
BEFORE UPDATE ON public.reading_habits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.reading_habits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own reading habits" ON public.reading_habits;
CREATE POLICY "Users can read their own reading habits"
ON public.reading_habits
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own reading habits" ON public.reading_habits;
CREATE POLICY "Users can insert their own reading habits"
ON public.reading_habits
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own reading habits" ON public.reading_habits;
CREATE POLICY "Users can update their own reading habits"
ON public.reading_habits
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own reading habits" ON public.reading_habits;
CREATE POLICY "Users can delete their own reading habits"
ON public.reading_habits
FOR DELETE
USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_learning_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  onboarding_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  derived_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  signal_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_learning_profiles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_user_learning_profiles_updated_at ON public.user_learning_profiles;
CREATE TRIGGER update_user_learning_profiles_updated_at
BEFORE UPDATE ON public.user_learning_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Users can read their own learning profile" ON public.user_learning_profiles;
CREATE POLICY "Users can read their own learning profile"
ON public.user_learning_profiles
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own learning profile" ON public.user_learning_profiles;
CREATE POLICY "Users can insert their own learning profile"
ON public.user_learning_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own learning profile" ON public.user_learning_profiles;
CREATE POLICY "Users can update their own learning profile"
ON public.user_learning_profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own learning profile" ON public.user_learning_profiles;
CREATE POLICY "Users can delete their own learning profile"
ON public.user_learning_profiles
FOR DELETE
USING (auth.uid() = user_id);
