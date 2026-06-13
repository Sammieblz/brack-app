# Deployment Guide

How to deploy Brack to production environments.

## Web Deployment

### Build for Production

```bash
npm run build
```

This runs `@brack/client#build` through Turborepo and creates an optimized production build in `apps/client/dist`.

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
  "outputDirectory": "apps/client/dist",
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
  publish = "apps/client/dist"

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
   - Build output: `apps/client/dist`
5. **Set environment variables**
6. **Deploy**

### Progressive Web App (PWA)

The app is automatically configured as a PWA:

- ✅ Service worker registered
- ✅ Offline support
- ✅ Install prompt
- ✅ App manifest
- ✅ Icons (192x192, 512x512)

**Configuration**: `apps/client/vite.config.ts` - VitePWA plugin

## Mobile Deployment

### iOS (App Store)

#### 1. Prepare Build

```bash
# Build web assets and sync to iOS
npm run cap:sync:ios

# Open Xcode
npm run cap:open:ios
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
# Build web assets and sync to Android
npm run cap:sync:android

# Open Android Studio
npm run cap:open:android
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

## Desktop Deployment

Desktop packaging uses Electron and `electron-builder`. The first release path builds unsigned internal artifacts for manual QA.

```bash
npm run desktop:typecheck
npm run desktop:dist:win
npm run desktop:dist:mac
npm run desktop:dist:mac:arm64
npm run desktop:dist:mac:x64
npm run desktop:dist:linux
```

Outputs are written to `release/desktop/`.

Targets:

- Windows 10/11 x64: NSIS installer.
- macOS Apple Silicon: dmg and zip.
- macOS Intel: dmg and zip.
- Linux/Ubuntu x64: AppImage and deb.

Linux `.deb` builds require package maintainer metadata. Brack declares this in `package.json` and `electron-builder.yml`, so CI can create AppImage and deb artifacts without interactive packaging prompts.

Desktop auth requires `brack://auth/callback` and `brack://auth/reset-password` in Supabase Auth redirect URLs. Web auth uses `/auth/callback` and `/auth/reset-password`, so production and local callback/reset URLs should also be listed. If Edge Function CORS is restricted, include `brack-app://brack` in `ALLOWED_ORIGINS`.

Signing, notarization, auto-update, and store/repository publishing are intentionally deferred until the internal artifacts pass QA.

## Supabase Deployment

### Edge Functions

Deploy all functions:

```bash
npx supabase functions deploy --project-ref waftnaqgkcgufzapcihe --use-api
```

Deploy specific function:

```bash
npx supabase functions deploy search-books --project-ref waftnaqgkcgufzapcihe --use-api
```

Function JWT settings are controlled in `supabase/config.toml`. The current intended state is:

- `search-books`: `verify_jwt = false` because it is public book search.
- All other functions: `verify_jwt = true`.

After deployment, verify remote drift with the Supabase dashboard, MCP, or CLI before relying on protected user data. As of June 13, 2026, the direct-message Edge Functions are deployed to project `waftnaqgkcgufzapcihe` and the `modern_direct_messaging` migration has been applied remotely.

Messaging functions that must stay deployed together:

- `conversations-home`
- `conversation-detail`
- `get-or-create-conversation`
- `send-message`
- `mark-conversation-read`
- `toggle-message-reaction`
- `update-conversation-settings`
- `delete-message`
- `search-message-gifs`

If messaging functions return 404, deploy the missing function. If they return 500 after deployment, verify the remote database has `conversation_reads`, `conversation_user_settings`, `message_media`, `message_reactions`, the modern `messages` columns, and the private `message-media` bucket.

`search-books` uses Google Books first and falls back to Open Library when Google returns 403, 429, or 5xx. `GOOGLE_BOOKS_API_KEY` is optional but recommended to reduce upstream quota failures.

The legacy 2025 functions (`get-book-details`, `update-reading-progress`, `daily-summary`) were removed from the remote project on May 5, 2026 after confirming there are no local consumers.

### Environment Secrets

Set production secrets:

```bash
npx supabase secrets set SUPABASE_URL=https://your-project.supabase.co
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
npx supabase secrets set ENVIRONMENT=production
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
ENVIRONMENT=development
```

### Staging

```env
VITE_SUPABASE_URL=https://staging-project.supabase.co
ENVIRONMENT=production
```

