# Brack Documentation

Welcome to the Brack (Book Tracking) application documentation! This wiki provides comprehensive information for developers working on the project.

> **💡 New here?** Start with the [Project Overview](./project-overview.md) then follow the [Getting Started Guide](./getting-started.md).  
> **⚡ Need something quick?** Check the [Quick Reference](./quick-reference.md) cheat sheet.  
> **📚 Want to see everything?** View the [Documentation Summary](./SUMMARY.md).

## 📚 Table of Contents

### Getting Started
- [Project Overview](./project-overview.md) - High-level overview and goals
- [Getting Started Guide](./getting-started.md) - Setup, installation, and first steps
- [Tech Stack](./tech-stack.md) - Technologies and libraries used
- [Architecture Overview](./architecture.md) - System design and patterns

### Development
- [File Structure](./file-structure.md) - Project organization and folder layout
- [Database Schema](./database-schema.md) - Database tables and relationships
- [API Reference](./api-reference.md) - Edge Functions and endpoints
- [Sprint Backlog](./backlog.md) - Prioritized backlog with ticket status ledger
- [Table Catalog](./schema/table-catalog.md) - Remote public schema inventory
- [Functions and Triggers](./schema/functions-and-triggers.md) - Database function and trigger catalog
- [Edge Function Catalog](./backend/edge-functions.md) - Maintained and retired Edge Functions
- [Domain Map](./architecture/domain-map.md) - Backend/domain ownership boundaries
- [RLS Matrix](./security/rls-matrix.md) - Public table permission matrix
- [Onboarding/Auth Audit](./security/onboarding-auth-audit.md) - Signup/profile/onboarding write-path review
- [Visibility Semantics](./security/visibility-semantics.md) - Social/community visibility strategy
- [Reading Write-Path Audit](./reading/write-path-audit.md) - Reading workflow write-path inventory
- [Reading Completion Transaction](./reading/completion-transaction.md) - Consolidated reading completion backend path
- [Dashboard Query Audit](./performance/dashboard-query-audit.md) - Dashboard round trips and aggregation review
- [Index Audit](./performance/index-audit.md) - Hot-path index coverage and migration notes
- [Dashboard Read Model](./performance/dashboard-read-model.md) - Snapshot-backed dashboard response model
- [Scale Readiness](./performance/scale-readiness.md) - Supabase scale-prep, EXPLAIN checks, and deferred fanout/load work
- [Observability](./operations/observability.md) - Runtime monitoring, alerts, and operational SQL checks
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
- [Progress Model](./product/progress-model.md) - Page, percentage, session, and completion rules
- [Streak Rules](./product/streak-rules.md) - Reading streak ownership and rules
- [Reading Loop Friction Audit](./product/reading-loop-friction-audit.md) - Core reading UX review
- [Must-Win Screens](./product/must-win-screens.md) - Retention-critical surfaces and quality bars
- [Mobile Features](./mobile-features.md) - Native mobile capabilities

### Reference
- [Components Guide](./components.md) - UI components and patterns
- [Hooks Reference](./hooks.md) - Custom React hooks
- [State Management](./state-management.md) - Data flow and caching
- [Authentication](./authentication.md) - User auth and security

### Guides
- [Offline Support](./offline-support.md) - Offline queue and caching
- [Deployment](./deployment.md) - Build and deployment process
- [Testing Guide](./testing.md) - Testing strategies
- [Features List](./features-list.md) - Complete features reference
- [Visual Guides](./visual-guides.md) - Diagrams and flowcharts

### Help
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
- [FAQ](./faq.md) - Frequently asked questions
- [Contributing](./contributing.md) - Contribution guidelines

## 🚀 Quick Links

