# Frequently Asked Questions (FAQ)

Common questions about Brack development and usage.

## General

### What is Brack?

Brack is a comprehensive book tracking application that helps readers:
- Track reading progress
- Set and achieve reading goals
- Connect with fellow readers
- Journal about their reading experiences
- Discover new books and readers

### What platforms are supported?

- **Web**: All modern browsers (Chrome, Safari, Firefox, Edge)
- **iOS**: iOS 13+ (iPhone and iPad)
- **Android**: Android 5.0+ (API 24+)

### Is Brack free to use?

The source code is available, but deployment costs depend on:
- Supabase (has free tier)
- Hosting (Vercel/Netlify have free tiers)
- Firebase (for push notifications, has free tier)

## Development

### Do I need a Mac to develop for iOS?

**For iOS development**: Yes, macOS with Xcode is required to build and deploy iOS apps.

**For web and Android**: No, you can develop on Windows, macOS, or Linux.

### Can I use Bun instead of npm?

No for project workflow. npm is the canonical package manager, `package-lock.json` is the canonical lockfile, and the root `package.json` declares `packageManager: "npm@11.3.0"`. Turborepo runs the npm workspace scripts. Do not reintroduce `bun.lockb`.

### Why is TypeScript strictness relaxed?

The project uses relaxed TypeScript settings for rapid development. This allows for:
- Faster prototyping
- Less friction for new developers
- Gradual type coverage increase

For production apps, consider enabling strict mode gradually.

### How do I add a new database table?

1. Create migration: `npm run db:migration:new -- add_your_table`
2. Write SQL in the generated file
3. Add RLS policies and pgTAP contracts
4. Finalize the migration lock: `npm run db:migrations:lock`
5. Clean-reset locally and finalize the catalog lock: `npx --no-install supabase db reset --local --no-seed && npm run db:schema:lock`
6. Open a pull request; the protected workflow validates and applies production migrations
7. Update types: The types in `apps/client/src/integrations/supabase/types.ts` should be regenerated

### How do I update Supabase types?

```bash
npx supabase gen types typescript --project-id your-project-id > apps/client/src/integrations/supabase/types.ts
```

## Features

### How does offline mode work?

When offline:
1. Reading-core changes are written to local repositories.
2. A durable outbox item is created in IndexedDB on web or SQLite on native.
3. When back online, `readingCoreSync` pushes pending mutations through `sync-push`.
4. The app then pulls remote changes through `sync-pull`.
5. Failed items can be retried or discarded from the sync review UI.

See [Offline Support](./offline-support.md) for details.

### How are reading streaks calculated?

- A completed reading session or a full saved progress log creates a streak
  day. A quick page correction by itself does not.
- Consecutive streak days increase the current streak. A missed, unprotected
  day resets the current run, while the personal best remains saved.
- Home uses the happy Brack flame when today's state is secure or protected and
  the sad flame when reading is needed or a new run can begin.
- Streak Freezes are consumable Journey items bought with Gold Leaves. Buying a
  Freeze stores it; Brack never spends it automatically.
- A manual Freeze request succeeds only when the server confirms ownership,
  inventory, no reading today, reading on the prior eligible day, and the
  seven-day cooldown.
- Cached Freeze quantities are read-only until the app refreshes them online.

Persistence is derived through `reading_streak_days`; Home's visual-state guard
lives in `apps/client/src/lib/dashboardStreak.ts`. See
[Streak Rules](./product/streak-rules.md) for the complete ownership model.

### How does the reading timer work?

- Timer runs in browser/app
- State persists to localStorage
- On native apps, shows background notification
- Automatically creates reading session when stopped
- Prompts for journal entry after 5+ minutes

See `apps/client/src/contexts/TimerContext.tsx` for implementation.

### Can users share books with friends?

Yes! Features:
- Share book details via native share sheet
- Share reading stats
- Share reviews and quotes
- Deep links for direct navigation

### How do push notifications work?

- The native app explains notification value after a new signup and requests OS
  access only after the reader presses **Enable useful notifications**.
- Uses Firebase Cloud Messaging (FCM); iOS obtains an FCM token through Firebase
  Messaging and Firebase forwards through APNs.
