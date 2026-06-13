# Architecture Overview

This document describes the high-level architecture and design patterns used in Brack.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Devices                          │
├─────────────────┬─────────────────┬────────────────────────┤
│   Web Browser   │   iOS Device    │   Android Device       │
│  (PWA Support)  │  (Capacitor)    │   (Capacitor)          │
└────────┬────────┴────────┬────────┴────────┬───────────────┘
         │                 │                 │
         │ HTTPS           │ HTTPS           │ HTTPS
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    React Application                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Components │  │    Hooks     │  │    Services      │  │
│  │  (UI Layer) │◄─┤ (Logic Layer)│◄─┤  (Data Layer)    │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
└────────┬───────────────────────┬──────────────────────────┘
         │                       │
         │ REST/WebSocket        │ Local durable storage
         │                       │
         ▼                       ▼
┌──────────────────┐    ┌─────────────────────┐
│    Supabase      │    │ Durable Local Store  │
│  ┌────────────┐  │    │  ┌───────────────┐ │
│  │ PostgreSQL │  │    │  │ IndexedDB/Web │ │
│  │  Database  │  │    │  ├───────────────┤ │
│  ├────────────┤  │    │  │ IndexedDB     │ │
│  │  Storage   │  │    │  ├───────────────┤ │
│  │  (Images)  │  │    │  │ Service Worker│ │
│  ├────────────┤  │    │  └───────────────┘ │
│  │    Auth    │  │    └─────────────────────┘
│  ├────────────┤  │
│  │  Realtime  │  │    ┌─────────────────────┐
│  ├────────────┤  │    │  Native Features    │
│  │   Edge     │◄─┼───►│  ┌───────────────┐ │
│  │ Functions  │  │    │  │ Camera        │ │
│  └────────────┘  │    │  ├───────────────┤ │
└──────────────────┘    │  │ Notifications │ │
         │              │  ├───────────────┤ │
         │              │  │ Filesystem    │ │
         ▼              │  ├───────────────┤ │
┌──────────────────┐    │  │ Haptics       │ │
│   External APIs  │    │  └───────────────┘ │
│  ┌────────────┐  │    └─────────────────────┘
│  │Google Books│  │
│  ├────────────┤  │
│  │    FCM     │  │
│  └────────────┘  │
└──────────────────┘
```

## Application Layers

### 1. Presentation Layer (Components)

**Location**: `apps/client/src/components/`, `apps/client/src/screens/`

**Responsibilities**:
- Render UI based on state
- Handle user interactions
- Display loading and error states
- Route-based code splitting

**Patterns**:
- **Compound Components** - Related components grouped together
- **Render Props** - For flexible component composition
- **Higher-Order Components** - For cross-cutting concerns (ErrorBoundary)

**Example Structure**:
```tsx
// Screen component
function BookDetail() {
  const { book, loading } = useBook(bookId);
  
  if (loading) return <Skeleton />;
  if (!book) return <NotFound />;
  
  return <BookDetailView book={book} />;
}
```

### 2. Business Logic Layer (Hooks)

**Location**: `apps/client/src/hooks/`

**Responsibilities**:
- Data fetching and mutations
- State management
- Business logic encapsulation
- Reusable logic across components

**Patterns**:
- **Custom Hooks** - Encapsulate stateful logic
- **Composition** - Hooks can use other hooks
- **Separation of Concerns** - One hook per domain

**Example Structure**:
```tsx
function useBook(bookId: string) {
  const { data: book, isLoading } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => bookService.getBook(bookId),
  });
  
  return { book, loading: isLoading };
}
```

### 3. Data Layer (Services)

**Location**: `apps/client/src/services/`

**Responsibilities**:
- API communication
- Data transformation
- Caching strategies
- Error handling

**Services**:
- `local/driver.ts` - Durable IndexedDB/SQLite local storage driver
- `local/repositories.ts` - Local-first repositories and outbox creation
- `sync/engine.ts` - Reading-core push/pull sync engine
- `syncService.ts` - App-level background synchronization facade
- `platform.ts` - Runtime helpers for web, iOS, Android, and desktop
- `api/` - Backend API module layer
- `deepLinkService.ts` - Deep link handling
- `pushNotifications.ts` - Push notification management
- `shareService.ts` - Native sharing
- `dataCache.ts` - Data caching
- `imageCache.ts` - Image caching

### 4. State Management

#### Global State (React Context)

**Contexts**:
- `ProfileContext` - User profile data
- `TimerContext` - Reading timer state
- `ThemeContext` - Theme preferences
- `ConfirmDialogContext` - Confirmation dialogs

#### Server State (TanStack Query)

**Strategy**: Stale-while-revalidate with cache persistence

**Configuration**:
```typescript
{
  staleTime: 5 * 60 * 1000,     // 5 minutes
  gcTime: 30 * 60 * 1000,       // 30 minutes
  retry: 1,
  refetchOnWindowFocus: false,
  refetchOnReconnect: "always"
}
```

**Cache Keys**: Hierarchical structure
```
['books'] - All books
['books', userId] - User's books
['book', bookId] - Specific book
['book', bookId, 'progress'] - Book progress
```

#### Local State (useState)

**Usage**: UI state, form inputs, temporary data

## Data Flow

### Read Flow (Query)

```
Component → Hook → TanStack Query → Cache Check
                         ↓ (miss)
                    Service Layer
                         ↓
                  Supabase Client
                         ↓
                   PostgreSQL
                         ↓
                  Transform Data
                         ↓
                   Update Cache
                         ↓
                  Return to Hook
                         ↓
                 Update Component
