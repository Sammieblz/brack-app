# File Structure

Complete guide to the Brack project organization.

## Root Directory

Brack is now an npm-workspace Turborepo. The apps are split by runtime wrapper, but the product still uses one shared React renderer.

```
brack-app/
|-- apps/
|   |-- client/                  # @brack/client: Vite React app
|   |   |-- public/              # Static web/PWA assets
|   |   |-- src/                 # Main renderer source
|   |   |-- dist/                # Web build output
|   |   |-- components.json      # shadcn/ui config
|   |   |-- index.html           # HTML entry
|   |   |-- postcss.config.js    # PostCSS config
|   |   |-- tailwind.config.ts   # Tailwind config
|   |   |-- tsconfig*.json       # Client TypeScript configs
|   |   `-- vite.config.ts       # Vite/PWA config
|   |-- mobile/                  # @brack/mobile: Capacitor wrapper
|   |   |-- capacitor.config.ts  # Points to ../client/dist and root native projects
|   |   `-- package.json
|   `-- desktop/                 # @brack/desktop: Electron shell
|       |-- src/                 # main/preload/SQLite IPC source
|       |-- dist/                # Compiled Electron files
|       |-- package.json
|       `-- tsconfig.json
|-- packages/
|   `-- typescript-config/       # Shared base/client/desktop TS configs
|-- android/                     # Root Android native project (Capacitor)
|-- ios/                         # Root iOS native project (Capacitor)
|-- assets/                      # Source brand assets
|-- docs/                        # Documentation
|-- resources/                   # Desktop/mobile package icons and splash assets
|-- scripts/                     # Repo scripts
|-- supabase/                    # Supabase config, migrations, and Edge Functions
|-- electron-builder.yml         # Desktop package config
|-- eslint.config.js             # Root ESLint config
|-- package.json                 # Root npm workspace scripts
|-- package-lock.json            # Canonical npm lockfile
|-- tsconfig.json                # Root solution TS config
`-- turbo.json                   # Turborepo task graph
```

## Workspace Map

| Workspace | Package | Purpose |
| --- | --- | --- |
| `apps/client` | `@brack/client` | React renderer, web/PWA build, shared app UI/business logic. |
| `apps/mobile` | `@brack/mobile` | Capacitor commands and config for iOS/Android. |
| `apps/desktop` | `@brack/desktop` | Electron main/preload process and native SQLite IPC. |
| `packages/typescript-config` | `@brack/typescript-config` | Shared TypeScript compiler settings. |

See [Monorepo and Turborepo](./monorepo.md) for task graph, cache, and CI behavior.

## Client Source (`apps/client/src/`)

Older docs may still use shorthand such as `src/components/Button.tsx`. In the current repository, that means `apps/client/src/components/Button.tsx`.

```
apps/client/src/
|-- components/          # React components
|-- config/              # App asset/navigation/icon config
|-- constants/           # Shared constants
|-- contexts/            # React contexts
|-- hooks/               # Custom hooks
|-- integrations/        # Supabase client and generated types
|-- lib/                 # Library setup and shared utilities
|-- screens/             # Route-level screens
|-- services/            # API, platform, local storage, and sync services
|-- types/               # TypeScript type definitions
|-- utils/               # Pure helpers
|-- App.css
|-- App.tsx
|-- index.css
|-- main.tsx
`-- vite-env.d.ts
```

## Components (`apps/client/src/components/`)

```
components/
|-- ui/                  # shadcn/ui base components
|-- charts/              # Data visualization components
|-- clubs/               # Book club components
|-- empty/               # Empty-state components
|-- library/             # Library-specific book surfaces
|-- messaging/           # Direct-message components
|-- mobile/              # Mobile form/input helpers
|-- settings/            # Settings panels
|-- skeletons/           # Loading states
|-- social/              # Feed, review, comment, and profile cards
`-- *.tsx                # Shared feature components
```

### Naming Conventions

