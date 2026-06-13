# API Reference

Documentation for Brack's Supabase Edge Functions.

## Overview

Edge Functions are serverless TypeScript/Deno functions deployed on Supabase's global edge network.

**Runtime**: Deno 1.x  
**Language**: TypeScript  
**Location**: `supabase/functions/`  
**Deployment**: `npx supabase functions deploy --project-ref waftnaqgkcgufzapcihe --use-api`

## Shared Utilities

Located in `supabase/functions/_shared/`:

### cors.ts

Handles CORS headers for all functions.

```typescript
export function getCorsHeaders(origin: string | null): HeadersInit;
```

**Usage**:
```typescript
const corsHeaders = getCorsHeaders(req.headers.get('origin'));
return new Response(data, { headers: corsHeaders });
```

### errorHandler.ts

Centralized error handling and formatting.

```typescript
export function createErrorResponse(
  error: Error | unknown,
  statusCode: number,
  origin: string | null,
  context?: Record<string, any>
): Response;
```

### rateLimit.ts

Distributed Edge Function rate limiting backed by the `api_rate_limits` table and `check_api_rate_limit` RPC. An in-memory limiter remains as a fallback if the distributed RPC is temporarily unavailable.

```typescript
export function enforceRateLimit(
  req: Request,
  supabaseClient: { rpc: Function },
  config: { name: string; limit: number; windowMs: number }
): Promise<Response | null>;
```

### validation.ts

Request validation helpers.

```typescript
export async function parseJsonBody<T>(req: Request): Promise<{
  data: T;
  error: Response | null;
}>;

export function requireFields(
  data: any,
  fields: string[]
): Response | null;
```

## Functions

App-facing function summary. The complete maintained inventory is in [Edge Function Catalog](./backend/edge-functions.md).

| Function | Purpose | JWT |
| --- | --- | --- |
| `search-books` | Book search with Google Books primary and Open Library fallback | No |
| `add-book` | Protected library insert with duplicate handling | Yes |
| `dashboard-home` | Snapshot-backed dashboard payload | Yes |
| `complete-reading` | Consolidated reading completion transaction | Yes |
| `create-reading-session` | Persist timer reading sessions | Yes |
| `award-badges` | Award badges for a user event | Yes |
| `log-progress` | Progress logging through completion transaction | Yes |
| `calculate-book-progress` | Book-level progress analytics | Yes |
| `monthly-stats` | Monthly reading statistics | Yes |
| `enhanced-activity` | Enriched activity feed | Yes |
| `social-feed` | Aggregated social feed | Yes |
| `reviews-feed` | Cursor-paginated, block-aware review feed | Yes |
| `review-detail` | Canonical public/private-author review detail payload | Yes |
| `create-review` | Create, update, or restore the current user's review for a book | Yes |
| `toggle-review-like` | Idempotent review like toggle for the authenticated user | Yes |
| `share-review` | Return canonical share URL and increment share count | Yes |
| `review-comments` | Cursor-paginated comments for a visible review | Yes |
| `create-review-comment` | Add a comment to a visible review | Yes |
| `delete-review` | Owner soft-delete for a review | Yes |
| `discover-readers` | Reader discovery | Yes |
| `update-presence` | Reader online/status heartbeat | Yes |
| `clubs-home` | Smart club discovery sections and member/invite/request summaries | Yes |
| `club-detail` | Full club home or private limited preview | Yes |
| `create-club` | Create public/private clubs with discovery metadata | Yes |
| `join-club` | Join public clubs | Yes |
| `leave-club` | Leave joined clubs with last-admin protection | Yes |
| `request-club-join` | Request access to private clubs | Yes |
| `review-club-join-request` | Admin approve/decline private club requests | Yes |
| `invite-club-member` | Admin invite readers to private/public clubs | Yes |
| `respond-club-invite` | Invitee accept/decline club invites | Yes |
| `create-club-discussion` | Member discussion/reply and admin announcement creation | Yes |
| `moderate-club-discussion` | Author/moderator/admin discussion moderation | Yes |
| `manage-club-member` | Admin member role and removal controls | Yes |
| `conversations-home` | Direct-message inbox summaries, read cursors, and settings | Yes |
| `conversation-detail` | Selected direct-message thread with signed media URLs | Yes |
| `get-or-create-conversation` | Start or reopen a one-to-one conversation | Yes |
| `send-message` | Send text, uploaded image/GIF, or Tenor GIF messages | Yes |
| `mark-conversation-read` | Update per-user read cursor | Yes |
| `toggle-message-reaction` | Add, replace, or remove fixed message reactions | Yes |
| `update-conversation-settings` | Mute, pin, archive, or hide a conversation for one user | Yes |
| `delete-message` | Sender soft-delete/unsend for a message | Yes |
| `search-message-gifs` | Authenticated Tenor GIF search for messages | Yes |
| `compute-analytics` | Daily analytics snapshot generation | Yes |
| `send-push-notification` | Firebase Cloud Messaging delivery | Yes |
| `sync-pull` | Pull reading-core sync changes | Yes |
| `sync-push` | Push reading-core outbox mutations | Yes |

