-- Add chapters column to books table
ALTER TABLE public.books
ADD COLUMN chapters INTEGER;

-- Add chapter_number column to progress_logs table
ALTER TABLE public.progress_logs
ADD COLUMN chapter_number INTEGER;

-- Add index for better query performance
CREATE INDEX idx_progress_logs_chapter ON public.progress_logs(chapter_number);