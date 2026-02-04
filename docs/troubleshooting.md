# Troubleshooting Guide

Common issues and solutions when developing or running Brack.

## Development Issues

### Build Errors

#### "Cannot find module '@/...'"

**Cause**: TypeScript path alias not resolved

**Solution**:
```bash
# Restart TypeScript server in VS Code
Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"

# Or restart development server
npm run dev
```

#### "Module not found: Error: Can't resolve '...'"

**Cause**: Missing dependency

**Solution**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

#### Vite build fails with memory error

**Cause**: Large bundle size

**Solution**:
```bash
# Increase Node memory limit
NODE_OPTIONS=--max_old_space_size=4096 npm run build
```

### TypeScript Errors

#### "Property '...' does not exist on type 'never'"

**Cause**: Type inference issue

**Solution**:
```typescript
// Add explicit type annotation
const data: YourType = await fetchData();

// Or use type assertion
const data = await fetchData() as YourType;
```

#### "Type 'null' is not assignable to type '...'"

**Cause**: Strict null checks (even though disabled globally)

**Solution**:
```typescript
// Use optional chaining
const value = data?.property;

// Or nullish coalescing
const value = data ?? defaultValue;
```

### Linting Errors

#### ESLint shows errors but build succeeds

**Cause**: ESLint config out of sync

**Solution**:
```bash
# Fix linting errors automatically
npm run lint -- --fix

# Or disable specific rules (use sparingly)
// eslint-disable-next-line rule-name
```

## Database Issues

### Supabase Connection

#### "Invalid API key"

**Cause**: Incorrect or missing environment variables

**Solution**:
1. Check `.env` file exists
2. Verify keys from Supabase dashboard
3. Restart dev server after changing `.env`

```bash
# .env file should have:
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

#### "Permission denied for table ..."

**Cause**: Row Level Security (RLS) policies not applied

**Solution**:
```bash
# Apply all migrations
npx supabase db push

# Or reset database (WARNING: deletes all data)
npx supabase db reset
```

#### "Row level security policy violated"

**Cause**: Trying to access data without proper authentication

**Solution**:
1. Ensure user is logged in
2. Check RLS policies in database
3. Verify JWT token is being sent

```typescript
// Check auth state
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  // Redirect to login
}
```

### Migration Issues

#### "Migration already applied"

**Cause**: Duplicate migration or out of sync

**Solution**:
```bash
# Check migration status
npx supabase db diff

# Force reset (development only)
npx supabase db reset
```

#### "Migration failed: syntax error"

**Cause**: SQL syntax error in migration file

**Solution**:
1. Open the failing migration file
2. Check SQL syntax
3. Test SQL in Supabase SQL editor
4. Fix and retry

## Mobile Development Issues

### iOS Issues

#### "No signing certificate found"

**Cause**: Xcode project not configured

**Solution**:
1. Open project in Xcode: `npx cap open ios`
2. Select your team in "Signing & Capabilities"
3. Let Xcode auto-manage signing

#### "CocoaPods installation failed"

**Cause**: CocoaPods not installed or outdated

**Solution**:
```bash
# Install CocoaPods
sudo gem install cocoapods

# Update pods
cd ios/App
pod update
cd ../..
```

#### "App crashes on launch (iOS)"

**Cause**: Missing configuration or plugin issue

**Solution**:
1. Check Xcode console for errors
2. Verify `capacitor.config.ts` is correct
3. Clean build folder:
   ```bash
   cd ios/App
   rm -rf build/
   cd ../..
   npx cap sync ios
   ```

### Android Issues

#### "AAPT: error: resource ... not found"

**Cause**: Android resources out of sync

**Solution**:
```bash
# Clean and rebuild
cd android
./gradlew clean
cd ..
npx cap sync android
```

#### "google-services.json missing"

**Cause**: Firebase configuration not added

**Solution**:
1. Download from Firebase Console
2. Place in `android/app/google-services.json`
3. Rebuild project

#### "App crashes on startup (Android)"

**Cause**: Plugin incompatibility or missing permission

**Solution**:
1. Check Logcat in Android Studio
2. Verify permissions in `AndroidManifest.xml`
3. Check for plugin errors:
   ```bash
   npx cap sync android
   ```

### Capacitor Sync Issues

#### "Capacitor plugin not found"

**Cause**: Plugin not synced to native project

**Solution**:
```bash
# Sync all plugins
npx cap sync

