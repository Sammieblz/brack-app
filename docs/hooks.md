# Hooks Reference

Complete reference for all custom hooks in Brack.

## Data Fetching Hooks

### useAuth

**Location**: `apps/client/src/hooks/useAuth.ts`

**Purpose**: User authentication state

```typescript
const { user, loading, signOut } = useAuth();
```

**Returns**:
- `user` - Current user or null
- `loading` - Initial auth check loading
- `signOut` - Sign out function

### useBooks

**Location**: `apps/client/src/hooks/useBooks.ts`

**Purpose**: Fetch user's books with pagination and caching

```typescript
const { books, loading, loadingMore, hasMore, loadMore, refetchBooks } = useBooks(userId);
```

**Features**:
- Pagination (20 books per page)
- Data caching (2-minute TTL)
- Infinite scroll support

### useBookProgress

**Location**: `apps/client/src/hooks/useBookProgress.ts`

**Purpose**: Calculate book progress analytics

```typescript
const { progress, loading, refetchProgress } = useBookProgress(bookId);
```

**Returns**: Reading velocity, completion forecast, statistics

### useProgressLogs

**Location**: `apps/client/src/hooks/useProgressLogs.ts`

**Purpose**: Fetch progress log history

```typescript
const { logs, loading, refetchLogs } = useProgressLogs(bookId);
```

### useJournalEntries

**Location**: `apps/client/src/hooks/useJournalEntries.ts`

**Purpose**: CRUD operations for journal entries

```typescript
const { entries, loading, addEntry, updateEntry, deleteEntry, refetchEntries } = 
  useJournalEntries(bookId);
```

**Methods**:
- `addEntry(entry)` - Create new entry
- `updateEntry(id, updates)` - Update existing
- `deleteEntry(id)` - Delete entry
- `refetchEntries()` - Refresh list

### useReviews

**Location**: `apps/client/src/hooks/useReviews.ts`

**Purpose**: Book reviews with user interaction

```typescript
const { reviews, averageRating, userHasReviewed, loading, refetch } = useReviews(bookId);
```

### usePosts

**Location**: `apps/client/src/hooks/usePosts.ts`

**Purpose**: Social feed posts

```typescript
const { posts, loading, refetchPosts, toggleLike } = usePosts();
```

**Features**:
- Real-time updates
- Like/unlike functionality
- User and book enrichment

### useGoals

**Location**: `apps/client/src/hooks/useGoals.ts`

**Purpose**: Reading goals management

```typescript
const { goals, activeGoals, loading, createGoal, updateGoal, deleteGoal, completeGoal } = 
  useGoals(userId);
```

### useStreaks

**Location**: `apps/client/src/hooks/useStreaks.ts`

**Purpose**: Reading streak tracking

```typescript
const { streakData, activityCalendar, loading, refetchStreaks, useStreakFreeze } = 
  useStreaks(userId);
```

**Features**:
- Current and longest streak
- Activity calendar (90 days)
- Streak freeze (once per week)

### useBadges

**Location**: `apps/client/src/hooks/useBadges.ts`

**Purpose**: Achievement badge system

```typescript
const { badges, userBadges, loading, checkAndAwardBadges } = useBadges(userId);
```

### useBookClubs

**Location**: `apps/client/src/hooks/useBookClubs.ts`

**Purpose**: Book club management

```typescript
const { clubs, loading, createClub, joinClub, leaveClub, updateClub, deleteClub } = 
  useBookClubs();
```

## Platform Hooks

### usePlatform

**Location**: `apps/client/src/hooks/usePlatform.ts`

**Purpose**: Detect current platform

```typescript
const { platform, isNative, isIOS, isAndroid, isWeb } = usePlatform();
```

### useNativeApp

**Location**: `apps/client/src/hooks/useNativeApp.ts`

**Purpose**: Detect if running in native app

```typescript
const isNative = useNativeApp();
```

### use-mobile

**Location**: `apps/client/src/hooks/use-mobile.tsx`

**Purpose**: Detect mobile viewport (responsive design)

```typescript
const isMobile = useIsMobile();
```

