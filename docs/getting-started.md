# Getting Started

This guide will help you set up Brack for local development.

## Prerequisites

### Required Software

- **Node.js** 18+ and npm
- **Git**
- **Supabase Account** (free tier works)

### For Mobile Development (Optional)

- **iOS Development**
  - macOS computer
  - Xcode 14+
  - CocoaPods
  
- **Android Development**
  - Android Studio
  - Android SDK (API 24+)
  - Java JDK 17+

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd brack-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Required
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PROJECT_ID=your-project-id
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Optional
GOOGLE_BOOKS_API_KEY=your-google-books-api-key
VITE_SENTRY_DSN=your-sentry-dsn

# For Edge Functions
ALLOWED_ORIGINS=http://localhost:8080,https://yourdomain.com
DENO_ENV=development
FCM_SERVER_KEY=your-fcm-server-key
```

### 4. Set Up Supabase

#### Option A: Use Existing Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Copy your project URL and anon key to `.env`
4. Run migrations:

```bash
npx supabase link --project-ref your-project-id
npx supabase db push
```

#### Option B: Local Supabase (Development)

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase
npx supabase start

# Apply migrations
npx supabase db reset
```

### 5. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:8080`

## Mobile Development Setup

### iOS Setup

1. Install CocoaPods:
```bash
sudo gem install cocoapods
```

2. Build and sync:
```bash
npm run build
npx cap sync ios
```

3. Open in Xcode:
```bash
npx cap open ios
```

4. Configure signing in Xcode:
   - Select your team in "Signing & Capabilities"
   - Change bundle identifier if needed

5. Run on simulator or device from Xcode

### Android Setup

1. Install Android Studio
2. Install Android SDK (API 24+)

3. Build and sync:
```bash
npm run build
npx cap sync android
```

4. Open in Android Studio:
```bash
npx cap open android
```

5. Add `google-services.json` for Firebase (push notifications):
   - Download from Firebase Console
   - Place in `android/app/google-services.json`

6. Run on emulator or device from Android Studio

## Database Setup

### Running Migrations

All migrations in `supabase/migrations/` will be applied automatically when you run:

```bash
npx supabase db push
```

### Seeding Data (Optional)

Create a seed file for test data:

```bash
# Create seed file
echo "-- Seed data" > supabase/seed.sql

# Run seed
npx supabase db reset --seed
```

## Firebase Setup (Push Notifications)

### Android (FCM)

1. Create Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Add Android app to Firebase project
3. Download `google-services.json`
4. Place in `android/app/google-services.json`
5. Get Server Key from Firebase Console → Project Settings → Cloud Messaging
6. Add to `.env` as `FCM_SERVER_KEY`

### iOS (APNs via FCM)

1. Add iOS app to Firebase project
2. Upload APNs certificate to Firebase
3. Download `GoogleService-Info.plist`
4. Add to Xcode project
5. Enable Push Notifications capability in Xcode

## Verification

### Check Web App

1. Navigate to `http://localhost:8080`
2. Create an account
3. Add a test book
4. Verify features work

### Check Mobile App

1. Build and run on device/simulator
2. Test native features:
   - Camera/barcode scanning
   - Image picker
   - Share functionality
   - Push notifications (if configured)

## Common Setup Issues

### Port Already in Use

If port 8080 is in use, change it in `vite.config.ts`:

```typescript
server: {
  port: 3000, // Change to any available port
}
```

### Supabase Connection Issues

- Verify URL and keys in `.env`
- Check project is active in Supabase dashboard
- Ensure RLS policies are applied (run migrations)

### Mobile Build Errors

- **iOS**: Run `pod install` in `ios/App` directory
- **Android**: Sync Gradle files in Android Studio
- Clean build folders if needed

## Next Steps

- Read [Architecture Overview](./architecture.md) to understand the system
- Explore [File Structure](./file-structure.md) to navigate the codebase
- Check [Database Schema](./database-schema.md) to understand data model
- Review [Mobile Features](./mobile-features.md) for native capabilities

## Development Workflow

```bash
# 1. Start development server
npm run dev

# 2. Make changes to code
# Files auto-reload with Vite HMR

# 3. Run linter
npm run lint

# 4. Build for production
npm run build

# 5. Sync to mobile (after build)
npx cap sync

# 6. Open native IDE
npx cap open ios
npx cap open android
```

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Production build
npm run build:dev       # Development build
npm run preview         # Preview production build

# Mobile
npm run cap:sync        # Build & sync to native
npm run cap:open:ios    # Open Xcode
npm run cap:open:android # Open Android Studio

# Linting
npm run lint            # Run ESLint

# Supabase
npx supabase start      # Start local Supabase
npx supabase stop       # Stop local Supabase
npx supabase db push    # Apply migrations
npx supabase db reset   # Reset database
npx supabase functions deploy # Deploy Edge Functions
```

## Getting Help

- Check [Troubleshooting Guide](./troubleshooting.md)
- Review [FAQ](./faq.md)
- Search existing issues on GitHub
- Join community discussions
