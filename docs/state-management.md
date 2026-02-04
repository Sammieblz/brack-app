# State Management

Guide to state management patterns and strategies in Brack.

## Overview

Brack uses a hybrid approach to state management:

1. **TanStack Query** - Server state (API data)
2. **React Context** - Global UI state
3. **useState** - Local component state
4. **localStorage** - Persistent client state

## TanStack Query (React Query)

### Purpose

Manage server state with automatic caching, background updates, and optimistic updates.

**Location**: Configured in `src/App.tsx`

### Configuration

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // 5 minutes
      gcTime: 1000 * 60 * 30,         // 30 minutes (garbage collection)
      retry: 1,                       // Retry once on failure
      refetchOnWindowFocus: false,   // Don't refetch on window focus
      refetchOnReconnect: "always",  // Always refetch when reconnecting
    },
    mutations: {
      retry: 1,
    },
  },
});
```

### Query Patterns

#### Basic Query

```typescript
import { useQuery } from '@tanstack/react-query';

const useBook = (bookId: string) => {
  return useQuery({
    queryKey: ['book', bookId],
    queryFn: () => fetchBook(bookId),
    enabled: !!bookId, // Only run if bookId exists
  });
};
```

#### Query with Transform

```typescript
const useBooks = (userId: string) => {
  return useQuery({
    queryKey: ['books', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      return data;
    },
    select: (data) => {
      // Transform data before returning
      return data.filter(book => !book.deleted_at);
    },
  });
};
```

#### Infinite Query

```typescript
const useInfiniteBooks = (userId: string) => {
  return useInfiniteQuery({
    queryKey: ['books', userId, 'infinite'],
    queryFn: ({ pageParam = 0 }) => fetchBooks(userId, pageParam),
    getNextPageParam: (lastPage, pages) => {
      return lastPage.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined;
    },
  });
};
```

### Mutation Patterns

#### Basic Mutation

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

const useCreateBook = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (bookData: BookData) => {
      return supabase.from('books').insert(bookData);
    },
    onSuccess: () => {
      // Invalidate and refetch books
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
  });
};
```

#### Optimistic Update

```typescript
const useUpdateBook = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Book> }) => {
      return supabase.from('books').update(updates).eq('id', id);
    },
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['book', id] });
      
      // Snapshot previous value
      const previousBook = queryClient.getQueryData(['book', id]);
      
      // Optimistically update
      queryClient.setQueryData(['book', id], (old: Book) => ({
        ...old,
        ...updates,
      }));
      
      // Return context with snapshot
      return { previousBook };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousBook) {
        queryClient.setQueryData(['book', variables.id], context.previousBook);
      }
    },
    onSettled: (data, error, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['book', variables.id] });
    },
  });
};
```

### Cache Persistence

Queries are persisted to localStorage:

```typescript
<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{
    persister: createSyncStoragePersister({
      storage: window.localStorage,
    }),
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
  }}
>
  <App />
</PersistQueryClientProvider>
```

## React Context

### When to Use Context

Use Context for:
- Global UI state (theme, modals)
- User authentication state
- Complex state that many components need
- Cross-cutting concerns (timers, notifications)

**Don't use Context for**:
- Server data (use TanStack Query)
- Simple prop passing (use props)
- Frequently changing data (performance impact)

### Existing Contexts

#### ProfileContext

**Location**: `src/contexts/ProfileContext.tsx`

**Purpose**: Current user's profile data

```typescript
import { useProfileContext } from '@/contexts/ProfileContext';

const MyComponent = () => {
  const { profile, isLoading, refetchProfile } = useProfileContext();
  
  if (isLoading) return <Spinner />;
  
  return <div>Welcome, {profile?.display_name}!</div>;
};
```

#### TimerContext

**Location**: `src/contexts/TimerContext.tsx`

**Purpose**: Reading timer state and controls

```typescript
import { useTimer } from '@/contexts/TimerContext';

const BookActions = ({ book }: { book: Book }) => {
  const { startTimer, time, isRunning } = useTimer();
  
  return (
    <Button onClick={() => startTimer(book.id, book.title)}>
      {isRunning ? `Running: ${formatTime(time)}` : 'Start Timer'}
    </Button>
  );
};
```

