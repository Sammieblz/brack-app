# Visual Guides

Visual diagrams and flowcharts to understand Brack architecture.

## Application Flow

### User Journey - First Time User

```
┌─────────────┐
│   Launch    │
│     App     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Check Auth  │
└──────┬──────┘
       │
       ▼
  Not Logged In
       │
       ▼
┌─────────────┐      ┌─────────────┐
│  Auth Page  │─────►│  Sign Up    │
│             │      └──────┬──────┘
└─────────────┘             │
       │                    │
       └────────────────────┘
                │
                ▼
        ┌───────────────┐
        │   Welcome     │
        │    Screen     │
        └───────┬───────┘
                │
                ▼
        ┌───────────────┐
        │Questionnaire  │
        │ (Habits)      │
        └───────┬───────┘
                │
                ▼
        ┌───────────────┐
        │  Set Initial  │
        │     Goal      │
        └───────┬───────┘
                │
                ▼
        ┌───────────────┐
        │   Dashboard   │
        │   (Home)      │
        └───────────────┘
```

### User Journey - Add Book

```
┌─────────────────┐
│  Add Book Page  │
└────────┬────────┘
         │
    ┌────┴─────┬──────────┬──────────┐
    │          │          │          │
    ▼          ▼          ▼          ▼
┌───────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Search │ │ Scan   │ │ Scan   │ │Manual  │
│Google │ │Barcode │ │ Cover  │ │ Entry  │
│Books  │ │ (ISBN) │ │ (OCR)  │ │        │
└───┬───┘ └───┬────┘ └───┬────┘ └───┬────┘
    │         │          │          │
    └─────────┴──────────┴──────────┘
              │
              ▼
     ┌────────────────┐
     │ Book Details   │
     │   Populated    │
     └────────┬───────┘
              │
              ▼
     ┌────────────────┐
     │ Review & Save  │
     └────────┬───────┘
              │
              ▼
     ┌────────────────┐
     │   Dashboard    │
     │  (Book Added)  │
     └────────────────┘
```

### User Journey - Reading Session

```
┌──────────────┐
│  Book Detail │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Start Timer  │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  Reading...      │
│  Timer Running   │
│  (Minimizable)   │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Stop Timer      │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Save Session     │
│ (Automatic)      │
└──────┬───────────┘
       │
       ├──► Update Streak
       ├──► Update Book Status
       └──► Trigger Journal Prompt (if 5+ min)
                │
                ▼
        ┌───────────────┐
        │Journal Prompt │
        │ (Optional)    │
        └───────┬───────┘
                │
           ┌────┴────┐
           │         │
           ▼         ▼
      ┌────────┐  ┌──────┐
      │  Add   │  │ Skip │
      │Journal │  │      │
      └────┬───┘  └──────┘
           │
           ▼
      ┌─────────┐
      │Dashboard│
      └─────────┘
```

## Data Flow Diagrams

### Book Creation Flow

```
User Input
    ↓
┌─────────────────────┐
│  Validate Form      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Check Network       │
└──────┬──────────────┘
       │
  ┌────┴────┐
  │ Online? │
  └────┬────┘
       │
   Yes │ No
       │ └────────► ┌──────────────┐
       │            │Offline Queue │
       │            │(LocalStorage)│
       │            └──────────────┘
       │                   │
       ▼                   │ (on reconnect)
┌──────────────┐           │
│  Supabase    │◄──────────┘
│  .from('books')│
│  .insert()   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  PostgreSQL  │
│  + RLS Check │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Success    │
└──────┬───────┘
       │
       ├──► Invalidate Cache
       ├──► Refetch Books
       ├──► Show Toast
       └──► Navigate to Dashboard
```

### Real-time Subscription Flow

```
Component Mounts
       ↓
┌──────────────────┐
│ Check Visibility │
└────────┬─────────┘
         │
    Is Visible?
         │
         ▼ Yes
┌──────────────────┐
│Create Channel    │
│  .on('changes')  │
│  .subscribe()    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Listen for      │
│   Database       │
│   Changes        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Change Detected  │
└────────┬─────────┘
         │
         ├──► Invalidate Cache
         ├──► Refetch Data
         └──► Update UI
         
         
Page Hidden
       ↓
┌──────────────────┐
│  Unsubscribe     │
│ (Save Battery)   │
└──────────────────┘
```

## Architecture Diagrams

### Offline Queue Architecture