- Each installation token has one authenticated owner in `push_tokens` and is
  claimed atomically when an account registers on that device.
- Sign-out removes/unregisters the current installation token, not tokens on the
  reader's other devices.
- Messages are sent by the `send-push-notification` Edge Function.
- User preferences in `notification_preferences` table

iOS delivery also requires valid APNs credentials in Firebase, the Apple Push
Notifications capability/provisioning, and physical-device testing. Having
`GoogleService-Info.plist` alone does not complete that external setup.

### Why does Get Started show onboarding before signup?

It lets a new reader understand and personalize Brack before creating an
account. The answers are stored as a schema-validated, versioned local draft for
up to seven days. After email confirmation or Google signup, Brack verifies that
the newly created account belongs to that signup attempt, applies the draft
idempotently, and then clears it.

The draft contains onboarding answers and limited email/provider binding
metadata. It never stores the password, Auth session/tokens, Turnstile token, or
server secret. It is device/runtime scoped rather than a cloud backup. If it is
missing or expires, a qualifying new account can finish authenticated
onboarding. **Sign In** remains direct for existing readers.

## Mobile

### Do mobile features work in web browser?

Most features have web fallbacks:

| Feature | Web Support |
|---------|-------------|
| Camera | Yes (getUserMedia API) |
| Photo Library | Yes (file input) |
| Barcode Scanning | Yes (with camera access) |
| Push Notifications | No current web-push registration; in-app notifications still work |
| Haptics | No vibration on most browsers |
| Share | Yes (Web Share API or clipboard) |

### Why use Capacitor instead of React Native?

Capacitor allows:
- Single codebase for web and mobile
- Web-first development (faster iteration)
- Easier debugging (Chrome DevTools)
- Simpler deployment process
- Better plugin ecosystem for our needs

### Can I test on iOS Simulator?

Yes, but with limitations:
- No camera access
- No push notifications
- No haptics
- Performance differs from real device

Always test critical features on physical devices.

### How do I update Capacitor version?

```bash
# Update Capacitor packages
npm install @capacitor/core@latest @capacitor/cli@latest
npm install @capacitor/ios@latest @capacitor/android@latest

# Update plugins
npm install @capacitor/camera@latest @capacitor/push-notifications@latest
# (update all plugins)

# Sync to native projects
npm run cap:sync
```

## Database

### How do I reset the database?

**⚠️ Warning**: This deletes all data!

This operation is local-only. Shared and production databases must never be
reset from a developer shell.

```bash
npx --no-install supabase db reset --local --no-seed
```

### How do I backup the database?

Via Supabase Dashboard:
1. Go to Database → Backups
2. Download backup

Via CLI:
```bash
npx supabase db dump > backup.sql
```

### What is Row Level Security (RLS)?

RLS ensures users can only access their own data:

```sql
-- Example: Users can only see their own books
CREATE POLICY "Users can view own books"
  ON books FOR SELECT
  USING (auth.uid() = user_id);
```

All 27 tables have RLS enabled for security.

### Can I use raw SQL queries?

Yes, but use Supabase client methods when possible:

```typescript
// ✅ Preferred: Type-safe client
const { data } = await supabase
  .from('books')
  .select('*')
  .eq('user_id', userId);

// ⚠️ Use sparingly: Raw SQL
const { data } = await supabase.rpc('custom_function', { param: value });
```

## Performance

### Why is my app slow?

Common causes:
1. **Too many subscriptions** - Unsubscribe when not needed
2. **Large bundles** - Check bundle analyzer
3. **Unoptimized queries** - Add database indexes
4. **Missing lazy loading** - Lazy load heavy components
5. **No caching** - Implement React Query caching

### How do I reduce bundle size?

1. **Lazy load routes**:
   ```typescript
   const Analytics = lazy(() => import('./screens/Analytics'));
   ```

2. **Remove unused dependencies**:
   ```bash
   npx depcheck
   ```

3. **Analyze bundle**:
   ```bash
   npm run build -- --mode analyze
   ```

4. **Tree-shake imports**:
   ```typescript
   // ✅ DO: Named imports
   import { useState } from 'react';
   
   // ❌ DON'T: Default imports (if library supports tree-shaking)
   import _ from 'lodash';  // Imports entire library
   ```

