# BRACK frontend renewal: audit and implementation plan

Date: 2026-09-27. Baseline commit: `8d3b35ecd778f30d52e40498509dc4beab056e42`.

Current checkpoint: **[F10a - Library reconstruction](28-library-reconstruction.md), implemented and verified within scope; stopped for user review, uncommitted.** Baseline `d944fef` commits CR06b. Actual Library controls/flat rows/shared actions are rebuilt; exact checks and original failures are in28. No staging/commit. Next on authorized continuation: F10b Lists manager/detail composition. Remaining F10 acceptance, CR06c/remaining CR06, CR07-CR10 and other main screen tickets stay open.

## Outcome

Build a calmer, recognizably BRACK reading companion that belongs on phones and tablets, adapts deliberately to mobile browsers and installed apps, and remains efficient on desktop. Preserve the theme-aware identity, custom logos, existing font choices, Iconoir semantic icon system, reading semantics, and offline guarantees.

The primary problems are inconsistent ownership of navigation and gestures, insufficient prioritization of reading actions, excessive persistent chrome, inconsistent component composition, and feedback that sometimes delays or misrepresents the underlying action. A generic component-library replacement will not resolve these problems on its own.

## How to use this plan

1. Read this index and [continuation protocol](11-agent-handoff.md).
2. Choose a ticket from [execution](09-execution-plan.md); inspect only its linked specifications and current source.
3. Verify the baseline still applies. Record evidence and changed assumptions before implementation.
4. Implement one coherent vertical slice, retaining existing domain/service boundaries.
5. Complete its state, accessibility, platform, performance, and regression acceptance criteria; attach evidence before marking complete.

The user's later instructions supersede this plan. The plan's proposed behavior governs renewal work; current source describes what exists, not proof that the proposal has shipped. A discovered safety, accessibility, or platform incompatibility must be recorded and resolved rather than followed mechanically.

## Documents

| Document | Purpose |
| --- | --- |
| [01 — Architecture and evidence](01-architecture-evidence.md) | Repository map, Graphify/Obsidian method, constraints, engineering principles, evidence levels |
| [02 — Screen audit](02-screen-audit.md) | Route inventory and source-backed findings with severity |
| [03 — Platform and navigation](03-platform-navigation.md) | Native/browser/PWA distinction, tablet layout, back, overlays, Ionic adoption |
| [04 — Design system and components](04-design-system-components.md) | Preserve identity, reduce generic composition, primitive ownership and calendar/date contracts |
| [05 — Screen specifications](05-screen-specifications.md) | Detailed target behavior across the entire frontend |
| [06 — Motion, gestures, performance](06-motion-gestures-performance.md) | Brand feedback, loading, gestures, conflicts, navigation responsiveness |
| [07 — Accessibility](07-accessibility.md) | Technical target, disability inclusion, legal applicability research and manual tests |
| [08 — Twenty UX principles](08-ux-laws.md) | Applied decisions, pitfalls, and observable checks |
| [09 — Execution plan](09-execution-plan.md) | Ordered implementation tickets, dependencies, rollout and rollback |
| [10 — Verification and acceptance](10-verification.md) | Device/state matrix, existing commands, usability and release gates |
| [11 — Agent handoff](11-agent-handoff.md) | Durable memory, evidence discipline, efficient retrieval and progress ledger |
| [12 — Research and decision register](12-research-decisions.md) | Source provenance, accepted direction, conditional decisions, unresolved evidence |
| [13 — F01 implementation tracker](13-implementation-tracker.md) | Historical F01 changes/checks and pointer to the current batch |
| [14 — F02 + F03 batch](14-next-implementation-batch.md) | Historical committed batch, changes and actual verification |
| [15 — F04 + F05 batch](15-feedback-environment-batch.md) | Historical committed feedback/runtime foundation implementation and actual checks |
| [16 — F06 Ionic fit](16-ionic-fit-experiment.md) | Historical committed experiment, integration evidence and adoption decision |
| [17 — F07 Back ownership](17-back-ownership.md) | Historical committed ancestry, overlays, task protection and local gestures |
| [18 — F08 adaptive overlays](18-adaptive-overlays.md) | Historical stable modal, action, form and date implementation evidence; committed `bd342dc` |
| [19 — F09 adaptive shell](19-adaptive-shell.md) | Historical F09 implementation and scoped validation; committed `db076cf`, coverage reopened |
| [20 — Coverage reconciliation](20-coverage-reconciliation.md) | Active correction: source census, live consumer matrices, missed requirements and corrective batches |
| [21 — CR01 live composers](21-live-composers.md) | Historical committed CR01: comment/message ownership, media semantics and scoped evidence |
| [22 — CR02 responsive creation](22-responsive-composers.md) | Historical committed CR02: real Feed/BookClubs/Readers creation tasks, retention and guarded outcomes |
| [23 - CR03 Settings continuity](23-settings-continuity.md) | Historical committed CR03: category navigation, stable editors and protected Settings tasks |
| [24 - CR04 Library/list tasks](24-library-list-tasks.md) | Historical committed CR04: stable tasks, truthful outcomes and large-text/focus corrections |
| [25 - CR05 Messages layout and gestures](25-messages-layout-gestures.md) | Historical committed CR05: measured panes, retained task ownership, visible actions and guarded local gestures |
| [26 - CR06a Social destinations](26-social-destinations.md) | Committed historical child: actual social links/actions, readable large-text card intros, verified callers and explicit browser limitations |
| [27 - CR06b Route recovery](27-route-recovery.md) | Committed `d944fef`: Lists/Goals sign-in return, club Back, named Library links; exact evidence and remaining shell child |
| [28 - F10a Library reconstruction](28-library-reconstruction.md) | Current review stop: actual Library hierarchy, flat book rows, shared action disclosure, evidence and bounded continuation |
| [Fixture evidence](evidence/README.md) | Limited current-state visual inspection with screenshots and explicit limitations |

