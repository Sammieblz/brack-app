# Quick Reference

Cheat sheet for common development tasks in Brack.

## Common Commands

### Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Fix linting errors
npm run lint -- --fix
```

### Mobile

```bash
# Build and sync to native
npm run cap:sync

# Open Xcode
npm run cap:open:ios

# Open Android Studio
npm run cap:open:android

# Run on iOS
npx cap run ios

# Run on Android
npx cap run android
```

### Supabase

```bash
# Start local Supabase
npx supabase start

# Stop local Supabase
npx supabase stop

# Link to remote project
npx supabase link --project-ref your-project-id

# Apply migrations
npx supabase db push

# Reset database (deletes all data!)
npx supabase db reset

# Create new migration
npx supabase migration new migration_name

# Deploy Edge Functions
npx supabase functions deploy

# Deploy specific function
npx supabase functions deploy function-name

# Set secrets
npx supabase secrets set KEY=value

# Generate TypeScript types
npx supabase gen types typescript --project-id your-project-id
```

## Code Snippets

### Create New Hook

```typescript
// src/hooks/useMyFeature.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useMyFeature = (param: string) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('table')
          .select('*')
          .eq('column', param);
        
        if (error) throw error;
        setData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [param]);

  return { data, loading, error };
};
```

### Create New Component

```typescript
// src/components/MyComponent.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface MyComponentProps {
  title: string;
  onClick: () => void;
}

export const MyComponent = ({ title, onClick }: MyComponentProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={onClick}>Action</Button>
      </CardContent>
    </Card>
  );
};
```

### Create New Screen

```typescript
// src/screens/MyScreen.tsx
import { useAuth } from '@/hooks/useAuth';
import { MobileLayout } from '@/components/MobileLayout';
import { MobileHeader } from '@/components/MobileHeader';
import { useIsMobile } from '@/hooks/use-mobile';

const MyScreen = () => {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  return (
    <MobileLayout>
      {isMobile && <MobileHeader title="My Screen" showBack />}
      
      <div className="container max-w-4xl mx-auto p-4">
        {/* Content */}
      </div>
    </MobileLayout>
  );
};

export default MyScreen;
```

### Create New Migration

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_description.sql

-- Create table
CREATE TABLE IF NOT EXISTS public.my_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add index
CREATE INDEX IF NOT EXISTS idx_my_table_user 
  ON public.my_table(user_id);

-- Enable RLS
ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own records"
  ON public.my_table FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own records"
  ON public.my_table FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_my_table_updated_at
  BEFORE UPDATE ON public.my_table
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

### Create Edge Function

```typescript
// supabase/functions/my-function/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: corsHeaders }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify user
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseClient.auth.getUser(jwt);
    
    if (error || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: corsHeaders }
      );
    }

    // Parse request body
    const body = await req.json();

    // Your logic here
    const result = { success: true };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const { createErrorResponse } = await import("../_shared/errorHandler.ts");
    return createErrorResponse(error, 500, origin, { function: "my-function" });
  }
});
```

## Query Patterns

### Basic Query

```typescript
const { data, error } = await supabase
  .from('books')
  .select('*')
  .eq('user_id', userId);
```

### Query with Join

```typescript
const { data, error } = await supabase
  .from('posts')
  .select(`
    *,
    profiles!inner (
      id,
      display_name,
      avatar_url
    ),
    books (
      id,
      title,
      author
    )
  `);
```

### Query with Filter

```typescript
const { data, error } = await supabase
  .from('books')
  .select('*')
  .eq('status', 'reading')
  .gte('current_page', 10)
  .order('created_at', { ascending: false })
  .limit(20);
```

### Insert

```typescript
const { data, error } = await supabase
  .from('books')
  .insert({
    user_id: userId,
    title: 'Book Title',
    author: 'Author',
  })
  .select()
  .single();
```

### Update

```typescript
const { error } = await supabase
  .from('books')
  .update({ status: 'completed' })
  .eq('id', bookId);
```

### Delete

```typescript
const { error } = await supabase
  .from('books')
  .delete()
  .eq('id', bookId);
```

### Soft Delete

```typescript
const { error } = await supabase
  .from('books')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', bookId);
```

## TanStack Query Patterns

### Basic Query

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['books', userId],
  queryFn: () => fetchBooks(userId),
});
```

### Query with Options

```typescript
const { data } = useQuery({
  queryKey: ['book', bookId],
  queryFn: () => fetchBook(bookId),
  enabled: !!bookId,              // Only run if bookId exists
  staleTime: 5 * 60 * 1000,       // Fresh for 5 minutes
  refetchOnMount: false,          // Don't refetch on component mount
  retry: 2,                       // Retry twice on failure
});
```

### Mutation

```typescript
const mutation = useMutation({
  mutationFn: (bookData: BookData) => createBook(bookData),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['books'] });
    toast.success('Book created!');
  },
  onError: (error) => {
    toast.error('Failed to create book');
  },
});

// Use mutation
mutation.mutate(bookData);
```

### Invalidate Cache

```typescript
const queryClient = useQueryClient();

// Invalidate specific query
queryClient.invalidateQueries({ queryKey: ['book', bookId] });

// Invalidate all books
queryClient.invalidateQueries({ queryKey: ['books'] });

// Invalidate and refetch
await queryClient.invalidateQueries({ 
  queryKey: ['books'], 
  refetchType: 'active' 
});
```

## Component Patterns

### Loading State

```typescript
if (loading) {
  return <Skeleton />;
}

if (error) {
  return <ErrorMessage error={error} />;
}

if (!data) {
  return <EmptyState />;
}

return <Content data={data} />;
```

### Conditional Rendering

