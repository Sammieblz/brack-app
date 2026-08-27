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

#### Staging

The repository now deploys the `test` branch to the dedicated Direct Upload
project `brack-app-staging` through the protected GitHub `Stage` environment.
GitHub performs the build, so Cloudflare dashboard build variables and Git
integration are intentionally not used for this project. See
[Staging Web Deployment](./staging-deployment.md) for the one-time Cloudflare,
GitHub, Supabase Auth, Turnstile, custom-domain, and verification steps.

The staging workflow is web-only and rejects Brack's production Supabase
project. It does not change production DNS, Auth Site URL, Edge Function
secrets, native deep links, database migrations, or Auth email templates.

#### Production

**Cutover status (2026-08-25):** Cloudflare is authoritative for
`brack-app.com` and the mail records exist, but the apex has no web A/AAAA/CNAME
answer and `www` is not configured. Hosted Supabase Auth therefore remains on
the previous Site URL. Complete and verify the following steps before changing
Auth, `PUBLIC_APP_URL`, or production CORS secrets; replace this status note when
the cutover is complete.

1. **Login to Cloudflare Dashboard**
2. **Create new Pages project**
3. **Connect GitHub repository**
4. **Configure build**:
   - Build command: `npm run build`
   - Build output: `apps/client/dist`
5. **Set environment variables**
   - Set `VITE_TURNSTILE_SITE_KEY` to the existing production widget's sitekey. It is a browser-visible identifier; the widget secret stays only in Supabase Auth.
6. **Deploy and connect `brack-app.com` as the production custom domain**
7. **Verify production routes before changing Auth**:
   - `https://brack-app.com/` resolves over HTTPS.
   - `/auth/callback` and `/auth/reset-password` return the SPA rather than a hosting 404.
   - `/turnstile.html` returns the dedicated challenge bridge with `Cache-Control: no-store` and the scoped `frame-ancestors` policy from `apps/client/public/_headers`.
   - The bridge policy includes only Brack's packaged origins and the fixed Vite loopback origins. Test `localhost:8080` after every bridge/CSP change; LAN-IP origins require an explicit security review and Cloudflare hostname configuration.
   - `www.brack-app.com` either redirects once to the canonical apex or is not advertised.
8. **Enable the free security baseline**:
   - SSL/TLS mode **Full (strict)**, Always Use HTTPS, TLS 1.3, and a minimum of TLS 1.2.
   - Cloudflare Free Managed Ruleset and DNSSEC.
   - Add HSTS only after every in-use hostname works permanently over HTTPS.

Cloudflare should serve the web client, not proxy Supabase Auth. Authentication
requests continue directly to the configured Supabase project. Do not add a
cache-everything rule for auth routes, and make `/auth/callback` and
`/auth/reset-password` non-cacheable if custom Pages cache rules are introduced.
Turnstile is integrated at each password-based Auth form and verified by
Supabase CAPTCHA protection. Challenging the static `/auth` route or adding a
generic Cloudflare interstitial does not protect direct Auth API calls. Keep
`/turnstile.html` out of service-worker and edge caches; packaged mobile and
desktop releases and fixed local Vite origins depend on that canonical HTTPS
bridge. Deploy the bridge and `_headers` before expecting the local client
change to work. Cloudflare error `110200` is a hostname-authorization failure,
not evidence that the configured sitekey text is malformed.

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
   - Keep the registered bundle identifier `com.brack.app`
   - Enable automatic signing

2. **Capabilities**:
   - Push Notifications
   - Background Modes → Remote notifications
   - Associated Domains with `applinks:brack-app.com`

3. **Info.plist**:
   - Verify all permission descriptions
   - Add deep link URL types
   - Configure Firebase (GoogleService-Info.plist)

The production site must serve an extensionless
`/.well-known/apple-app-site-association` file over HTTPS with status 200, JSON
content type, no authentication, and no redirect. Populate it with the real
Apple Team ID and `com.brack.app`; never commit a guessed Team ID. Keep the
`brack://` custom URL scheme as a desktop/mobile fallback.

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

3. **App Links**:
   - Keep the registered application ID `com.brack.app`.
   - Keep `android:autoVerify="true"` on the `https://brack-app.com` intent filter.
   - Serve `/.well-known/assetlinks.json` over HTTPS with status 200 and no redirect.
   - Use the real Play App Signing/release certificate SHA-256 fingerprint; never commit a placeholder or a debug fingerprint for production verification.

