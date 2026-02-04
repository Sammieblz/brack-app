# Authentication

Guide to authentication and authorization in Brack.

## Overview

Brack uses Supabase Auth for user authentication and Row Level Security (RLS) for authorization.

**Features**:
- Email/password authentication
- JWT token-based sessions
- Automatic token refresh
- Session persistence
- Row Level Security (RLS)

## Authentication Flow

```
User visits app
       ↓
Check session
       ↓
┌──────────────┐
│  Has valid   │
│   session?   │
└──┬───────┬───┘
   │ Yes   │ No
   │       │
   │       └────► Redirect to /auth
   │
   ▼
Load user data
   ↓
Render dashboard
```

## Setup

### Supabase Configuration

**Location**: `src/integrations/supabase/client.ts`

```typescript
export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,      // Store tokens in localStorage
      persistSession: true,       // Persist across page reloads
      autoRefreshToken: true,     // Auto-refresh before expiry
    }
  }
);
```

## Sign Up

### Basic Sign Up

```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
  options: {
    data: {
      full_name: 'John Doe',
    },
  },
});
```

### With Email Confirmation

```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
  options: {
    emailRedirectTo: 'https://brack.app/auth/callback',
  },
});
```

## Sign In

### Email/Password

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password',
});
```

### Magic Link

```typescript
const { data, error } = await supabase.auth.signInWithOtp({
  email: 'user@example.com',
  options: {
    emailRedirectTo: 'https://brack.app/auth/callback',
  },
});
```

### OAuth (Optional)

```typescript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google', // or 'github', 'apple', etc.
});
```

## Sign Out

```typescript
const { error } = await supabase.auth.signOut();

// Then redirect to login
navigate('/auth');
```

## Session Management

### Get Current Session

```typescript
const { data: { session }, error } = await supabase.auth.getSession();

if (session) {
  console.log('User is logged in:', session.user);
} else {
  console.log('No active session');
}
```

### Get Current User

```typescript
const { data: { user }, error } = await supabase.auth.getUser();

if (user) {
  console.log('User ID:', user.id);
  console.log('Email:', user.email);
}
```

### Refresh Session

```typescript
const { data: { session }, error } = await supabase.auth.refreshSession();
```

### Listen to Auth Changes

```typescript
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (event, session) => {
    console.log('Auth event:', event); // 'SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED'
    console.log('Session:', session);
    
    if (event === 'SIGNED_OUT') {
      // Clear local state
      // Redirect to login
    }
  }
);

// Cleanup
subscription.unsubscribe();
```

## useAuth Hook

**Location**: `src/hooks/useAuth.ts`

### Usage

```typescript
import { useAuth } from '@/hooks/useAuth';

const MyComponent = () => {
  const { user, loading, signOut } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  
  if (!user) {
    return <Redirect to="/auth" />;
  }
  
  return (
    <div>
      <p>Welcome, {user.email}</p>
      <Button onClick={signOut}>Sign Out</Button>
    </div>
  );
};
```

### Protected Routes

```typescript
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

// Usage in App.tsx
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
} />
```

## Row Level Security (RLS)

### Purpose

RLS ensures users can only access their own data at the database level.

### Example Policies

#### Books Table

```sql
-- Users can view their own books
CREATE POLICY "Users can view own books"
  ON books FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own books
CREATE POLICY "Users can insert own books"
  ON books FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own books
CREATE POLICY "Users can update own books"
  ON books FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own books
CREATE POLICY "Users can delete own books"
  ON books FOR DELETE
  USING (auth.uid() = user_id);
```

#### Public Data (Posts)

```sql
-- All authenticated users can view posts
CREATE POLICY "Authenticated users can view posts"
  ON posts FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own posts
CREATE POLICY "Users can insert own posts"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts
CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE
  USING (auth.uid() = user_id);
```

## Profile Creation

### Automatic Profile Creation

When a user signs up, create their profile:

```typescript
// Option 1: Database trigger (recommended)
CREATE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

