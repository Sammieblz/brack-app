# Complete Features List

Comprehensive list of all features, screens, and capabilities in Brack.

## 🖥️ Screens (27)

### Authentication & Onboarding
1. **Auth** (`/auth`) - Login and signup
2. **Welcome** (`/welcome`) - Onboarding welcome
3. **Questionnaire** (`/questionnaire`) - Reading habits survey
4. **Goals** (`/goals`) - Initial goal setting

### Main Screens
5. **Dashboard** (`/` or `/dashboard`) - Home screen with overview
6. **MyBooks** (`/my-books` or `/books`) - Book library
7. **Profile** (`/profile`) - User profile and settings
8. **Analytics** (`/analytics`) - Reading analytics dashboard

### Book Management
9. **AddBook** (`/add-book`) - Add new book
10. **EditBook** (`/edit-book/:id`) - Edit book details
11. **BookDetail** (`/book/:id`) - Book detail page
12. **ScanBarcode** (`/scan-barcode` or `/scan`) - Barcode scanner
13. **ScanCover** (`/scan-cover`) - Book cover OCR scanner

### Reading Tracking
14. **ProgressTracking** (`/book/:id/progress`) - Detailed progress analytics
15. **ReadingHistory** (`/history`) - Reading sessions history
16. **GoalsManagement** (`/goals-management`) - Manage reading goals

### Organization
17. **BookLists** (`/book-lists` or `/lists`) - Book lists overview
18. **BookListDetail** (`/lists/:listId`) - Single list detail

### Social
19. **Feed** (`/feed`) - Social feed with posts
20. **Reviews** (`/reviews`) - Book reviews feed
21. **Readers** (`/readers`) - Discover other readers
22. **UserProfile** (`/users/:userId`) - Other user's profile
23. **Messages** (`/messages`) - Direct messaging

### Book Clubs
24. **BookClubs** (`/clubs`) - Book clubs list
25. **BookClubDetail** (`/clubs/:clubId`) - Single club detail

### Other
26. **Index** (`/`) - Landing/redirect page
27. **NotFound** (`/*`) - 404 page

---

## 🎨 Key Components (50+)

### Display Components
- `BookCard` - Book display card
- `BookSearch` - Book search with provider fallback, ISBN lookup, and metadata caching
- `SwipeableBookCard` - Book card with swipe actions
- `BadgeDisplay` - Achievement badges
- `StreakDisplay` - Streak counter
- `ReadingHeatmap` - ApexCharts reading activity heatmap
- `StreakHistoryTimeline` - Streak milestones
- `QuoteCollection` - Quote collection view

### Input Components
- `ProgressLogger` - Log reading progress
- `QuickProgressWidget` - Quick page update
- `JournalEntryDialog` - Create/edit journal
- `QuickJournalEntryDialog` - Quick journal after reading
- `ReviewForm` - Write book review
- `GoalManager` - Create/edit goals
- `TagManager` - Manage book tags

### Social Components
- `PostCard` - Social post display
- `PostList` - Feed of posts
- `CreatePostDialog` - Create new post
- `ReviewCard` - Book review display
- `CommentSection` - Comments thread
- `UserCard` - User profile card
- `FollowButton` - Follow/unfollow
- `ActivityItem` - Activity feed item

### Navigation Components
- `MobileBottomNav` - Bottom navigation bar
- `MobileHeader` - Mobile page header
- `Navbar` - Desktop sidebar
- `Header` - Desktop top header
- `FloatingActionButton` - Mobile FAB

### Utility Components
- `FloatingTimerWidget` - Reading timer
- `OfflineIndicator` - Offline status banner
- `PullToRefresh` - Pull-to-refresh wrapper
- `OptimizedImage` - Cached image loader
- `LoadingSpinner` - Loading indicator
- `ErrorBoundary` - Error boundary wrapper