### How can I optimize images?

1. **Use WebP format** when possible
2. **Compress images** before upload
3. **Lazy load** with `loading="lazy"`
4. **Use srcset** for responsive images
5. **Cache** with `imageCache` service

## Security

### How are passwords stored?

Passwords are handled by Supabase Auth:
- Hashed with bcrypt
- Never stored in plain text
- Never sent to frontend

### How do I report a security issue?

**Do not** create public GitHub issues for security vulnerabilities.

Instead:
1. Email security contact (if provided)
2. Or create private security advisory on GitHub

### Is user data encrypted?

- **In transit**: HTTPS/TLS encryption
- **At rest**: Supabase encrypts data at rest
- **Sensitive data**: Additional encryption can be added

### What permissions does the mobile app need?

**iOS**:
- Notifications for reading reminders and remote push, requested from an
  explicit enable action or contextual timer action
- Camera for barcode/cover scanning and chosen photo attachments
- Photo Library read/add-only descriptions for choosing or explicitly saving an image
- Foreground location when the reader selects **Use current location**

**Android**:
- `INTERNET` and `VIBRATE`
- `POST_NOTIFICATIONS` on supported Android versions
- `CAMERA` for explicit scanner/photo actions
- `ACCESS_COARSE_LOCATION` and `ACCESS_FINE_LOCATION` for an explicit
  foreground location lookup

Brack does not request broad external-storage/media access, background
location, or exact alarms. The native post-signup page asks only about useful
notifications; camera, photos, and location remain just-in-time prompts in the
feature that needs them. Every optional denial keeps a continue/manual path,
and Brack does not repeatedly prompt after the OS records a denial.

## Troubleshooting

### "Module not found" errors

```bash
rm -rf node_modules package-lock.json
npm install
```

### Build works locally but fails in production

1. Check environment variables
2. Verify build command in hosting platform
3. Check build logs for errors
4. Ensure dependencies are in `dependencies`, not `devDependencies`

### Mobile app crashes on startup

1. Check Xcode/Android Studio console
2. Verify all plugins are synced: `npm run cap:sync`
3. Check Info.plist/AndroidManifest.xml for missing permissions
4. Clean and rebuild

### Data not syncing

1. Check network connection
2. Verify Supabase URL and keys
3. Check browser console for errors
4. Check the sync status in `OfflineIndicator` or inspect the local outbox through `readingCoreSync`

## Getting Help

### Where can I get help?

1. **Documentation**: Check [docs/](../docs/)
2. **Troubleshooting**: See [troubleshooting.md](./troubleshooting.md)
3. **Issues**: Search existing GitHub issues
4. **Discussions**: GitHub Discussions (if enabled)
5. **Community**: Join community channels (if available)

### How do I report a bug?

Create a GitHub issue with:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Screenshots/logs if applicable

See [Contributing Guide](./contributing.md) for template.

### How do I request a feature?

Create a GitHub issue with:
- Feature description
- Use case
- Proposed solution
- Alternative approaches considered

## Contributing

### Can I contribute?

Yes! Contributions are welcome. See [Contributing Guidelines](./contributing.md).

### What can I work on?

- Check GitHub issues labeled `good first issue`
- Fix bugs
- Add features
- Improve documentation
- Write tests

### How long do pull requests take to review?

Depends on maintainer availability. Typical: 3-7 days.

## Miscellaneous

### Why "Brack"?

Bracket for books - a way to organize and track your reading journey.

### Can I white-label this app?

Yes, the code is available for modification:
1. Change branding (logos, colors, name)
2. Update `apps/mobile/capacitor.config.ts` with your app ID
3. Update app store listings
4. Deploy with your own Supabase project

### Can I self-host?

Yes:
- Deploy web app to your hosting
- Run Supabase locally or self-hosted
- Configure your own Firebase project
- Update environment variables

### Is there a hosted version?

Check the main README for links to hosted version (if available).

## Further Reading

- [Getting Started](./getting-started.md)
- [Architecture](./architecture.md)
- [Troubleshooting](./troubleshooting.md)
- [Contributing](./contributing.md)
