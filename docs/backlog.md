# BRACK Sprint Backlog

## Structure
This backlog is organized by:
- Epic
- Priority
- Ticket
- Acceptance criteria

Priority levels:
- P0 = immediate and blocking
- P1 = near-term and important
- P2 = useful but not urgent

## Current Audit Facts
- Remote Supabase is the source of truth for this backlog audit.
- As of 2026-05-05, the remote public schema has 32 tables, not 25.
- All 32 public tables have RLS enabled.
- Sprint 1 began as audit-first work. Later backlog passes added targeted indexes, a dashboard snapshot table/RPC, a conversation summary RPC, and a consolidated reading completion transaction.
- Remote Edge Functions now match the maintained local function surface. Legacy remote-only functions `get-book-details`, `update-reading-progress`, and `daily-summary` were deleted on 2026-05-05 after confirming no local consumers.
- Maintained Edge Functions now use distributed service-role rate limiting through `api_rate_limits` and `check_api_rate_limit`.
- Anonymous direct public-schema table privileges were revoked, broad analytics snapshot write policies were removed, backend-only security-definer RPCs were restricted to `service_role`, and public storage object listing policies were removed.
- Existing duplicate/overlap risks are recorded in the Sprint 1 catalogs:
  - Dashboard has `get_user_dashboard_stats`, now wrapped by the snapshot-backed `get_dashboard_home_snapshot` path.
  - Streak logic is centralized through `reading_streak_days`, profile sync triggers, and the documented backend ownership zone.
  - Activity generation is trigger-based on several tables, while activity fanout tables are deferred until the feed audit proves they are needed.

## Ticket Status Ledger
Status values:
- `Implemented` means the current acceptance criteria are met.
- `Partial` means supporting work exists, but the ticket is not complete.
- `Duplicate` means the ticket is already covered by another ticket and should be merged or closed.
- `Not started` means no material implementation has been completed yet.