**Features**:
- Persistent state (survives page refresh)
- Background timer on native
- App state handling (foreground/background)
- Local notifications

#### ThemeContext

**Location**: `src/contexts/ThemeContext.tsx`

**Purpose**: Theme mode (light/dark/system)

```typescript
import { useTheme } from 'next-themes';

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  
  return (
    <Button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      Toggle Theme
    </Button>
  );
};
```

**Provider**: `next-themes` library

#### ConfirmDialogContext

**Location**: `src/contexts/ConfirmDialogContext.tsx`

**Purpose**: Programmatic confirmation dialogs

```typescript
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';

const DeleteButton = ({ bookId }: { bookId: string }) => {
  const confirmDialog = useConfirmDialog();
  
  const handleDelete = async () => {
    const confirmed = await confirmDialog({
      title: 'Delete this book?',
      description: 'This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
    });
    
    if (confirmed) {
      await deleteBook(bookId);
    }
  };
  
  return <Button onClick={handleDelete}>Delete</Button>;
};
```

### Creating New Context

```typescript
// 1. Create context file
import { createContext, useContext, useState, ReactNode } from 'react';

interface MyContextValue {
  data: any;
  setData: (data: any) => void;
}

const MyContext = createContext<MyContextValue | undefined>(undefined);

export const MyProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState(null);
  
  return (
    <MyContext.Provider value={{ data, setData }}>
      {children}
    </MyContext.Provider>
  );
};

export const useMyContext = () => {
  const context = useContext(MyContext);
  if (!context) {
    throw new Error('useMyContext must be used within MyProvider');
  }
  return context;
};

// 2. Add provider to App.tsx
<MyProvider>
  <App />
</MyProvider>

// 3. Use in components
const { data, setData } = useMyContext();
```

## Local State (useState)

### When to Use

Use `useState` for:
- Component-specific UI state
- Form inputs
- Toggle states (modals, dropdowns)
- Temporary data

### Patterns

```typescript
// Simple state
const [isOpen, setIsOpen] = useState(false);

// State with initial value from props
const [value, setValue] = useState(initialValue);

// State with lazy initialization
const [data, setData] = useState(() => {
  return expensiveComputation();
});

// State with updater function
const [count, setCount] = useState(0);
setCount(prev => prev + 1); // Use previous value
```

## Persistent State (localStorage)

### When to Use

Use localStorage for:
- User preferences
- Draft data
- Offline queue
- Cache
- Non-sensitive data

### Patterns

```typescript
// Save to localStorage
const saveToStorage = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value));
};

// Load from localStorage
const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
};

// Hook for localStorage state
const useLocalStorage = <T>(key: string, defaultValue: T) => {
  const [value, setValue] = useState<T>(() => {
    return loadFromStorage(key, defaultValue);
  });
  
  useEffect(() => {
    saveToStorage(key, value);
  }, [key, value]);
  
  return [value, setValue] as const;
};
```

## State Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│                  User Interaction                    │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │   Component    │
              │   (useState)   │
              └────────┬───────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
┌──────────┐   ┌─────────────┐  ┌──────────┐
│  Local   │   │   Context   │  │ TanStack │
│  State   │   │   (Global)  │  │  Query   │
└──────────┘   └─────────────┘  └─────┬────┘
                                       │
                                       ▼
                              ┌────────────────┐
                              │  Data Cache    │
                              │ (2-min TTL)    │
                              └────────┬───────┘
                                       │
                              ┌────────▼───────┐
                              │   Offline?     │
                              └────┬───────┬───┘
                              Yes  │       │ No
                                   │       │
                         ┌─────────▼─┐   ┌─▼────────┐
                         │  Offline  │   │ Supabase │
                         │   Queue   │   │   API    │
                         └─────┬─────┘   └────┬─────┘
                               │              │
                               │              ▼
                               │      ┌───────────────┐
                               │      │  PostgreSQL   │
                               │      └───────┬───────┘
                               │              │
                         (on reconnect)       │
                               │              │
                               └──────────────┘
                                      │
                                      ▼
                            Update UI & Cache