# Or sync specific platform
npx cap sync ios
npx cap sync android
```

#### "Native project out of sync"

**Cause**: Changes not reflected in native project

**Solution**:
```bash
# Build then sync
npm run build
npx cap sync

# Copy web assets
npx cap copy
```

## Runtime Issues

### Authentication

#### User logged out unexpectedly

**Cause**: Session expired or localStorage cleared

**Solution**:
```typescript
// Check session validity
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  // Redirect to login
}
```

#### "Invalid JWT token"

**Cause**: Token expired or malformed

**Solution**:
```typescript
// Refresh session
const { data: { session }, error } = await supabase.auth.refreshSession();
if (error) {
  // Re-authenticate user
}
```

### Data Fetching

#### Infinite loading state

**Cause**: Query never resolves or error not handled

**Solution**:
```typescript
// Add timeout to queries
const { data, isLoading, error } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  retry: 1,
  retryDelay: 1000,
});

if (error) {
  return <ErrorMessage error={error} />;
}
```

#### Data not updating after mutation

**Cause**: Cache not invalidated

**Solution**:
```typescript
// Invalidate query cache after mutation
const mutation = useMutation({
  mutationFn: updateData,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['data'] });
  },
});
```

### Offline Mode

#### Actions not syncing when back online

**Cause**: Offline queue service not running

**Solution**:
```typescript
// Check offline queue
import { offlineQueue } from '@/services/offlineQueue';

console.log('Queue size:', offlineQueue.getQueueSize());

// Manually trigger sync
await offlineQueue.sync();
```

#### "Offline" banner stuck

**Cause**: Network status not updating

**Solution**:
```bash
# Hard refresh browser
Cmd/Ctrl + Shift + R

# Or clear localStorage
localStorage.clear();
```

### Push Notifications

#### Notifications not received (iOS)

**Cause**: APNs certificate not configured

**Solution**:
1. Enable Push Notifications in Xcode
2. Upload APNs certificate to Firebase
3. Test on physical device (not simulator)

#### Notifications not received (Android)

**Cause**: FCM not configured

**Solution**:
1. Verify `google-services.json` is present
2. Check FCM Server Key in `.env`
3. Test on physical device

#### Permission denied for notifications

**Cause**: User denied permission

**Solution**:
```typescript
// Check and request permission
const { receive } = await PushNotifications.checkPermissions();
if (receive === 'denied') {
  // Prompt user to enable in settings
}
```

## Performance Issues

### Slow Page Load

**Cause**: Large bundle or too many requests

**Solution**:
1. Check Network tab in DevTools
2. Look for slow queries
3. Implement lazy loading:
   ```typescript
   const HeavyComponent = lazy(() => import('./HeavyComponent'));
   ```

### Memory Leaks

**Cause**: Subscriptions not cleaned up

**Solution**:
```typescript
useEffect(() => {
  const subscription = supabase
    .channel('changes')
    .on('*', handleChange)
    .subscribe();

  // Cleanup on unmount
  return () => {
    supabase.removeChannel(subscription);
  };
}, []);
```

### App Crashes

**Cause**: Unhandled errors

**Solution**:
1. Check Sentry for error logs
2. Add error boundaries:
   ```tsx
   <ErrorBoundary>
     <Component />
   </ErrorBoundary>
   ```
3. Add try-catch blocks:
   ```typescript
   try {
     await riskyOperation();
   } catch (error) {
     console.error(error);
     toast.error('Something went wrong');
   }
   ```

## Network Issues

### CORS Errors

**Cause**: Edge Function not configured for origin

**Solution**:
```typescript
// Add origin to ALLOWED_ORIGINS in Edge Function
const corsHeaders = getCorsHeaders(origin);
return new Response(data, { headers: corsHeaders });
```

### Rate Limiting

**Cause**: Too many requests to Edge Function

**Solution**:
```typescript
// Implement debouncing
const debouncedSearch = debounce(searchFn, 300);

