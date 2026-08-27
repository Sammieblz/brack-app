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

Brack separates acquisition from authentication. A new reader can experience
and personalize onboarding before deciding to create an account, while an
established reader still reaches sign-in directly.

```text
Landing "Get Started"
  -> anonymous /onboarding
  -> schema-validated in-memory draft
  -> /auth?mode=signup&from=onboarding
  -> Supabase Auth / email confirmation or OAuth
  -> authenticated, retry-safe draft finalization
  -> native permission education (iOS/Android only)
  -> /dashboard

Landing "Sign In" or a protected-route redirect
  -> /auth?mode=signin
  -> post-auth route resolver
  -> /dashboard, unfinished authenticated onboarding, or pending native setup
```

Web/PWA and Electron skip the native permission page. Capacitor iOS and Android
show it once per new reader/device after onboarding has been applied. A reader
may continue without granting any optional permission.

### Pre-auth onboarding draft

`apps/client/src/services/onboardingDraft.ts` owns the anonymous draft. The
record is schema-validated, versioned, assigned a UUID flow id, and held only in
the active JavaScript document/app process. It records the complete onboarding
form, last step, completion-or-skip outcome, and narrowly scoped signup-attempt
metadata. An email attempt holds only the normalized address needed to bind the
draft to the resulting new account; an OAuth attempt holds the provider and
start time.

The draft never contains a password, Supabase session, access/refresh token,
Turnstile token, SMTP credential, or other secret. Invalid, incompatible, or
state-invalid records are discarded. It is not written to `localStorage`,
`sessionStorage`, IndexedDB, SQLite, or Supabase. Refreshing the document,
closing its tab, or terminating the desktop/mobile app therefore discards the
answers and requires a fresh anonymous onboarding run. Entering the landing or
sign-in flow explicitly abandons it as well.

Normal client-side navigation from onboarding to email signup keeps the same
module instance, so the chosen palette is previewed on the signup screen and
the email OTP can complete in that same document. Web/PWA Google signup uses a
script-created provider window because a same-document OAuth redirect would
destroy the in-memory draft. The callback sends only a completion signal back
to the requesting page; onboarding answers never cross documents. Native and
desktop OAuth already keep the app process alive while using their external
browser handoff. If the owning page/process is gone when any provider callback
returns, Brack keeps the verified Auth account and starts fresh authenticated
onboarding instead of recreating or guessing the discarded answers.

The post-auth resolver applies a draft only when all of these are true:

- the reader explicitly completed or skipped onboarding and then started
  signup from that draft;
- the verified Auth account was created within the bounded signup-attempt
  window and matches the submitted email or OAuth provider;
- the profile still qualifies for first-run onboarding.

An established account signing in cannot consume or overwrite the anonymous
draft. Successful finalization clears it. A transient write failure keeps the
validated draft only while the current process remains alive and routes the
authenticated reader to `/onboarding?resume=draft` for an explicit retry. A
reload at that point intentionally falls back to fresh authenticated
onboarding.

Finalization is single-flight in the client. The authenticated user UUID is
also the stable ID of that reader's onboarding-created goal row, so retries and
fresh authenticated onboarding after a discarded draft update the same row
instead of accumulating goals. The remaining onboarding writes are still
separate owner-scoped operations, not one database transaction; completion
status is written last and the explicit retry path remains required for partial
network failures.

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

The client normalizes the address and makes one Supabase Auth signup request.
It does not run a separate database-backed email-availability preflight:

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
    emailRedirectTo: 'https://brack-app.com/auth/callback',
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

`signed_in` delegates to the shared post-auth resolver. A newly created account
with a bound onboarding draft is finalized before it reaches the dashboard;
native clients then receive the optional device-permission education step.
`confirmation_pending` opens the email-actions screen for a new, unconfirmed
signup. `email_exists` keeps the reader on the signup form and shows **Email
already exists** with the instruction to sign in or continue with Google.

`signUpWithEmail` derives the outcome from that single Auth response. Explicit
`user_already_exists` and `email_exists` errors, plus Supabase's obfuscated
existing-user response with an empty identities array, map to `email_exists`.
An ambiguous response without one of those signals remains
`confirmation_pending` rather than guessing. Supabase owns the unique identity;
the failed or repeated request does not create a second Auth user or profile.

The neutral screen conditionally explains that a confirmation message may
arrive and offers the same options for every pending outcome: request another
confirmation, continue with Google, sign in, reset the password, or use another
email address.

This product decision intentionally turns Supabase's repeated-signup signal into
a visible duplicate-email message. The client does not query `auth.users`, call
a service-role endpoint, or initiate a second signup transaction. Auth errors
are caught and mapped to actionable UI states; delivery `429` responses are not
automatically retried.