Local JWT settings live in `supabase/config.toml`. Remote deployment was aligned on June 13, 2026: every maintained function except public `search-books` is deployed with `verify_jwt = true`, the direct-message function group is deployed, and the `modern_direct_messaging` schema is applied remotely. See [Edge Function Catalog](./backend/edge-functions.md) for the full maintained inventory and operational checks.

The legacy 2025 functions `get-book-details`, `update-reading-progress`, and `daily-summary` were deleted remotely after confirming there are no local consumers.

### search-books

Search for books. Google Books is the primary provider; Open Library is the fallback when Google returns 403, 429, or 5xx.

**Endpoint**: `POST /search-books`

**Request**:
```typescript
{
  query: string;        // Search query (max 200 chars)
  maxResults?: number;  // Max results (1-40, default 10)
}
```

**Response**:
```typescript
{
  books: Array<{
    googleBooksId: string;
    title: string;
    author: string | null;
    isbn: string | null;
    genre: string | null;
    pages: number | null;
    chapters: null;
    cover_url: string | null;
    description: string | null;
    publisher: string | null;
    published_date: string | null;
    average_rating: number | null;
    ratings_count: number | null;
    source_provider?: 'google_books' | 'open_library';
    source_id?: string | null;
  }>;
  fallback_provider?: 'open_library';
}
```

**Rate Limit**: 30 requests per minute per client IP

**Auth**: Public function (`verify_jwt = false`). The app may still call it through the Supabase client, but a user JWT is not required.

**Example**:
```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/search-books`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: 'The Great Gatsby', maxResults: 10 }),
});