```

## Best Practices

### 1. Choose the Right State Tool

| Use Case | Tool | Example |
|----------|------|---------|
| Server data | TanStack Query | Books, posts, profiles |
| Global UI | Context | Theme, modals, timer |
| Component UI | useState | Form inputs, toggles |
| Persistence | localStorage | Preferences, drafts |

### 2. Minimize Re-renders

```typescript
// ✅ DO: Split contexts
<ThemeProvider>
  <TimerProvider>
    <App />
  </TimerProvider>
</ThemeProvider>

// ❌ DON'T: Combine unrelated state in one context
<AppProvider value={{ theme, timer, profile, ... }}>
  <App />
</AppProvider>
```

### 3. Use Selectors

```typescript
// ✅ DO: Select only needed data
const bookTitle = useQuery({
  queryKey: ['book', id],
  queryFn: fetchBook,
  select: (data) => data.title, // Only re-render if title changes
});

// ❌ DON'T: Use entire object if only need part
const { data: book } = useQuery({
  queryKey: ['book', id],
  queryFn: fetchBook,
});
const title = book?.title; // Re-renders on any book change
```

### 4. Invalidate Efficiently

```typescript
// ✅ DO: Invalidate specific queries
queryClient.invalidateQueries({ queryKey: ['book', bookId] });

// ⚠️ Use sparingly: Invalidate all books
queryClient.invalidateQueries({ queryKey: ['books'] });

// ❌ DON'T: Invalidate everything
queryClient.invalidateQueries(); // Re-fetches everything!
```

### 5. Handle Loading States

```typescript
const { data, isLoading, isFetching, error } = useQuery({
  queryKey: ['books'],
  queryFn: fetchBooks,
});

// isLoading: Initial load (no cached data)
// isFetching: Any fetch (including background refetch)
// error: Query error

if (isLoading) return <Skeleton />;
if (error) return <Error />;
if (!data) return <Empty />;

return <BookList books={data} />;
```

## Cache Invalidation Strategies

### When to Invalidate

1. **After mutations**:
   ```typescript
   onSuccess: () => {
     queryClient.invalidateQueries({ queryKey: ['books'] });
   }
   ```

2. **On user action** (pull-to-refresh):
   ```typescript
   const handleRefresh = () => {
     queryClient.invalidateQueries({ queryKey: ['books', userId] });
   };
   ```

3. **On real-time updates**:
   ```typescript
   useEffect(() => {
     const subscription = supabase
       .channel('books')
       .on('postgres_changes', { table: 'books' }, () => {
         queryClient.invalidateQueries({ queryKey: ['books'] });
       })
       .subscribe();
     
     return () => supabase.removeChannel(subscription);
   }, []);
   ```

### Invalidation Patterns

```typescript
// Specific book
queryClient.invalidateQueries({ queryKey: ['book', bookId] });

// All books for a user
queryClient.invalidateQueries({ queryKey: ['books', userId] });

// All book-related queries
queryClient.invalidateQueries({ queryKey: ['books'] });

// Exact match only
queryClient.invalidateQueries({ 
  queryKey: ['books', userId], 
  exact: true 
});
```

## Real-time Updates

### Pattern

```typescript
const useRealtimeBooks = (userId: string) => {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    // Only subscribe if page is visible (battery saving)
    if (document.hidden) return;
    
    const channel = supabase
      .channel('books-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'books',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        // Invalidate cache on changes
        queryClient.invalidateQueries({ queryKey: ['books', userId] });
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
};
```

### Visibility-Based Subscriptions

```typescript
useEffect(() => {
  let channel: any = null;
  
  const setupSubscription = () => {
    if (document.hidden) return;
    
    channel = supabase.channel('changes').on('*', handler).subscribe();
  };
  
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Unsubscribe when hidden
      if (channel) supabase.removeChannel(channel);
    } else {
      // Re-subscribe when visible
      setupSubscription();
    }
  };
  
  setupSubscription();
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (channel) supabase.removeChannel(channel);
  };
}, []);
```

## Custom Cache Management

### Data Cache Service

**Location**: `src/services/dataCache.ts`

**When to use**: For data that doesn't fit TanStack Query patterns

```typescript
import { dataCache } from '@/services/dataCache';

