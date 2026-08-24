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

**Location**: `apps/client/src/integrations/supabase/client.ts`

```typescript
export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,      // Store tokens in localStorage
      persistSession: true,       // Persist across page reloads
      autoRefreshToken: true,     // Auto-refresh before expiry
      detectSessionInUrl: false,  // Brack's cross-platform callback owns completion
      flowType: 'implicit',       // Explicit compatibility mode for current links
    }
  }
);
```

## Sign Up

### Underlying Supabase Sign Up

The client calls this only after `auth-email-availability` confirms that the
normalized address is not already registered:

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

### Brack Signup Outcome Contract

The application layer returns an `EmailSignUpOutcome` instead of exposing the
raw Supabase signup response:

```typescript
type EmailSignUpOutcome =
  | { kind: 'signed_in'; session: Session }
  | { kind: 'email_exists'; email: string }
  | { kind: 'confirmation_pending'; email: string };
```

`signed_in` continues into onboarding or the dashboard.
`confirmation_pending` opens the email-actions screen for a new, unconfirmed
signup. `email_exists` keeps the reader on the signup form and shows **Email
already exists** with the instruction to sign in or continue with Google.

Before calling Supabase Auth, `signUpWithEmail` invokes the public
`auth-email-availability` Edge Function with only the normalized email address.
The function calls the backend-only `public.auth_email_exists(text)` RPC with a
service-role client and returns only `{ exists: boolean }`. An existing
confirmed account, unconfirmed account, or Google-created account therefore
produces `email_exists` before Auth can create a user or resend confirmation.

Supabase can also return an obfuscated user with an empty identities array for
an existing address. Brack retains that response, plus the
`user_already_exists` and `email_exists` Auth codes, as race-condition and
provider-behavior fallbacks. An ambiguous response without one of those signals
remains `confirmation_pending` rather than guessing.

The neutral screen conditionally explains that a confirmation message may
arrive and offers the same options for every pending outcome: request another
confirmation, continue with Google, sign in, reset the password, or use another
email address.

This product decision intentionally reveals whether an email belongs to a Brack
reader. That account-enumeration tradeoff is limited to the signup flow: the
endpoint returns no user, provider, profile, or confirmation details; responses
use `Cache-Control: private, no-store`; and requests are limited to 5 per client
IP per minute and 30 per client IP per hour. The privileged RPC is executable
only by `service_role`; `PUBLIC`, `anon`, and `authenticated` have no direct
execute permission, and no service-role credential reaches the client.

Availability checks fail closed. A rate-limit response, lookup error, malformed
response, or unavailable function prevents the subsequent Auth signup call.
The UI reports that Brack could not verify the address and explicitly states
that no account was created.

Changing first name, last name, password, or letter casing does not bypass Auth
identity ownership. On a repeated signup, Supabase does not create or update the
existing user; submitted profile metadata is ignored. Brack trims accidental
email whitespace before Auth calls and leaves canonicalization to Supabase.

### Account and profile uniqueness

Brack's invariant is one Auth user and one profile per reader identity:

- Supabase Auth owns email uniqueness and automatic same-email OAuth identity
  linking. Brack intentionally exposes only the rate-limited
  `auth-email-availability` boolean for signup; it does not duplicate email into
  `public.profiles` or expose Auth rows through the Data API.
- `public.profiles.id` is both its primary key and a validated, cascading foreign
  key to `auth.users.id`.
- `on_auth_user_created` runs only after a real `auth.users` insert. The trigger
  and client fallback are idempotent on the Auth user UUID.
- `supabase/contracts/production_integrity.sql` continuously checks normalized
  non-SSO Auth email uniqueness, cross-user identity email uniqueness, missing
  or orphaned profiles, the profile PK/FK, and the insert trigger.

A hosted read-only audit on 2026-08-23 found zero normalized duplicate Auth
emails, zero identity emails mapped to multiple users, and a one-to-one mapping
between six Auth users and six profiles. The two recent repeated submissions
were `user_repeated_signup` events: they created zero users/profiles and updated
neither existing row.

### Adding password login to a Google account

An existing Google reader must not use public signup to add password login.
Supabase intentionally returns an obfuscated response and sends no signup email
for that attempt. The supported flow is:

1. Continue with Google to authenticate the existing account.
2. Open **Settings > Account**.
3. Add a Brack password. The authenticated `updateUser({ password })` call adds
   password login to the same Auth user and the same profile.

The availability response intentionally does not identify Google as the owning
provider. The duplicate error offers both sign-in and Google recovery paths;
after Google authentication, adding a password still occurs through the
authenticated account settings flow.

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
  options: {
    redirectTo: getAuthRedirectUrl(),
  },
});
```

## Auth Callback URLs

Brack uses explicit callback URLs for all redirect-based auth methods.

| Runtime | Callback URL | Handler |
| --- | --- | --- |
| Web/PWA | `https://brack.app/auth/callback` | React route `/auth/callback` |
| Local web | `http://localhost:8080/auth/callback` | React route `/auth/callback` |
| Electron desktop | `brack://auth/callback` | Electron protocol callback through preload |
| Capacitor iOS/Android | `brack://auth/callback` | Capacitor `App.appUrlOpen` deep link |