### Layout Components
- `MobileLayout` - Mobile screen wrapper
- `NativeScrollView` - Native scroll container
- `NativeHeader` - Native-style header
- `SwipeBackHandler` - Swipe back gesture

### Specialized Components
- `JournalPromptHandler` - Global journal prompt
- `DeepLinkHandler` - Deep link router
- `ImagePickerDialog` - Camera/library chooser
- `AddToListDialog` - Add book to list

---

## 🔧 Core Features

### Book Management ✅
- ✅ Add books manually
- ✅ Search Google Books with Open Library fallback and metadata caching
- ✅ Scan ISBN barcode, resolve exact match, preview, and add directly
- ✅ Scan book cover (OCR)
- ✅ Edit book details
- ✅ Delete books (soft delete)
- ✅ Book statuses (to_read, reading, completed)
- ✅ Auto-status updates
- ✅ Custom tags
- ✅ Personal notes
- ✅ Star ratings
- ✅ Book metadata (JSON)

### Reading Tracking ✅
- ✅ Reading timer with persistence
- ✅ Background timer notifications
- ✅ Manual progress logging
- ✅ Quick progress updates
- ✅ Page, chapter, paragraph tracking
- ✅ Time tracking
- ✅ Session notes
- ✅ Photo attachments on logs
- ✅ Progress analytics
- ✅ Reading velocity calculation
- ✅ Completion forecasts
- ✅ Daily progress charts

### Streaks & Goals ✅
- ✅ Daily reading streaks
- ✅ Current and longest streak
- ✅ Reading activity heatmap
- ✅ Streak freeze (once/week)
- ✅ Streak milestones
- ✅ Streak history timeline
- ✅ Reading goals (books, pages, time)
- ✅ Goal progress tracking
- ✅ Multiple goal types
- ✅ Goal completion

### Journaling ✅
- ✅ Journal entries (notes, quotes, reflections)
- ✅ Auto-prompt after reading session
- ✅ Photo attachments
- ✅ Page references
- ✅ Tags
- ✅ Edit/delete entries
- ✅ Quote collection
- ✅ Search quotes
- ✅ Share quotes

### Social Features ✅
- ✅ User profiles (public/private)
- ✅ Follow/unfollow users
- ✅ Social feed
- ✅ Create posts
- ✅ Like/comment on posts
- ✅ Book reviews with ratings
- ✅ Review likes and comments
- ✅ Activity feed
- ✅ Reader discovery
- ✅ Direct messaging
- ✅ Typing indicators
- ✅ Message read status

### Book Clubs ✅
- ✅ Create public/private clubs
- ✅ Join/leave clubs
- ✅ Club discussions (threaded)
- ✅ Set current book
- ✅ Member management
- ✅ Admin roles

### Organization ✅
- ✅ Custom book lists
- ✅ Public/private lists
- ✅ Add/remove books from lists
- ✅ Reorder books in lists
- ✅ List carousel on dashboard
- ✅ Share lists

### Analytics ✅
- ✅ Weekly reading charts
- ✅ Monthly statistics
- ✅ Genre distribution
- ✅ Reading velocity trends
- ✅ Goal progress charts
- ✅ Streak trend charts
- ✅ Year in review (foundation)

---

## 📱 Mobile Features

### Camera & Media ✅
- ✅ Barcode scanning (ISBN-10/13)
- ✅ Book cover OCR scanning
- ✅ Photo capture
- ✅ Photo library access
- ✅ Image compression
- ✅ Photo attachments (journal, progress)

### Notifications ✅
- ✅ Push notifications (FCM)
- ✅ Local notifications
- ✅ Timer notifications
- ✅ Notification preferences
- ✅ Quiet hours settings

### Gestures & Interaction ✅
- ✅ Swipe to delete
- ✅ Swipe between tabs
- ✅ Swipe back (iOS-style)
- ✅ Pull to refresh
- ✅ Pull to dismiss
- ✅ Long press
- ✅ Haptic feedback