The legacy `auth-email-availability` Edge Function and
`public.auth_email_exists(text)` RPC remain temporarily for rollback and older
clients, but the current signup path does not call either one. Keep their
service-role-only grants and rate limits intact until telemetry confirms they
can be removed in a later migration/release.

Changing first name, last name, password, or letter casing does not bypass Auth
identity ownership. On a repeated signup, Supabase does not create or update the
existing user; submitted profile metadata is ignored. Brack trims accidental
email whitespace before Auth calls and leaves canonicalization to Supabase.

### Account and profile uniqueness

Brack's invariant is one Auth user and one profile per reader identity:

- Supabase Auth owns email uniqueness and automatic same-email OAuth identity
  linking. Brack derives duplicate-email UI from the single signup response; it
  does not duplicate email into `public.profiles` or expose Auth rows through
  the Data API.
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

The repeated-signup response intentionally does not identify Google as the
owning provider. The duplicate error offers both sign-in and Google recovery paths;
after Google authentication, adding a password still occurs through the
authenticated account settings flow.

## Sign In

Sign-in remains intentionally direct. It does not require a reader to repeat
the anonymous acquisition questionnaire. After Supabase verifies the session,
the shared resolver sends the reader to the dashboard, an already-pending
authenticated onboarding recovery, or an unfinished native permission intro.
The signup affordance on the sign-in screen starts `/onboarding`; direct signup
routes require a valid ready onboarding draft.

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
    emailRedirectTo: 'https://brack-app.com/auth/callback',
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
| Web/PWA | `https://brack-app.com/auth/callback` | React route `/auth/callback` |
| Staging Web/PWA | `https://staging.brack-app.com/auth/callback` | React route `/auth/callback` |
| Local web | `http://localhost:8080/auth/callback` | React route `/auth/callback` |
| Electron desktop | `brack://auth/callback` | Electron protocol callback through preload |
| Capacitor iOS/Android | `brack://auth/callback` | Capacitor `App.appUrlOpen` deep link |

### Auth context and session ownership

Brack keeps each flow in the surface that started it whenever the platform can
do so:

| Surface | Primary flow | Redirect fallback |
| --- | --- | --- |
| Browser | Email signup/recovery accepts the six-digit code in the same Auth screen. Onboarding-owned Google signup uses a controlled provider window so the in-memory draft's requesting tab remains alive. | The email link opens a browser context on the same HTTPS origin; direct established-reader OAuth may still redirect its current Auth context. |
| Installed PWA | Signup and recovery use the code in the existing PWA window; onboarding-owned Google signup preserves that requesting context when the platform permits a provider window. | Link/window handling remains browser/OS controlled; `handle_links: "not-preferred"` is advisory. |
| Capacitor iOS/Android | The WebView keeps its session while the system browser is used only for provider/link flows | `brack://auth/*` returns the verified result to the app |
| Electron | The renderer keeps its session while provider Auth runs in the system browser | `brack://auth/*` returns through the protocol handler |

An email client cannot target the exact browser tab that originated a request.
The six-digit code is therefore the deterministic same-window path; the secure
link is a fallback. Web Auth routes are excluded from the service worker's
offline app-shell fallback, and the production build verifies that exclusion
with `npm run web:auth-artifacts:check`.

The client is a static Supabase SPA. Supabase persists and refreshes its session
in origin-scoped `localStorage`, as shown in the configuration above. These are
not cookies. JavaScript-readable cookies would not improve the security model;
real `HttpOnly`, `Secure`, server-managed cookies require an SSR/BFF deployment
(for example, a deliberately designed Cloudflare Worker session boundary) and
must not be claimed until that architecture exists.

Supabase Auth redirect URLs should include:

```text
https://brack-app.com/auth/callback
https://staging.brack-app.com/auth/callback
http://localhost:8080/auth/callback
http://127.0.0.1:8080/auth/callback
http://127.0.0.1:8081/auth/callback
brack://auth/callback
```

Password recovery uses a dedicated reset route so fallback links land on the password update screen instead of the normal post-login route:

```text
https://brack-app.com/auth/reset-password
https://staging.brack-app.com/auth/reset-password
http://localhost:8080/auth/reset-password
http://127.0.0.1:8080/auth/reset-password
http://127.0.0.1:8081/auth/reset-password
brack://auth/reset-password
```

The stable staging deployment uses those two exact staging routes instead of a
broad Pages preview wildcard. On web/PWA, the redirect helpers derive their
origin from `window.location.origin`; staging Auth therefore fails if these
exact URLs are absent. A dedicated staging Supabase project should use
`https://staging.brack-app.com` as its Site URL. Adding staging routes to a
shared project's Additional Redirect URLs must not change that project's
production Site URL.

### Production domain cutover state