const { books } = await response.json();
```

**Environment Variables**:
- `GOOGLE_BOOKS_API_KEY` (optional, recommended) - Increases Google Books quota. If it is missing or Google rejects the request, the function can still return Open Library results.

### add-book

Add a book to the authenticated user's library through the `add_library_book` RPC.

**Endpoint**: `POST /add-book`

**Request**: book payload containing at least `title`. Optional fields include `author`, `isbn`, `genre`, `pages`, `cover_url`, `description`, and reading status fields.

**Response**:
```typescript
{
  success?: boolean;
  book_id?: string;
  book?: Record<string, unknown>;
}
```

If the book already exists, the function returns `409`:

```typescript
{
  code: 'book_exists';
  message: string;
  book_id: string;
  book: Record<string, unknown>;
}
```

**Notes**:
- ISBN is the primary duplicate key.
- Title + author is used as a fallback when ISBN is missing.
- Re-adding a soft-deleted book restores the existing row instead of creating a duplicate.

### reviews-feed

Load the scalable review feed used by `/reviews`.

**Endpoint**: `POST /reviews-feed`

**Request**:
```typescript
{
  cursor?: string | null;
  limit?: number; // 1-30, default 20
  query?: string;
  rating?: '1' | '2' | '3' | '4' | '5' | null;
  scope?: 'for_you' | 'following' | 'recent' | 'popular' | 'mine';
  sort?: 'personalized' | 'recent' | 'popular';
}
```

**Response**:
```typescript
{
  items: ReviewFeedItem[];
  next_cursor: string | null;
  has_more: boolean;
  caught_up: boolean;
  feed_mode: 'for_you' | 'following' | 'recent' | 'popular' | 'mine';
  summary: {
    rating_mix: Array<{ rating: number; count: number }>;
    trending_books: Array<{
      id: string;
      title: string;
      author: string | null;
      cover_url: string | null;
      review_count: number;
      average_rating: number | null;
    }>;
    review_opportunities: Array<{
      id: string;
      title: string;
      author: string | null;
      cover_url: string | null;
      date_finished?: string | null;
    }>;
  };
}
```

**Notes**:
- Uses opaque cursor pagination based on `created_at + id` or popularity ordering.
- Excludes blocked users, deleted reviews, and non-public reviews unless `scope = 'mine'`.
- Feed cards link to `/reviews/:reviewId`; they do not link to another user's private `/book/:id`.

### review-detail

Load one canonical review page payload.

**Endpoint**: `POST /review-detail`

**Request**:
```typescript
{
  review_id: string;
}
```

**Response**:
```typescript
{
  review: ReviewFeedItem;
  related_reviews: ReviewFeedItem[];
}
```

Public reviews are visible to authenticated users unless blocking hides either side. Private reviews are visible only to their author.

### create-review

Create, update, or restore the authenticated user's review for a book they own.

**Endpoint**: `POST /create-review`

**Request**:
```typescript
{
  book_id: string;
  rating: number; // 1-5
  title?: string;
  content: string; // 10-5000 chars
  is_spoiler?: boolean;
  is_public?: boolean;
}
```

**Response**:
```typescript
{
  review: ReviewFeedItem;
  review_id: string;
}
```

The backend preserves one active review per user/book by updating an existing row, including a previously soft-deleted row.

### review actions

Review interaction endpoints:

| Endpoint | Request | Response |
| --- | --- | --- |
| `toggle-review-like` | `{ review_id: string }` | `{ liked: boolean; likes_count: number }` |
| `share-review` | `{ review_id: string }` | `{ share_url: string; share_count: number }` |
| `delete-review` | `{ review_id: string }` | `{ success: true }` |
| `review-comments` | `{ review_id: string; cursor?: string | null; limit?: number }` | `{ comments: ReviewComment[]; next_cursor: string | null; has_more: boolean }` |
| `create-review-comment` | `{ review_id: string; content: string }` | `{ comment: ReviewComment }` |

All review action endpoints are authenticated, block-aware where visibility is relevant, and use soft deletion for review removal.

### dashboard-home

Load dashboard aggregate data for the authenticated user.

**Endpoint**: `GET /dashboard-home?recent_limit=10` or `POST /dashboard-home`

**Request**:
```typescript
{
  recent_limit?: number; // 1-30, default 10
}
```

**Response**: dashboard home payload returned by `get_dashboard_home_snapshot`. Fresh snapshots are read from `dashboard_home_snapshots`; stale or missing snapshots refresh through `get_user_dashboard_stats`.

### clubs-home

Load the clubs discovery dashboard for the authenticated user.

**Endpoint**: `POST /clubs-home`

**Request**:
```typescript
{
  searchQuery?: string;
  limit?: number;
  maxDistance?: number;
}
```

**Response**:
```typescript
{
  myClubs: ClubPreview[];
  suggested: ClubPreview[];
  nearby: ClubPreview[];
  popular: ClubPreview[];
  newest: ClubPreview[];
  invites: ClubPreview[];
  pendingRequests: ClubPreview[];
  searchResults: ClubPreview[];
  summary: {
    my_clubs: number;
    suggested: number;
    nearby: number;
    invites: number;
    pending_requests: number;
  };
}
```

Private clubs are returned as limited previews for non-members. Preview payloads hide discussions, members, current book details, and precise coordinates until the viewer is accepted.
Club image fields are stored as private `club-media` paths and returned as signed `banner_image_url` / `avatar_image_url` values by club Edge Functions.

### club-detail

Load the club home. Public clubs and member/private clubs return full detail. Private non-member clubs return only limited preview metadata.

**Endpoint**: `POST /club-detail`

**Request**:
```typescript
{ clubId: string }
```

**Response**:
```typescript
{
  club: ClubPreview;
  user_role: "admin" | "moderator" | "member" | null;
  members: ClubMember[];
  discussions: ClubDiscussion[];
  announcements: ClubDiscussion[];
  admin?: {
    pending_requests: ClubJoinRequest[];
    pending_invites: ClubInvite[];
  } | null;
}
```

### Club Commands

Protected club command functions:

- `create-club`: creates a club with `name`, optional `description`, `is_private`, `genres`, `tags`, `member_limit`, and optional region fields.
- `join-club`: joins public clubs; private clubs require request or invite.
- `leave-club`: removes the current user, but rejects leaving if they are the last admin.
- `request-club-join`: creates an idempotent pending request for private clubs.
- `review-club-join-request`: admin-only approve/decline.
- `invite-club-member`: admin-only invite by reader id; blocked relationships are rejected.
- `respond-club-invite`: invited user accepts/declines.
- `create-club-discussion`: members create discussions/replies with optional media; admins can create announcements and pinned posts. `club-detail` returns discussions as nested tree payloads.
- `update-club-media`: admin-only banner/profile image updates using private `club-media` storage paths.
- `moderate-club-discussion`: author can delete own posts; moderators/admins can moderate; admins can pin.
- `manage-club-member`: admin-only role changes and removals.

### Direct Messaging

Protected one-to-one messaging functions:

- `conversations-home`: returns searchable inbox summaries with unread counts from `conversation_reads`, last message previews, per-user mute/pin/archive state, and block-disabled history.
- `conversation-detail`: returns a selected thread, the other reader profile summary, current user settings, reactions, and signed private media URLs when the pair is not blocked.
- `get-or-create-conversation`: creates or restores a direct conversation with another reader; blocked pairs and self-conversations are rejected.
- `send-message`: accepts text, uploaded image/GIF metadata, or a normalized Tenor GIF; inserts the message, registers media, and updates the sender read cursor.
- `mark-conversation-read`: updates the authenticated user's read cursor without mutating another participant's state.
- `toggle-message-reaction`: fixed reactions are `like`, `dislike`, `heart`, `laugh`, `wow`, and `thanks`; each user has at most one reaction per message.
- `update-conversation-settings`: per-user mute, pin, archive, and hidden inbox state. Inbox delete is a hide/archive action, not shared conversation deletion.
- `delete-message`: sender-only soft delete. Deleted messages remain as tombstones when needed for chronology.
- `search-message-gifs`: Tenor v2 search with safe-content filtering. Requires `TENOR_API_KEY` in deployed Edge Function secrets.

Message media uses the private `message-media` bucket. Uploads are JPEG, PNG, WebP, or GIF only, max 8 MB each, max 4 attachments per message. Reads use signed URLs returned by messaging Edge Functions.

### complete-reading

Run the consolidated reading completion transaction.

**Endpoint**: `POST /complete-reading`

**Request**:
```typescript
{
  book_id: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  client_session_id?: string;
  page_number?: number;
  chapter_number?: number;
  paragraph_number?: number;
  notes?: string;
  log_type?: string;
  time_spent_minutes?: number;
  photo_url?: string;
  client_log_id?: string;
  mark_complete?: boolean;
}
```

**Response**:
```typescript
{
  success: boolean;
  idempotent?: boolean;
  session?: Record<string, unknown> | null;
  progress_log?: Record<string, unknown> | null;
  book?: Record<string, unknown>;
  progress?: Record<string, unknown>;
  streak?: Record<string, unknown>;
  goal_progress?: unknown[];
  activity?: Record<string, unknown> | null;
  awarded_badges?: unknown[];
  awarded_count?: number;
}
```

This is the canonical backend path for online reading completion. It can persist a session, persist progress, update book state, refresh streaks, complete active goals, create deduped book activity, and award badges.

### create-reading-session

Persist a completed timer session through `create_reading_session`, which delegates to `complete_reading_transaction`.

**Endpoint**: `POST /create-reading-session`

**Request**:
```typescript
{
  book_id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  client_session_id?: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  session?: Record<string, unknown>;
}
```

### award-badges

Evaluate and award badges for the authenticated user.

**Endpoint**: `GET /award-badges?event=event-name` or `POST /award-badges`

**Request**:
```typescript
{
  event?: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  awarded_badges: Array<Record<string, unknown>>;
}
```

### discover-readers

Load smart reader discovery sections and ranked reader search.

**Endpoint**: `POST /discover-readers`

**Request**:
```typescript
{
  searchQuery?: string; // Optional reader-name search
  maxDistance?: number; // Nearby radius in km, default 50
  limit?: number;       // Max readers per section, default 24
}
```

**Response**:
```typescript
{
  suggestions: ReaderRecommendation[];
  nearby: ReaderRecommendation[];
  connections: ReaderRecommendation[];
  friendsOfFriends: ReaderRecommendation[];
  activeFriends: ReaderRecommendation[];
  searchResults: ReaderRecommendation[];
}

