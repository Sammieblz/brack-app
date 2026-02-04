-- Add photo_url column to progress_logs table for photo attachments
ALTER TABLE public.progress_logs
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add index for queries filtering by photo entries
CREATE INDEX IF NOT EXISTS idx_progress_logs_photo_url 
ON public.progress_logs(photo_url) 
WHERE photo_url IS NOT NULL;
