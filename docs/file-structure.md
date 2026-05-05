# File Structure

Complete guide to the Brack project organization.

## Root Directory

```
brack-app/
├── android/              # Android native project (Capacitor)
├── ios/                  # iOS native project (Capacitor)
├── dist/                 # Production build output
├── docs/                 # 📚 Documentation (you are here)
├── LLM/                  # AI agent implementation guides
├── node_modules/         # Dependencies
├── public/               # Static assets
├── resources/            # App icons and splash screens
├── scripts/              # Build and deployment scripts
├── src/                  # 🎯 Main application source
├── supabase/             # Supabase configuration and migrations
├── .env.example          # Environment variables template
├── .gitignore            # Git ignore patterns
├── capacitor.config.ts   # Capacitor configuration
├── components.json       # shadcn/ui configuration
├── eslint.config.js      # ESLint configuration
├── index.html            # HTML entry point
├── package.json          # Dependencies and scripts
├── postcss.config.js     # PostCSS configuration
├── README.md             # Project readme
├── tailwind.config.ts    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript base config
├── tsconfig.app.json     # TypeScript app config
├── tsconfig.node.json    # TypeScript node config
└── vite.config.ts        # Vite build configuration
```

## Source Directory (`src/`)

### Overview

```
src/
├── components/           # 192 React components
├── contexts/            # React contexts (global state)
├── hooks/               # 59 custom hooks
├── integrations/        # External service integrations
├── lib/                 # Library configurations
├── screens/             # 27 page components
├── services/            # API, local storage, sync, and platform services
├── types/               # TypeScript type definitions
├── utils/               # 9 utility functions
├── App.css              # Global app styles
├── App.tsx              # Root app component
├── index.css            # Global CSS and Tailwind imports
├── main.tsx             # Application entry point
└── vite-env.d.ts        # Vite environment types
```

## Components (`src/components/`)

### Structure

```
components/
├── ui/                  # 54 shadcn/ui base components
│   ├── accordion.tsx
│   ├── alert-dialog.tsx
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── toast.tsx
│   └── ... (46 more)
│
├── charts/              # Data visualization components
│   ├── WeeklyReadingChart.tsx
│   ├── MonthlyProgressChart.tsx
│   ├── GenreDistributionChart.tsx
│   ├── ReadingVelocityChart.tsx
│   ├── GoalProgressChart.tsx
│   ├── StreakTrendChart.tsx
│   ├── ReadingHeatmap.tsx
│   └── YearInReviewChart.tsx
│
├── social/              # Social feature components
│   ├── PostCard.tsx
│   ├── PostList.tsx
│   ├── CreatePostDialog.tsx
│   ├── ReviewCard.tsx
│   ├── ReviewForm.tsx
│   ├── CommentSection.tsx
│   ├── UserCard.tsx
│   ├── FollowButton.tsx
│   └── ActivityItem.tsx
│
├── clubs/               # Book club components
│   ├── BookClubCard.tsx
│   ├── CreateClubDialog.tsx
│   └── DiscussionThread.tsx
│
├── messaging/           # Messaging components
│   ├── ConversationsList.tsx
│   └── MessageThread.tsx
│
├── skeletons/           # Loading state components
│   ├── BookCardSkeleton.tsx
│   ├── DashboardCardSkeleton.tsx
│   ├── PostCardSkeleton.tsx
│   ├── StatCardSkeleton.tsx
│   ├── ActivityItemSkeleton.tsx
│   └── ReviewCardSkeleton.tsx
│
└── [Feature Components]  # Top-level components
    ├── BookCard.tsx              # Book display card
    ├── BookSearch.tsx            # Book search with Google Books
    ├── SwipeableBookCard.tsx     # Swipeable book card
    ├── JournalEntryCard.tsx      # Journal entry display
    ├── JournalEntryDialog.tsx    # Create/edit journal
    ├── QuickJournalEntryDialog.tsx # Quick journal after reading
    ├── JournalPromptHandler.tsx  # Global journal prompt handler
    ├── ProgressLogger.tsx        # Log reading progress
    ├── ProgressLogItem.tsx       # Progress log display
    ├── QuickProgressWidget.tsx   # Quick progress update
    ├── FloatingTimerWidget.tsx   # Reading timer widget
    ├── StreakDisplay.tsx         # Streak counter
    ├── StreakCalendar.tsx        # Activity calendar
    ├── StreakHistoryTimeline.tsx # Streak milestones
    ├── QuoteCollection.tsx       # Quote collection view
    ├── GoalManager.tsx           # Goal creation/editing
    ├── GoalsSheet.tsx            # Goals bottom sheet
    ├── BadgeDisplay.tsx          # Badge showcase
    ├── MobileLayout.tsx          # Mobile page wrapper
    ├── MobileHeader.tsx          # Mobile page header
    ├── MobileBottomNav.tsx       # Bottom navigation
    ├── NativeHeader.tsx          # Native-style header
    ├── NativeScrollView.tsx      # Native scroll container
    ├── NativeSearchBar.tsx       # Native search input
    ├── FloatingActionButton.tsx  # FAB for mobile
    ├── OfflineIndicator.tsx      # Offline status banner
    ├── OptimizedImage.tsx        # Cached image component
    ├── PullToRefresh.tsx         # Pull-to-refresh wrapper
    ├── SwipeBackHandler.tsx      # iOS-style swipe back
    ├── DeepLinkHandler.tsx       # Deep link initialization
    ├── ErrorBoundary.tsx         # Error boundary
    ├── LoadingSpinner.tsx        # Loading indicator
    ├── Header.tsx                # Desktop header
    ├── Navbar.tsx                # Desktop navigation
    └── ... (and more)
```

