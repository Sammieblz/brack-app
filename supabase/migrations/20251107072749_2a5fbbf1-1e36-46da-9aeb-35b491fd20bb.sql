-- Add streak tracking columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN current_streak INTEGER DEFAULT 0,
ADD COLUMN longest_streak INTEGER DEFAULT 0,
ADD COLUMN last_reading_date DATE,
ADD COLUMN streak_freeze_used_at TIMESTAMP WITH TIME ZONE;

-- Create reading_streak_history table to track streak milestones
CREATE TABLE public.reading_streak_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  streak_count INTEGER NOT NULL,
  achieved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on reading_streak_history
ALTER TABLE public.reading_streak_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for reading_streak_history
CREATE POLICY "Users can view their own streak history"
ON public.reading_streak_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own streak history"
ON public.reading_streak_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_reading_streak_history_user_id ON public.reading_streak_history(user_id);
CREATE INDEX idx_reading_sessions_user_date ON public.reading_sessions(user_id, created_at);