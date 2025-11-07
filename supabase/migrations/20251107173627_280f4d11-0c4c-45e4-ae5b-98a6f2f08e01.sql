-- Create progress_logs table for granular reading tracking
CREATE TABLE public.progress_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.reading_sessions(id) ON DELETE SET NULL,
  page_number INTEGER NOT NULL,
  paragraph_number INTEGER,
  notes TEXT,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  log_type TEXT NOT NULL CHECK (log_type IN ('manual', 'timer_based', 'automatic')),
  time_spent_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add description column to books table
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS description TEXT;

-- Enable Row Level Security
ALTER TABLE public.progress_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for progress_logs
CREATE POLICY "Users can insert their own progress logs"
  ON public.progress_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own progress logs"
  ON public.progress_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress logs"
  ON public.progress_logs
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own progress logs"
  ON public.progress_logs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_progress_logs_user_book ON public.progress_logs(user_id, book_id);
CREATE INDEX idx_progress_logs_logged_at ON public.progress_logs(logged_at DESC);
CREATE INDEX idx_progress_logs_book_id ON public.progress_logs(book_id);
CREATE INDEX idx_reading_sessions_user_id ON public.reading_sessions(user_id, created_at DESC);
CREATE INDEX idx_books_user_status ON public.books(user_id, status) WHERE deleted_at IS NULL;