// Or use rate limit helper in Edge Function
```

### Timeout Errors

**Cause**: Request taking too long

**Solution**:
1. Add timeout to fetch:
   ```typescript
   const controller = new AbortController();
   setTimeout(() => controller.abort(), 10000);
   
   fetch(url, { signal: controller.signal });
   ```
2. Optimize database queries
3. Add indexes to frequently queried columns

## Environment Issues

### Development vs Production

#### Feature works in dev but not production

**Cause**: Environment variable not set

**Solution**:
1. Check build-time variables (VITE_*)
2. Verify production environment variables
3. Check console for errors

#### Different behavior on mobile vs web

**Cause**: Platform-specific code

**Solution**:
```typescript
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  // Mobile-specific code
} else {
  // Web fallback
}
```

## Debugging Tips

### Enable Verbose Logging

```typescript
// In development, log all queries
if (import.meta.env.DEV) {
  queryClient.setLogger({
    log: console.log,
    warn: console.warn,
    error: console.error,
  });
}
```

### React DevTools

1. Install React DevTools browser extension
2. Inspect component props and state
3. Check component re-renders

### Network Tab

1. Open DevTools → Network
2. Check for failed requests (red)
3. Look at request/response headers
4. Check timing for slow requests

### Console Logging

```typescript
// Conditional logging
const DEBUG = import.meta.env.DEV;
if (DEBUG) console.log('Debug info:', data);

// Use console.table for arrays
console.table(books);

// Use console.time for performance
console.time('operation');
await slowOperation();
console.timeEnd('operation');
```

### Sentry Debugging

```typescript
// Add context to errors
Sentry.setContext('user', { id: user.id });
Sentry.setTag('feature', 'books');

// Capture message
Sentry.captureMessage('Important event', 'info');

// Capture exception
try {
  riskyOperation();
} catch (error) {
  Sentry.captureException(error);
}
```

## Getting Help

### Before Asking for Help

1. ✅ Check this troubleshooting guide
2. ✅ Search existing GitHub issues
3. ✅ Check browser console for errors
4. ✅ Check Sentry for error logs
5. ✅ Try in incognito/private mode
6. ✅ Clear browser cache and localStorage

### Reporting Issues

Include:
- **Environment**: OS, browser/device, Node version
- **Steps to reproduce**: Clear, numbered steps
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Error messages**: Full error text
- **Screenshots**: If applicable

### Useful Commands

```bash
# Check versions
node --version
npm --version
npx cap --version

# Check environment
printenv | grep VITE

# Clear all caches
npm run build:clean  # If script exists
rm -rf node_modules dist .vite
npm install

# Reset database
npx supabase db reset

# Check Supabase status
npx supabase status
```

## Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| TypeScript errors | Restart TS server |
| Stale data | Hard refresh (Cmd/Ctrl + Shift + R) |
| Build fails | `rm -rf node_modules && npm install` |
| Mobile crash | `npx cap sync` |
| Auth issues | Check `.env` and restart server |
| Slow queries | Check database indexes |
| Memory leak | Check for missing cleanup in useEffect |

## Further Reading

- [Getting Started](./getting-started.md) - Setup instructions
- [Architecture](./architecture.md) - System design
- [Database Schema](./database-schema.md) - Database structure
- [API Reference](./api-reference.md) - Edge Functions