4. **Version**:
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

Desktop auth requires `brack://auth/callback` and `brack://auth/reset-password`
in Supabase Auth redirect URLs. Web auth uses the exact
`https://brack-app.com/auth/callback` and
`https://brack-app.com/auth/reset-password` URLs. If Edge Function CORS is
restricted, include the packaged renderer origin `brack-app://brack`.

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

- `auth-email-availability`: retained legacy endpoint with `verify_jwt = false`.
  It is not on the active signup path. Keep its existing rate limits and
  service-role-only RPC grants intact while older clients or rollback support
  remain in scope.
- `search-books`, `feature-flags`, and `core-telemetry`: `verify_jwt = false` for
  their bounded public contracts.
- `gamification-worker`: `verify_jwt = false`, protected by its private worker
  secret rather than a user JWT.
- All remaining functions: `verify_jwt = true`.

The active email/password signup path has no Edge Function prerequisite. Deploy
the client and verify that one form submission produces one Supabase `signUp`
request, maps explicit/obfuscated duplicate responses to the reader-facing
error, and creates at most one Auth user/profile. Do not redeploy
`auth-email-availability` as a signup dependency. Retire that endpoint and
`public.auth_email_exists(text)` only in a later release/migration after
supported-client telemetry confirms no calls remain.

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

`search-books` uses Google Books first and falls back to Open Library when Google fails, times out, or returns no usable books. `GOOGLE_BOOKS_API_KEY` is optional but recommended to reduce upstream quota failures. ISBN lookups are cached in `book_metadata_cache` for 7 days; non-ISBN searches are cached for 1 day.

The legacy 2025 functions (`get-book-details`, `update-reading-progress`, `daily-summary`) were removed from the remote project on May 5, 2026 after confirming there are no local consumers.

### Environment Secrets

The commands below describe the post-cutover production target. Do not apply the
`PUBLIC_APP_URL` or canonical-domain `ALLOWED_ORIGINS` values until
`https://brack-app.com` and both Auth routes pass the verification steps above;
until then, preserve the currently working production origin values.

Set production secrets at the appropriate release stage:

```bash
npx supabase secrets set SUPABASE_URL=https://your-project.supabase.co
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
npx supabase secrets set ENVIRONMENT=production
npx supabase secrets set GOOGLE_BOOKS_API_KEY=your-key
npx supabase secrets set FCM_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
npx supabase secrets set GAMIFICATION_WORKER_SECRET=your-random-worker-secret
npx supabase secrets set PUBLIC_APP_URL=https://brack-app.com
npx supabase secrets set ALLOWED_ORIGINS=https://brack-app.com,https://localhost,capacitor://localhost,brack-app://brack
```

`https://localhost` is the configured Android Capacitor WebView origin;
`capacitor://localhost` is the iOS WebView origin. Add local HTTP development
origins to production only when developers intentionally use the production
backend. CORS is a browser boundary, not authorization; authenticated functions
must continue validating JWTs and user ownership server-side.

List secrets:

```bash
npx supabase secrets list
```

### Database Migrations

Database migrations deploy only through
`.github/workflows/deploy-database.yml`. The workflow performs a clean replay,
pgTAP tests, database lint, remote-history preflight, dry-run, serialized push,
read-only production contracts, and a post-deployment schema comparison. It
requires approval through the protected GitHub `production` environment.

```bash
# Local authoring and verification
npm run db:migration:new -- descriptive_name
npm run db:migrations:lock
npx --no-install supabase db reset --local --no-seed
npm run db:schema:lock
node scripts/verify-migration-integrity.mjs --base-ref origin/main
```

Do not run `supabase db push`, `migration repair`, or linked resets manually in
normal operation. See [Database Migration Integrity](./database-migrations.md)
for the production controls and incident-recovery procedure.

## Environment-Specific Configuration

### Development

```env
VITE_SUPABASE_URL=https://dev-project.supabase.co
ENVIRONMENT=development
```

### Staging

```env
VITE_SUPABASE_URL=https://your-dedicated-staging-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-staging-publishable-key
VITE_TURNSTILE_SITE_KEY=your-browser-visible-widget-sitekey
ENVIRONMENT=production
```