type ReaderRecommendation = {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    relationship: 'none' | 'following' | 'follower' | 'friend';
    badges: string[];
    status_badge: string;
    is_online: boolean;
    last_seen_at: string | null;
    distance_km?: number;
    mutual_friend_count: number;
    shared_club_count: number;
    genre_overlap?: number;
    recommendation_score: number;
    recommendation_reason: string;
    current_streak: number;
    books_read_count: number;
  };
```

**Discovery Rules**:
- The default response does not include an all-users directory.
- Suggestions are ranked from relationship, friends-of-friends, taste overlap, nearby, shared clubs, and activity.
- `activeFriends` includes mutual follows with online status enabled and recent presence only.
- `nearby` and distance scoring require saved coordinates and `show_location = true` for both readers.
- Blocked users are excluded in both directions.
- Private profiles are excluded unless profile visibility allows the authenticated user to view them.

**Example**:
```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/discover-readers`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ searchQuery: 'sam', limit: 20 }),
});

const { suggestions, searchResults } = await response.json();
```

### update-presence

Update the authenticated reader's lightweight presence heartbeat and optional reader status badge.

**Endpoint**: `POST /update-presence`

**Request**:
```typescript
{
  reader_status?: 'available' | 'reading_now' | 'buddy_reads' | 'looking_for_club' | 'taking_recommendations' | 'quiet';
}
```