// Option 2: Client-side (after sign up)
const { data: { user } } = await supabase.auth.signUp({ ... });

if (user) {
  await supabase.from('profiles').insert({
    id: user.id,
    display_name: user.email?.split('@')[0],
  });
}
```

## Password Reset

### Request Reset

```typescript
const { error } = await supabase.auth.resetPasswordForEmail(
  'user@example.com',
  {
    redirectTo: 'https://brack.app/auth/reset-password',
  }
);
```

### Update Password

```typescript
const { error } = await supabase.auth.updateUser({
  password: 'new-secure-password',
});
```

## Update User Metadata

```typescript
const { data, error } = await supabase.auth.updateUser({
  data: {
    full_name: 'John Doe',
    avatar_url: 'https://...',
  },
});
```

## Security Best Practices

### 1. Never Store Passwords

```typescript
// ✅ DO: Let Supabase handle passwords
await supabase.auth.signUp({ email, password });

// ❌ DON'T: Store passwords anywhere
localStorage.setItem('password', password); // NEVER DO THIS
```

### 2. Use RLS Policies

```typescript
// ✅ DO: Rely on RLS
const { data } = await supabase
  .from('books')
  .select('*');
// RLS automatically filters to user's books

// ❌ DON'T: Filter client-side (security issue)
const { data } = await supabase
  .from('books')
  .select('*')
  .eq('user_id', userId);
// Without RLS, could access other users' data
```

### 3. Validate on Server

```typescript
// ✅ DO: Validate in Edge Functions
const { data: { user } } = await supabase.auth.getUser(jwt);
if (!user) {
  return new Response('Unauthorized', { status: 401 });
}

// ❌ DON'T: Trust client data
// Always verify user ID from JWT, never from request body
```

### 4. Handle Token Expiry

```typescript
// ✅ DO: Auto-refresh enabled in client config
// Supabase handles this automatically

// Manual refresh if needed
const { data: { session } } = await supabase.auth.refreshSession();
```

## Checking Permissions

### In Frontend

```typescript
// Check if user owns a book
const canEdit = book.user_id === user?.id;

// Check if user is club admin
const isAdmin = await supabase.rpc('is_club_admin', {
  club_id: clubId,
  user_id: user.id,
});
```

### In Database Functions

```sql
-- Custom function to check club membership
CREATE OR REPLACE FUNCTION is_club_member(club_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM book_club_members
    WHERE club_id = $1 AND user_id = $2
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Use in RLS policy
CREATE POLICY "Members can view club discussions"
  ON book_club_discussions FOR SELECT
  USING (is_club_member(club_id, auth.uid()));
```

## Common Issues

### "Invalid JWT token"

**Cause**: Token expired or malformed

**Solution**:
```typescript
try {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    // Redirect to login
    navigate('/auth');
  }
} catch (error) {
  // Handle error
}
```

### "Permission denied"

**Cause**: RLS policy blocking access

**Solution**:
1. Check RLS policies in Supabase dashboard
2. Verify user is authenticated
3. Ensure user owns the resource

### Session Lost After Refresh

**Cause**: localStorage cleared or cookies disabled

**Solution**:
```typescript
// Check localStorage is available
try {
  localStorage.setItem('test', 'test');
  localStorage.removeItem('test');
} catch {
  console.error('localStorage not available');
}
```

## Auth Screen

**Location**: `src/screens/Auth.tsx`

**Features**:
- Email/password sign in
- Email/password sign up
- Form validation
- Error handling
- Auto-redirect on success

## Testing Authentication

### Local Testing

1. Start app: `npm run dev`
2. Sign up with test email
3. Check Supabase dashboard for new user
4. Verify profile created
5. Sign out and sign in again

### Test RLS Policies

```typescript
// Try to access another user's data
const { data, error } = await supabase
  .from('books')
  .select('*')
  .eq('user_id', 'other-user-id'); // Should return empty or error

// Verify RLS is working
```

## Further Reading

- [Database Schema](./database-schema.md)
- [Security Best Practices](https://supabase.com/docs/guides/auth)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