- [Main README](../README.md)
- [Quick Reference](./quick-reference.md) - Cheat sheet for common tasks
- [Environment Variables](./getting-started.md#environment-variables)
- [Database Migrations](./database-schema.md#migrations)
- [Sprint Backlog](./backlog.md)
- [RLS Matrix](./security/rls-matrix.md)
- [Mobile Setup](./mobile-features.md#setup)

## 📖 Documentation Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| Getting Started | ✅ Complete | 2026-02-04 |
| Tech Stack | ✅ Complete | 2026-02-04 |
| Architecture | ✅ Complete | 2026-02-04 |
| File Structure | ✅ Complete | 2026-02-04 |
| Database Schema | ✅ Complete | 2026-02-04 |
| API Reference | ✅ Complete | 2026-02-04 |
| Mobile Features | ✅ Complete | 2026-02-04 |
| Project Overview | ✅ Complete | 2026-02-04 |
| Quick Reference | ✅ Complete | 2026-02-04 |
| Components Guide | ✅ Complete | 2026-02-04 |
| Hooks Reference | ✅ Complete | 2026-02-04 |
| State Management | ✅ Complete | 2026-02-04 |
| Offline Support | ✅ Complete | 2026-02-04 |
| Authentication | ✅ Complete | 2026-02-04 |
| Testing Guide | ✅ Complete | 2026-02-04 |
| Features List | ✅ Complete | 2026-02-04 |
| Deployment | ✅ Complete | 2026-02-04 |
| Contributing | ✅ Complete | 2026-02-04 |
| FAQ | ✅ Complete | 2026-02-04 |
| Troubleshooting | ✅ Complete | 2026-02-04 |
| Summary | ✅ Complete | 2026-02-04 |
| Sprint Backlog | Active | 2026-05-05 |
| Table Catalog | ✅ Complete | 2026-05-05 |
| Functions and Triggers | ✅ Complete | 2026-05-05 |
| Edge Function Catalog | ✅ Complete | 2026-05-05 |
| Domain Map | ✅ Complete | 2026-05-05 |
| RLS Matrix | ✅ Complete | 2026-05-05 |
| Onboarding/Auth Audit | Complete | 2026-05-05 |
| Visibility Semantics | ✅ Complete | 2026-05-05 |
| Reading Write-Path Audit | ✅ Complete | 2026-05-05 |
| Reading Completion Transaction | Complete | 2026-05-05 |
| Dashboard Query Audit | ✅ Complete | 2026-05-05 |
| Index Audit | ✅ Complete | 2026-05-05 |
| Dashboard Read Model | Complete | 2026-05-05 |
| Scale Readiness | Complete | 2026-05-05 |
| Observability | Complete | 2026-05-05 |
| Books Schema Review | ✅ Complete | 2026-05-05 |
| Books/User Books Migration Plan | ✅ Complete | 2026-05-05 |
| Activity Generation Audit | ✅ Complete | 2026-05-05 |
| Activity Types | ✅ Complete | 2026-05-05 |
| Feed Policy | ✅ Complete | 2026-05-05 |
| Club Roles and Permissions | ✅ Complete | 2026-05-05 |
| Messaging Permissions Audit | ✅ Complete | 2026-05-05 |
| Conversation Summary | ✅ Complete | 2026-05-05 |
| Frontend Service Boundaries | ✅ Complete | 2026-05-05 |
| Mobile Device Boundaries | Complete | 2026-05-05 |
| Product KPIs | ✅ Complete | 2026-05-05 |
| In-Product Analytics | ✅ Complete | 2026-05-05 |
| Analytics Snapshot Strategy | ✅ Complete | 2026-05-05 |
| Progress Model | ✅ Complete | 2026-05-05 |
| Streak Rules | ✅ Complete | 2026-05-05 |
| Reading Loop Friction Audit | ✅ Complete | 2026-05-05 |
| Must-Win Screens | ✅ Complete | 2026-05-05 |

## 📁 Documentation Structure

```
docs/
├── README.md                  # This file - documentation index
│
├── Getting Started
│   ├── project-overview.md    # High-level overview
│   ├── getting-started.md     # Setup and installation
│   └── quick-reference.md     # Cheat sheet
│
├── Architecture & Design
│   ├── tech-stack.md          # Technologies used
│   ├── architecture.md        # System design
│   ├── file-structure.md      # Project organization
│   └── database-schema.md     # Database design
│
├── Features & Development
│   ├── components.md          # UI components guide
│   ├── hooks.md              # Custom hooks reference
│   ├── state-management.md   # State patterns
│   ├── mobile-features.md    # Native capabilities
│   ├── offline-support.md    # Offline architecture
│   ├── authentication.md     # Auth and security
│   └── api-reference.md      # Edge Functions API
│
├── Deployment & Operations
│   ├── deployment.md         # Deploy to production
│   ├── testing.md           # Testing strategies
│   └── troubleshooting.md   # Common issues
│
└── Community
    ├── contributing.md       # Contribution guide
    └── faq.md               # Frequently asked questions
```

## 🤝 Contributing to Documentation

Found an error or want to improve the docs? See [Contributing Guidelines](./contributing.md).

## 📝 License

This documentation is part of the Brack project and follows the same license.