The protected `Stage` GitHub environment supplies these values to
`.github/workflows/deploy-staging.yml`. The workflow refuses the production
Supabase project and applies a staging-only noindex policy to the generated
bundle. See [Staging Web Deployment](./staging-deployment.md).

### Production

```env
VITE_SUPABASE_URL=https://prod-project.supabase.co
ENVIRONMENT=production
VITE_SENTRY_DSN=your-production-sentry-dsn
```

## CI/CD Pipeline

Brack uses GitHub Actions for continuous integration. The full CI pipeline
validates pushes to `main` and pull requests targeting `main` or `test`.
Approved pushes to `test` also run the staging workflow's release checks before
deployment.

### Pipeline Overview

The CI pipeline consists of 6 jobs that run quality checks and validate builds through npm and Turborepo:

1. **Quality Checks** - Turbo-backed ESLint and TypeScript validation
2. **Build Web** - Turbo-backed production client build validation
3. **Validate Android** - Turbo-backed Capacitor Android sync validation
4. **Validate iOS** - Turbo-backed Capacitor iOS sync validation
5. **Build Desktop** - Turbo-backed Electron desktop artifact builds for Windows, Linux, and macOS
6. **Tests** - Vitest plus Chromium smoke, onboarding responsive, and optional authenticated offline checks

### Workflow File

The CI pipeline is defined in `.github/workflows/ci.yml`:

**Triggers**:
- Push to `main` branch
- Pull requests targeting `main` or `test`

CI browser builds always receive complete public runtime configuration. The
Turnstile value is Cloudflare's documented test sitekey. Supabase uses the
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` repository variables
when configured; otherwise CI falls back to a non-secret loopback URL and dummy
publishable key for signed-out smoke tests. The fallback does not contact a
database and must not be used for a deployment. Production and staging builds
must provide their own public Supabase values. Vite now fails the build early if
either required Supabase value is absent, instead of producing a bundle that
crashes before React mounts.

### Job Details

#### Quality Checks Job

**Runner**: `ubuntu-latest`

**Steps**:
1. Checkout code
2. Setup Node.js 22 with npm caching
3. Install dependencies (`npm ci`)
4. Run ESLint (`npm run lint`)
5. Run TypeScript type check (`npm run check-types`)

**Purpose**: Catch code quality issues and type errors before merging.

#### Build Web Job

**Runner**: `ubuntu-latest`

**Steps**:
1. Checkout code
2. Setup Node.js 22 with npm caching
3. Install dependencies
4. Build web app (`npm run build`)
5. Validate `apps/client/dist` output exists and contains expected files

**Purpose**: Ensure production build succeeds and generates expected output.

#### Validate Android Job

**Runner**: `ubuntu-latest`

**Dependencies**: Requires `quality-checks` and `build-web` to succeed first

**Steps**:
1. Checkout code
2. Setup Node.js 22
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
2. Setup Node.js 22
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
2. Setup Node.js 22
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

**Steps**:
1. Install dependencies from a clean checkout
2. Run the Vitest suite
3. Produce a fresh production client build
4. Install Playwright Chromium
5. Run the public-shell and responsive onboarding smoke tests
6. Run the authenticated offline-reload test when `E2E_EMAIL` and
   `E2E_PASSWORD` are configured

Store those optional credentials as GitHub Actions secrets and point the two
public Supabase repository variables at the matching non-production project.
Without both secrets, Playwright intentionally skips the authenticated case.

The public-shell assertion requires a known Brack heading and a non-empty React
root, and fails on uncaught page errors. A visible but empty HTML body is not
considered a successful application boot.

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
           node-version: '22'
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
5. **Production web deployment**: add a protected `main` release only after the Cloudflare cutover checklist passes
6. **Matrix testing**: Test against multiple Node.js versions

### Staging Deployment Workflow

`.github/workflows/deploy-staging.yml` deploys only `refs/heads/test` to the
hard-coded `brack-app-staging` Pages project. Validation runs without Stage
secrets; the publish job then enters the protected `Stage` environment, builds
with its public runtime configuration, verifies Auth/PWA artifacts, prevents
indexing, and publishes with immutable action and Wrangler versions.

The workflow performs a Direct Upload. Do not enable Cloudflare Git integration
for the same Pages project. Production web deployment remains a separate future
cutover, and production database releases continue exclusively through the
protected migration workflow.

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