- **PascalCase** for all components.
- **Descriptive names** such as `QuickJournalEntryDialog`, not `Dialog2`.
- **Suffix patterns**:
  - `*Card` - Display cards
  - `*Dialog` - Modal dialogs
  - `*Sheet` - Bottom sheets
  - `*Form` - Form components
  - `*List` - List components
  - `*Skeleton` - Loading skeletons
  - `*Widget` - Interactive widgets

## Screens (`apps/client/src/screens/`)

Page-level components for routing.

```
screens/
|-- Index.tsx
|-- Auth.tsx
|-- AuthCallback.tsx
|-- Dashboard.tsx
|-- MyBooks.tsx
|-- AddBook.tsx
|-- EditBook.tsx
|-- BookDetail.tsx
|-- ScanBarcode.tsx
|-- ScanCover.tsx
|-- ProgressTracking.tsx
|-- ReadingHistory.tsx
|-- Analytics.tsx
|-- Profile.tsx
|-- UserProfile.tsx
|-- BookLists.tsx
|-- BookListDetail.tsx
|-- GoalsManagement.tsx
|-- Reviews.tsx
|-- Feed.tsx
|-- Readers.tsx
|-- BookClubs.tsx
|-- BookClubDetail.tsx
|-- Messages.tsx
|-- Settings.tsx
|-- ResetPassword.tsx
|-- Onboarding.tsx
`-- NotFound.tsx
```

### Screen Pattern

```tsx
const ScreenName = () => {
  const { user } = useAuth();
  const { data, loading } = useData();

  useEffect(() => {
    // Effects
  }, []);

  const handleAction = () => {
    // Handlers
  };

  if (loading) return <Skeleton />;

  return (
    <MobileLayout>
      {/* Content */}
    </MobileLayout>
  );
};
```

## Hooks (`apps/client/src/hooks/`)

Custom React hooks for business logic.

```
hooks/
|-- useAuth.ts
|-- useBooks.ts
|-- useBookProgress.ts
|-- useProgressLogs.ts
|-- useJournalEntries.ts
|-- useReviews.ts
|-- usePosts.ts
|-- useGoals.ts
|-- useStreaks.ts
|-- useBadges.ts
|-- useBookClubs.ts
|-- useConversations.ts
|-- useMessages.ts
|-- useBarcodeScanner.ts
|-- useCoverScanner.ts
|-- useImagePicker.ts
|-- useNetworkStatus.ts
|-- useNativeApp.ts
|-- usePlatform.ts
`-- ...
```

### Hook Categories

**Data Fetching**: TanStack Query-backed hooks.

**Gestures**: Platform-specific interactions.

**Platform**: Native capability detection and fallbacks.

**UI State**: Component and page state helpers.

## Services (`apps/client/src/services/`)

Business logic and external integrations.

```
services/
|-- api/                  # Backend API service modules
|-- local/                # IndexedDB/SQLite local repositories
|-- sync/                 # Reading-core sync engine and types
|-- authRedirect.ts
|-- badgeNotifications.ts
|-- dataCache.ts
|-- deepLinkService.ts
|-- imageCache.ts
|-- platform.ts
|-- pushNotifications.ts
|-- shareService.ts
|-- syncService.ts
`-- timerNative.ts
```

## Utilities, Contexts, Types, Integrations

| Area | Path | Notes |
| --- | --- | --- |
| Utilities | `apps/client/src/utils/` | Pure helpers, validation, progress math, offline wrappers. |
| Contexts | `apps/client/src/contexts/` | Profile, timer, theme, confirmation, badge celebration state. |
| Types | `apps/client/src/types/` | Shared app types and external API shapes. |
| Supabase client | `apps/client/src/integrations/supabase/` | Browser Supabase client and generated database types. |
| Library setup | `apps/client/src/lib/` | Sentry, animation helpers, themes, utility functions. |

## Mobile Wrapper (`apps/mobile/`)

```
apps/mobile/
|-- capacitor.config.ts
`-- package.json
```

`capacitor.config.ts` uses:

- `webDir: "../client/dist"`
- `android.path: "../../android"`
- `ios.path: "../../ios"`

