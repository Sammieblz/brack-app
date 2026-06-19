# Documentation Summary

Complete reference for navigating Brack documentation.

## 📚 Documentation Overview

This documentation provides comprehensive coverage of:
- **Setup & Configuration** - Get Brack running locally
- **Architecture & Design** - Understand the system
- **Development Guides** - Build new features
- **Deployment** - Ship to production
- **Troubleshooting** - Solve common issues

**Total Documents**: 57
**Last Updated**: June 19, 2026

---

## 🎯 Start Here

### New Developers

1. **[Project Overview](./project-overview.md)** - Understand what Brack is and its goals
2. **[Getting Started](./getting-started.md)** - Set up your development environment
3. **[Tech Stack](./tech-stack.md)** - Learn what technologies are used
4. **[Architecture](./architecture.md)** - Understand the system design
5. **[Monorepo and Turborepo](./monorepo.md)** - Understand workspaces, Turbo tasks, cache, and CI
6. **[File Structure](./file-structure.md)** - Navigate the codebase

### Experienced Developers

1. **[Quick Reference](./quick-reference.md)** - Jump straight to common tasks
2. **[Database Schema](./database-schema.md)** - Review data model
3. **[API Reference](./api-reference.md)** - Edge Functions documentation
4. **[Hooks Reference](./hooks.md)** - Custom hooks API
5. **[Sprint Backlog](./backlog.md)** - Current implementation checklist and ticket statuses
6. **[Table Catalog](./schema/table-catalog.md)** - Remote public schema inventory
7. **[Monorepo and Turborepo](./monorepo.md)** - Workspace ownership and task graph

### Mobile Developers