**Breakpoint**: 768px (Tailwind's `md` breakpoint)

## Device Features Hooks

### useBarcodeScanner

**Location**: `apps/client/src/hooks/useBarcodeScanner.ts`

**Purpose**: Scan ISBN barcodes and QR payloads that contain valid ISBNs

```typescript
const videoRef = useRef<HTMLVideoElement>(null);

const { isScanning, scannedCode, error, startScan, stopScan, resetScan } =
  useBarcodeScanner({ videoRef });

const handleScan = async () => {
  const isbn = await startScan();
  if (isbn) {
    // Resolve exact metadata match, preview, then add through add-book
  }
};
```

**Platforms**:
- Native iOS/Android: `@capacitor/barcode-scanner`
- Web/PWA/Desktop: live `getUserMedia` video stream scanned by ZXing

The scanner hook only returns a validated ISBN. Book lookup and add behavior is orchestrated by `BarcodeScannerFlow` through `resolveScannedBook` and `addScannedBookToLibrary`.

### useCoverScanner

**Location**: `apps/client/src/hooks/useCoverScanner.ts`

**Purpose**: Scan book cover with OCR

```typescript
const { scanCover, isScanning, extractedInfo, confidence } = useCoverScanner();

const handleScanCover = async () => {
  const result = await scanCover();
  if (result) {
    console.log(result.title, result.author);
  }
};
```

**Technology**: Tesseract.js

### useImagePicker

**Location**: `apps/client/src/hooks/useImagePicker.ts`

**Purpose**: Select/capture images

```typescript
const { pickImage } = useImagePicker();

const handleSelectImage = async () => {
  const image = await pickImage({
    source: 'photos', // or 'camera'
    quality: 90,
  });
};
```

### useHapticFeedback

**Location**: `apps/client/src/hooks/useHapticFeedback.ts`

**Purpose**: Trigger haptic feedback

```typescript
const { triggerHaptic } = useHapticFeedback();

triggerHaptic('success'); // or 'warning', 'error', 'light', 'medium', 'heavy'
```

### usePushNotifications

**Location**: `apps/client/src/hooks/usePushNotifications.ts`

**Purpose**: Manage push notifications

```typescript
const { isRegistered, token, register, unregister, error } = usePushNotifications();
```

## Network Hooks

### useNetworkStatus

**Location**: `apps/client/src/hooks/useNetworkStatus.ts`

**Purpose**: Monitor online/offline status

```typescript
const isOnline = useNetworkStatus();

if (!isOnline) {
  // Show offline message
}
```

**Features**:
- Auto-sync on reconnect
- Toast notifications on status change

## UI Hooks

### use-toast

**Location**: `apps/client/src/hooks/use-toast.ts`

**Purpose**: Show toast notifications

```typescript
const { toast } = useToast();

toast({
  title: 'Success',
  description: 'Book added successfully',
});

toast({
  title: 'Error',
  description: 'Failed to save',
  variant: 'destructive',
});
```

### useScrollDirection

**Location**: `apps/client/src/hooks/useScrollDirection.ts`

**Purpose**: Detect scroll direction (up/down)

```typescript
const scrollDirection = useScrollDirection();

<Header className={scrollDirection === 'down' ? 'hidden' : 'visible'} />
```

### useLongPress

**Location**: `apps/client/src/hooks/useLongPress.ts`

**Purpose**: Detect long press gestures

```typescript
const longPressHandlers = useLongPress(() => {
  // Handle long press
}, 500); // 500ms threshold

<div {...longPressHandlers}>Long press me</div>
```

### useSwipeBack

**Location**: `apps/client/src/hooks/useSwipeBack.ts`

**Purpose**: iOS-style swipe back gesture

```typescript
const swipeHandlers = useSwipeBack(() => {
  navigate(-1);
});

<div {...swipeHandlers}>Content</div>
```

### usePullToDismiss

**Location**: `apps/client/src/hooks/usePullToDismiss.ts`

**Purpose**: Pull down to dismiss modals

```typescript
const pullHandlers = usePullToDismiss(onDismiss, threshold);
```

## Utility Hooks

### useInfiniteScroll

**Location**: `apps/client/src/hooks/useInfiniteScroll.ts`

**Purpose**: Infinite scroll with Intersection Observer

```typescript
const { hasMore, loading, loadMore } = useLoadMore();

const loadMoreRef = useInfiniteScroll({
  hasMore,
  loading,
  onLoadMore: loadMore,
});

<div ref={loadMoreRef}>Load More Trigger</div>
```

### useVirtualBooks

**Location**: `apps/client/src/hooks/useVirtualBooks.ts`

**Purpose**: Virtual scrolling for large book lists

```typescript
const { virtualizer, items } = useVirtualBooks(books);
```

**Uses**: `@tanstack/react-virtual`

### useRecentSearches

**Location**: `apps/client/src/hooks/useRecentSearches.ts`

**Purpose**: Manage search history

```typescript
const { recentSearches, addSearch, clearSearches } = useRecentSearches();
```

**Storage**: localStorage

### useTypingIndicator

**Location**: `apps/client/src/hooks/useTypingIndicator.ts`

**Purpose**: Show when user is typing (messages)

```typescript
const { isTyping, startTyping, stopTyping } = useTypingIndicator(conversationId);
```

## Chart & Analytics Hooks

### useChartData

**Location**: `apps/client/src/hooks/useChartData.ts`

**Purpose**: Fetch weekly reading chart data

```typescript
const { weeklyReading, loading } = useChartData(userId);
```

### useMonthlyStats

**Location**: `apps/client/src/hooks/useMonthlyStats.ts`

**Purpose**: Monthly reading statistics

```typescript
const { stats, loading, refetch } = useMonthlyStats(userId, month, year);
```

### useProgressTracking

**Location**: `apps/client/src/hooks/useProgressTracking.ts`

**Purpose**: Detailed progress tracking data

```typescript
const { dailyProgress, velocityData, forecastData, loading, refetch } = 
  useProgressTracking(bookId);
```

## Social Hooks

### useFollowing

**Location**: `apps/client/src/hooks/useFollowing.ts`

**Purpose**: Follow/unfollow users

```typescript
const { following, followers, isFollowing, toggleFollow, loading } = useFollowing(userId);
```

### useConversations

**Location**: `apps/client/src/hooks/useConversations.ts`

**Purpose**: Direct message conversations

```typescript
const { conversations, loading, getOrCreateConversation } = useConversations();
```

### useMessages

**Location**: `apps/client/src/hooks/useMessages.ts`

**Purpose**: Messages in a conversation

```typescript
const { messages, loading, sendMessage, markAsRead } = useMessages(conversationId);
```

### useSocialFeed

**Location**: `apps/client/src/hooks/useSocialFeed.ts`

**Purpose**: Aggregated social feed

```typescript
const { feed, loading, refetch } = useSocialFeed(userId);
```

### useRecentActivity

**Location**: `apps/client/src/hooks/useRecentActivity.ts`

**Purpose**: User's recent activity

```typescript
const { activities, loading, formatTimeAgo } = useRecentActivity(userId);
```

### useUserSearch

**Location**: `apps/client/src/hooks/useUserSearch.ts`

**Purpose**: Search for users

```typescript
const { users, loading, search } = useUserSearch();

search('john doe');
```

## Hook Composition

Hooks can be composed:

```typescript
const useBookWithProgress = (bookId: string) => {
  const { data: book } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => fetchBook(bookId),
  });
  
  const { progress } = useBookProgress(bookId);
  const { logs } = useProgressLogs(bookId);
  
  return { book, progress, logs };
};
```

## Hook Best Practices

### 1. Single Responsibility

```typescript
// ✅ DO: One concern per hook
const useBooks = () => { /* fetch books */ };
const useBookActions = () => { /* create, update, delete */ };

// ❌ DON'T: Mix concerns
const useEverything = () => { /* books, posts, reviews, ... */ };
```

### 2. Return Object Pattern

```typescript
// ✅ DO: Return object for extensibility
return { data, loading, error, refetch };

// ❌ DON'T: Return array (harder to extend)
return [data, loading, error];
```

### 3. Cleanup Side Effects

```typescript
useEffect(() => {
  const subscription = subscribe();
  
  return () => {
    subscription.unsubscribe(); // Cleanup!
  };
}, []);
```

### 4. Handle Loading/Error States

```typescript
const useData = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Always return all three states
  return { data, loading, error };
};
```

## Creating Custom Hooks

### Template

```typescript
import { useState, useEffect } from 'react';

export const useCustomHook = (param: string) => {
  // 1. State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 2. Effects
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await api.fetch(param);
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [param]);
  
  // 3. Methods
  const refetch = () => {
    // Refetch logic
  };
  
  // 4. Return
  return { data, loading, error, refetch };
};
```

## Further Reading

- [State Management](./state-management.md)
- [Architecture](./architecture.md)
- [Component Library](./components.md)
