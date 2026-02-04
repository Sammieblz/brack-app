# Offline Support

Comprehensive guide to Brack's offline capabilities and caching strategies.

## Overview

Brack provides robust offline support to ensure users can read and track their progress even without an internet connection.

**Key Features**:
- ✅ Offline action queue
- ✅ Data caching (2-minute TTL)
- ✅ Image caching (7-day TTL)
- ✅ Background sync on reconnect
- ✅ Retry logic for failed operations
- ✅ User feedback on sync status

## Architecture

```
User Action (Offline)
       ↓
Check navigator.onLine
       ↓
┌──────────────────────┐
│   Offline Queue      │
│  (LocalStorage)      │
│                      │
│  [Action 1]          │
│  [Action 2]          │
│  [Action 3]          │
└──────────────────────┘
       ↓ (on reconnect)
Background Sync Service
       ↓
Execute Actions Sequentially
       ↓ (retry on failure)
Remove from Queue
       ↓
Invalidate Cache
       ↓
Refresh UI
```

## Offline Queue

### Service

**Location**: `src/services/offlineQueue.ts`

**Supported Actions**:
- `create_book` - Add new book
- `update_book` - Update book details
- `delete_book` - Soft delete book
- `create_review` - Post review
- `update_review` - Update review
- `create_post` - Create social post
- `update_post` - Update post
- `create_message` - Send message
- `create_journal_entry` - Add journal entry
- `update_journal_entry` - Update entry
- `delete_journal_entry` - Delete entry

### Usage

**Manual Queueing**:
```typescript
import { offlineQueue } from '@/services/offlineQueue';

// Queue an action
offlineQueue.enqueue({
  type: 'create_book',
  data: {
    user_id: userId,
    title: 'Book Title',
    author: 'Author Name',
    status: 'to_read',
  },
});
```

**With Offline Operation Wrapper** (Recommended):
```typescript
import { bookOperations } from '@/utils/offlineOperation';

// Automatically queues if offline, executes if online
await bookOperations.create({
  user_id: userId,
  title: 'Book Title',
  author: 'Author Name',
  status: 'to_read',
});
```

### Monitoring Queue

```typescript
// Check queue size
const size = offlineQueue.getQueueSize();

// Get all queued actions
const queue = offlineQueue.getQueue();

// Manually trigger sync
await offlineQueue.sync();

// Clear queue (use with caution)
offlineQueue.clearQueue();
```

### Queue Persistence

- **Storage**: localStorage
- **Key**: `offline_queue`
- **Format**: JSON array of queued actions
- **Persistence**: Survives page refresh and app restart

### Retry Logic

Failed actions are retried with:
- **Max Retries**: 3
- **Retry Delay**: 5 seconds
- **Exponential Backoff**: Not implemented (could be added)

After max retries, action is removed from queue and logged as error.

## Data Caching

### Service

**Location**: `src/services/dataCache.ts`

**Features**:
- Time-To-Live (TTL) based expiration
- Automatic cleanup of expired entries
- Namespace support for organization
- Manual invalidation

### Usage

```typescript
import { dataCache } from '@/services/dataCache';

// Set cache (2-minute TTL)
const TTL = 2 * 60 * 1000;
dataCache.set('books_user_123', books, TTL);

// Get from cache
const cached = dataCache.get('books_user_123');
if (cached) {
  // Use cached data
} else {
  // Fetch from API
}

// Invalidate cache
dataCache.invalidate('books_user_123');

// Invalidate by prefix (all user's books)
dataCache.invalidateByPrefix('books_user_');

// Clear all cache
dataCache.clear();
```

### Cached Data

| Data Type | Cache Key Pattern | TTL |
|-----------|------------------|-----|
| Books | `books_{userId}_{offset}` | 2 minutes |
| Posts | `posts_all` | 2 minutes |
| Social Feed | `social_feed_{userId}` | 2 minutes |
| User Profile | Managed by TanStack Query | 5 minutes |

### Cache Invalidation

**Automatic**:
- On mutation success
- On manual refresh (pull-to-refresh)
- On TTL expiration

**Manual**:
```typescript
// Invalidate specific cache
dataCache.invalidate(cacheKey);

// Invalidate all books caches for user
dataCache.invalidateByPrefix(`books_${userId}`);
```

## Image Caching

### Service

**Location**: `src/services/imageCache.ts`

**Features**:
- Filesystem storage on native (Capacitor)
- Browser cache on web
- Size limit (100MB)
- Automatic cleanup of old images
- LRU eviction policy

### Usage

```typescript
import { imageCache } from '@/services/imageCache';

// Cache image
await imageCache.cache('book-cover-123', imageDataUrl);

// Get cached image
const cachedUrl = await imageCache.get('book-cover-123');

// Check if cached
const exists = await imageCache.has('book-cover-123');

// Clear old cache
await imageCache.cleanup();

// Clear all cache
await imageCache.clear();
```

### Optimized Image Component

**Component**: `src/components/OptimizedImage.tsx`

Automatically handles:
- Image caching
- Lazy loading
- Error states
- Placeholder images

```tsx
<OptimizedImage
  src={book.cover_url}
  alt={book.title}
  cacheKey={`book-${book.id}`}
  className="w-full h-auto"
/>
```

## Background Sync

### Service

**Location**: `src/services/syncService.ts`

**Features**:
- Automatic sync on app foreground
- Sync cooldown (5 seconds between syncs)
- Progress tracking
- Event subscriptions

