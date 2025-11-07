-- Create storage bucket for book covers
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-covers', 'book-covers', true);

-- Create RLS policies for book covers bucket
CREATE POLICY "Users can view all book covers"
ON storage.objects FOR SELECT
USING (bucket_id = 'book-covers');

CREATE POLICY "Users can upload their own book covers"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'book-covers' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own book covers"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'book-covers' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own book covers"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'book-covers' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);