### Production

```env
VITE_SUPABASE_URL=https://prod-project.supabase.co
ENVIRONMENT=production
VITE_SENTRY_DSN=your-production-sentry-dsn
```

## CI/CD Pipeline

Brack uses GitHub Actions for continuous integration. The CI pipeline automatically validates code quality and builds on every push to `main` and on pull requests.

### Pipeline Overview

The CI pipeline consists of 6 jobs that run quality checks and validate builds through npm and Turborepo:

1. **Quality Checks** - Turbo-backed ESLint and TypeScript validation
2. **Build Web** - Turbo-backed production client build validation
3. **Validate Android** - Turbo-backed Capacitor Android sync validation
4. **Validate iOS** - Turbo-backed Capacitor iOS sync validation
5. **Build Desktop** - Turbo-backed Electron desktop artifact builds for Windows, Linux, and macOS
6. **Tests** - Test execution (disabled until tests are added)

### Workflow File

The CI pipeline is defined in `.github/workflows/ci.yml`:

**Triggers**:
- Push to `main` branch
- Pull requests targeting `main` branch

### Job Details

#### Quality Checks Job

**Runner**: `ubuntu-latest`

**Steps**:
1. Checkout code
2. Setup Node.js 20 with npm caching
3. Install dependencies (`npm ci`)
4. Run ESLint (`npm run lint`)
5. Run TypeScript type check (`npm run check-types`)

**Purpose**: Catch code quality issues and type errors before merging.

#### Build Web Job

**Runner**: `ubuntu-latest`

**Steps**:
1. Checkout code
2. Setup Node.js 20 with npm caching
3. Install dependencies
4. Build web app (`npm run build`)
5. Validate `apps/client/dist` output exists and contains expected files

**Purpose**: Ensure production build succeeds and generates expected output.

#### Validate Android Job

**Runner**: `ubuntu-latest`

**Dependencies**: Requires `quality-checks` and `build-web` to succeed first

**Steps**:
1. Checkout code
2. Setup Node.js 20
3. Setup Java 17 (required for Android)
4. Cache Gradle dependencies
5. Install npm dependencies
6. Sync Capacitor Android (`npm run cap:sync:android`), which builds `@brack/client` first through Turbo
7. Validate Android project structure
8. Validate Gradle setup

**Purpose**: Ensure Android project can be synced and is properly configured.

#### Validate iOS Job

**Runner**: `macos-latest` (required for iOS builds)

**Dependencies**: Requires `quality-checks` and `build-web` to succeed first

**Steps**:
1. Checkout code
2. Setup Node.js 20
3. Install npm dependencies
4. Sync Capacitor iOS (`npm run cap:sync:ios`), which builds `@brack/client` first through Turbo
5. Cache CocoaPods
6. Install CocoaPods dependencies
7. Validate iOS project structure

**Purpose**: Ensure iOS project can be synced and is properly configured.

**Note**: This job uses macOS runners which are more expensive. Consider making it conditional if cost is a concern.

#### Build Desktop Job

**Runners**: `windows-latest`, `ubuntu-22.04`, `macos-latest`, and `macos-15-intel`

**Dependencies**: Requires `quality-checks` and `build-web` to succeed first

**Steps**:
1. Checkout code
2. Setup Node.js 20
3. Install npm dependencies
4. Typecheck the Electron shell (`npm run desktop:typecheck`)
5. Build unsigned desktop artifacts with the platform-specific and architecture-specific `desktop:dist:*` script
6. Upload `release/desktop/**/*` as GitHub Actions artifacts

**Purpose**: Ensure the desktop shell packages for Windows x64, Linux x64, macOS Apple Silicon, and macOS Intel.

The CI matrix maps each platform to an explicit script:

- Windows x64: `npm run desktop:dist:win`
- Linux x64: `npm run desktop:dist:linux`
- macOS Apple Silicon: `npm run desktop:dist:mac:arm64`
- macOS Intel: `npm run desktop:dist:mac:x64`

#### Tests Job

**Runner**: `ubuntu-latest`

**Status**: Currently disabled (`if: false`) until test framework is added

**Future**: When tests are added (Vitest, Jest, etc.), enable this job to run test suite.

### Caching Strategy

The pipeline uses aggressive caching to speed up builds:

- **npm dependencies**: Cached using `actions/setup-node@v4` with `cache: 'npm'`
- **Turborepo**: Cached using `actions/cache@v4` at `.turbo/cache`
- **Gradle dependencies**: Cached in `~/.gradle/caches` (Android job)
- **CocoaPods**: Cached in `ios/App/Pods` (iOS job)

Dependency cache keys are based on lock/config files (`package-lock.json`, `Podfile.lock`, Gradle files). Turbo cache keys use the runner OS plus the Git SHA with OS-level restore keys.

### Viewing CI Results

1. **GitHub UI**: Go to your repository → Actions tab
2. **Pull Requests**: CI status appears as checks on PRs
3. **Commit Status**: Green checkmark or red X on commits

### Debugging Failed Builds

#### Common Issues

**ESLint Errors**:
```bash
# Fix locally
npm run lint
npm run lint -- --fix  # Auto-fix where possible
```

**TypeScript Errors**:
```bash
# Check types locally
npm run check-types
```

**Build Failures**:
```bash
# Test build locally
npm run build
```

**Android Sync Failures**:
```bash
# Test locally
npm run cap:sync:android
```

**iOS Sync Failures**:
```bash
# Test locally (macOS only)
npm run cap:sync:ios
```

#### Viewing Logs

1. Go to Actions tab in GitHub
2. Click on the failed workflow run
3. Click on the failed job
4. Expand failed step to see error logs

### Adding New Checks

To add new quality checks to the pipeline:

1. **Add to existing job** (if quick check):
   ```yaml
   - name: New Check
     run: npm run new-check
   ```

2. **Create new job** (if separate concern):
   ```yaml
   new-check:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
       - uses: actions/setup-node@v4
         with:
           node-version: '18'
       - run: npm ci
       - run: npm run new-check
   ```

### Performance Optimization

The pipeline is optimized for speed:

- **Parallel execution**: Quality checks and web build run simultaneously
- **Job dependencies**: Mobile validations only run after web build succeeds
- **Caching**: Dependencies cached between runs
- **Fast failure**: Jobs fail immediately on errors

### Cost Considerations

- **Ubuntu runners**: Free for public repos, 2000 minutes/month for private
- **macOS runners**: 10x more expensive, use only when necessary (iOS validation)
- **Optimization**: Consider making iOS validation conditional (only on main branch)

### Future Enhancements

Potential additions to the CI pipeline:

1. **Bundle size analysis**: Check bundle size on PRs
2. **Code coverage**: Report test coverage when tests are added
3. **Security scanning**: Dependabot or Snyk integration
4. **Signed desktop releases**: Add Apple notarization and Windows signing secrets after unsigned QA passes
5. **Deployment jobs**: Auto-deploy to staging/production
6. **Matrix testing**: Test against multiple Node.js versions

### Deployment Workflow (Future)

For actual deployments, create a separate workflow (e.g., `.github/workflows/deploy.yml`):

```yaml
name: Deploy

on:
  push:
    branches: [main]
    tags:
      - 'v*'

jobs:
  deploy-web:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: npm run deploy  # Configure based on hosting

  deploy-functions:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: npx supabase functions deploy --project-ref waftnaqgkcgufzapcihe --use-api
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

## Monitoring

### Sentry Setup

1. Create Sentry project at [sentry.io](https://sentry.io)
2. Get DSN from project settings
3. Add to environment variables:
   ```env
   VITE_SENTRY_DSN=https://...@sentry.io/...
   ```
4. Errors automatically tracked (configured in `apps/client/src/lib/sentry.ts`)

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
rm -rf node_modules package-lock.json apps/client/dist apps/desktop/dist .turbo
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
npm run cap:sync:ios
```

**Android**:
```bash
cd android
./gradlew clean
cd ..
npm run cap:sync:android
```

### Function Deployment Fails

```bash
# Check function syntax
npx supabase functions serve function-name

# Check secrets are set
npx supabase secrets list

# Re-deploy
npx supabase functions deploy function-name --project-ref waftnaqgkcgufzapcihe --use-api
```

## Further Reading

- [Getting Started](./getting-started.md)
- [Troubleshooting](./troubleshooting.md)
- [Mobile Features](./mobile-features.md)
- [API Reference](./api-reference.md)