## User requirement traceability

| Request | Plan coverage |
| --- | --- |
| Understand repo through Obsidian, Graphify, docs | 01, 11; local generated vault read and graph queried |
| Audit mobile; use Ionic and One UI; declutter | 02–05, 12; component adoption gate and screen hierarchy |
| Distinguish native app from mobile browser; retain native bottom navigation | 03; runtime and viewport are separate inputs |
| Brand loading, streaks, XP, book/list/post feedback | 06; confirmed-result feedback and interruption contracts |
| Lag, back, swipe, pinch, drag, long press, conflicts | 03, 06, 10; measurable hypotheses and explicit arbitration |
| Tablets, iPads, foldables first | 03, 05, 10; window-based adaptation and pane constraints |
| Blind, deaf, motor/cognitive inclusion; legal concerns | 07, 10; accessibility always active, conditional legal scope |
| Twenty UX laws | 08; twenty applied principles with concrete checks |
| Update documents/skills; reduce hallucinations and token cost | 11; compact skill entrypoint and evidence-first delivery skill |
| Preserve themes/logos/fonts/icon library | 01, 04, 10; retention contract and theme verification |
| Detailed plan, no application code required | Entire directory; implementation remains separate |

## Direction fixed for this plan

- Phone/tablet app shells use reachable, labeled primary navigation. Native compact layouts retain bottom tabs. Compact browser layouts use a compact app header and explicit destination menu; browser Back never substitutes for app destinations.
- Installed PWA is a distinct presentation mode, while retaining web capabilities and web authentication contracts.
- Window size, available pane width, input capabilities, text scaling, and runtime jointly determine presentation. A tablet is not a stretched phone or an automatically dense desktop.
- Keep the current five primary destination identities (three with social disabled) for initial rollout. Test findability before changing information architecture.
- F06 tested pinned Ionic9.0.5 and deferred production router/modal adoption. Continue F07–F09 with the existing router and accessible primitives; the decision records evidence required to reconsider Ionic. Do not simultaneously run competing route, overlay, scroll, or back owners.
- Keep proven accessible headless foundations. Build BRACK-specific content composition above them. Date-only values, focus restoration, locale handling, drafts, and offline writes are invariants.
- Fix correctness and accessibility before motion polish. Fast actions do not wait for an animation; brand moments follow meaningful confirmed outcomes.

## Completion definition

Renewal is complete only when every route/surface in 02 has an implemented or explicitly justified disposition, required checks in 10 have evidence, and no release-blocking correctness/accessibility issues remain. A successful screenshot, unit test, or browser fixture alone does not establish native behavior or legal compliance.
