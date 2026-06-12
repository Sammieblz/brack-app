-- Add private media support for book clubs and club discussion posts.
ALTER TABLE public.book_clubs
ADD COLUMN IF NOT EXISTS banner_image_path TEXT,
ADD COLUMN IF NOT EXISTS avatar_image_path TEXT;

ALTER TABLE public.book_club_discussions
ADD COLUMN IF NOT EXISTS media JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.book_club_discussions
DROP CONSTRAINT IF EXISTS book_club_discussions_media_array;

ALTER TABLE public.book_club_discussions
ADD CONSTRAINT book_club_discussions_media_array
CHECK (jsonb_typeof(media) = 'array');

CREATE INDEX IF NOT EXISTS idx_book_clubs_media_paths
ON public.book_clubs(banner_image_path, avatar_image_path)
WHERE banner_image_path IS NOT NULL OR avatar_image_path IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'club-media',
  'club-media',
  false,
  62914560,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users can upload their own club media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own club media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own club media" ON storage.objects;

CREATE POLICY "Users can upload their own club media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'club-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own club media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'club-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'club-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own club media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'club-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