Supabase Auth redirect URLs should include:

```text
https://brack.app/auth/callback
http://localhost:8080/auth/callback
http://127.0.0.1:8080/auth/callback
http://127.0.0.1:8081/auth/callback
brack://auth/callback
```

Password recovery uses a dedicated reset route so users land on the password update screen instead of the normal post-login route:

```text
https://brack.app/auth/reset-password
http://localhost:8080/auth/reset-password
http://127.0.0.1:8080/auth/reset-password
http://127.0.0.1:8081/auth/reset-password
brack://auth/reset-password
```

For preview deployments, add the hosting provider's exact preview pattern if needed. Keep production URLs exact rather than broad wildcard patterns.

The SDK URL detector is intentionally disabled. `AuthCallback`, the Capacitor
deep-link handler, and the Electron protocol handler all delegate to the same
manual callback completion service. This gives one owner to single-use callback
credentials and prevents the SDK and application from consuming the same code
or token payload twice.

## Production Email Delivery

Supabase's built-in Auth mailer is intended for development and has a very low,
project-wide delivery limit. Public email signup must not launch on that sender.

Before enabling production signup:

1. Configure a verified custom SMTP provider in **Supabase Dashboard → Project Settings → Auth → SMTP Settings**.
2. Set **Site URL** to `https://brack.app`.
3. Keep the exact web, local-development, Capacitor, and Electron callback URLs listed above in the redirect allowlist.
4. Set an intentional email-send rate limit that matches the provider's capacity and Brack's abuse controls.
5. Enable CAPTCHA with production keys before opening unrestricted public signup.
6. Exercise signup, confirmation resend, password reset, expired-link, and already-used-link flows in staging before promotion.

The client never automatically retries Auth `429` responses. It maps
`over_email_send_rate_limit` and `over_request_rate_limit` to an actionable
try-later message and does not invent a 60-second recovery time. A 60-second
client resend guard is applied only after Supabase accepts a signup or resend
request; it is not presented as evidence that delivery occurred or that a
server-side quota will recover when the timer ends. After an email-delivery
rate limit, the mounted Auth screen disables further signup, reset, and resend
delivery attempts without displaying a recovery countdown. Sign in remains
available because it does not send email. Repeated client retries cannot repair
an exhausted server-side email quota.

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

### Offline Sync and Signed-out State

The reading-core queue is account-scoped and remains on the device when a user
signs out. App startup, foreground, and reconnect events treat a missing Auth
session as a normal no-op; they do not inspect, mutate, or delete any user's
queue. Once a verified session becomes available, Brack resumes only the queue
owned by that user. Auth or connectivity failures other than the official
missing-session state remain visible as errors.

## useAuth Hook

**Location**: `apps/client/src/hooks/useAuth.ts`

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

Brack supports password reset from the signed-out auth screen and from Account Settings. The reset request uses the platform-aware `getPasswordResetRedirectUrl()` helper:

- Web/PWA: `/auth/reset-password`
- Electron desktop: `brack://auth/reset-password`
- Capacitor iOS/Android: `brack://auth/reset-password`

### Request Reset Email

```typescript
const { error } = await supabase.auth.resetPasswordForEmail(
  'user@example.com',
  {
    redirectTo: getPasswordResetRedirectUrl(),
  }
);
```

Password-reset requests use enumeration-safe messaging. A successful API
response is presented conditionally: if the address is connected to Brack, a
reset link may arrive. The UI never confirms whether an account exists and never
states that a reset message was sent. Confirmation resend acknowledgements use
the same conditional delivery language.

Opening the password-reset form also requires a short-lived, user-scoped
recovery authorization created by a successfully completed recovery callback.
An unrelated signed-in session cannot authorize this form. Callback credentials
are removed from the browser URL immediately, replayed callbacks are coalesced,
and the recovery authorization is consumed only after the password update
succeeds.

### Update Password

`apps/client/src/screens/ResetPassword.tsx` handles Supabase recovery callback parameters, confirms an active recovery session, validates the new password, and updates the logged-in recovery user:

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

### "Email rate limit exceeded" During Signup

**Cause**: Supabase rejected `/auth/v1/signup` with
`over_email_send_rate_limit`. The encoded `redirect_to=/auth/callback` value may
make the failed request look like a callback failure in a narrow browser
console, but the rejected operation is signup email delivery.

**Solution**:

1. Do not repeatedly submit or automatically retry the request.
2. Tell the reader that email is temporarily unavailable and to try again later; do not start a guessed 60-second recovery countdown.
3. Do not infer whether the address already has an account or whether an earlier message was delivered.
4. Offer sign in, password reset, and another-email paths while the reader waits.
5. For production, configure custom SMTP and verify the sender/domain.
6. Review Auth logs for the structured error code rather than diagnosing from a truncated DevTools URL.

## Auth Screen

**Location**: `apps/client/src/screens/Auth.tsx`

**Features**:
- Email/password sign in
- Email/password sign up
- Explicit duplicate-email rejection with sign-in and Google recovery paths
- Neutral confirmation-pending handling for genuinely ambiguous responses
- Conditional confirmation resend and password-reset messaging
- In-flight duplicate request prevention without automatic `429` retries
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