| Ticket | Status | Evidence |
| --- | --- | --- |
| 1.1 | Implemented | `docs/schema/table-catalog.md` lists all 32 public tables with domain, source/derived status, visibility, write/read paths, and key indexes. |
| 1.2 | Implemented | `docs/schema/functions-and-triggers.md` lists remote DB functions and triggers with side effects and overlap risks. |
| 1.3 | Implemented | `docs/backend/edge-functions.md` lists maintained Edge Functions, retired legacy functions, auth, inputs, outputs, secrets, side effects, and retry concerns. |
| 1.4 | Implemented | `docs/architecture/domain-map.md` maps every public table to Identity, Reading, Social, Reviews, Clubs, Curation, or Motivation/Analytics. |
| 2.1 | Implemented | `docs/security/rls-matrix.md` covers select, insert, update, and delete behavior for all public tables. |
| 2.2 | Implemented | `docs/security/onboarding-auth-audit.md` documents deterministic profile creation, defaults, RLS, and risks; controlled remote Auth tests verified `handle_new_user` creates exactly one `profiles` row with `not_started` onboarding defaults and cleanup. |
| 2.3 | Implemented | `docs/security/visibility-semantics.md` defines private/followers/club/public semantics, identifies inconsistent tables, and lays out the migration plan. |
| 3.1 | Implemented | `docs/reading/write-path-audit.md` documents add book, timer, progress, completion, goal, journal, offline, and duplicate/hidden write paths. |
| 3.2 | Implemented | `complete_reading_transaction` now consolidates session, progress, book completion, streak refresh, goal completion, activity, and badges; `create_reading_session` and `log_progress_transaction` delegate to it, `complete-reading` is deployed, and `docs/reading/completion-transaction.md` records validation. |
| 3.3 | Implemented | `docs/product/progress-model.md` defines page, percentage, session, completion, streak, and goal progress semantics. |
| 3.4 | Implemented | `docs/product/streak-rules.md` documents valid days, UTC timezone behavior, backfill behavior, and backend streak ownership; client profile streak writes were removed. |
| 4.1 | Implemented | `docs/performance/dashboard-query-audit.md` documents dashboard query paths, round trips, joins, heavy aggregations, and consolidation targets. |
| 4.2 | Implemented | `docs/performance/index-audit.md` records existing coverage, EXPLAIN checks, and the applied dashboard plus advisor index migrations. |
| 4.3 | Implemented | `dashboard_home_snapshots`, `refresh_dashboard_home_snapshot`, and `get_dashboard_home_snapshot` provide the snapshot-backed dashboard read model; `dashboard-home` calls it and `docs/performance/dashboard-read-model.md` documents the contract. |
| 5.1 | Implemented | `docs/data/books-schema-review.md` documents current `books` usage, metadata/user-state mixing, risks, and short-term recommendation. |
| 5.2 | Implemented | `docs/data/books-user-books-migration-plan.md` proposes future canonical `books` plus `user_books` schemas and phased migration impact without executing the split. |
| 6.1 | Implemented | `docs/social/activity-generation-audit.md` lists every `social_activities` producer, duplicate risks, event naming, and feed query path. |
| 6.2 | Implemented | `docs/social/activity-types.md` defines the canonical event set; migrations `20260505093000` and `20260505094000` standardize `post` and enforce the constraint. |
| 6.3 | Implemented | `docs/social/feed-policy.md` defines feed inclusion, excluded noisy events, visibility behavior, and fanout criteria. |
| 7.1 | Implemented | `docs/clubs/roles-and-permissions.md` documents owner/admin/moderator/member semantics and current RLS/frontend alignment. |
| 7.2 | Implemented | `docs/messaging/permissions-audit.md` documents conversation membership, message read/write rules, and unread strategy. |
| 7.3 | Implemented | `docs/messaging/conversation-summary.md` documents the `get_conversation_summaries` RPC and `fetchConversations` now uses one summary query with latest message and unread count. |
| 8.1 | Implemented | `docs/architecture/frontend-service-boundaries.md` documents the service pattern; direct Supabase imports are confined to `src/services/api/*` and the integration client. |
| 8.2 | Implemented | `docs/architecture/mobile-device-boundaries.md` documents device boundaries and fallbacks; timer local notifications/app state moved to `src/services/timerNative.ts`, badge push orchestration moved to `src/services/badgeNotifications.ts`, and push hooks delegate native detection to `pushNotificationsService`. |
| 9.1 | Implemented | `docs/analytics/kpis.md` defines primary and secondary product KPIs. |
| 9.2 | Implemented | `docs/analytics/in-product-analytics.md` reviews user-facing analytics and expensive live calculations for precomputation. |
| 9.3 | Implemented | `docs/analytics/snapshot-strategy.md` documents snapshot tables/functions and chooses a hybrid incremental plus scheduled strategy. |
| 10.1 | Implemented | `docs/product/reading-loop-friction-audit.md` reviews add/import, resume, start timer, finish timer, progress update, and completion friction with notes and follow-ups. |
| 10.2 | Implemented | `docs/product/must-win-screens.md` selects dashboard, book detail, timer/session, and add/import flows with quality bars and follow-up tasks. |

## Performance Implementation Notes
- Epic 4 was implemented audit-first: dashboard query paths were documented before indexes and read models were added.
- New indexes were added only for documented hot paths and recorded in `docs/performance/index-audit.md`.
- Dashboard home now uses the snapshot-backed `dashboard_home_snapshots` table/RPC path instead of ad hoc frontend aggregation.
- Efficient dashboard metrics are covered by the dashboard home response: current streak, reading time, active goal progress, and current/continue-reading lists.
- Activity feed fanout remains intentionally deferred because the feed audit did not prove current `social_activities` queries are a bottleneck.

---

# Epic 1: Architecture Inventory and Documentation
**Priority: P0**

## Ticket 1.1 — Create database table catalog
**Description**
Document every table with purpose, ownership, source-of-truth status, visibility, write path, read path, and indexes.

**Acceptance Criteria**
- Every table in the public schema is listed
- Each table has a domain assignment
- Each table identifies whether it is source-of-truth or derived
- Each table identifies whether data is private, public, followers-only, or club-scoped
- Catalog is stored in `/docs/schema/table-catalog.md`

## Ticket 1.2 — Create database function and trigger catalog
**Description**
Document all DB functions and triggers, including side effects.

**Acceptance Criteria**
- Every trigger and DB function is listed
- Each entry includes input tables, output tables, trigger timing, and side effects
- Duplicate or overlapping logic is identified
- Catalog is stored in `/docs/schema/functions-and-triggers.md`

## Ticket 1.3 — Create edge function catalog
**Description**
Document all edge functions and secure external integrations.

**Acceptance Criteria**
- Every edge function is listed
- Each entry includes auth requirements, inputs, outputs, secrets, side effects, and retry concerns
- Stored in `/docs/backend/edge-functions.md`

## Ticket 1.4 — Create official domain map
**Description**
Define BRACK's domain boundaries.

