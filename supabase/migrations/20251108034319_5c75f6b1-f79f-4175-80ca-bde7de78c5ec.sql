-- Create user_follows table for following system
CREATE TABLE public.user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Add indexes for performance
CREATE INDEX idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX idx_user_follows_following ON public.user_follows(following_id);

-- Enable RLS
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_follows
-- Users can view all follow relationships
CREATE POLICY "Anyone can view follow relationships"
ON public.user_follows
FOR SELECT
USING (true);

-- Users can follow others
CREATE POLICY "Users can follow others"
ON public.user_follows
FOR INSERT
WITH CHECK (auth.uid() = follower_id);

-- Users can unfollow
CREATE POLICY "Users can unfollow"
ON public.user_follows
FOR DELETE
USING (auth.uid() = follower_id);

-- Add privacy settings to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_visibility TEXT DEFAULT 'public' CHECK (profile_visibility IN ('public', 'followers', 'private')),
ADD COLUMN IF NOT EXISTS show_reading_activity BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_currently_reading BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS allow_friend_requests BOOLEAN DEFAULT true;

-- Update profiles RLS policy to allow viewing public profiles
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles
FOR SELECT
USING (
  profile_visibility = 'public' 
  OR auth.uid() = id 
  OR (
    profile_visibility = 'followers' 
    AND EXISTS (
      SELECT 1 FROM public.user_follows 
      WHERE following_id = profiles.id 
      AND follower_id = auth.uid()
    )
  )
);