```

### Write Flow (Mutation)

```
User Action → Component → Hook → Mutation
                                    ↓
                         Check Network Status
                                    ↓
              ┌────────────────────┴────────────────────┐
              │ Online                       │ Offline  │
              ▼                              ▼          │
         Service Layer                 Local Outbox     │
              ▼                              ▼          │
       Supabase Client                IndexedDB/SQLite │
              ▼                              │          │
        PostgreSQL                           │          │
              ▼                              │          │
      Invalidate Cache ◄───────────────────┘          │
              ▼                                         │
       Refetch Data                                     │
              ▼                                         │
      Update Component                                  │
                                                        │
      On Reconnect: Push outbox, then pull latest ─────┘
```

## Offline Architecture

### Local-First Sync System

```
User Action (Offline)
       ↓
Check Network Status
       ↓
Persist local record and enqueue outbox item
       ↓
┌─────────────────────────────┐
│   Durable local outbox      │
│  ┌────────────────────────┐ │
│  │ Action 1 (create_book) │ │
│  │ Action 2 (update_book) │ │
│  │ Action 3 (log_progress)│ │
│  └────────────────────────┘ │
└─────────────────────────────┘
       ↓ (on reconnect)
readingCoreSync processes outbox
       ↓
Push to sync-push with retry metadata
       ↓
Pull latest server records from sync-pull
       ↓
Update UI with Fresh Data
```

### Caching Strategy

**Data Cache** (2-minute TTL):
- Books list
- Social feed
- Posts
- User profiles

**Image Cache** (7-day TTL):
- Book covers
- Profile avatars
- User-uploaded images

**Strategy**: Cache-first with background refresh

## Mobile Architecture

### Capacitor Bridge

```
React Component
       ↓
Custom Hook
       ↓
Capacitor Plugin
       ↓
┌──────────────────────────────┐
│    Native Bridge             │
│  ┌────────────────────────┐  │
│  │  iOS (Swift/Obj-C)     │  │
│  │  Android (Java/Kotlin) │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
       ↓
Native APIs (Camera, Push, etc.)
```

### Platform Detection

```typescript
if (Capacitor.isNativePlatform()) {
  // Use native features
} else {
  // Web fallback
}
```

## Desktop Architecture

Desktop uses Electron as a shell around the same React renderer.

```text
Electron main process
    |
    v
Secure preload bridge
    |
    v
React renderer services
```

The renderer does not access Node or Electron APIs directly. `window.brackDesktop` exposes platform info, auth/deep-link callbacks, app foreground events, and whitelisted local database operations. Desktop offline storage uses native SQLite in the main process while preserving the existing `LocalDriver` interface used by web Dexie and Capacitor SQLite.

## Security Architecture

### Authentication Flow

```
User Login
    ↓
Supabase Auth.signIn()
    ↓
JWT Token Generated
    ↓
Token Stored in LocalStorage
    ↓
Auto-refresh Enabled
    ↓
Token in Authorization Header
    ↓
RLS Policies Check Token
    ↓
