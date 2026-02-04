# Deployment Guide

How to deploy Brack to production environments.

## Web Deployment

### Build for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Deploy to Vercel

1. **Install Vercel CLI**:
```bash
npm install -g vercel
```

2. **Deploy**:
```bash
vercel
```

3. **Set Environment Variables** in Vercel Dashboard:
```
VITE_SUPABASE_URL
VITE_SUPABASE_PROJECT_ID
VITE_SUPABASE_PUBLISHABLE_KEY
GOOGLE_BOOKS_API_KEY (optional)
VITE_SENTRY_DSN (optional)
```

4. **Configure** `vercel.json` (optional):
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

### Deploy to Netlify

1. **Install Netlify CLI**:
```bash
npm install -g netlify-cli
```

2. **Deploy**:
```bash
netlify deploy --prod
```

3. **Set Environment Variables** in Netlify Dashboard

4. **Configure** `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Deploy to Cloudflare Pages

1. **Login to Cloudflare Dashboard**
2. **Create new Pages project**
3. **Connect GitHub repository**
4. **Configure build**:
   - Build command: `npm run build`
   - Build output: `dist`
5. **Set environment variables**
6. **Deploy**

### Progressive Web App (PWA)

The app is automatically configured as a PWA:

- ✅ Service worker registered
- ✅ Offline support
- ✅ Install prompt
- ✅ App manifest
- ✅ Icons (192x192, 512x512)

**Configuration**: `vite.config.ts` - VitePWA plugin

## Mobile Deployment

### iOS (App Store)

#### 1. Prepare Build

```bash
# Build web assets
npm run build

# Sync to iOS
npx cap sync ios

# Open Xcode
npx cap open ios
```

#### 2. Configure in Xcode

1. **Signing**:
   - Select your team
   - Set bundle identifier (e.g., `com.yourcompany.brack`)
   - Enable automatic signing

2. **Capabilities**:
   - Push Notifications
   - Background Modes → Remote notifications
   - Associated Domains (for deep links)

3. **Info.plist**:
   - Verify all permission descriptions
   - Add deep link URL types
   - Configure Firebase (GoogleService-Info.plist)

4. **Version**:
   - Set version number (e.g., 1.0.0)
   - Set build number (increment for each upload)

#### 3. Build for TestFlight

1. Select "Any iOS Device" as target
2. Product → Archive
3. Distribute App → App Store Connect
4. Upload to TestFlight

#### 4. Submit for Review

1. Go to App Store Connect
2. Create app listing
3. Add screenshots, description, keywords
4. Submit for review

**Resources**:
- [iOS App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [TestFlight Documentation](https://developer.apple.com/testflight/)

### Android (Google Play)

#### 1. Prepare Build

```bash
# Build web assets
npm run build

# Sync to Android
npx cap sync android

# Open Android Studio
npx cap open android
```

#### 2. Configure in Android Studio

1. **Signing**:
   - Generate keystore:
     ```bash
     keytool -genkey -v -keystore brack-release.keystore \
       -alias brack -keyalg RSA -keysize 2048 -validity 10000
     ```
   - Configure in `android/app/build.gradle`:
     ```gradle
     android {
       signingConfigs {
         release {
           storeFile file('brack-release.keystore')
           storePassword 'your-password'
           keyAlias 'brack'
           keyPassword 'your-password'
         }
       }
       buildTypes {
         release {
           signingConfig signingConfigs.release
         }
       }
     }
     ```

2. **Firebase**:
   - Add `google-services.json` to `android/app/`

3. **Version**:
   - Update `versionCode` and `versionName` in `build.gradle`

#### 3. Build Release APK/AAB

```bash
cd android
./gradlew bundleRelease  # For AAB (Play Store)
# or
./gradlew assembleRelease  # For APK

cd ..
```

Output:
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- APK: `android/app/build/outputs/apk/release/app-release.apk`

#### 4. Upload to Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Create app listing
3. Upload AAB to Internal Testing
4. Test, then promote to Production
5. Complete store listing
6. Submit for review

**Resources**:
- [Google Play Guidelines](https://play.google.com/about/developer-content-policy/)
- [Android App Signing](https://developer.android.com/studio/publish/app-signing)

## Supabase Deployment

### Edge Functions

Deploy all functions:

```bash
npx supabase functions deploy
```

Deploy specific function:

```bash
npx supabase functions deploy search-books
```

### Environment Secrets

Set production secrets:

```bash
npx supabase secrets set GOOGLE_BOOKS_API_KEY=your-key
npx supabase secrets set FCM_SERVER_KEY=your-fcm-key
npx supabase secrets set ALLOWED_ORIGINS=https://yourdomain.com
```

List secrets:

```bash
npx supabase secrets list
```

### Database Migrations

Apply to production:

```bash
# Link to production project
npx supabase link --project-ref production-project-id

