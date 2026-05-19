-- Persist the user's preferred Library presentation mode.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS library_view_mode TEXT NOT NULL DEFAULT 'flat';

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS valid_library_view_mode;

ALTER TABLE public.profiles
ADD CONSTRAINT valid_library_view_mode
CHECK (library_view_mode IN ('flat', 'bookshelf', 'carousel'));