```typescript
// Short circuit
{isOnline && <OnlineIndicator />}

// Ternary
{loading ? <Spinner /> : <Content />}

// Nullish coalescing
{user?.displayName ?? 'Guest'}
```

### Event Handlers

```typescript
// Simple
<Button onClick={handleClick}>Click</Button>

// With parameter
<Button onClick={() => handleClick(id)}>Click</Button>

// Prevent default
<form onSubmit={(e) => {
  e.preventDefault();
  handleSubmit();
}}>
```

## Styling

### Tailwind Classes

```tsx
// Layout
<div className="flex items-center justify-between gap-4">

// Responsive
<div className="p-4 md:p-6 lg:p-8">

// Dark mode
<div className="bg-white dark:bg-gray-900">

// States
<Button className="hover:bg-primary/90 active:scale-95">

// Conditional
<div className={cn(
  "base-classes",
  isActive && "active-classes",
  variant === 'primary' && "primary-classes"
)}>
```

### Custom Classes

```css
/* src/index.css */
.gradient-background {
  @apply bg-gradient-to-br from-blue-900 to-purple-900;
}

.gradient-card {
  @apply bg-gradient-to-br from-card to-card/50;
}
```

## File Locations

### Quick Find

| What | Where |
|------|-------|
| Add new screen | `src/screens/ScreenName.tsx` |
| Add new component | `src/components/ComponentName.tsx` |
| Add new hook | `src/hooks/useHookName.ts` |
| Add new service | `src/services/serviceName.ts` |
| Add new util | `src/utils/utilName.ts` |
| Add migration | `supabase/migrations/YYYYMMDDHHMMSS_name.sql` |
| Add Edge Function | `supabase/functions/function-name/index.ts` |
| Update routes | `src/App.tsx` |
| Update nav | `src/components/MobileBottomNav.tsx` or `Navbar.tsx` |

## Environment Variables

```env
# Required
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PROJECT_ID=xxx
VITE_SUPABASE_PUBLISHABLE_KEY=xxx

# Optional
GOOGLE_BOOKS_API_KEY=xxx
VITE_SENTRY_DSN=xxx
ALLOWED_ORIGINS=http://localhost:8080
DENO_ENV=development
FCM_SERVER_KEY=xxx
```

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat: add my feature"

# Push to remote
git push origin feature/my-feature

# After PR merged, update main
git checkout main
git pull origin main

# Delete feature branch
git branch -d feature/my-feature
```

## Debugging

```typescript
// Log data
console.log('Data:', data);
console.table(arrayData);

// Log render count
useEffect(() => {
  console.log('Component rendered');
});

// Check query cache
console.log(queryClient.getQueryData(['books']));

// Check offline queue
console.log('Queue size:', offlineQueue.getQueueSize());
console.log('Queue:', offlineQueue.getQueue());
```

## Common Fixes

### Clear Everything

```bash
# Clear node modules
rm -rf node_modules package-lock.json
npm install

# Clear build
rm -rf dist

# Clear cache
rm -rf .vite

# Reset database
npx supabase db reset
```

### Fix TypeScript

```bash
# Restart TS server in VS Code
Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"
```

### Fix Mobile

```bash
# Clean and sync
npx cap sync

# iOS: Reinstall pods
cd ios/App && pod deintegrate && pod install && cd ../..

# Android: Clean build
cd android && ./gradlew clean && cd ..
```

## Keyboard Shortcuts

### VS Code

- `Cmd/Ctrl + P` - Quick file open
- `Cmd/Ctrl + Shift + F` - Find in files
- `F2` - Rename symbol
- `Cmd/Ctrl + Click` - Go to definition
- `Alt + Click` - Add cursor
- `Cmd/Ctrl + /` - Toggle comment

### Chrome DevTools

- `Cmd/Ctrl + Shift + C` - Inspect element
- `Cmd/Ctrl + Shift + I` - Open DevTools
- `Cmd/Ctrl + R` - Refresh
- `Cmd/Ctrl + Shift + R` - Hard refresh

## Import Paths

```typescript
// UI Components
import { Button } from '@/components/ui/button';

// Feature Components
import { BookCard } from '@/components/BookCard';

// Hooks
import { useAuth } from '@/hooks/useAuth';

// Services
import { offlineQueue } from '@/services/offlineQueue';

// Utils
import { formatDate } from '@/utils';

// Types
import type { Book } from '@/types';

// Supabase
import { supabase } from '@/integrations/supabase/client';

// Constants
import { GENRES } from '@/constants';
```

## Common Patterns

### Fetch Data

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['resource', id],
  queryFn: () => fetchResource(id),
});
```

### Mutate Data

```typescript
const mutation = useMutation({
  mutationFn: createResource,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['resources'] });
  },
});

mutation.mutate(data);
```

### Offline Operation

```typescript
import { executeWithOfflineQueue } from '@/utils/offlineOperation';

await executeWithOfflineQueue(
  () => supabase.from('table').insert(data),
  { type: 'create_item', data }
);
```

### Real-time Subscription

```typescript
useEffect(() => {
  const channel = supabase
    .channel('changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, (payload) => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}, []);
```

## Troubleshooting Quick Fixes

| Problem | Solution |
|---------|----------|
| Module not found | `npm install` |
| TypeScript errors | Restart TS server |
| Build fails | `rm -rf node_modules && npm install` |
| Stale data | Hard refresh (Cmd/Ctrl + Shift + R) |
| Auth issues | Check .env, restart server |
| Mobile crash | `npx cap sync` |
| Database error | Check RLS policies |
| Offline sync stuck | `offlineQueue.sync()` |

## Resources

- [Full Documentation](./README.md)
- [Getting Started](./getting-started.md)
- [Troubleshooting](./troubleshooting.md)
- [API Reference](./api-reference.md)
