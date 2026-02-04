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

Partially. The project has a `bun.lockb` file, but npm is the official package manager. Bun may work but is not officially supported.

### Why is TypeScript strictness relaxed?

The project uses relaxed TypeScript settings for rapid development. This allows for:
- Faster prototyping
- Less friction for new developers
- Gradual type coverage increase

For production apps, consider enabling strict mode gradually.

### How do I add a new database table?

1. Create migration: `npx supabase migration new add_your_table`
2. Write SQL in the generated file
3. Add RLS policies
4. Apply migration: `npx supabase db push`
5. Update types: The types in `src/integrations/supabase/types.ts` should be regenerated

### How do I update Supabase types?

```bash
npx supabase gen types typescript --project-id your-project-id > src/integrations/supabase/types.ts
```

## Features

### How does offline mode work?

When offline:
1. User actions are queued in `offlineQueue`
2. Stored in localStorage
3. When back online, queue is synced automatically
4. Failed actions retry up to 3 times

See [Offline Support](./offline-support.md) for details.

### How are reading streaks calculated?

- Reading on consecutive days increases streak
- Missing a day breaks the streak
- Streak Freeze: Save your streak once per week
- Calculated from `reading_sessions` table

See `src/utils/streakCalculation.ts` for implementation.

### How does the reading timer work?

- Timer runs in browser/app
- State persists to localStorage
- On native apps, shows background notification
- Automatically creates reading session when stopped
- Prompts for journal entry after 5+ minutes

See `src/contexts/TimerContext.tsx` for implementation.

### Can users share books with friends?

Yes! Features:
- Share book details via native share sheet
- Share reading stats
- Share reviews and quotes
- Deep links for direct navigation

### How do push notifications work?

- Uses Firebase Cloud Messaging (FCM)
- Tokens stored in `push_tokens` table
- Sent via `send-push-notification` Edge Function
- User preferences in `notification_preferences` table

## Mobile

### Do mobile features work in web browser?

Most features have web fallbacks:

| Feature | Web Support |
|---------|-------------|
| Camera | Yes (getUserMedia API) |
| Photo Library | Yes (file input) |
| Barcode Scanning | Yes (with camera access) |
| Push Notifications | Limited (Web Push API) |
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
npx cap sync
```

## Database

### How do I reset the database?

**⚠️ Warning**: This deletes all data!

```bash
npx supabase db reset
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
- Camera (for barcode/cover scanning)
- Photo Library (for cover images)
- Notifications (for push notifications)
- Network (for online functionality)

**Android**:
- Camera
- Read External Storage
- Internet
- Notifications
- Wake Lock (for background timer)

All permissions are requested only when needed.

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
2. Verify all plugins are synced: `npx cap sync`
3. Check Info.plist/AndroidManifest.xml for missing permissions
4. Clean and rebuild

### Data not syncing

1. Check network connection
2. Verify Supabase URL and keys
3. Check browser console for errors
4. Look at offline queue: `offlineQueue.getQueue()`

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
2. Update `capacitor.config.ts` with your app ID
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