1. **[Mobile Features](./mobile-features.md)** - Native capabilities guide
2. **[Getting Started](./getting-started.md#mobile-development-setup)** - iOS/Android setup
3. **[Deployment](./deployment.md#mobile-deployment)** - Deploy to app stores

### Desktop Developers

1. **[Desktop Packaging](./desktop.md)** - Electron runtime, SQLite storage, and CI artifacts
2. **[Deployment](./deployment.md#desktop-deployment)** - Desktop artifact build process

### DevOps/Platform Engineers

1. **[Deployment](./deployment.md)** - Production deployment
2. **[Database Schema](./database-schema.md)** - Database management
3. **[Troubleshooting](./troubleshooting.md)** - Common issues
4. **[API Reference](./api-reference.md)** - Backend services
5. **[Edge Function Catalog](./backend/edge-functions.md)** - Active maintained and retired functions
6. **[RLS Matrix](./security/rls-matrix.md)** - Public table permission matrix
7. **[Scale Readiness](./performance/scale-readiness.md)** - Supabase hardening and scale-prep status
8. **[Observability](./operations/observability.md)** - Alerts, monitoring, and operational SQL checks

---

## 📖 Documentation by Topic

### Setup & Installation
- [Getting Started](./getting-started.md) - Complete setup guide
- [Quick Reference](./quick-reference.md) - Common commands and snippets

### Understanding the Codebase
- [Project Overview](./project-overview.md) - What is Brack?
- [Tech Stack](./tech-stack.md) - Technologies used
- [Architecture](./architecture.md) - System design
- [Monorepo and Turborepo](./monorepo.md) - npm workspaces and Turbo orchestration
- [File Structure](./file-structure.md) - Code organization

### Development
- [Components](./components.md) - UI component library
- [Hooks Reference](./hooks.md) - Custom React hooks
- [State Management](./state-management.md) - State patterns
- [Database Schema](./database-schema.md) - Data model
- [API Reference](./api-reference.md) - Backend API
- [Sprint Backlog](./backlog.md) - Ticket checklist and implementation status
- [Table Catalog](./schema/table-catalog.md) - Public schema catalog
- [Functions and Triggers](./schema/functions-and-triggers.md) - Database function/trigger catalog
- [Domain Map](./architecture/domain-map.md) - Domain ownership boundaries
- [Edge Function Catalog](./backend/edge-functions.md) - Edge Function inventory
- [RLS Matrix](./security/rls-matrix.md) - Row Level Security matrix
- [Onboarding/Auth Audit](./security/onboarding-auth-audit.md) - Signup/profile/onboarding audit
- [Visibility Semantics](./security/visibility-semantics.md) - Shared visibility model
- [Reading Write-Path Audit](./reading/write-path-audit.md) - Reading workflow write paths
- [Book Acquisition, Search, And Barcode Scanning](./reading/book-acquisition.md) - Search providers, scanner flow, ISBN matching, and add-book semantics
- [Reading Completion Transaction](./reading/completion-transaction.md) - Consolidated reading completion backend path
- [Dashboard Query Audit](./performance/dashboard-query-audit.md) - Dashboard round trips and aggregation review
- [Index Audit](./performance/index-audit.md) - Hot-path index coverage and migration notes
- [Dashboard Read Model](./performance/dashboard-read-model.md) - Snapshot-backed dashboard response model
- [Scale Readiness](./performance/scale-readiness.md) - Supabase hardening and scale-prep status
- [Observability](./operations/observability.md) - Alerts, monitoring, and operational SQL checks
- [Books Schema Review](./data/books-schema-review.md) - Current book metadata/user-state assessment
- [Books/User Books Migration Plan](./data/books-user-books-migration-plan.md) - Future canonical/user split plan
- [Activity Generation Audit](./social/activity-generation-audit.md) - Social activity producer review
- [Activity Types](./social/activity-types.md) - Canonical feed event names
- [Feed Policy](./social/feed-policy.md) - Feed inclusion and fanout rules
- [Club Roles and Permissions](./clubs/roles-and-permissions.md) - Club role policy and RLS alignment
- [Messaging Permissions Audit](./messaging/permissions-audit.md) - Conversation/message access and unread strategy
- [Conversation Summary](./messaging/conversation-summary.md) - Efficient conversation list read model
- [Frontend Service Boundaries](./architecture/frontend-service-boundaries.md) - Domain API access rules
- [Mobile Device Boundaries](./architecture/mobile-device-boundaries.md) - Capacitor/plugin ownership and fallbacks
- [Product KPIs](./analytics/kpis.md) - Primary and secondary success metrics
- [In-Product Analytics](./analytics/in-product-analytics.md) - User-facing analytics review
- [Analytics Snapshot Strategy](./analytics/snapshot-strategy.md) - Snapshot generation and consumption plan
- [Progress Model](./product/progress-model.md) - Progress and completion rules
- [Streak Rules](./product/streak-rules.md) - Streak calculation and ownership
- [Reading Loop Friction Audit](./product/reading-loop-friction-audit.md) - Core reading-loop UX notes
- [Must-Win Screens](./product/must-win-screens.md) - Retention-critical surfaces and quality bars

### Features
- [Mobile Features](./mobile-features.md) - Native capabilities
- [Desktop Packaging](./desktop.md) - Electron desktop runtime
- [Offline Support](./offline-support.md) - Offline architecture
- [Authentication](./authentication.md) - Auth system

### Operations
- [Deployment](./deployment.md) - Production deployment
- [Testing](./testing.md) - Testing strategies
- [Troubleshooting](./troubleshooting.md) - Problem solving

### Community
- [Contributing](./contributing.md) - How to contribute
- [FAQ](./faq.md) - Common questions

---

## 🔍 Find What You Need

### "How do I...?"

| Question | Document |
|----------|----------|
| ...set up the project? | [Getting Started](./getting-started.md) |
| ...run the app locally? | [Getting Started](./getting-started.md#run-development-server) |
| ...build for production? | [Deployment](./deployment.md) |
| ...deploy to mobile? | [Deployment](./deployment.md#mobile-deployment) |
| ...package desktop apps? | [Desktop Packaging](./desktop.md), [Deployment](./deployment.md#desktop-deployment) |
| ...add a new feature? | [Contributing](./contributing.md#adding-new-features) |
| ...create a database table? | [Database Schema](./database-schema.md), [FAQ](./faq.md#how-do-i-add-a-new-database-table) |
| ...check backlog status? | [Sprint Backlog](./backlog.md) |
| ...review RLS coverage? | [RLS Matrix](./security/rls-matrix.md) |
| ...find database triggers? | [Functions and Triggers](./schema/functions-and-triggers.md) |
| ...understand reading progress rules? | [Progress Model](./product/progress-model.md) |
| ...understand book search and barcode scanning? | [Book Acquisition, Search, And Barcode Scanning](./reading/book-acquisition.md) |
| ...audit reading writes? | [Reading Write-Path Audit](./reading/write-path-audit.md) |
| ...understand reading completion side effects? | [Reading Completion Transaction](./reading/completion-transaction.md) |
| ...audit dashboard performance? | [Dashboard Query Audit](./performance/dashboard-query-audit.md) |
| ...understand the dashboard read model? | [Dashboard Read Model](./performance/dashboard-read-model.md) |
| ...check scale readiness? | [Scale Readiness](./performance/scale-readiness.md) |
| ...configure observability? | [Observability](./operations/observability.md) |
| ...review book schema split risks? | [Books Schema Review](./data/books-schema-review.md) |
| ...review feed activity types? | [Activity Types](./social/activity-types.md) |
| ...check message permissions? | [Messaging Permissions Audit](./messaging/permissions-audit.md) |
| ...review product KPIs? | [Product KPIs](./analytics/kpis.md) |
| ...check service boundaries? | [Frontend Service Boundaries](./architecture/frontend-service-boundaries.md) |
| ...create a new component? | [Components](./components.md#creating-new-components) |
| ...create a custom hook? | [Quick Reference](./quick-reference.md#create-new-hook) |
| ...handle offline mode? | [Offline Support](./offline-support.md) |
| ...fix build errors? | [Troubleshooting](./troubleshooting.md#build-errors) |

### "What is...?"

| Topic | Document |
|-------|----------|
| ...the architecture? | [Architecture](./architecture.md) |
| ...the tech stack? | [Tech Stack](./tech-stack.md) |
| ...the monorepo layout? | [Monorepo and Turborepo](./monorepo.md) |
| ...the database schema? | [Database Schema](./database-schema.md) |
| ...the source-of-truth table catalog? | [Table Catalog](./schema/table-catalog.md) |
| ...domain ownership boundaries? | [Domain Map](./architecture/domain-map.md) |
| ...the file structure? | [File Structure](./file-structure.md) |
| ...Row Level Security? | [Authentication](./authentication.md#row-level-security-rls) |
| ...TanStack Query? | [State Management](./state-management.md#tanstack-query-react-query) |
| ...offline sync? | [Offline Support](./offline-support.md) |
| ...Capacitor? | [Mobile Features](./mobile-features.md) |

### "Where is...?"

| Looking for | Location |
|-------------|----------|
| Components | [File Structure](./file-structure.md#components-appsclientsrccomponents) |
| Hooks | [File Structure](./file-structure.md#hooks-appsclientsrchooks) |
| Screens | [File Structure](./file-structure.md#screens-appsclientsrcscreens) |
| Services | [File Structure](./file-structure.md#services-appsclientsrcservices) |
| Database migrations | [File Structure](./file-structure.md#supabase-directory-supabase) |
| Edge Functions | [File Structure](./file-structure.md#supabase-directory-supabase) |

---

## 📊 Documentation Statistics

### Coverage

- **Setup & Installation**: 100%
- **Architecture**: 100%
- **API Documentation**: 100%
- **Mobile Features**: 100%
- **Troubleshooting**: 100%

### Documents by Category

- **Getting Started**: 3 documents
- **Architecture and Schema**: 8 documents
- **Security/Audit**: 4 documents
- **Performance/Data**: 6 documents
- **Development/API/Features**: 24 documents
- **Operations**: 4 documents
- **Community**: 2 documents
- **Backlog/Audit**: 1 document
- **Index/Summary**: 2 documents

### Total Content

- **~20,000+ words** across all documents
- **100+ code examples**
- **50+ diagrams** (ASCII art)
- **Comprehensive coverage** of all features

---

## 🎓 Learning Paths

### Path 1: Frontend Developer

1. [Project Overview](./project-overview.md) - Understand the app
2. [Getting Started](./getting-started.md) - Set up environment
3. [Monorepo and Turborepo](./monorepo.md) - Understand workspaces and root commands
4. [Tech Stack](./tech-stack.md) - Learn the technologies
5. [Components](./components.md) - Study UI patterns
6. [Hooks Reference](./hooks.md) - Understand data fetching
7. [State Management](./state-management.md) - Master state patterns

**Estimated Time**: 4-6 hours

### Path 2: Mobile Developer

1. [Project Overview](./project-overview.md) - Understand the app
2. [Mobile Features](./mobile-features.md) - Native capabilities
3. [Getting Started](./getting-started.md#mobile-development-setup) - iOS/Android setup
4. [Deployment](./deployment.md#mobile-deployment) - App Store deployment
5. [Troubleshooting](./troubleshooting.md#mobile-development-issues) - Common issues

**Estimated Time**: 3-4 hours

### Path 3: Desktop Developer

1. [Project Overview](./project-overview.md) - Understand the app
2. [Desktop Packaging](./desktop.md) - Electron runtime and local SQLite
3. [Offline Support](./offline-support.md) - Sync and outbox behavior
4. [Deployment](./deployment.md#desktop-deployment) - Build unsigned artifacts

**Estimated Time**: 2-3 hours

### Path 3: Backend Developer

1. [Database Schema](./database-schema.md) - Understand data model
2. [API Reference](./api-reference.md) - Edge Functions
3. [Authentication](./authentication.md) - Auth & security
4. [Deployment](./deployment.md#supabase-deployment) - Deploy functions

**Estimated Time**: 2-3 hours

### Path 4: DevOps Engineer

1. [Architecture](./architecture.md) - System overview
2. [Deployment](./deployment.md) - Deployment strategies
3. [Database Schema](./database-schema.md) - Database management
4. [Troubleshooting](./troubleshooting.md) - Operations issues

**Estimated Time**: 2-3 hours

---

## 🔧 Quick Reference Tables

### Commands

| Task | Command |
|------|---------|
| Start dev | `npm run dev` |
| Build prod | `npm run build` |
| Sync mobile | `npm run cap:sync` |
| Inspect Turbo graph | `npx turbo run build check-types --dry=json` |
| Run migrations | `npx supabase db push` |
| Deploy functions | `npx supabase functions deploy` |

### File Locations

| Type | Location |
|------|----------|
| Components | `apps/client/src/components/` |
| Screens | `apps/client/src/screens/` |
| Hooks | `apps/client/src/hooks/` |
| Services | `apps/client/src/services/` |
| Mobile wrapper | `apps/mobile/` |
| Desktop shell | `apps/desktop/` |
| Migrations | `supabase/migrations/` |
| Functions | `supabase/functions/` |

### Key Files

| File | Purpose |
|------|---------|
| `apps/client/src/App.tsx` | App routing and providers |
| `apps/client/src/main.tsx` | Renderer entry point |
| `apps/client/vite.config.ts` | Web build and PWA configuration |
| `apps/mobile/capacitor.config.ts` | Mobile wrapper configuration |
| `apps/client/tailwind.config.ts` | Styling configuration |
| `turbo.json` | Workspace task graph and cache rules |

---

## 🆘 Getting Help

### Documentation Not Clear?

1. Check [FAQ](./faq.md) for common questions
2. Search within docs (use your editor's search)
3. Check [Troubleshooting](./troubleshooting.md) for issues
4. Create a documentation issue on GitHub

### Still Stuck?

1. Search existing GitHub issues
2. Check [Quick Reference](./quick-reference.md) for snippets
3. Review similar features in codebase
4. Ask in community discussions
5. Create new issue with details

---

## 📝 Documentation Maintenance

### Updating Documentation

When making changes:
1. Update relevant documentation files
2. Update `Last Updated` date in doc index
3. Add to CHANGELOG (if significant)
4. Link from README if major addition

### Adding New Documentation

1. Create new `.md` file in `docs/`
2. Add to table of contents in `docs/README.md`
3. Link from related documents
4. Update this summary

### Documentation Style Guide

- Use Markdown formatting
- Include code examples
- Add diagrams where helpful
- Link to related docs
- Keep sections focused
- Update regularly

---

## 🗺️ Documentation Roadmap

### Current (v1.0)
✅ Complete coverage of existing features  
✅ Setup and installation guides  
✅ Architecture documentation  
✅ API reference  
✅ Troubleshooting guide  

### Planned (v1.1)
- [ ] Video tutorials
- [ ] Interactive examples
- [ ] More diagrams and visuals
- [ ] Performance optimization guide
- [ ] Security best practices deep-dive

### Future (v2.0)
- [ ] API versioning documentation
- [ ] Migration guides (v1 → v2)
- [ ] Advanced patterns and recipes
- [ ] Case studies
- [ ] Community contributions showcase

---

## 📊 Document Cross-Reference Matrix

| From | Related Docs |
|------|--------------|
| Getting Started | Monorepo and Turborepo, Tech Stack, Architecture, File Structure |
| Architecture | Tech Stack, State Management, Database Schema |
| Components | Hooks, State Management |
| Hooks | Components, State Management |
| Mobile Features | Getting Started, Deployment |
| Desktop Packaging | Deployment, Offline Support |
| Offline Support | State Management, Architecture |
| Authentication | Database Schema, API Reference |
| Deployment | Getting Started, Mobile Features, Desktop Packaging |
| Testing | Contributing, Deployment |

---

## 🎉 Documentation Complete!

This documentation covers all aspects of Brack development. Use the index above to jump to what you need, or start with [Getting Started](./getting-started.md) if you're new.

**Happy coding!** 📚✨