### Platform Integration ✅
- ✅ Native share sheet
- ✅ Deep linking (brack://)
- ✅ App state handling
- ✅ Background sync
- ✅ Network status detection
- ✅ Device information

### Offline Capabilities ✅
- ✅ Local-first reading core
- ✅ Durable outbox sync
- ✅ IndexedDB on web/PWA
- ✅ SQLite driver path for native apps
- ✅ Image caching (7-day TTL)
- ✅ Background sync
- ✅ Retry and failed-sync review
- ✅ Sync progress indicator

---

## 🎨 UI Features

### Theming ✅
- ✅ Dark mode
- ✅ Light mode
- ✅ System preference
- ✅ Theme persistence
- ✅ Color themes (future)

### Responsive Design ✅
- ✅ Mobile-first design
- ✅ Tablet optimization
- ✅ Desktop layouts
- ✅ Adaptive navigation (bottom/sidebar)
- ✅ Responsive components

### Accessibility ✅
- ✅ Keyboard navigation
- ✅ Focus indicators
- ✅ ARIA labels
- ✅ Screen reader support
- ✅ High contrast support
- ✅ Reduced motion support

### UX Polish ✅
- ✅ Loading skeletons
- ✅ Empty states
- ✅ Error messages
- ✅ Toast notifications
- ✅ Confirmation dialogs
- ✅ Smooth animations
- ✅ Haptic feedback
- ✅ Pull-to-refresh
- ✅ Infinite scroll

---

## 🔒 Security Features

### Authentication ✅
- ✅ Email/password auth
- ✅ JWT tokens
- ✅ Session persistence
- ✅ Auto token refresh
- ✅ Password reset

### Authorization ✅
- ✅ Row Level Security (RLS)
- ✅ User-specific data access
- ✅ Public/private content
- ✅ Role-based access (clubs)

### Data Protection ✅
- ✅ Input sanitization (DOMPurify)
- ✅ XSS prevention
- ✅ HTTPS-only in production
- ✅ Environment variable protection
- ✅ Secure API keys

---

## 🚀 Performance Features

### Optimization ✅
- ✅ Code splitting (route-based)
- ✅ Lazy loading (components)
- ✅ Virtual scrolling (100+ items)
- ✅ Image lazy loading
- ✅ Debounced operations
- ✅ Batch operations
- ✅ Query caching (TanStack Query)
- ✅ Durable local cache for reading-core data
- ✅ Image caching (filesystem)

### PWA ✅
- ✅ Service worker
- ✅ Offline support
- ✅ Install prompt
- ✅ App manifest
- ✅ Cache strategies

### Battery Optimization ✅
- ✅ Visibility-based subscriptions
- ✅ Reduced animations on low battery
- ✅ Efficient rendering
- ✅ Background sync throttling

---

## 📊 Analytics & Insights

### Reading Statistics ✅
- ✅ Books completed
- ✅ Pages read
- ✅ Time spent reading
- ✅ Average reading pace
- ✅ Genre distribution
- ✅ Reading velocity trends
- ✅ Completion forecasts

### Social Analytics ✅
- ✅ Follower/following counts
- ✅ Post engagement metrics
- ✅ Review statistics
- ✅ Activity tracking

### Gamification ✅
- ✅ Reading streaks
- ✅ Achievement badges
- ✅ Streak milestones
- ✅ Goal completion

---

## 🔌 Integrations

### External APIs
- ✅ **Google Books API** - Primary book search and metadata
- ✅ **Open Library API** - Fallback book search when Google fails, times out, or returns no usable books
- ✅ **Firebase Cloud Messaging** - Push notifications
- ✅ **Sentry** - Error tracking (optional)

### Internal APIs
- ✅ **Supabase REST API** - Database operations
- ✅ **Supabase Realtime** - Live updates
- ✅ **Supabase Storage** - Image storage
- ✅ **Edge Functions** - Serverless backend (48 maintained local functions)

---

## 🎯 User Journeys

### New User Journey
1. Sign up → Welcome screen
2. Questionnaire → Reading habits
3. Set initial goal
4. Add first book
5. Start reading timer
6. Log first progress
7. Maintain streak

### Returning User Journey
1. Open app → Dashboard
2. See streak status
3. Continue reading book
4. Log progress or use timer
5. Write journal entry
6. Check analytics
7. Interact with social feed

### Power User Journey
1. Manage multiple books
2. Join book clubs
3. Write detailed reviews
4. Create custom lists
5. Follow other readers
6. Share achievements
7. Maintain long streaks

---

## 🛠️ Developer Features

### Development Tools
- ✅ Hot Module Replacement (Vite)
- ✅ TypeScript type checking
- ✅ ESLint code quality
- ✅ Path aliases (`@/`)
- ✅ Environment variables
- ✅ Error boundaries
- ✅ Dev server (port 8080)

### Debugging Tools
- ✅ React DevTools integration
- ✅ TanStack Query DevTools
- ✅ Sentry error tracking
- ✅ Console logging helpers
- ✅ Network inspection
- ✅ Component inspection

### Build Tools
- ✅ Vite build optimization
- ✅ Code splitting
- ✅ Tree shaking
- ✅ Minification
- ✅ Asset optimization
- ✅ Source maps

---

## 📦 Data Models

### Core Entities
- **User/Profile** - User account and preferences
- **Book** - Book in user's library
- **ReadingSession** - Timed reading sessions
- **ProgressLog** - Granular progress tracking
- **Goal** - Reading goals
- **JournalEntry** - Notes, quotes, reflections

### Social Entities
- **Post** - Social feed posts
- **Review** - Book reviews
- **Comment** - Post/review comments
- **Like** - Post/review likes
- **Follow** - User relationships
- **Conversation** - Message threads
- **Message** - Direct messages

### Organization Entities
- **BookList** - Custom book collections
- **BookClub** - Reading groups
- **ClubMember** - Club membership
- **Discussion** - Club discussions

### Analytics Entities
- **ReadingHabits** - User reading statistics
- **StreakHistory** - Streak milestones
- **SocialActivity** - Activity feed entries
- **Badge** - Achievement badges
- **DashboardHomeSnapshot** - Snapshot-backed dashboard read model

### System Entities
- **PushToken** - Push notification tokens
- **NotificationPreferences** - Notification settings

---

## 🔄 Real-time Features

### Live Updates
- ✅ Social feed updates
- ✅ New messages
- ✅ Post likes/comments
- ✅ Club discussions
- ✅ Typing indicators

### Subscriptions
- ✅ Books changes
- ✅ Posts changes
- ✅ Messages changes
- ✅ Club discussions changes
- ✅ Visibility-based (battery saving)

---

## 📲 Push Notification Types

### Planned Notifications
- [ ] New follower
- [ ] New message
- [ ] Book club update
- [ ] Goal milestone
- [ ] Streak reminder
- [ ] Reading reminder
- [ ] New comment/like

### Currently Implemented
- ✅ Infrastructure (token management)
- ✅ Preferences UI
- ✅ Send notification function
- ⚠️ Notification triggers (needs backend)

---

## 🎮 Gamification Features

### Achievement System
- ✅ Badge definitions
- ✅ Badge awarding logic
- ✅ Badge display
- ✅ Social activity on badge earn

### Streak System
- ✅ Daily streak tracking
- ✅ Streak freeze mechanic
- ✅ Milestone tracking
- ✅ History timeline
- ✅ Motivational messages

### Goal System
- ✅ Multiple goal types (books, pages, time)
- ✅ Period types (monthly, quarterly, yearly, custom)
- ✅ Progress tracking
- ✅ Completion celebration

---

## 🎨 Design System

### Colors
- **Primary**: Indigo/Purple gradient
- **Accent**: Orange
- **Success**: Green
- **Warning**: Yellow
- **Error**: Red
- **Background Dark**: #0b1021
- **Background Light**: White

### Typography
- **Headings**: System font stack
- **Body**: System font stack
- **Sizes**: Responsive (sm, base, lg, xl, 2xl, 3xl)

### Spacing
- **Base**: 4px (1 unit)
- **Common**: 4px, 8px, 12px, 16px, 24px
- **Responsive**: Increases on larger screens

### Components
- **shadcn/ui**: 54 base components
- **Custom**: 72 feature components
- **Icons**: iconoir-react (1000+ icons)

---

## 📈 Performance Metrics

### Bundle Size
- **Main**: above current 1 MB warning threshold before gzip
- **Chunks**: Code-split by route and heavy vendors
- **ApexCharts**: split into `apex-vendor`

### Loading Times
- **Initial**: < 3 seconds
- **Subsequent**: Instant (cached)
- **API Calls**: < 500ms (p95)

### Caching
- **Query Cache**: In-memory (React Query)
- **Data Cache**: 2-minute TTL
- **Image Cache**: 7-day TTL
- **Service Worker**: Static assets

---

## 🔮 Future Features

### Short Term (Planned)
- [ ] Audiobook tracking
- [ ] Reading challenges
- [ ] Advanced search filters
- [ ] Export journal as PDF
- [ ] Reading insights AI

### Medium Term (Conceptual)
- [ ] AI book recommendations
- [ ] Reading speed tests
- [ ] Book club scheduling
- [ ] Reading groups (public clubs)
- [ ] Achievements system expansion

### Long Term (Ideas)
- [ ] Browser extension
- [ ] E-reader integrations (Kindle, Kobo)
- [ ] Library integrations
- [ ] Goodreads import
- [ ] Reading tracking API

---

## 📊 Database Statistics

- **Total Tables**: 31
- **Total Migrations**: 47
- **RLS Policies**: 100+ (all tables protected)
- **Indexes**: 50+ (optimized queries)
- **Functions**: 30+ (RPCs, helpers, triggers, and read models)

---

## 🔄 API Endpoints (Edge Functions)

1. **search-books** - Book search and ISBN lookup gateway with Google Books primary, Open Library fallback, and metadata caching
2. **add-book** - Protected library insert and duplicate handling
3. **dashboard-home** - Snapshot-backed dashboard data
4. **complete-reading** - Consolidated reading completion transaction
5. **create-reading-session** - Timer session persistence
6. **award-badges** - Badge awarding
7. **log-progress** - Progress logging through completion transaction
8. **monthly-stats** - Calculate statistics
9. **social-feed** - Aggregate social posts
10. **send-push-notification** - FCM integration
11. **calculate-book-progress** - Progress analytics
12. **discover-readers** - Find similar readers
13. **enhanced-activity** - Generate activity feed
14. **compute-analytics** - Daily analytics snapshots
15. **sync-pull** - Pull reading-core changes
16. **sync-push** - Push reading-core outbox mutations

This list highlights core app-facing endpoints. See [Edge Function Catalog](./backend/edge-functions.md) for the full maintained function inventory.

All maintained Edge Functions use distributed rate limiting through `api_rate_limits`; every maintained function except public `search-books` requires JWT verification.

---

## 🎯 Key Differentiators

What makes Brack unique:

1. **Offline-First** - Works without internet
2. **Mobile Native** - True native mobile apps
3. **Social Reading** - Community features built-in
4. **Detailed Tracking** - Granular progress tracking
5. **Open Source** - Transparent and customizable
6. **Modern Stack** - Latest technologies
7. **Performance** - Fast and responsive
8. **Privacy** - User controls data visibility

---

## 📚 Further Reading

- [Project Overview](./project-overview.md) - Detailed overview
- [Architecture](./architecture.md) - System design
- [Getting Started](./getting-started.md) - Setup guide
- [Database Schema](./database-schema.md) - Data model
