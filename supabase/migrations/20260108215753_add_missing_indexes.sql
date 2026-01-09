-- Add missing indexes for frequently queried columns to improve performance

-- Index for posts feed ordering (used in social feed queries)
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);

-- Composite index for message threads (used when fetching messages for a conversation)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON public.messages(conversation_id, created_at DESC);

-- Composite index for social activities feed (used in social-feed function)
CREATE INDEX IF NOT EXISTS idx_social_activities_user_created 
ON public.social_activities(user_id, created_at DESC);