### Naming Conventions

- **PascalCase** for all components
- **Descriptive names** (e.g., `QuickJournalEntryDialog` not `Dialog2`)
- **Suffix patterns**:
  - `*Card` - Display cards
  - `*Dialog` - Modal dialogs
  - `*Sheet` - Bottom sheets
  - `*Form` - Form components
  - `*List` - List components
  - `*Skeleton` - Loading skeletons
  - `*Widget` - Interactive widgets

## Screens (`src/screens/`)

Page-level components for routing.

```
screens/
├── Index.tsx              # Landing page (redirects to auth or dashboard)
├── Auth.tsx               # Login/signup
├── Welcome.tsx            # Onboarding welcome
├── Questionnaire.tsx      # Onboarding questionnaire
├── Goals.tsx              # Onboarding goals
├── Dashboard.tsx          # Main dashboard (home)
├── MyBooks.tsx            # Book library
├── AddBook.tsx            # Add new book
├── EditBook.tsx           # Edit book details
├── BookDetail.tsx         # Book detail page
├── ScanBarcode.tsx        # Barcode scanner
├── ScanCover.tsx          # Book cover scanner
├── ProgressTracking.tsx   # Detailed progress analytics
├── ReadingHistory.tsx     # Reading sessions history
├── Analytics.tsx          # Reading analytics
├── Profile.tsx            # User profile
├── UserProfile.tsx        # Other user's profile
├── BookLists.tsx          # Book lists overview
├── BookListDetail.tsx     # Single list detail
├── GoalsManagement.tsx    # Manage goals
├── Reviews.tsx            # Book reviews feed
├── Feed.tsx               # Social feed
├── Readers.tsx            # Reader discovery
├── BookClubs.tsx          # Book clubs list
├── BookClubDetail.tsx     # Single club detail
├── Messages.tsx           # Direct messages
└── NotFound.tsx           # 404 page
```

### Screen Patterns

All screens follow this structure:

```tsx
const ScreenName = () => {
  // 1. Hooks
  const { user } = useAuth();
  const { data, loading } = useData();
  
  // 2. Effects
  useEffect(() => { /* ... */ }, []);
  
  // 3. Handlers
  const handleAction = () => { /* ... */ };
  
  // 4. Loading state
  if (loading) return <Skeleton />;
  
  // 5. Render
  return (
    <MobileLayout>
      {/* Content */}
    </MobileLayout>
  );
};
```

## Hooks (`src/hooks/`)

Custom React hooks for business logic.

```
hooks/
├── use-mobile.tsx            # Mobile breakpoint detection
├── use-toast.ts              # Toast notifications
├── useAuth.ts                # Authentication
├── useBooks.ts               # Book data with caching
├── useBookProgress.ts        # Book progress analytics
├── useProgressLogs.ts        # Progress log history
├── useProgressTracking.ts    # Progress tracking data
├── useJournalEntries.ts      # Journal entries CRUD
├── useReviews.ts             # Book reviews
├── usePosts.ts               # Social posts
├── useGoals.ts               # Reading goals
├── useStreaks.ts             # Reading streaks
├── useStreakHistory.ts       # Streak milestones
├── useBadges.ts              # Badge system
├── useBookClubs.ts           # Book clubs
├── useClubDiscussions.ts     # Club discussions
├── useMessages.ts            # Direct messages
├── useConversations.ts       # Message conversations
├── useBookLists.ts           # Book lists
├── useListBooks.ts           # Books in a list
├── useFollowing.ts           # Follow/unfollow
├── useSocialFeed.ts          # Social feed
├── useRecentActivity.ts      # Activity feed
├── useEnhancedActivity.ts    # Enhanced activity
├── useUserProfile.ts         # User profile data
├── useUserSearch.ts          # Search users
├── useChartData.ts           # Chart data
├── useMonthlyStats.ts        # Monthly statistics
├── useRecentSearches.ts      # Search history
├── useVirtualBooks.ts        # Virtual scrolling for books
├── useInfiniteScroll.ts      # Infinite scroll helper
├── useBarcodeScanner.ts      # Barcode scanning
├── useCoverScanner.ts        # Cover OCR scanning
├── useImagePicker.ts         # Image selection
├── useHapticFeedback.ts      # Haptic feedback
├── useNetworkStatus.ts       # Online/offline detection
├── usePushNotifications.ts   # Push notifications
├── usePlatform.ts            # Platform detection
├── useNativeApp.ts           # Native app detection
├── useScrollDirection.ts     # Scroll direction
├── usePullToDismiss.ts       # Pull to dismiss
├── useSwipeBack.ts           # Swipe back gesture
├── useLongPress.ts           # Long press gesture
├── useTypingIndicator.ts     # Typing indicator
├── useSupabaseRequest.ts     # Supabase request wrapper
├── useCreatePost.ts          # Create social post
└── usePostComments.ts        # Post comments
```

### Hook Categories

**Data Fetching**: Use TanStack Query for caching
**Gestures**: Platform-specific interactions
**Platform**: Native capabilities
**UI State**: Component state management

## Services (`src/services/`)

Business logic and external integrations.

```
services/
├── api/                   # Backend API service modules
├── local/                 # IndexedDB/SQLite local repositories
├── sync/                  # Reading-core sync engine and types
├── syncService.ts         # Background sync facade
├── timerNative.ts         # Native timer notifications/app state
├── badgeNotifications.ts  # Badge push orchestration
├── deepLinkService.ts     # Deep link handling
├── pushNotifications.ts   # Push notification management
├── shareService.ts        # Native sharing
├── dataCache.ts           # Data caching with TTL
└── imageCache.ts          # Image caching (Filesystem)
```

### Service Pattern

```typescript
class ServiceName {
  // Private state
  private data: any[] = [];
  
  // Public methods
  public async fetch() { /* ... */ }
  public async update() { /* ... */ }
  
  // Listeners
  subscribe(listener: () => void) { /* ... */ }
}

export const serviceName = new ServiceName();
```

## Utils (`src/utils/`)

Pure utility functions.