**Acceptance Criteria**
- Identity, Reading, Social, Reviews, Clubs, Curation, Motivation/Analytics are documented
- Every table is mapped to a domain
- Stored in `/docs/architecture/domain-map.md`

---

# Epic 2: Security and RLS Audit
**Priority: P0**

## Ticket 2.1 — Build RLS matrix
**Description**
Create a full permission matrix for all user-facing tables.

**Acceptance Criteria**
- Matrix covers select/insert/update/delete
- Includes all social, reading, messaging, review, and club tables
- Stored in `/docs/security/rls-matrix.md`

## Ticket 2.2 — Audit profiles/auth onboarding write path
**Description**
Verify that new user creation, profile creation, settings defaults, and related triggers are safe and reliable.

**Acceptance Criteria**
- Sign-up flow is tested end to end
- No trigger-related failures on new user creation
- Profile creation is deterministic
- Any missing RLS policies are fixed

## Ticket 2.3 — Standardize visibility semantics
**Description**
Add or standardize visibility modeling across social/community tables.

**Acceptance Criteria**
- Visibility strategy is defined: private/followers/club/public
- Tables that need visibility controls are identified
- Migration plan exists for missing visibility fields

---

# Epic 3: Reading Workflow Consolidation
**Priority: P0**

## Ticket 3.1 — Audit reading write paths
**Description**
Map how reading sessions, progress, streaks, goals, and journal entries are written today.

**Acceptance Criteria**
- Current flow is documented for:
  - add book
  - start session
  - finish session
  - update progress
  - mark book complete
- Duplicate writes or hidden writes are identified

## Ticket 3.2 — Create transactional reading completion flow
**Description**
Move reading completion logic into one backend transaction path.

**Acceptance Criteria**
- A single backend path handles:
  - reading session write
  - progress update
  - streak update
  - goal update
  - activity generation if needed
- Flow is idempotent or safe against double submission
- Frontend uses only this consolidated path

## Ticket 3.3 — Define progress semantics
**Description**
Standardize what progress means in BRACK.

**Acceptance Criteria**
- Progress model is documented
- Page-based, percentage-based, and session-based logic are clearly defined
- Book completion rules are documented
- Stored in `/docs/product/progress-model.md`

## Ticket 3.4 — Define streak rules
**Description**
Make streak logic explicit and centralized.

**Acceptance Criteria**
- Rule for a valid reading day is documented
- User timezone handling is documented
- Backfill behavior is defined
- Logic lives in one backend responsibility zone

---

# Epic 4: Dashboard and Query Performance
**Priority: P1**

## Ticket 4.1 — Dashboard query audit
**Description**
Analyze every query required to render the dashboard.

**Acceptance Criteria**
- All dashboard queries are documented
- Round trips are counted
- Heavy joins and aggregations are identified
- Stored in `/docs/performance/dashboard-query-audit.md`

## Ticket 4.2 — Add missing indexes
**Description**
Add/verify indexes for the highest-traffic query paths.

**Acceptance Criteria**
- Index audit completed for reading, social, reviews, clubs, and messaging
- Missing indexes are added through migrations
- Query response improvements are validated

## Ticket 4.3 — Create dashboard read model
**Description**
Build a view, RPC, or snapshot-backed model for the dashboard.

**Acceptance Criteria**
- Dashboard can be fetched with one main query path
- Includes current streak, reading time, active goal progress, and recent/current reads
- Response shape is stable and documented

---

# Epic 5: Book Data Model Review
**Priority: P1**

## Ticket 5.1 — Assess current books schema usage
**Description**
Determine whether `books` mixes canonical metadata with user-specific state.

**Acceptance Criteria**
- Current usage patterns are documented
- Clear recommendation is made: keep as-is or plan split
- Risks of current model are documented

## Ticket 5.2 — Propose `books` + `user_books` migration plan
**Description**
Prepare a future-proof plan if user-specific data should be separated.

**Acceptance Criteria**
- Proposed schemas for `books` and `user_books` are documented
- Migration impact is assessed
- No migration is executed yet without approval

---

# Epic 6: Activity Feed and Social Consistency
**Priority: P1**

## Ticket 6.1 — Audit activity generation
**Description**
Catalog all triggers and functions that write to `social_activities`.

**Acceptance Criteria**
- Every activity-producing path is listed
- Duplicate activity risks are identified
- Event naming is standardized

## Ticket 6.2 — Define activity types
**Description**
Standardize allowed activity event types.