As of 2026-08-25, `https://brack-app.com` is the repository's canonical target,
but the hosted Supabase Auth Site URL intentionally remains on the previous web
origin until Cloudflare serves the new domain. The safe cutover order is:

1. Connect the canonical domain to the web deployment and verify HTTPS.
2. Verify `/auth/callback` and `/auth/reset-password` both return the SPA.
3. Add the two exact `https://brack-app.com` routes to Supabase's redirect allowlist without removing the previous routes.
4. Change the hosted Site URL to `https://brack-app.com` and smoke-test signup, Google sign-in, resend, recovery, and callback error handling.
5. Retain the previous redirects until already-issued links have expired and the old deployment is no longer serving readers; remove them deliberately afterward.

Do not point Auth at an unresolvable hostname. Repository metadata can identify
the target domain before cutover, but it does not change hosted Auth settings.

The SDK URL detector is intentionally disabled. `AuthCallback`, the Capacitor
deep-link handler, and the Electron protocol handler all delegate to the same
manual callback completion service. This gives one owner to single-use callback
credentials and prevents the SDK and application from consuming the same code
or token payload twice.

## Production Email Delivery

Brack's hosted Auth project uses custom SMTP through Brevo with a sender on
`brack-app.com`; Supabase's development mailer is not the production sender.
SMTP credentials belong only in Supabase/Brevo and must never enter the
repository, client environment, logs, or documentation.

The audited hosted baseline on 2026-08-25 has email confirmation and secure
email changes enabled, a one-hour email OTP lifetime, an eight-character
minimum password, and all seven account-security notifications enabled. The six
authentication templates and seven security-notification templates are stored
under `supabase/templates/`; validate them with `npm run auth:emails:validate`,
check hosted drift with `npm run auth:emails:check`, and use the protected
**Auth Email Templates** workflow for reviewed production synchronization.

Before enabling production signup:

1. Confirm Brevo reports the sender domain and DKIM records as authenticated, and send a real delivery test to more than one mailbox provider.
2. Disable Brevo click/link rewriting for Supabase transactional mail; rewritten single-use Auth links can be consumed or broken by tracking and security scanners.
3. Confirm `no-reply@brack-app.com` can send and that the documented support address is actually routed and monitored.
4. Keep one valid SPF record only. If Brevo requires an SPF include, merge it with the existing record rather than publishing a second SPF TXT record. Monitor DMARC reports before moving from `p=none` to enforcement.
5. Keep the hosted Site URL on the previous origin until the domain-cutover checklist above passes, then switch it to `https://brack-app.com`.
6. Keep the exact web, local-development, Capacitor, and Electron callback URLs listed above in the redirect allowlist during their supported lifetimes.
7. Set Supabase's email-send rate limit within the verified Brevo plan quota; SMTP capacity and Supabase Auth rate limiting are separate controls.
8. Keep Cloudflare Turnstile enabled in Supabase and the client together before unrestricted public signup. Passing a widget token without server-side verification, or enabling verification before the deployed client has its sitekey, breaks Auth.
9. Exercise signup, confirmation resend, invite, magic link, email change, password reset, reauthentication, expired-link, already-used-link, bounce, and provider-outage flows before promotion.

### Cloudflare Turnstile

Turnstile is integrated into email/password signup, sign-in, password recovery,
confirmation/recovery resend, and the current-password reauthentication step in
Account Settings. `VITE_TURNSTILE_SITE_KEY` supplies the browser-visible widget
identifier at build time. It must be configured in each Cloudflare Pages and
native/desktop build environment; never put the Turnstile secret in a `VITE_`
variable. The secret remains only in **Supabase Auth > Bot and Abuse Protection**.

Supabase Auth is the backend verifier for these forms. The client passes the
fresh token as `captchaToken`, and Supabase performs the canonical Cloudflare
Siteverify request with the configured secret. Do not add a Worker that redeems
the same token before Supabase: Turnstile tokens are single-use and the second
verification would fail. Client service types require a token, reject empty or
oversized values before making an Auth request, and reset the widget after every
attempt so a retry cannot reuse a spent token.

The SPA uses explicit, theme-aware rendering with flexible sizing and a compact
fallback below 300px. Production Web/PWA renders directly. Packaged Android,
iOS, Electron, and the fixed Vite loopback origins use
`https://brack-app.com/turnstile.html`. This keeps the real widget on Brack's
authorized HTTPS hostname while hosted Supabase Auth receives a real token that
matches its production secret. The bridge accepts initialization only from the
explicit origins in `TURNSTILE_BRIDGE_PARENT_ORIGINS`, uses a per-instance
cryptographic channel, validates every message, is framed by a restrictive CSP,
and is served with `Cache-Control: no-store`. The service worker never precaches
it. A bridge that cannot complete its handshake becomes a visible retry state
instead of leaving the Auth form waiting indefinitely. LAN-IP development
origins are intentionally not trusted by this bridge.