**Response**:
```typescript
{
  online_enabled: boolean;
  reader_status: string;
  last_seen_at: string | null;
}
```

If `profiles.show_online_status` is false, the endpoint does not refresh `last_seen_at`.

### enhanced-activity

Generate enhanced activity feed with rich context.

**Endpoint**: `POST /enhanced-activity`

**Request**:
```typescript
{
  limit?: number;  // Activities to return (default 20)
  offset?: number; // Pagination offset (default 0)
}
```

**Response**:
```typescript
{
  activities: Array<{
    id: string;
    user_id: string;
    activity_type: string;
    created_at: string;
    metadata: Record<string, any>;
    
    // Enriched data
    user: {
      id: string;
      display_name: string;
      avatar_url: string | null;
    };
    book?: {
      id: string;
      title: string;
      author: string | null;
      cover_url: string | null;
    };
    review?: {
      id: string;
      rating: number;
      content: string;
    };
    badge?: {
      id: string;
      title: string;
      icon_url: string | null;
    };
  }>;
  total: number;
}
```

**Activity Types**:
- `book_started` - Started reading a book
- `book_completed` - Finished a book
- `review_created` - Posted a review
- `badge_earned` - Earned a badge
- `goal_achieved` - Achieved a reading goal
- `streak_milestone` - Hit streak milestone

**Example**:
```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/enhanced-activity`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ limit: 20, offset: 0 }),
});

const { activities, total } = await response.json();
```

### log-progress

Log reading progress through the consolidated completion transaction.

**Endpoint**: `POST /log-progress`

**Request**:
```typescript
{
  book_id: string;
  page_number: number;
  chapter_number?: number;
  paragraph_number?: number;
  notes?: string;
  log_type: 'manual' | 'timer' | 'quick';
  time_spent_minutes?: number;
  photo_url?: string;
  client_log_id?: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  log: {
    id: string;
    book_id: string;
    user_id: string;
    page_number: number;
    chapter_number: number | null;
    paragraph_number: number | null;
    notes: string | null;
    log_type: string;
    time_spent_minutes: number | null;
    logged_at: string;
    created_at: string;
  };
  progress: {
    current_page: number;
    percentage: number;
  };
}
```

**Features**:
- Atomic transaction for progress, book update, streak refresh, goal completion, activity, and badges when applicable
- Auto-update book's current_page
- Calculate progress percentage
- Idempotent offline sync support through `client_log_id`

**Example**:
```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/log-progress`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    book_id: 'book-uuid',
    page_number: 42,
    chapter_number: 3,
    log_type: 'manual',
    time_spent_minutes: 15,
  }),
});

const { success, log, progress } = await response.json();
```

