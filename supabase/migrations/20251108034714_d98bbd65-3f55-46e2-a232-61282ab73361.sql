-- Create book_reviews table
CREATE TABLE public.book_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT NOT NULL,
  is_spoiler BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

CREATE INDEX idx_book_reviews_book ON public.book_reviews(book_id);
CREATE INDEX idx_book_reviews_user ON public.book_reviews(user_id);
CREATE INDEX idx_book_reviews_rating ON public.book_reviews(rating);
CREATE INDEX idx_book_reviews_created ON public.book_reviews(created_at DESC);

-- Create review_likes table
CREATE TABLE public.review_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.book_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

CREATE INDEX idx_review_likes_review ON public.review_likes(review_id);
CREATE INDEX idx_review_likes_user ON public.review_likes(user_id);

-- Create review_comments table
CREATE TABLE public.review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.book_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_comments_review ON public.review_comments(review_id);
CREATE INDEX idx_review_comments_user ON public.review_comments(user_id);

-- Enable RLS
ALTER TABLE public.book_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for book_reviews
CREATE POLICY "Public reviews are viewable by everyone"
ON public.book_reviews
FOR SELECT
USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can create their own reviews"
ON public.book_reviews
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
ON public.book_reviews
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
ON public.book_reviews
FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for review_likes
CREATE POLICY "Anyone can view review likes"
ON public.review_likes
FOR SELECT
USING (true);

CREATE POLICY "Users can like reviews"
ON public.review_likes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike reviews"
ON public.review_likes
FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for review_comments
CREATE POLICY "Anyone can view comments on public reviews"
ON public.review_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.book_reviews 
    WHERE id = review_comments.review_id 
    AND (is_public = true OR user_id = auth.uid())
  )
);

CREATE POLICY "Users can create comments"
ON public.review_comments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
ON public.review_comments
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
ON public.review_comments
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger to update updated_at on reviews
CREATE TRIGGER update_book_reviews_updated_at
BEFORE UPDATE ON public.book_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to update updated_at on comments
CREATE TRIGGER update_review_comments_updated_at
BEFORE UPDATE ON public.review_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update likes count on reviews
CREATE OR REPLACE FUNCTION public.update_review_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.book_reviews 
    SET likes_count = likes_count + 1 
    WHERE id = NEW.review_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.book_reviews 
    SET likes_count = likes_count - 1 
    WHERE id = OLD.review_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER update_review_likes_count_trigger
AFTER INSERT OR DELETE ON public.review_likes
FOR EACH ROW
EXECUTE FUNCTION public.update_review_likes_count();

-- Function to update comments count on reviews
CREATE OR REPLACE FUNCTION public.update_review_comments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.book_reviews 
    SET comments_count = comments_count + 1 
    WHERE id = NEW.review_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.book_reviews 
    SET comments_count = comments_count - 1 
    WHERE id = OLD.review_id;
    RETURN OLD;
  END IF;
END;
$$;