Grant/Deny Access
```

### Row Level Security (RLS)

**Pattern**: User can only access their own data

```sql
-- Example: Books table
CREATE POLICY "Users can view own books"
  ON books FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own books"
  ON books FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

**Public Data**: Posts, reviews, profiles (read-only for others)

### Input Sanitization

```
User Input
    ↓
DOMPurify.sanitize()
    ↓
Remove HTML Tags
    ↓
Escape Special Characters
    ↓
Store in Database
```

## Real-time Architecture

### Subscription Management

```typescript
// Subscribe only when page is visible
const setupSubscription = () => {
  if (document.hidden) return;
  
  channel = supabase
    .channel('posts-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, handleChange)
    .subscribe();
};

// Unsubscribe when hidden (battery saving)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && channel) {
    supabase.removeChannel(channel);
  } else {
    setupSubscription();
  }
});
```

## Performance Optimizations

### Code Splitting

```typescript
// Route-based splitting
const Analytics = lazy(() => import('./screens/Analytics'));
const BookClubs = lazy(() => import('./screens/BookClubs'));

// Component-level splitting
const HeavyChart = lazy(() => import('./components/HeavyChart'));
```

### Virtual Scrolling

```typescript
// For lists > 100 items
const virtualizer = useVirtualizer({
  count: items.length,
  estimateSize: () => 148,
  overscan: 8,
});
```

### Batch Operations

```typescript
// Debounce search
const debouncedSearch = debounce(searchFn, 300);

// Batch database queries
const results = await batchQueries(queries, 5);
```

## Error Handling

### Error Boundary Pattern

```tsx
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

### API Error Handling

```typescript
try {
  const data = await api.call();
} catch (error) {
  if (error.code === 'PGRST116') {
    // Not found - handle gracefully
  } else {
    // Log to Sentry
    Sentry.captureException(error);
    // Show user-friendly message
    toast.error('Something went wrong');
  }
}
```

## Deployment Architecture

### Build Process

```
npm run build
    ↓
Vite Optimization
    ↓
Code Splitting
    ↓
Asset Optimization
    ↓
PWA Service Worker
    ↓
apps/client/dist
    ↓
Deploy to Hosting
```

### Mobile Build

```
npm run cap:sync
    ↓
Build @brack/client, then sync from apps/mobile
    ↓
Copy to root native projects
    ↓
Open in Xcode/Android Studio
    ↓
Build Native App
    ↓
Submit to App Stores
```

`npm run cap:sync` is a root Turbo-backed script. The client build runs in `apps/client`; Capacitor sync runs from `apps/mobile` and copies built web assets into the root `android/` and `ios/` projects.

## Scalability Considerations

### Database

- **Indexing**: All foreign keys indexed
- **RLS Policies**: Optimized for performance
- **Connection Pooling**: Via Supabase

### Frontend

- **Pagination**: Infinite scroll with TanStack Query
- **Virtual Scrolling**: For large lists
- **Code Splitting**: Route and component level
- **Image Optimization**: WebP format, lazy loading

### Caching

- **Multi-level**: Memory → LocalStorage → Network
- **TTL-based**: Automatic invalidation
- **Selective**: Only cache frequently accessed data

## Monitoring & Observability

### Error Tracking (Sentry)

- Frontend errors
- API errors
- Performance monitoring
- User session replay

### Logging Strategy

- Development: Console logs
- Production: Sentry + structured logs
- Critical errors: Immediate alerts

## Design Patterns

### Component Patterns

1. **Compound Components** - Related components that work together
2. **Render Props** - Pass render logic as prop
3. **Higher-Order Components** - Wrap components with additional logic
4. **Custom Hooks** - Extract and reuse stateful logic

### Service Patterns

1. **Singleton** - Service instances (`readingCoreSync`, `syncService`)
2. **Factory** - Creating similar objects
3. **Strategy** - Different implementations (online/offline)
4. **Observer** - Event subscriptions

### State Patterns

1. **Provider Pattern** - Context providers
2. **Container/Presenter** - Smart/dumb components
3. **Hooks Pattern** - Custom hooks for logic

## Further Reading

- [File Structure](./file-structure.md)
- [Database Schema](./database-schema.md)
- [Mobile Features](./mobile-features.md)
- [State Management](./state-management.md)