```
utils/
├── index.ts              # Exports and common utilities
├── offlineOperation.ts   # Offline operation wrappers
├── ocrHelpers.ts         # OCR image processing
├── streakCalculation.ts  # Streak logic
├── bookProgress.ts       # Progress calculations
├── bookStatus.ts         # Auto-update book status
├── batchOperations.ts    # Batch, debounce, throttle
├── hapticToast.ts        # Toast with haptics
└── sanitize.ts           # Input sanitization
```

## Contexts (`src/contexts/`)

React Context providers for global state.

```
contexts/
├── ProfileContext.tsx        # User profile
├── TimerContext.tsx          # Reading timer (complex)
├── ThemeContext.tsx          # Theme mode
└── ConfirmDialogContext.tsx  # Confirmation dialogs
```

## Types (`src/types/`)

TypeScript type definitions.

```
types/
├── index.ts          # Core types (User, Book, etc.)
└── googleBooks.ts    # Google Books API types
```

## Integrations (`src/integrations/`)

External service integrations.

```
integrations/
└── supabase/
    ├── client.ts     # Supabase client instance
    └── types.ts      # Generated database types
```

## Library Configurations (`src/lib/`)

Third-party library setup.

```
lib/
├── sentry.ts         # Error tracking
└── utils.ts          # Class name utilities (cn)
```

## Supabase Directory (`supabase/`)

Backend configuration and code.

```
supabase/
├── config.toml                # Supabase CLI configuration
├── migrations/                # Database migrations (53 files)
│   ├── 20250731180820_...sql # Enable RLS
│   ├── 20260109044500_...sql # Add push tokens
│   ├── 20260109044600_...sql # Add notification prefs
│   ├── 20260204013937_...sql # Fix relationships
│   ├── 20260204020000_...sql # Add journal photos
│   └── ... (42 more)
│
└── functions/                 # Edge Functions (Deno)
    ├── _shared/              # Shared utilities
    │   ├── cors.ts
    │   ├── errorHandler.ts
    │   ├── rateLimit.ts
    │   └── validation.ts
    │
    ├── add-book/             # Protected library insert + duplicate handling
    ├── search-books/         # Public Google Books search
    ├── dashboard-home/       # Dashboard aggregate data
    ├── complete-reading/     # Consolidated reading completion transaction
    ├── create-reading-session/ # Timer session persistence
    ├── award-badges/         # Badge awarding
    ├── compute-analytics/    # Daily analytics snapshots
    ├── sync-pull/            # Pull reading-core sync changes
    ├── sync-push/            # Push reading-core outbox mutations
    ├── discover-readers/     # Reader recommendations
    ├── enhanced-activity/    # Activity feed
    ├── log-progress/         # Progress logging
    ├── monthly-stats/        # Statistics
    ├── social-feed/          # Social feed
    ├── send-push-notification/ # FCM integration
    └── calculate-book-progress/ # Progress analytics
```

## Native Directories

### Android (`android/`)

```
android/
├── app/
│   ├── src/main/
│   │   ├── java/              # Java/Kotlin code
│   │   ├── res/               # Android resources
│   │   └── AndroidManifest.xml # App manifest
│   ├── build.gradle
│   └── google-services.json   # Firebase config
├── build.gradle
└── gradle/                    # Gradle wrapper
```

### iOS (`ios/`)

```
ios/
└── App/
    ├── App/
    │   ├── Info.plist         # iOS configuration
    │   ├── Assets.xcassets/   # App icons/images
    │   └── GoogleService-Info.plist # Firebase config
    └── App.xcodeproj/         # Xcode project
```

## Documentation (`docs/`)

Developer documentation (this directory).