### monthly-stats

Calculate monthly reading statistics.

**Endpoint**: `POST /monthly-stats`

**Request**:
```typescript
{
  month?: number;  // 1-12 (default: current month)
  year?: number;   // (default: current year)
}
```

**Response**:
```typescript
{
  stats: {
    books_completed: number;
    pages_read: number;
    time_spent_minutes: number;
    average_rating: number;
    favorite_genre: string | null;
    reading_streak: number;
    goal_progress: {
      target: number;
      actual: number;
      percentage: number;
    };
  };
  daily_breakdown: Array<{
    date: string;
    pages: number;
    minutes: number;
  }>;
}
```

**Example**:
```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/monthly-stats`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ month: 2, year: 2026 }),
});

const { stats, daily_breakdown } = await response.json();
```

### social-feed

Aggregate social feed from followed users.

**Endpoint**: `POST /social-feed`

**Request**:
```typescript
{
  limit?: number;   // Posts to return (default 20)
  offset?: number;  // Pagination offset (default 0)
  filter?: 'all' | 'following' | 'popular';
}
```

**Response**:
```typescript
{
  posts: Array<{
    id: string;
    user_id: string;
    book_id: string | null;
    title: string;
    content: string;
    genre: string | null;
    likes_count: number;
    comments_count: number;
    created_at: string;
    
    // Enriched
    user: {
      id: string;
      display_name: string;
      avatar_url: string | null;
    };
    book: {
      id: string;
      title: string;
      author: string | null;
      cover_url: string | null;
    } | null;
    user_has_liked: boolean;
  }>;
  total: number;
}
```

**Example**:
```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/social-feed`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ filter: 'following', limit: 20 }),
});

const { posts, total } = await response.json();
```

### send-push-notification

Send push notifications via Firebase Cloud Messaging.

**Endpoint**: `POST /send-push-notification`

**Request**:
```typescript
{
  user_ids: string[];       // Must contain only the authenticated user
  notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
    image?: string;
  };
  platform?: 'ios' | 'android';
}
```

**Response**:
```typescript
{
  success: boolean;
  results: {
    ios: { tokens: number; sent: number; failed: number };
    android: { tokens: number; sent: number; failed: number };
  };
}
```

**Example**:
```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    user_ids: ['current-user-uuid'],
    notification: {
      title: 'New badge earned',
      body: 'You unlocked a new badge',
      data: { type: 'badge_earned' },
    },
  }),
});

const { success, results } = await response.json();
```

**Environment Variables**:
- `FCM_SERVER_KEY` (required) - Firebase Cloud Messaging server key

**Platforms**: Android and iOS (via FCM)

### calculate-book-progress

Calculate detailed progress analytics for a book.

**Endpoint**: `POST /calculate-book-progress`

**Request**:
```typescript
{
  book_id: string;
}
```

**Response**:
```typescript
{
  progress: {
    current_page: number;
    total_pages: number;
    progress_percentage: number;
    pages_remaining: number;
    
    reading_velocity: {
      overall: number;        // pages per hour
      recent: number;         // last 7 days
      trend: 'up' | 'down' | 'stable';
    };
    
    estimated_completion_date: string | null;
    estimated_days_to_completion: number | null;
    
    total_time_hours: number;
    
    statistics: {
      total_logs: number;
      total_sessions: number;
      avg_session_duration: number;
      longest_session: number;
      most_productive_hour: number | null;
    };
  };
}
```

**Example**:
```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/calculate-book-progress`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ book_id: 'book-uuid' }),
});