Deployment order is mandatory:

1. Configure the existing widget for each deployed Pages hostname: `brack-app.com` for production and `staging.brack-app.com` for staging. Error `110200` means the page rendering the widget is not in Cloudflare Hostname Management.
2. Store the existing widget secret in Supabase Bot and Abuse Protection and keep Turnstile selected as the provider.
3. Set `VITE_TURNSTILE_SITE_KEY` in each Pages build and packaged-app build environment.
4. Deploy and verify `/turnstile.html` plus its `_headers` policy over HTTPS before testing fixed loopback, mobile, or desktop clients.
5. Run local Vite on the documented port (`localhost:8080` or `127.0.0.1:8080`). A LAN IP must be explicitly authorized in Cloudflare or routed through a separately reviewed HTTPS bridge origin.
6. Smoke-test each protected flow and confirm the widget is reset after an accepted, rejected, rate-limited, or network-failed request.

Cloudflare dummy sitekeys work on localhost only when the backend uses the
matching dummy secret. Do not put a dummy sitekey in a client connected to the
hosted production Supabase Auth project: production secrets reject dummy
tokens. A fully local Supabase stack may use the documented dummy pair.

Production Vite builds fail closed when the sitekey is absent. CI uses
Cloudflare's published always-pass test widget, never the production widget.

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

## Post-signup device permissions

Permissions are not part of identity proofing and do not gate account creation.
Cloudflare Turnstile protects selected Supabase Auth requests; the native
permission screen explains optional device capabilities only after a verified
new account and its onboarding data have been finalized.

On Capacitor iOS and Android, `/app-permissions` is tracked locally per Auth user
and installation. It offers one explicit notification action and a clear
continue-without-notifications path. The app checks existing OS state without
prompting, does not request notification access at startup, and does not nag
after a denial. If the reader skips the intro, the first deliberate reading
timer start may request local-notification access in that feature context.

Camera, photo-library, and foreground-location access are never requested by
the post-signup page. They are requested just in time after the reader chooses
Scan barcode/Cover, Choose image, or Use current location. Brack does not request
background location, broad media-library access, exact alarms, or unrelated
permissions. Web/PWA and Electron use their browser/desktop fallbacks and never
enter `/app-permissions`.

Permission state remains OS-authoritative and device-specific. Brack's local
marker records only whether the education screen is pending or complete; it is
not copied into profile data and cannot grant a permission.

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

`useAuth` is backed by one application-wide external store. Mounting another
consumer does not create another `getSession()` bootstrap or
`onAuthStateChange()` subscription. Calls that require a server-verified Auth
user share a token-keyed, five-minute cache and one in-flight `getUser()`
request; sign-out, token refresh, and user updates invalidate it. This cache is
only a client request-deduplication layer—Supabase still verifies JWTs and RLS
for every protected database or Edge Function operation.

Onboarding status, reading profile, and notification queries use user-scoped
React Query keys and bounded stale times. Their mutations refresh those keys so
one reader's cached state cannot be presented as another reader's state and
route changes do not repeat identical profile reads.

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

Brack supports password recovery from the signed-out Auth screen. Account
Settings changes a known password inline and links to that same recovery screen
when the current password is forgotten. Recovery email fallback URLs use the
platform-aware `getPasswordResetRedirectUrl()` helper:

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

Password-reset requests use enumeration-safe messaging. The email contains a
six-digit recovery code as the primary path and a secure link as fallback. The
Auth screen verifies the code in the requesting window and then opens the
password form without changing browser/PWA context. The UI never confirms
whether an account exists. Confirmation and reset resends use the same
conditional-delivery language.

Opening the password-reset form also requires a short-lived, user-scoped
recovery authorization created by a successfully verified recovery code or callback.
An unrelated signed-in session cannot authorize this form. Callback credentials
are removed from the browser URL immediately, replayed callbacks are coalesced,
and the recovery authorization is consumed only after the password update
succeeds.

For an already authenticated password account, **Settings > Account** changes
the password inline: Brack verifies the current password first and updates the
same Auth user only after that succeeds. The forgotten-password link navigates
to `/auth?mode=reset` in the same tab. Google-only readers keep the existing
authenticated add-password flow; Settings does not send reset mail itself.

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

**Cause**: the origin-scoped Supabase session in `localStorage` was cleared,
storage is unavailable, or the flow returned to a different browser/app origin

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
- Email/password sign up after a completed or skipped in-memory onboarding draft
- Direct sign-in for established readers without repeating onboarding
- Shared post-auth draft finalization and native permission routing
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
