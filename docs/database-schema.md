# Database Schema

Complete database schema documentation for Brack.

## Overview

- **Database**: PostgreSQL 15 (via Supabase)
- **Total Tables**: 27
- **Schema**: `public`
- **Row Level Security**: Enabled on all tables
- **Migrations**: 31 SQL files in `supabase/migrations/`

## Entity Relationship Diagram

```
┌─────────────┐
│  profiles   │◄──────────────────┐
│             │                   │
│ id (PK)     │                   │
│ display_name│                   │
│ avatar_url  │                   │
│ current_    │                   │
│  streak     │                   │
└──────┬──────┘                   │
       │                          │
       │ user_id (FK)             │
       │                          │
┌──────▼──────┐    ┌──────────────▼─────┐
│    books    │    │  reading_sessions  │
│             │    │                    │
│ id (PK)     │    │ id (PK)            │
│ user_id (FK)│◄───┤ user_id (FK)       │
│ title       │    │ book_id (FK)       │
│ author      │    │ duration           │
│ status      │    └────────────────────┘
│ current_page│
└──────┬──────┘
       │
       │ book_id (FK)
       │
       ├──────┬──────────────┬───────────────┐
       │      │              │               │
┌──────▼─┐ ┌─▼────────┐ ┌───▼─────────┐ ┌──▼────────┐
│progress│ │journal_  │ │book_reviews │ │book_list_ │
│_logs   │ │entries   │ │             │ │items      │
└────────┘ └──────────┘ └─────────────┘ └───────────┘

┌──────────────┐
│    posts     │
│              │
│ id (PK)      │
│ user_id (FK) │───► profiles
│ book_id (FK) │───► books
└──────┬───────┘
       │
       ├─────────────┬─────────────┐
       │             │             │
┌──────▼────┐ ┌──────▼────┐ ┌─────▼─────┐
│post_likes │ │post_      │ │social_    │
│           │ │comments   │ │activities │
└───────────┘ └───────────┘ └───────────┘
```

## Core Tables

### profiles

User profile information and preferences.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  display_name TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  
  -- Contact
  phone_number TEXT,
  date_of_birth DATE,
  
  -- Location
  city TEXT,
  country TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Preferences
  theme_mode TEXT, -- 'light', 'dark', 'system'
  color_theme TEXT,
  profile_visibility TEXT DEFAULT 'public',
  allow_friend_requests BOOLEAN DEFAULT true,
  show_currently_reading BOOLEAN DEFAULT true,
  show_reading_activity BOOLEAN DEFAULT true,
  
  -- Reading Streaks
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_reading_date DATE,
  streak_freeze_used_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

**RLS Policies**:
- Users can read their own profile
- Users can update their own profile
- Public profiles readable by all authenticated users

### books

User's book library.

```sql
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Book Info
  title TEXT NOT NULL,
  author TEXT,
  isbn TEXT,
  genre TEXT,
  description TEXT,
  
  -- Format
  pages INTEGER,
  chapters INTEGER,
  cover_url TEXT,
  
  -- Reading Progress
  status TEXT DEFAULT 'to_read', -- 'to_read', 'reading', 'completed'
  current_page INTEGER DEFAULT 0,
  date_started TIMESTAMP WITH TIME ZONE,
  date_finished TIMESTAMP WITH TIME ZONE,
  
  -- User Data
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  tags TEXT[],
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_books_user_id ON books(user_id);
CREATE INDEX idx_books_status ON books(status);
CREATE INDEX idx_books_deleted_at ON books(deleted_at);
```

**RLS Policies**:
- Users can CRUD their own books
- Soft delete (deleted_at) instead of hard delete

### reading_sessions

Reading time tracking.

```sql
CREATE TABLE reading_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  duration INTEGER, -- minutes
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_reading_sessions_user_id ON reading_sessions(user_id);
CREATE INDEX idx_reading_sessions_book_id ON reading_sessions(book_id);
CREATE INDEX idx_reading_sessions_created_at ON reading_sessions(created_at DESC);
```

**Used for**:
- Reading timer functionality
- Analytics and statistics
- Streak calculation

### progress_logs

Granular reading progress tracking.

```sql
CREATE TABLE progress_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  session_id UUID REFERENCES reading_sessions(id) ON DELETE SET NULL,
  
  log_type TEXT NOT NULL, -- 'manual', 'timer', 'quick'
  page_number INTEGER NOT NULL,
  chapter_number INTEGER,
  paragraph_number INTEGER,
  
  time_spent_minutes INTEGER,
  notes TEXT,
  photo_url TEXT,
  
  logged_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_progress_logs_book_id ON progress_logs(book_id, logged_at DESC);
CREATE INDEX idx_progress_logs_user_id ON progress_logs(user_id);
```

**Features**:
- Photo attachments for progress
- Detailed location tracking (page, chapter, paragraph)
- Time spent per log

### goals

Reading goals and targets.

```sql
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  goal_type TEXT, -- 'books_count', 'pages_count', 'reading_time'
  period_type TEXT, -- 'monthly', 'quarterly', 'yearly', 'custom'
  
  target_books INTEGER,
  target_pages INTEGER,
  target_minutes INTEGER,
  
  start_date DATE,
  end_date DATE,
  reminder_time TIME,
  
  is_active BOOLEAN DEFAULT true,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_active ON goals(user_id, is_active);
```

## Journaling Tables

### journal_entries

Notes, quotes, and reflections.

