-- Phase 2: Add columns for book progress tracking and enhanced details
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS current_page INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS date_started DATE,
  ADD COLUMN IF NOT EXISTS date_finished DATE,
  ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add some initial badges for the badge system
INSERT INTO public.badges (title, description, icon_url) VALUES
  ('First Book', 'Added your first book to the library', '📚'),
  ('Bookworm', 'Read 10 books', '🐛'),
  ('Century Reader', 'Read 100 books', '💯'),
  ('Speed Reader', 'Read 5 books in one month', '⚡'),
  ('Dedicated Reader', 'Maintained a 7-day reading streak', '🔥'),
  ('Marathon Reader', 'Read a book over 500 pages', '🏃'),
  ('Genre Explorer', 'Read books from 5 different genres', '🗺️'),
  ('Night Owl', 'Read for 100 hours total', '🦉'),
  ('Early Bird', 'Started reading before 8 AM', '🌅'),
  ('Consistent Reader', 'Read every day for 30 days', '📅')
ON CONFLICT DO NOTHING;