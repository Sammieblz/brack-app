# Project Overview

High-level overview of the Brack application.

## What is Brack?

Brack is a comprehensive book tracking application that combines personal library management with social features, helping readers:

- 📚 **Track Reading** - Manage books, log progress, set goals
- ⏱️ **Time Sessions** - Use reading timers with analytics
- 📝 **Journal** - Capture notes, quotes, and reflections
- 👥 **Connect** - Follow readers, join clubs, share reviews
- 📊 **Analyze** - View detailed reading statistics and trends
- 📱 **Go Mobile** - Native iOS and Android apps
- ✈️ **Work Offline** - Track reading without internet

## Key Statistics

- **27 Database Tables** - Comprehensive data model
- **356 Source Files** - Well-organized codebase
- **59 Custom Hooks** - Reusable business logic
- **192 Components** - Modular UI architecture
- **15 Edge Functions** - Serverless backend
- **41 Migrations** - Evolved database schema

## Target Users

### Primary Audience
- **Avid Readers** - Track multiple books simultaneously
- **Goal-Oriented Readers** - Set and achieve reading targets
- **Social Readers** - Connect with reading community
- **Data-Driven Readers** - Analyze reading patterns

### Use Cases

1. **Personal Library Management**
   - Organize books by status (to read, reading, completed)
   - Create custom book lists
   - Track reading progress
   - Store notes and quotes

2. **Reading Analytics**
   - Track reading velocity (pages/hour)
   - Monitor daily/weekly/monthly progress
   - Predict book completion dates
   - View genre distribution

3. **Social Reading**
   - Share book reviews and ratings
   - Discover readers with similar tastes
   - Join book clubs and discussions
   - Follow friends and see their reading activity

4. **Goal Achievement**
   - Set reading goals (books, pages, time)
   - Track progress toward goals
   - Maintain reading streaks
   - Earn achievement badges

## Technology Highlights

### Modern Stack
- **React 18** - Latest features (Suspense, concurrent rendering)
- **TypeScript 5** - Type safety throughout
- **Vite 5** - Lightning-fast builds
- **Supabase** - Backend-as-a-Service
- **Capacitor 7** - Native mobile capabilities

### Developer Experience
- **Hot Module Replacement** - Instant feedback during development
- **Path Aliases** - Clean imports with `@/`
- **ESLint** - Code quality checks
- **TypeScript** - IDE autocomplete and type checking
- **Component Library** - shadcn/ui for consistent UI

### Production Ready
- **PWA Support** - Installable web app
- **Offline Mode** - Works without internet
- **Error Tracking** - Sentry integration
- **Performance Optimized** - Code splitting, lazy loading, caching
- **Security** - RLS policies, input sanitization, JWT auth

## Architecture at a Glance

```
┌─────────────────────────────────────────────┐
│           User Interface Layer              │
│                                             │
│  React Components (126)                     │
│  ├── Screens (27 pages)                     │
│  ├── UI Components (54 shadcn/ui)           │
│  ├── Feature Components (45+)               │
│  └── Charts, Skeletons, Modals              │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│          Business Logic Layer               │
│                                             │
│  Custom Hooks (42)                          │
│  ├── Data Fetching (useBooks, usePosts)     │
│  ├── Actions (useCreatePost, useGoals)      │
│  ├── Platform (usePlatform, useHaptics)     │
│  └── UI (useScrollDirection, useSwipeBack)  │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│            Services Layer                   │
│                                             │
│  Services                                   │
│  ├── local/ + sync/ - Offline reading core  │
│  ├── syncService - Background sync          │
│  ├── dataCache - Data caching               │
│  ├── imageCache - Image caching             │
│  ├── pushNotifications - FCM                │
│  ├── shareService - Native sharing          │
│  └── deepLinkService - URL handling         │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│            Data Layer                       │
│                                             │
│  ┌─────────────────┐  ┌─────────────────┐  │
│  │    Supabase     │  │ Local Durable DB│  │
│  │                 │  │                 │  │
│  │ - PostgreSQL    │  │ - Query Cache   │  │
│  │ - Storage       │  │ - Outbox sync   │  │
│  │ - Auth          │  │ - Preferences   │  │
│  │ - Realtime      │  │ - Image Cache   │  │
│  │ - Edge Functions│  │                 │  │
│  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────┘
```

## Feature Breakdown

### Core Features (Must-Have)
✅ User authentication  
✅ Book library management  
✅ Progress tracking  
✅ Reading timer  
✅ Goals and streaks  

### Social Features
✅ Posts and feed  
✅ Book reviews  
✅ Follow system  
✅ Direct messaging  
✅ Book clubs  
✅ Activity feed  

### Advanced Features
✅ Barcode scanning  
✅ Cover OCR scanning  
✅ Push notifications  
✅ Offline support  
✅ Journal with photos  
✅ Analytics dashboard  
✅ Quote collection  
✅ Deep linking  

