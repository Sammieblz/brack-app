# API Reference

Documentation for Brack's Supabase Edge Functions.

## Overview

Edge Functions are serverless TypeScript/Deno functions deployed on Supabase's global edge network.

**Runtime**: Deno 1.x  
**Language**: TypeScript  
**Location**: `supabase/functions/`  
**Deployment**: `npx supabase functions deploy`

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

Simple in-memory rate limiting.

```typescript
export function rateLimit(
  req: Request,
  config: { name: string; limit: number; windowMs: number }
): Response | null;
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

### search-books

Search for books using Google Books API.

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
  }>;
}
```

**Rate Limit**: 30 requests per minute

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
- `GOOGLE_BOOKS_API_KEY` (optional) - Increases rate limits

### discover-readers

Find readers with similar interests and reading habits.

**Endpoint**: `POST /discover-readers`

**Request**:
```typescript
{
  limit?: number;  // Max readers to return (default 20)
}
```

**Response**:
```typescript
{
  readers: Array<{
    id: string;
    display_name: string;
    avatar_url: string | null;
    bio: string | null;
    city: string | null;
    country: string | null;
    distance: number | null;  // km, if location available
    score: number;            // Match score (0-100)
    common_genres: string[];  // Shared genres
    current_streak: number;
    books_read: number;
    is_following: boolean;
  }>;
}
```

**Matching Algorithm**:
- Genre overlap: +20 points per genre
- Similar reading pace: +10 points
- Same favorite genre: +15 points
- Nearby location: +5 points

**Example**:
```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/discover-readers`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ limit: 20 }),
});

const { readers } = await response.json();
```

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

Log reading progress with atomic transaction.

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
- Atomic transaction (log + book update)
- Auto-update book's current_page
- Calculate progress percentage

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
  user_id: string;          // Target user
  title: string;            // Notification title
  body: string;             // Notification body
  data?: Record<string, string>; // Custom data
}
```

**Response**:
```typescript
{
  success: boolean;
  sent_count: number;  // Number of tokens notified
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
    user_id: 'user-uuid',
    title: 'New follower',
    body: 'John Doe started following you',
    data: { type: 'follower', user_id: 'john-uuid' },
  }),
});

const { success, sent_count } = await response.json();
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

## Authentication

All functions require a valid Supabase JWT token in the `Authorization` header:

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
npx supabase functions deploy
```

### Deploy Specific Function

```bash
npx supabase functions deploy search-books
```

### Environment Variables

Set in Supabase Dashboard or via CLI:

```bash
npx supabase secrets set GOOGLE_BOOKS_API_KEY=your-key
npx supabase secrets set FCM_SERVER_KEY=your-fcm-key
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
4. **Implement rate limiting** - Use `rateLimit` helper
5. **Keep functions small** - Single responsibility
6. **Use TypeScript** - Type safety and better DX
7. **Log errors** - Use `console.error` for debugging

## Further Reading

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Documentation](https://deno.land/manual)
- [Getting Started](./getting-started.md)
- [Database Schema](./database-schema.md)
