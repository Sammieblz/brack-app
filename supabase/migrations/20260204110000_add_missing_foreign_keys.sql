-- Add all missing foreign key constraints for referential integrity
-- This ensures proper cascading and prevents orphaned records

-- 1. Book Club Discussions
ALTER TABLE public.book_club_discussions
ADD CONSTRAINT book_club_discussions_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Book Club Members
ALTER TABLE public.book_club_members
ADD CONSTRAINT book_club_members_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. Book Clubs
ALTER TABLE public.book_clubs
ADD CONSTRAINT book_clubs_created_by_fkey
FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.book_clubs
ADD CONSTRAINT book_clubs_current_book_id_fkey
FOREIGN KEY (current_book_id) REFERENCES public.books(id) ON DELETE SET NULL;

-- 4. Book Lists
ALTER TABLE public.book_lists
ADD CONSTRAINT book_lists_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 5. Conversations
ALTER TABLE public.conversations
ADD CONSTRAINT conversations_participant_one_id_fkey
FOREIGN KEY (participant_one_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.conversations
ADD CONSTRAINT conversations_participant_two_id_fkey
FOREIGN KEY (participant_two_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 6. Messages
ALTER TABLE public.messages
ADD CONSTRAINT messages_conversation_id_fkey
FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

ALTER TABLE public.messages
ADD CONSTRAINT messages_sender_id_fkey
FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 7. Post Comments
ALTER TABLE public.post_comments
ADD CONSTRAINT post_comments_post_id_fkey
FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;

ALTER TABLE public.post_comments
ADD CONSTRAINT post_comments_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.post_comments
ADD CONSTRAINT post_comments_parent_id_fkey
FOREIGN KEY (parent_id) REFERENCES public.post_comments(id) ON DELETE CASCADE;

-- 8. Post Likes
ALTER TABLE public.post_likes
ADD CONSTRAINT post_likes_post_id_fkey
FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;

ALTER TABLE public.post_likes
ADD CONSTRAINT post_likes_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 9. Progress Logs
ALTER TABLE public.progress_logs
ADD CONSTRAINT progress_logs_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 10. Journal Entries
ALTER TABLE public.journal_entries
ADD CONSTRAINT journal_entries_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add performance indexes for the new foreign keys
CREATE INDEX IF NOT EXISTS idx_book_club_discussions_user_id ON public.book_club_discussions(user_id);
CREATE INDEX IF NOT EXISTS idx_book_club_members_user_id ON public.book_club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_book_clubs_created_by ON public.book_clubs(created_by);
CREATE INDEX IF NOT EXISTS idx_book_clubs_current_book_id ON public.book_clubs(current_book_id) WHERE current_book_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_book_lists_user_id ON public.book_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_one ON public.conversations(participant_one_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_two ON public.conversations(participant_two_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON public.post_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id ON public.post_comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_logs_user_id ON public.progress_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id_fk ON public.journal_entries(user_id);

-- Add composite unique constraints where needed
CREATE UNIQUE INDEX IF NOT EXISTS unique_post_likes_user_post 
ON public.post_likes(user_id, post_id);

CREATE UNIQUE INDEX IF NOT EXISTS unique_review_likes_user_review 
ON public.review_likes(user_id, review_id);