// Set cache with TTL
dataCache.set('custom-key', data, 120000); // 2 minutes

// Get from cache
const cached = dataCache.get('custom-key');

// Check if exists
const has = dataCache.has('custom-key');

// Invalidate
dataCache.invalidate('custom-key');

// Clear all
dataCache.clear();
```

## State Updates Flow

### Mutation Flow

```
User clicks "Add Book"
       ↓
Component calls mutation
       ↓
┌──────────────────────────┐
│  Check Network Status    │
└──────┬───────────────────┘
       │
  ┌────┴────┐
  │ Online? │
  └────┬────┘
       │
   Yes │ No
       │ └──────► Offline Queue ──► LocalStorage
       │                 │
       ▼                 │ (on reconnect)
  API Call               │
       ▼                 │
  Supabase ◄─────────────┘
       ▼
  Database
       ▼
  Success
       ▼
Invalidate Cache
       ▼
 Refetch Data
       ▼
 Update UI
```

## Performance Tips

### 1. Batch Invalidations

```typescript
// ❌ DON'T: Multiple invalidations
queryClient.invalidateQueries({ queryKey: ['books', userId] });
queryClient.invalidateQueries({ queryKey: ['posts', userId] });
queryClient.invalidateQueries({ queryKey: ['reviews', userId] });

// ✅ DO: Batch in Promise.all
await Promise.all([
  queryClient.invalidateQueries({ queryKey: ['books', userId] }),
  queryClient.invalidateQueries({ queryKey: ['posts', userId] }),
  queryClient.invalidateQueries({ queryKey: ['reviews', userId] }),
]);
```

### 2. Use Placeholders

```typescript
const { data, isLoading } = useQuery({
  queryKey: ['books'],
  queryFn: fetchBooks,
  placeholderData: [], // Show empty array while loading
});
```

### 3. Prefetch Data

```typescript
// Prefetch on hover
const handleMouseEnter = () => {
  queryClient.prefetchQuery({
    queryKey: ['book', bookId],
    queryFn: () => fetchBook(bookId),
  });
};
```

### 4. Optimize Context

```typescript
// ✅ DO: Memoize context value
const value = useMemo(
  () => ({ profile, isLoading, refetchProfile }),
  [profile, isLoading, refetchProfile]
);

return <Context.Provider value={value}>{children}</Context.Provider>;
```

## Debugging State

### React Query DevTools

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<QueryClientProvider client={queryClient}>
  <App />
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
```

### Log Cache

```typescript
// Log all cached queries
console.log(queryClient.getQueryCache().getAll());

// Log specific query
console.log(queryClient.getQueryData(['book', bookId]));

// Log query state
console.log(queryClient.getQueryState(['book', bookId]));
```

### Log Context

```typescript
const MyComponent = () => {
  const contextValue = useMyContext();
  
  useEffect(() => {
    console.log('Context updated:', contextValue);
  }, [contextValue]);
};
```

## Common Patterns

### Fetch on Mount

```typescript
const { data } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  // Runs automatically on mount
});
```

### Fetch on Event

```typescript
const { refetch } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  enabled: false, // Don't fetch on mount
});

<Button onClick={() => refetch()}>Load Data</Button>
```

### Dependent Queries

```typescript
const { data: book } = useQuery({
  queryKey: ['book', bookId],
  queryFn: () => fetchBook(bookId),
});

const { data: progress } = useQuery({
  queryKey: ['progress', bookId],
  queryFn: () => fetchProgress(bookId),
  enabled: !!book, // Only fetch if book exists
});
```

### Parallel Queries

```typescript
const books = useQuery({ queryKey: ['books'], queryFn: fetchBooks });
const posts = useQuery({ queryKey: ['posts'], queryFn: fetchPosts });
const reviews = useQuery({ queryKey: ['reviews'], queryFn: fetchReviews });

// All queries run in parallel
const isLoading = books.isLoading || posts.isLoading || reviews.isLoading;
```

## Further Reading

- [TanStack Query Docs](https://tanstack.com/query/latest)
- [React Context Docs](https://react.dev/reference/react/useContext)
- [Architecture](./architecture.md)
- [Offline Support](./offline-support.md)