### Usage

```typescript
import { syncService } from '@/services/syncService';

// Manual sync
await syncService.manualSync();

// Get sync progress
const progress = syncService.getProgress();
console.log(progress.completed, '/', progress.total);

// Subscribe to sync events
const unsubscribe = syncService.subscribe((progress) => {
  console.log('Sync progress:', progress);
});

// Cleanup
unsubscribe();
```

### Auto-Sync Triggers

1. **App comes to foreground** (App plugin)
2. **Network reconnects** (Network plugin)
3. **User manually refreshes** (pull-to-refresh)
4. **After successful offline action** (immediate sync attempt)

## Network Status

### Hook

**Location**: `src/hooks/useNetworkStatus.ts`

```typescript
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

const MyComponent = () => {
  const isOnline = useNetworkStatus();
  
  if (!isOnline) {
    return <OfflineBanner />;
  }
  
  return <NormalContent />;
};
```

### Features

- Detects online/offline transitions
- Shows toast notifications on status change
- Displays pending action count when offline
- Automatically triggers sync on reconnect

## Offline Indicator

### Component

**Location**: `src/components/OfflineIndicator.tsx`

**Features**:
- Shows when offline
- Displays queued action count
- Manual sync button
- Auto-hides when online

**Usage**: Automatically added in `src/App.tsx`

## Best Practices

### 1. Always Use Offline Wrappers

```typescript
// ✅ DO: Use offline operation wrapper
import { bookOperations } from '@/utils/offlineOperation';
await bookOperations.create(bookData);

// ❌ DON'T: Call Supabase directly for mutable operations
await supabase.from('books').insert(bookData);
```

### 2. Handle Both States

```typescript
// ✅ DO: Handle online and offline
const saveBook = async (book: Book) => {
  if (navigator.onLine) {
    // Save immediately
    await api.saveBook(book);
  } else {
    // Queue for later
    offlineQueue.enqueue({ type: 'create_book', data: book });
    toast.info('Saved offline. Will sync when online.');
  }
};
```

### 3. Invalidate Cache After Mutations

```typescript
// ✅ DO: Invalidate cache after successful mutation
const mutation = useMutation({
  mutationFn: createBook,
  onSuccess: () => {
    dataCache.invalidate(`books_${userId}`);
    queryClient.invalidateQueries(['books', userId]);
  },
});
```

### 4. Show Loading States

```typescript
// ✅ DO: Show appropriate loading states
if (loading) return <Skeleton />;
if (syncing) return <SyncingBanner />;
if (error) return <ErrorMessage />;
```

### 5. Provide User Feedback

```typescript
// ✅ DO: Inform users about offline status
if (!navigator.onLine) {
  toast.info('You are offline. Changes will sync when online.');
}

// After successful sync
toast.success('Changes synced successfully!');
```

## PWA Service Worker

### Configuration

**Location**: `vite.config.ts` - VitePWA plugin

**Caching Strategy**:

1. **Static Assets**: Cache-first
   - HTML, CSS, JS, images
   - 7-day expiration

2. **Supabase Public Storage**: Cache-first
   - Book covers, avatars
   - 7-day expiration, 60 max entries

3. **Google Books API**: Stale-while-revalidate
   - 5-minute expiration, 30 max entries

### Registration

**Location**: `src/main.tsx`

```typescript
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });
```

### Update Strategy

- **Auto-update**: Service worker updates automatically
- **Prompt**: Can be configured to prompt user for updates

## Testing Offline Mode

### Web

1. Open DevTools → Network
2. Select "Offline" from throttling dropdown
3. Perform actions (add book, create post)
4. Check offline queue: `offlineQueue.getQueueSize()`
5. Go back online
6. Verify actions sync automatically

### Mobile

1. Enable Airplane Mode on device
2. Use app (add books, log progress)
3. Disable Airplane Mode
4. Verify sync happens

### Simulating Poor Connection

1. DevTools → Network → "Slow 3G"
2. Test with intermittent connectivity
3. Verify retry logic works

## Limitations

### What Works Offline?

✅ Add/edit/delete books  
✅ Log reading progress  
✅ Create journal entries  
✅ Create reviews  
✅ Create posts  
✅ View cached data  
✅ Use reading timer  

### What Doesn't Work Offline?

❌ Search books (requires Google Books API)  
❌ Discover readers (requires server function)  
❌ Real-time updates  
❌ Push notifications  
❌ Image uploads (queued but not uploaded until online)  
❌ Following/unfollowing users  

### Known Issues

1. **Large images** may cause queue to grow large
2. **Complex operations** (multi-table updates) may fail partially
3. **Conflicts** not automatically resolved (last-write-wins)

## Future Improvements

### Potential Enhancements

1. **Conflict Resolution**:
   - Detect conflicting changes
   - Allow user to choose which version to keep

2. **Optimistic UI Updates**:
   - Show changes immediately
   - Rollback if sync fails

3. **IndexedDB Storage**:
   - Store more data offline
   - Better performance than localStorage

4. **Background Sync API**:
   - Browser-native background sync
   - More reliable than custom implementation

5. **Differential Sync**:
   - Only sync changed data
   - Reduce bandwidth usage

## Further Reading

- [Architecture Overview](./architecture.md)
- [Services Documentation](./services.md)
- [Getting Started](./getting-started.md)
- [Troubleshooting](./troubleshooting.md)