```
┌─────────────────────────────────────────────────────┐
│                    User Action                       │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
              ┌───────────────┐
              │ Check Network │
              └───────┬───────┘
                      │
              ┌───────┴────────┐
              │                │
         Online│                │Offline
              │                │
              ▼                ▼
    ┌──────────────┐  ┌──────────────────┐
    │   Execute    │  │   Add to Queue   │
    │ Immediately  │  │                  │
    └──────┬───────┘  │  ┌─────────────┐ │
           │          │  │  Action 1   │ │
           │          │  ├─────────────┤ │
           │          │  │  Action 2   │ │
           │          │  ├─────────────┤ │
           │          │  │  Action 3   │ │
           │          │  └─────────────┘ │
           │          └──────────────────┘
           │                   │
           │                   │ (store in localStorage)
           │                   │
           │          ┌────────▼─────────┐
           │          │  Wait for Online │
           │          └────────┬─────────┘
           │                   │
           │          ┌────────▼─────────┐
           │          │   Sync Service   │
           │          │                  │
           │          │  ┌────────────┐  │
           │          │  │ Retry Loop │  │
           │          │  │  (max 3x)  │  │
           │          │  └────────────┘  │
           │          └────────┬─────────┘
           │                   │
           └───────────────────┘
                      │
                      ▼
            ┌──────────────────┐
            │  Update Database │
            └──────────┬───────┘
                       │
                       ▼
            ┌──────────────────┐
            │ Invalidate Cache │
            └──────────┬───────┘
                       │
                       ▼
            ┌──────────────────┐
            │   Refresh UI     │
            └──────────────────┘
```

### Component Hierarchy

```
App
├── ErrorBoundary
│   └── PersistQueryClientProvider
│       └── ConfirmDialogProvider
│           └── ThemeProvider
│               └── ProfileProvider
│                   └── TimerProvider
│                       └── TooltipProvider
│                           ├── Toaster (shadcn)
│                           ├── Sonner (sonner)
│                           └── BrowserRouter
│                               ├── DeepLinkHandler
│                               ├── SwipeBackHandler
│                               │   ├── Routes
│                               │   │   ├── Dashboard
│                               │   │   ├── MyBooks
│                               │   │   ├── BookDetail
│                               │   │   └── ...
│                               │   ├── FloatingTimerWidget
│                               │   ├── JournalPromptHandler
│                               │   └── OfflineIndicator
```

### Hook Dependency Graph

```
Component
    ↓
useAuth ────────┐
    ↓           │
  user          │
    │           │
    ├──► useBooks(user.id)
    │       ↓
    │     books
    │
    ├──► useStreaks(user.id)
    │       ↓
    │   streakData
    │
    ├──► useGoals(user.id)
    │       ↓
    │     goals
    │
    └──► useProfileContext()
            ↓
          profile
```

## Screen Layouts

### Mobile Layout Structure

```
┌─────────────────────────┐
│     MobileHeader        │  ← Sticky header
├─────────────────────────┤
│                         │
│                         │
│   NativeScrollView      │  ← Scrollable content
│     (Main Content)      │
│                         │
│                         │
├─────────────────────────┤
│   MobileBottomNav       │  ← Fixed bottom nav
│  [Home][Books][Feed]    │
│  [Readers][Profile]     │
└─────────────────────────┘

Floating:
┌──────────────┐
│FloatingTimer │  ← Draggable (future)
│  00:15:23    │
└──────────────┘

┌──────┐
│ FAB  │  ← Bottom right
└──────┘
```

### Desktop Layout Structure

```
┌──────────────────────────────────────────────────┐
│              NativeHeader (Sticky)                │
│  Title                              [Actions]    │
├────────┬─────────────────────────────────────────┤
│        │                                         │
│ Side   │        Main Content Area               │
│ Nav    │                                         │
│ Bar    │  ┌──────────────────────────────────┐  │
│        │  │         Card Grid / List         │  │
│[Home]  │  │                                  │  │
│[Books] │  │  ┌────┐ ┌────┐ ┌────┐           │  │
│[Feed]  │  │  │Card│ │Card│ │Card│           │  │
│[Clubs] │  │  └────┘ └────┘ └────┘           │  │
│[Profile]   │                                  │  │
│        │  │                                  │  │
│        │  └──────────────────────────────────┘  │
│        │                                         │
└────────┴─────────────────────────────────────────┘
```

## Database Relationship Diagram