const { progress } = await response.json();
```

### compute-analytics

Compute and store a daily analytics snapshot for the authenticated user.

**Endpoint**: `POST /compute-analytics`

**Request**:
```typescript
{
  date?: string; // YYYY-MM-DD, defaults to today
}
```

**Response**:
```typescript
{
  success: boolean;
  snapshot: Record<string, unknown>;
}
```

### sync-pull

Pull reading-core records changed since the client's cursor.

**Endpoint**: `POST /sync-pull`

**Request**:
```typescript
{
  cursor?: string | null;
}
```

**Response**:
```typescript
{
  success: boolean;
  cursor: string;
  records: {
    books: unknown[];
    reading_sessions: unknown[];
    progress_logs: unknown[];
    journal_entries: unknown[];
    goals: unknown[];
    profile_preferences: unknown[];
  };
}
```

**Notes**:
- Uses the authenticated user ID only.
- Includes soft-delete tombstones for books, journal entries, and goals.
- Cursor-based filtering uses `updated_at` for mutable entities and `created_at` for immutable session/log history.

### sync-push

Push reading-core outbox mutations from the local device.

**Endpoint**: `POST /sync-push`

**Request**:
```typescript
{
  items: Array<{
    id: string;
    client_mutation_id: string;
    client_entity_id: string;
    user_id: string;
    entity: 'books' | 'reading_sessions' | 'progress_logs' | 'journal_entries' | 'goals' | 'profile_preferences';
    operation: 'create' | 'update' | 'delete' | 'restore';
    payload: Record<string, unknown>;
  }>;
}
```

**Response**:
```typescript
{
  success: boolean;
  accepted: Array<{
    id: string;
    client_mutation_id: string;
    entity: string;
    client_entity_id: string;
    server_entity_id?: string;
    record?: unknown;
  }>;
  failed: Array<{
    id: string;
    client_mutation_id: string;
    entity: string;
    client_entity_id: string;
    error: string;
    retryable: boolean;
  }>;
  cursor: string;
}
```

**Notes**:
- The server rejects items whose `user_id` does not match the authenticated user.
- Book creates/restores route through `add_library_book`.
- Progress logs route through `log_progress_transaction` with client log IDs.
- Journal and goal deletes are soft deletes, not hard deletes.

## Authentication

All protected functions require a valid Supabase JWT token in the `Authorization` header. `search-books` is intentionally public and has `verify_jwt = false`.

```typescript
headers: {
  'Authorization': `Bearer ${supabaseToken}`,
  'Content-Type': 'application/json',
}
```

Get token from Supabase client:
```typescript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

## Error Handling

All functions return errors in a consistent format:

```typescript
{
  error: string;      // Error message
  code?: string;      // Error code
  details?: any;      // Additional details
}
```

**Common Status Codes**:
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

**Example Error**:
```json
{
  "error": "Missing required fields",
  "details": ["query"]
}
```

## Deployment

### Deploy All Functions

```bash
npx supabase functions deploy --project-ref waftnaqgkcgufzapcihe --use-api
```

### Deploy Specific Function

```bash
npx supabase functions deploy search-books --project-ref waftnaqgkcgufzapcihe --use-api
```

### Environment Variables

Set in Supabase Dashboard or via CLI:

```bash
npx supabase secrets set SUPABASE_URL=https://your-project.supabase.co
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
npx supabase secrets set ALLOWED_ORIGINS=https://yourdomain.com
npx supabase secrets set ENVIRONMENT=production
npx supabase secrets set GOOGLE_BOOKS_API_KEY=your-key
npx supabase secrets set FCM_SERVER_KEY=your-fcm-key
npx supabase secrets set TENOR_API_KEY=your-tenor-key
```

## Local Development

### Start Supabase Locally

```bash
npx supabase start
```

### Serve Functions Locally

```bash
npx supabase functions serve search-books --env-file .env
```

### Test Function

```bash
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/search-books' \
  --header 'Authorization: Bearer YOUR_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{"query":"gatsby"}'
```

## Best Practices

1. **Always validate input** - Use `requireFields` helper
2. **Handle errors gracefully** - Use `createErrorResponse`
3. **Set CORS headers** - Use `getCorsHeaders`
4. **Implement rate limiting** - Use `enforceRateLimit` with a service client
5. **Keep functions small** - Single responsibility
6. **Use TypeScript** - Type safety and better DX
7. **Log errors** - Use `console.error` for debugging

## Further Reading

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Documentation](https://deno.land/manual)
- [Getting Started](./getting-started.md)
- [Database Schema](./database-schema.md)