# Push migrations
npx supabase db push
```

**⚠️ Warning**: Always test migrations on staging first!

## Environment-Specific Configuration

### Development

```env
VITE_SUPABASE_URL=https://dev-project.supabase.co
DENO_ENV=development
```

### Staging

```env
VITE_SUPABASE_URL=https://staging-project.supabase.co
DENO_ENV=production
```

### Production

```env
VITE_SUPABASE_URL=https://prod-project.supabase.co
DENO_ENV=production
VITE_SENTRY_DSN=your-production-sentry-dsn
```

## CI/CD (Optional)

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run build
      - run: npm run deploy  # Configure based on hosting

  deploy-functions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: supabase/setup-cli@v1
      - run: npx supabase functions deploy
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_TOKEN }}
```

## Monitoring

### Sentry Setup

1. Create Sentry project at [sentry.io](https://sentry.io)
2. Get DSN from project settings
3. Add to environment variables:
   ```env
   VITE_SENTRY_DSN=https://...@sentry.io/...
   ```
4. Errors automatically tracked (configured in `src/lib/sentry.ts`)

### Supabase Monitoring

- **Dashboard**: Monitor API usage, database performance
- **Logs**: View Edge Function logs
- **Alerts**: Set up alerts for errors

## Pre-Deployment Checklist

### Code Quality

- [ ] All linting errors fixed (`npm run lint`)
- [ ] No console errors in production build
- [ ] TypeScript compiles without errors
- [ ] All critical paths tested

### Security

- [ ] Environment variables not committed
- [ ] API keys properly secured
- [ ] RLS policies reviewed and tested
- [ ] Input sanitization implemented
- [ ] HTTPS enforced in production

### Performance

- [ ] Bundle size optimized (check `npm run build` output)
- [ ] Images optimized (WebP, compression)
- [ ] Lazy loading implemented
- [ ] Caching configured
- [ ] Database indexes created

### Mobile Specific

- [ ] Tested on physical devices
- [ ] All permissions configured
- [ ] Firebase setup complete
- [ ] App icons and splash screens set
- [ ] Deep linking tested
- [ ] Offline mode tested

### Documentation

- [ ] README updated
- [ ] CHANGELOG updated
- [ ] API documentation current
- [ ] Migration notes added

## Post-Deployment

### Verification

1. **Web**:
   - Visit production URL
   - Test critical flows
   - Check for console errors
   - Verify analytics tracking

2. **Mobile**:
   - Install from TestFlight/Internal Testing
   - Test all native features
   - Check push notifications
   - Verify deep links

### Monitoring

1. **Check Sentry** for errors
2. **Monitor Supabase** dashboard for:
   - API usage
   - Database performance
   - Edge Function errors
3. **User Feedback**: Monitor app store reviews

### Rollback Plan

If issues arise:

1. **Web**: Revert to previous deployment
2. **Mobile**: Can't rollback (users update manually)
   - Fix and release patch version
   - Use feature flags to disable problematic features
3. **Database**: Careful with migrations (can't easily rollback)

## Version Management

### Versioning Scheme

Follow [Semantic Versioning](https://semver.org/):

- **Major** (1.0.0): Breaking changes
- **Minor** (1.1.0): New features (backward compatible)
- **Patch** (1.1.1): Bug fixes

### Updating Versions

**Web** (`package.json`):
```json
{
  "version": "1.0.0"
}
```

**iOS** (Xcode):
- Version: 1.0.0
- Build: 1, 2, 3, ... (increment each upload)

**Android** (`android/app/build.gradle`):
```gradle
android {
  defaultConfig {
    versionCode 1      // Integer, increment each release
    versionName "1.0.0"  // String, user-visible version
  }
}
```

## Troubleshooting Deployment

### Build Fails

```bash
# Clean install
rm -rf node_modules package-lock.json dist
npm install
npm run build
```

### Mobile Build Fails

**iOS**:
```bash
cd ios/App
pod deintegrate
pod install
cd ../..
npx cap sync ios
```

**Android**:
```bash
cd android
./gradlew clean
cd ..
npx cap sync android
```

### Function Deployment Fails

```bash
# Check function syntax
npx supabase functions serve function-name

# Check secrets are set
npx supabase secrets list

# Re-deploy
npx supabase functions deploy function-name
```

## Further Reading

- [Getting Started](./getting-started.md)
- [Troubleshooting](./troubleshooting.md)
- [Mobile Features](./mobile-features.md)
- [API Reference](./api-reference.md)