**Acceptance Criteria**
- Canonical set of activity types is documented
- Event naming is consistent across DB and app
- Stored in `/docs/social/activity-types.md`

## Ticket 6.3 — Reduce feed noise
**Description**
Decide what events belong in the main feed.

**Acceptance Criteria**
- Feed inclusion policy exists
- Low-value/noisy events are excluded
- Public/private activity behavior is defined

---

# Epic 7: Clubs and Messaging Hardening
**Priority: P1**

## Ticket 7.1 — Define club roles and permissions
**Description**
Formalize role-based permissions for clubs.

**Acceptance Criteria**
- Roles documented: owner/admin/moderator/member
- Allowed actions per role documented
- RLS and frontend expectations aligned

## Ticket 7.2 — Audit conversation and message permissions
**Description**
Ensure only valid members can access/write messages.

**Acceptance Criteria**
- Conversation membership rules are documented
- Message read/write permissions are enforced
- Unread-count strategy is documented

## Ticket 7.3 — Conversation summary optimization
**Description**
Create a reliable summary model for conversation lists.

**Acceptance Criteria**
- Conversation list can show latest message preview and updated_at efficiently
- Heavy live queries are reduced

---

# Epic 8: Frontend Service Boundaries
**Priority: P1**

## Ticket 8.1 — Centralize domain API access
**Description**
Refactor frontend Supabase access into domain-level service modules.

**Acceptance Criteria**
- Direct ad hoc Supabase calls in components are reduced
- Domain API files exist for reading, books, social, reviews, clubs, and profile
- Service boundary pattern is documented

## Ticket 8.2 — Separate mobile/device integration concerns
**Description**
Keep Capacitor/device-specific behavior isolated from generic domain logic.

**Acceptance Criteria**
- OCR, camera, notifications, and barcode/plugin code live in clear service boundaries
- Web fallback behavior is documented where needed

---

# Epic 9: Analytics and KPI Instrumentation
**Priority: P2**

## Ticket 9.1 — Define product KPIs
**Description**
Establish BRACK's core success metrics.

**Acceptance Criteria**
- Primary KPIs selected:
  - weekly active readers
  - sessions logged per active user
  - 7-day return rate after first session
- Secondary metrics documented

## Ticket 9.2 — User-facing analytics review
**Description**
Decide what analytics should appear in-product.

**Acceptance Criteria**
- User-facing metrics list is documented
- Any expensive live calculations are identified for precomputation

## Ticket 9.3 — Snapshot strategy for analytics
**Description**
Standardize how analytics snapshots are generated and consumed.

**Acceptance Criteria**
- Snapshot tables/functions are documented
- Scheduled vs incremental generation approach is chosen

---

# Epic 10: Product Focus and UX Hardening
**Priority: P0/P1**

## Ticket 10.1 — Core reading-loop friction audit
**Priority: P0**
**Description**
Audit the user's most important actions for UX friction.

**Acceptance Criteria**
- Review complete for:
  - add book
  - scan/import book
  - start reading
  - finish reading
  - update progress
  - resume current book
- Pain points are documented with screenshots/notes

## Ticket 10.2 — Define must-win screens
**Priority: P1**
**Description**
Identify and prioritize the screens that most affect retention.

**Acceptance Criteria**
- Top surfaces selected:
  - dashboard/home
  - book detail
  - timer/session flow
  - add/import flow
- Each has a quality bar and follow-up task list

---

# Suggested Sprint Order

## Sprint 1
- Ticket 1.1
- Ticket 1.2
- Ticket 1.3
- Ticket 1.4
- Ticket 2.1
- Ticket 2.2

## Sprint 2
- Ticket 3.1
- Ticket 3.2
- Ticket 3.3
- Ticket 3.4
- Ticket 10.1

## Sprint 3
- Ticket 4.1
- Ticket 4.2
- Ticket 4.3
- Ticket 5.1

## Sprint 4
- Ticket 6.1
- Ticket 6.2
- Ticket 6.3
- Ticket 7.1
- Ticket 7.2

## Sprint 5
- Ticket 8.1
- Ticket 8.2
- Ticket 9.1
- Ticket 9.2
- Ticket 9.3
- Ticket 10.2

---

# Definition of Done

A ticket is done only when:
- code/migrations/functions are implemented
- access/security implications are reviewed
- docs are updated
- affected query paths are tested
- acceptance criteria are met
- no hidden duplicate writes remain for the affected flow