```
                    ┌─────────────┐
                    │  profiles   │
                    │             │
                    │ id (PK)     │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         │ user_id         │                 │
         │                 │                 │
┌────────▼───────┐ ┌───────▼────────┐ ┌─────▼──────┐
│     books      │ │reading_sessions│ │   goals    │
│                │ │                │ │            │
│ id (PK)        │ │ id (PK)        │ │ id (PK)    │
│ user_id (FK)   │ │ user_id (FK)   │ │ user_id(FK)│
│ title          │ │ book_id (FK)───┼─┤ target     │
│ status         │ │ duration       │ │ period     │
└────────┬───────┘ └────────────────┘ └────────────┘
         │
         │ book_id (FK)
         │
         ├──────────────┬──────────────┬──────────────┐
         │              │              │              │
┌────────▼────┐ ┌───────▼──────┐ ┌────▼────────┐ ┌──▼──────┐
│progress_logs│ │journal_      │ │book_reviews │ │  posts  │
│             │ │entries       │ │             │ │         │
│ id (PK)     │ │              │ │ id (PK)     │ │ id (PK) │
│ book_id(FK) │ │ id (PK)      │ │ book_id(FK) │ │book_id  │
│ page_number │ │ book_id (FK) │ │ user_id(FK) │ │user_id  │
│ photo_url   │ │ entry_type   │ │ rating      │ │content  │
└─────────────┘ │ photo_url    │ └─────────────┘ └─────────┘
                └──────────────┘
```

## State Management Flow

```
┌───────────────────────────────────────────────┐
│              Component Layer                   │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐     │
│  │Dashboard│  │ MyBooks │  │BookDetail│     │
│  └────┬────┘  └────┬────┘  └────┬─────┘     │
└───────┼────────────┼────────────┼────────────┘
        │            │            │
        └────────────┴────────────┘
                     │
┌────────────────────▼────────────────────────┐
│              Hook Layer                      │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐    │
│  │useBooks │  │useGoals │  │useStreaks│    │
│  └────┬────┘  └────┬────┘  └────┬─────┘    │
└───────┼────────────┼────────────┼───────────┘
        │            │            │
        └────────────┴────────────┘
                     │
┌────────────────────▼────────────────────────┐
│         TanStack Query Layer                 │
│  ┌────────────────────────────────────┐     │
│  │        Query Client                │     │
│  │  ┌──────────┐  ┌──────────────┐   │     │
│  │  │  Cache   │  │  Subscriptions│   │     │
│  │  └──────────┘  └──────────────┘   │     │
│  └────────────────────────────────────┘     │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│           Service Layer                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │Supabase  │  │dataCache │  │offline   │  │
│  │ Client   │  │          │  │Queue     │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└───────┼─────────────┼─────────────┼─────────┘
        │             │             │
        └─────────────┴─────────────┘
                      │
┌─────────────────────▼─────────────────────────┐
│              Data Layer                        │
│  ┌──────────────┐  ┌───────────────────────┐  │
│  │  PostgreSQL  │  │   Local Storage       │  │
│  │  (Supabase)  │  │  ┌─────────────────┐  │  │
│  │              │  │  │ Query Persist   │  │  │
│  │ - 27 Tables  │  │  │ Offline Queue   │  │  │
│  │ - RLS        │  │  │ Data Cache      │  │  │
│  │ - Indexes    │  │  │ Image Cache     │  │  │
│  └──────────────┘  │  └─────────────────┘  │  │
└─────────────────────────────────────────────────┘
```

## Mobile Architecture

```
┌─────────────────────────────────────────────────┐
│           React Web Application                  │
│  (Runs in WebView)                              │
│                                                  │
│  ┌────────────────────────────────────────┐     │
│  │         Components & Hooks             │     │
│  └────────────────┬───────────────────────┘     │
│                   │                              │
│                   ▼                              │
│  ┌────────────────────────────────────────┐     │
│  │      Capacitor JavaScript Bridge       │     │
│  └────────────────┬───────────────────────┘     │
└───────────────────┼──────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────┐
│           Native Platform Layer                    │
│                                                    │
│  iOS (Swift/Obj-C)       Android (Java/Kotlin)    │
│  ┌──────────────┐         ┌──────────────┐        │
│  │   Camera     │         │   Camera     │        │
│  ├──────────────┤         ├──────────────┤        │
│  │Notifications │         │Notifications │        │
│  ├──────────────┤         ├──────────────┤        │
│  │  Filesystem  │         │  Filesystem  │        │
│  ├──────────────┤         ├──────────────┤        │
│  │   Haptics    │         │   Vibrator   │        │
│  ├──────────────┤         ├──────────────┤        │
│  │    Share     │         │    Share     │        │
│  └──────────────┘         └──────────────┘        │
└───────────────────────────────────────────────────┘
```