```
docs/
├── README.md              # Documentation index
├── analytics/             # Analytics and KPI strategy
│   ├── in-product-analytics.md
│   ├── kpis.md
│   └── snapshot-strategy.md
├── backlog.md             # Sprint backlog and ticket status ledger
├── getting-started.md     # Setup guide
├── tech-stack.md          # Technologies used
├── architecture.md        # System architecture
├── architecture/          # Domain ownership docs
│   ├── domain-map.md
│   ├── frontend-service-boundaries.md
│   └── mobile-device-boundaries.md
├── backend/               # Edge Function catalogs
│   └── edge-functions.md
├── clubs/                 # Club policy docs
│   └── roles-and-permissions.md
├── data/                  # Data model reviews and migration plans
│   ├── books-schema-review.md
│   └── books-user-books-migration-plan.md
├── file-structure.md      # This file
├── database-schema.md     # Database design
├── performance/           # Query/index/read-model audits
│   ├── dashboard-query-audit.md
│   ├── dashboard-read-model.md
│   ├── index-audit.md
│   └── scale-readiness.md
├── operations/            # Runtime monitoring and alerting
│   └── observability.md
├── messaging/             # Messaging permission docs
│   ├── conversation-summary.md
│   └── permissions-audit.md
├── product/               # Product rules and UX audits
│   ├── progress-model.md
│   ├── reading-loop-friction-audit.md
│   ├── streak-rules.md
│   └── must-win-screens.md
├── reading/               # Reading workflow audits
│   ├── completion-transaction.md
│   └── write-path-audit.md
├── schema/                # Public schema audit catalogs
│   ├── table-catalog.md
│   └── functions-and-triggers.md
├── security/              # Security audit docs
│   ├── onboarding-auth-audit.md
│   ├── visibility-semantics.md
│   └── rls-matrix.md
├── social/                # Social feed/activity docs
│   ├── activity-generation-audit.md
│   ├── activity-types.md
│   └── feed-policy.md
├── api-reference.md       # Edge Functions
├── mobile-features.md     # Native features
├── troubleshooting.md     # Common issues
└── ... (more docs)
```

## Best Practices

### File Naming

- **Components**: `PascalCase.tsx`
- **Hooks**: `useCamelCase.ts`
- **Services**: `camelCase.ts`
- **Utils**: `camelCase.ts`
- **Types**: `camelCase.ts`

### File Size

- **Components**: < 300 lines (split if larger)
- **Hooks**: < 150 lines
- **Services**: < 200 lines
- **Utils**: Single responsibility

### Imports

Order imports in this sequence:

```typescript
// 1. External libraries
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Internal components
import { Button } from '@/components/ui/button';
import { BookCard } from '@/components/BookCard';

// 3. Hooks
import { useAuth } from '@/hooks/useAuth';

// 4. Services/Utils
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/utils';

// 5. Types
import type { Book } from '@/types';
```

### Path Aliases

Configure in `tsconfig.json`:

```json
{
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

Usage:
```typescript
import { Button } from '@/components/ui/button';
// Instead of: import { Button } from '../../../../components/ui/button';
```

## Finding Files

### By Feature

- **Books**: `src/screens/MyBooks.tsx`, `src/hooks/useBooks.ts`, `src/components/BookCard.tsx`
- **Social**: `src/screens/Feed.tsx`, `src/hooks/usePosts.ts`, `src/components/social/`
- **Analytics**: `src/screens/Analytics.tsx`, `src/hooks/useChartData.ts`, `src/components/charts/`

### By Type

- **All components**: `src/components/**/*.tsx`
- **All hooks**: `src/hooks/*.ts`
- **All screens**: `src/screens/*.tsx`
- **All services**: `src/services/*.ts`

### Common Patterns

- **Feature hooks**: `use{FeatureName}.ts`
- **Feature components**: `{FeatureName}Card.tsx`, `{FeatureName}List.tsx`
- **Feature screens**: `{FeatureName}.tsx`, `{FeatureName}Detail.tsx`

## Further Reading

- [Architecture Overview](./architecture.md)
- [Component Library](./components.md)
- [Database Schema](./database-schema.md)
- [Getting Started](./getting-started.md)