### Mobile Features
✅ Native camera access  
✅ Image picker  
✅ Haptic feedback  
✅ Native sharing  
✅ Background sync  
✅ Local notifications  
✅ Pull-to-refresh  
✅ Swipe gestures  

## Development Phases

### Phase 1: MVP ✅
- User authentication
- Book CRUD operations
- Basic progress tracking
- Reading timer

### Phase 2: Social ✅
- User profiles
- Posts and reviews
- Follow system
- Book clubs

### Phase 3: Mobile ✅
- Capacitor integration
- Native camera features
- Push notifications
- Offline support

### Phase 4: Analytics ✅
- Progress analytics
- Reading velocity
- Completion forecasts
- Goal tracking

### Phase 5: Polish ✅
- Streaks and badges
- Journal prompts
- Quote collection
- Performance optimization

## Code Quality Metrics

### TypeScript Coverage
- **Strict**: Disabled (rapid development)
- **Type Annotations**: ~70% of codebase
- **Any Types**: Used sparingly
- **Recommendation**: Enable strict mode gradually

### Component Size
- **Average**: ~150 lines
- **Largest**: ~600 lines (complex screens)
- **Target**: < 300 lines per component

### Test Coverage
- **Current**: 0% (no automated tests)
- **Target**: 70%+ for critical paths
- **Priority**: Auth, data mutations, calculations

### Performance
- **Initial Load**: < 3 seconds
- **Time to Interactive**: < 5 seconds
- **Bundle Size**: main bundle is still above the target, with ApexCharts split into an `apex-vendor` chunk
- **Lighthouse Score**: 85+ (estimated)

## Scalability

### Current Capacity
- **Users**: 1,000+ concurrent users (Supabase free tier)
- **Books**: Unlimited (pagination implemented)
- **Realtime**: 500 concurrent connections
- **Storage**: 1GB free (book covers, avatars)

### Scaling Considerations

**Database**:
- ✅ Indexes on all foreign keys
- ✅ Pagination for large datasets
- ✅ RLS policies optimized
- 🔄 Connection pooling (managed by Supabase)

**Frontend**:
- ✅ Code splitting (route-based)
- ✅ Lazy loading (components)
- ✅ Virtual scrolling (100+ items)
- ✅ Image optimization
- ✅ Caching strategies

**Backend**:
- ✅ Edge Functions (auto-scaling)
- ✅ Rate limiting on functions
- 🔄 CDN for static assets (via hosting)

## Monetization Potential

### Freemium Model
- **Free Tier**: Basic book tracking, limited social
- **Pro Tier**: Advanced analytics, unlimited book clubs, priority support
- **Team Tier**: Organization features, admin dashboard

### Features for Pro
- Advanced analytics and insights
- Export data (PDF, CSV)
- Custom themes
- Ad-free experience
- Early access to new features
- Increased storage limits

## Competitive Advantages

1. **Unified Experience** - Web + iOS + Android from one codebase
2. **Offline First** - Works without internet
3. **Social Integration** - Not just tracking, but community
4. **Detailed Analytics** - Reading velocity, forecasts, trends
5. **Open Source** - Transparent, customizable, self-hostable
6. **Modern Stack** - Fast, maintainable, scalable

## Future Roadmap

### Short Term (1-3 months)
- [ ] Automated testing (Vitest + Playwright)
- [ ] Performance improvements (bundle splitting)
- [ ] Further chart/bundle optimization beyond the ApexCharts split
- [ ] Export features (journal PDF, statistics CSV)

### Medium Term (3-6 months)
- [ ] AI recommendations (ML-based book suggestions)
- [ ] Reading challenges (community challenges)
- [ ] Audiobook tracking
- [ ] Reading groups (larger than clubs)
- [ ] Advanced search filters

### Long Term (6-12 months)
- [ ] API for third-party integrations
- [ ] Browser extension (track web reading)
- [ ] E-reader integrations
- [ ] Gamification features
- [ ] Reading insights AI

## Team Recommendations

### For Small Team (1-3 devs)
- Focus on core features
- Use Supabase free tier
- Manual testing
- Deploy to Vercel/Netlify

### For Growing Team (4-10 devs)
- Add automated testing
- Implement CI/CD
- Upgrade Supabase tier
- Add staging environment

### For Large Team (10+ devs)
- Full test coverage
- Multiple environments (dev, staging, prod)
- Code review process
- Documentation maintenance
- Performance monitoring

## Success Metrics

### User Engagement
- Daily Active Users (DAU)
- Books tracked per user
- Reading sessions per week
- Time spent in app

### Feature Adoption
- Timer usage rate
- Journal entry creation
- Social post engagement
- Goal completion rate
- Streak maintenance

### Technical Health
- Error rate (< 1%)
- API response time (< 500ms p95)
- App crash rate (< 0.1%)
- Offline sync success (> 95%)

## Further Reading

- [Architecture](./architecture.md)
- [Tech Stack](./tech-stack.md)
- [Getting Started](./getting-started.md)
- [Database Schema](./database-schema.md)