## Caching Strategy

```
Request Data
     │
     ▼
┌─────────────────┐
│Check React Query│
│     Cache       │
└────────┬────────┘
         │
    ┌────┴────┐
    │  Hit?   │
    └────┬────┘
         │
    No   │ Yes ──► Return Cached Data (Instant)
         │
         ▼
┌─────────────────┐
│ Check dataCache │
│  (2-min TTL)    │
└────────┬────────┘
         │
    ┌────┴────┐
    │  Hit?   │
    └────┬────┘
         │
    No   │ Yes ──► Return Cached, Refetch in Background
         │
         ▼
┌─────────────────┐
│ Fetch from API  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Update Caches  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Return Data    │
└─────────────────┘
```

## Timer State Machine

```
         ┌─────────┐
    ┌───►│ Stopped │
    │    └────┬────┘
    │         │ start()
    │         │
    │         ▼
    │    ┌─────────┐     pause()    ┌────────┐
    │    │ Running │────────────────►│ Paused │
    │    └────┬────┘                 └───┬────┘
    │         │                          │
    │         │ finish()      resume()   │
    │         │                          │
    │         ▼                          │
    │    ┌─────────┐◄────────────────────┘
    │    │ Saving  │
    │    └────┬────┘
    │         │
    │         │ success
    │         │
    │         ▼
    │    ┌─────────┐
    │    │Completed│
    │    └────┬────┘
    │         │
    │         │ journal prompt (if 5+ min)
    │         │
    │         ▼
    │    ┌─────────────┐      skip
    │    │Journal Prompt├──────────────┐
    │    └────┬────────┘              │
    │         │ add entry              │
    │         │                        │
    │         ▼                        │
    │    ┌─────────┐                  │
    │    │ Saved   │                  │
    │    └────┬────┘                  │
    │         │                        │
    └─────────┴────────────────────────┘
              │
              ▼
         Back to Stopped
```

## Authentication Flow Diagram

```
┌──────────────┐
│  User Opens  │
│     App      │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Check Session    │
│ (localStorage)   │
└──────┬───────────┘
       │
  ┌────┴─────┐
  │  Valid?  │
  └────┬─────┘
       │
   No  │ Yes ──► Load User Data ──► Dashboard
       │
       ▼
┌──────────────┐
│  Auth Screen │
└──────┬───────┘
       │
  ┌────┴─────┬─────────┐
  │          │         │
  ▼          ▼         ▼
SignUp    SignIn   MagicLink
  │          │         │
  └──────────┴─────────┘
             │
             ▼
    ┌────────────────┐
    │ Supabase Auth  │
    └────────┬───────┘
             │
             ▼
    ┌────────────────┐
    │  JWT Token     │
    │  Generated     │
    └────────┬───────┘
             │
             ├──► Store in localStorage
             ├──► Create Profile (if new)
             └──► Redirect to Dashboard
```

## Offline Sync Sequence

```
1. User Creates Book (Offline)
   ↓
   Queue Action in localStorage
   
2. App Reconnects
   ↓
   Network Event Fires
   ↓
   syncService.sync() Called
   ↓
   
3. Process Queue
   ┌─────────────────────────┐
   │ For each queued action: │
   │                         │
   │ 1. Execute API call     │
   │ 2. If success:          │
   │    - Remove from queue  │
   │    - Invalidate cache   │
   │ 3. If failure:          │
   │    - Increment retry    │
   │    - Keep in queue      │
   │ 4. If max retries:      │
   │    - Log error          │
   │    - Remove from queue  │
   └─────────────────────────┘
   ↓
   All Actions Processed
   ↓
   Show Success Toast
   ↓
   Refetch Data
```

## Book Status State Machine

```
         ┌──────────┐
    ┌───►│ to_read  │
    │    └────┬─────┘
    │         │
    │         │ First Activity (log/session/journal)
    │         │
    │         ▼
    │    ┌─────────┐
    │    │ reading │◄────────┐
    │    └────┬────┘         │
    │         │              │
    │         │ Manual       │ Reopen
    │         │ Complete     │
    │         │              │
    │         ▼              │
    │    ┌───────────┐       │
    └────┤ completed │───────┘
         └───────────┘
```

## Further Reading

- [Architecture](./architecture.md)
- [Database Schema](./database-schema.md)
- [State Management](./state-management.md)
- [Offline Support](./offline-support.md)