The native `android/` and `ios/` directories intentionally remain at the repository root. Capacitor sync tasks are side-effecting and are not cached by Turbo.

## Desktop Wrapper (`apps/desktop/`)

```
apps/desktop/
|-- src/
|   |-- main.cts
|   |-- preload.cts
|   `-- sqliteLocalDb.cts
|-- dist/
|   |-- main.cjs
|   |-- preload.cjs
|   `-- sqliteLocalDb.cjs
|-- package.json
`-- tsconfig.json
```

Desktop packaging is configured by `electron-builder.yml`. Renderer bridge types live in `apps/client/src/types/desktop.d.ts`. The root package `main` points to `apps/desktop/dist/main.cjs`.

## Supabase Directory (`supabase/`)

Backend configuration and code remain root-managed.

```
supabase/
|-- config.toml                 # Supabase CLI configuration and function JWT settings
|-- migrations/                 # Database migrations
`-- functions/                  # Edge Functions (Deno)
    |-- _shared/                # Shared CORS, rate limit, validation, messaging helpers
    |-- search-books/           # Public book search, Google primary with Open Library fallback
    |-- add-book/
    |-- dashboard-home/
    |-- complete-reading/
    |-- conversations-home/
    |-- conversation-detail/
    |-- send-message/
    |-- sync-pull/
    |-- sync-push/
    `-- ...
```

See [Edge Function Catalog](./backend/edge-functions.md) and [API Reference](./api-reference.md).

## Native Directories

### Android (`android/`)

```
android/
|-- app/
|   |-- src/main/
|   |   |-- java/
|   |   |-- res/
|   |   `-- AndroidManifest.xml
|   |-- build.gradle
|   `-- google-services.json
|-- build.gradle
`-- gradle/
```

### iOS (`ios/`)

```
ios/
`-- App/
    |-- App/
    |   |-- Info.plist
    |   |-- Assets.xcassets/
    |   `-- GoogleService-Info.plist
    `-- App.xcodeproj/
```

## Documentation (`docs/`)

Developer documentation lives in `docs/` and follows topic-based markdown files.

```
docs/
|-- README.md
|-- SUMMARY.md
|-- getting-started.md
|-- monorepo.md
|-- tech-stack.md
|-- architecture.md
|-- file-structure.md
|-- deployment.md
|-- api-reference.md
|-- backend/
|-- architecture/
|-- performance/
|-- product/
|-- security/
`-- ...
```

## Best Practices

### File Naming

- **Components**: `PascalCase.tsx`
- **Hooks**: `useCamelCase.ts`
- **Services**: `camelCase.ts`
- **Utils**: `camelCase.ts`
- **Types**: `camelCase.ts`

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

The `@/*` alias is scoped to the client app and maps to `apps/client/src/*`.

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
```

## Finding Files

### By Feature

- **Books**: `apps/client/src/screens/MyBooks.tsx`, `apps/client/src/hooks/useBooks.ts`, `apps/client/src/components/BookCard.tsx`
- **Social**: `apps/client/src/screens/Feed.tsx`, `apps/client/src/hooks/usePosts.ts`, `apps/client/src/components/social/`
- **Analytics**: `apps/client/src/screens/Analytics.tsx`, `apps/client/src/hooks/useChartData.ts`, `apps/client/src/components/charts/`
- **Messaging**: `apps/client/src/screens/Messages.tsx`, `apps/client/src/services/api/messaging.ts`, `supabase/functions/conversations-home/`

### By Type

- **All components**: `apps/client/src/components/**/*.tsx`
- **All hooks**: `apps/client/src/hooks/*.ts`
- **All screens**: `apps/client/src/screens/*.tsx`
- **All services**: `apps/client/src/services/**/*.ts`
- **All Edge Functions**: `supabase/functions/*/index.ts`

## Further Reading

- [Monorepo and Turborepo](./monorepo.md)
- [Architecture Overview](./architecture.md)
- [Component Library](./components.md)
- [Database Schema](./database-schema.md)
- [Getting Started](./getting-started.md)
