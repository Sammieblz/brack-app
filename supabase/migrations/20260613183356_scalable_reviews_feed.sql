-- Scalable review feed support.
-- Reviews are now soft-deleted and shareable while still preserving the
-- existing one-review-per-user-book invariant.

ALTER TABLE public.book_reviews
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS share_count INTEGER NOT NULL DEFAULT 0;

UPDATE public.book_reviews
SET
  share_count = COALESCE(share_count, 0),
  likes_count = COALESCE(likes_count, 0),
  comments_count = COALESCE(comments_count, 0);

ALTER TABLE public.book_reviews
ALTER COLUMN share_count SET DEFAULT 0,
ALTER COLUMN share_count SET NOT NULL;

ALTER TABLE public.book_reviews
DROP CONSTRAINT IF EXISTS book_reviews_user_id_book_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_book_reviews_one_active_per_user_book
ON public.book_reviews(user_id, book_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_book_reviews_feed_recent
ON public.book_reviews(created_at DESC, id DESC)
WHERE is_public = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_book_reviews_feed_rating_recent
ON public.book_reviews(rating, created_at DESC, id DESC)
WHERE is_public = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_book_reviews_feed_popular
ON public.book_reviews(likes_count DESC, created_at DESC, id DESC)
WHERE is_public = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_book_reviews_active_book
ON public.book_reviews(book_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_book_reviews_active_user
ON public.book_reviews(user_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_review_comments_review_created
ON public.review_comments(review_id, created_at ASC, id ASC);

-- Older environments may have missed this trigger in the original migration.
DROP TRIGGER IF EXISTS update_review_comments_count_trigger ON public.review_comments;
CREATE TRIGGER update_review_comments_count_trigger
AFTER INSERT OR DELETE ON public.review_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_review_comments_count();

DROP POLICY IF EXISTS "Public reviews are viewable by everyone" ON public.book_reviews;
CREATE POLICY "Visible reviews are viewable by everyone"
ON public.book_reviews
FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    COALESCE(is_public, true) = true
    OR auth.uid() = user_id
  )
);

DROP POLICY IF EXISTS "Anyone can view comments on public reviews" ON public.review_comments;
CREATE POLICY "Visible review comments are readable"
ON public.review_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.book_reviews
    WHERE id = review_comments.review_id
      AND deleted_at IS NULL
      AND (
        COALESCE(is_public, true) = true
        OR user_id = auth.uid()
      )
  )
);