```sql
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  
  entry_type TEXT NOT NULL, -- 'note', 'quote', 'reflection'
  title TEXT,
  content TEXT NOT NULL,
  page_reference INTEGER,
  tags TEXT[],
  photo_url TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_journal_entries_user_book ON journal_entries(user_id, book_id, created_at DESC);
CREATE INDEX idx_journal_entries_type ON journal_entries(entry_type, created_at DESC) 
  WHERE entry_type = 'quote';
```

**Features**:
- Three entry types for different use cases
- Photo attachments
- Page references for quotes
- Searchable tags

## Social Tables

### posts

Social feed posts.

```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE SET NULL,
  
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  genre TEXT,
  
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
```

### book_reviews

Book reviews with ratings.

```sql
CREATE TABLE book_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT NOT NULL,
  
  is_spoiler BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,
  
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_book_reviews_book_id ON book_reviews(book_id);
CREATE INDEX idx_book_reviews_user_id ON book_reviews(user_id);
```

### user_follows

Follow relationships.

```sql
CREATE TABLE user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX idx_user_follows_following ON user_follows(following_id);
```

### social_activities

Activity feed entries.

```sql
CREATE TABLE social_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  activity_type TEXT NOT NULL,
  visibility TEXT DEFAULT 'public',
  
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  review_id UUID REFERENCES book_reviews(id) ON DELETE CASCADE,
  list_id UUID REFERENCES book_lists(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
  
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_social_activities_user_id ON social_activities(user_id, created_at DESC);
```

## Messaging Tables

### conversations

Direct message conversations.

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_one_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  participant_two_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(participant_one_id, participant_two_id)
);

CREATE INDEX idx_conversations_participants ON conversations(participant_one_id, participant_two_id);
```

### messages

Direct messages.

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
```

## Book Club Tables

### book_clubs

Reading groups.

```sql
CREATE TABLE book_clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  current_book_id UUID REFERENCES books(id) ON DELETE SET NULL,
  is_private BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_book_clubs_created_by ON book_clubs(created_by);
```

### book_club_members

Club membership with roles.

```sql
CREATE TABLE book_club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES book_clubs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  role TEXT DEFAULT 'member', -- 'admin', 'moderator', 'member'
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(club_id, user_id)
);

CREATE INDEX idx_book_club_members_club ON book_club_members(club_id);
CREATE INDEX idx_book_club_members_user ON book_club_members(user_id);
```

### book_club_discussions

Threaded discussions.

```sql
CREATE TABLE book_club_discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES book_clubs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES book_club_discussions(id) ON DELETE CASCADE,
  
  title TEXT,
  content TEXT NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_club_discussions_club ON book_club_discussions(club_id, created_at DESC);
```

## Organization Tables

### book_lists

Custom book lists.

```sql
CREATE TABLE book_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_book_lists_user ON book_lists(user_id);
```

### book_list_items

Books in lists with ordering.

```sql
CREATE TABLE book_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES book_lists(id) ON DELETE CASCADE,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  
  position INTEGER DEFAULT 0,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(list_id, book_id)
);

CREATE INDEX idx_book_list_items_list ON book_list_items(list_id, position);
```

## Analytics Tables

### reading_habits

User reading statistics.

```sql
CREATE TABLE reading_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  genres TEXT[],
  longest_genre TEXT,
  avg_length INTEGER, -- average pages per book
  avg_time_per_book INTEGER, -- average minutes
  books_6mo INTEGER,
  books_1yr INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_reading_habits_user ON reading_habits(user_id);
CREATE INDEX idx_reading_habits_genres ON reading_habits USING GIN(genres);
```

### reading_streak_history

Streak milestones.

```sql
CREATE TABLE reading_streak_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  streak_count INTEGER NOT NULL,
  achieved_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_streak_history_user_achieved 
  ON reading_streak_history(user_id, achieved_at DESC);
```

## Gamification Tables

### badges

Achievement badges.

```sql
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### user_badges

User badge awards.

```sql
CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);
```

## Notification Tables

### push_tokens

Device push notification tokens.

```sql
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(user_id, token)
);

CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);
```

### notification_preferences

Per-user notification settings.

```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  
  enabled BOOLEAN DEFAULT true,
  messages BOOLEAN DEFAULT true,
  followers BOOLEAN DEFAULT true,
  book_clubs BOOLEAN DEFAULT true,
  goals BOOLEAN DEFAULT true,
  streaks BOOLEAN DEFAULT true,
  reading_reminders BOOLEAN DEFAULT false,
  
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

## Database Functions

### log_progress_transaction

Atomically log progress and update book.

```sql
CREATE OR REPLACE FUNCTION log_progress_transaction(
  p_user_id UUID,
  p_book_id UUID,
  p_page_number INTEGER,
  p_chapter_number INTEGER DEFAULT NULL,
  p_paragraph_number INTEGER DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_log_type TEXT DEFAULT 'manual',
  p_time_spent_minutes INTEGER DEFAULT NULL
) RETURNS JSON AS $$
-- Implementation in migration file
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### calculate_distance

Calculate distance between two coordinates.

```sql
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 DECIMAL,
  lon1 DECIMAL,
  lat2 DECIMAL,
  lon2 DECIMAL
) RETURNS DECIMAL AS $$
-- Haversine formula implementation
$$ LANGUAGE plpgsql IMMUTABLE;
```

## Migrations

Located in `supabase/migrations/`:

1. Initial schema setup
2. RLS policies
3. Indexes for performance
4. Functions and triggers
5. New features (photos, notifications)
6. Relationship fixes

**Apply migrations**:
```bash
npx supabase db push
```

## Further Reading

- [Getting Started](./getting-started.md)
- [Architecture](./architecture.md)
- [API Reference](./api-reference.md)
