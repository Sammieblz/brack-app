# Architecture, evidence, and constraints

## Audit method and confidence

The repository was clean at the baseline recorded in the index. Existing `graphify-out/graph.json` was queried before source exploration. The initial frontend/platform query found 164 related nodes in an 8,073-node graph; a bounded result was used as a locator, followed by focused queries and direct source reads. `graphify-out/wiki/index.md` was absent. The existing `graphify-out/obsidian/` vault was read directly as Markdown; no Obsidian desktop UI or external vault connection is claimed.

Read vault entries included `architecture.md`, `frontend-service-boundaries.md`, `brack-frontend-uxSKILL.md`, and the frontend community note. Community titles can be misleading: the note named `_COMMUNITY_brack-frontend-uxSKILL.md` includes messaging and loading fixture members. Follow `source_file`, symbols, and typed connections, not the community title alone. Generated notes are navigational evidence, not authoritative implementation state.

Use these evidence levels throughout implementation:

| Label | Meaning | Required record |
| --- | --- | --- |
| Source-verified | Current source directly establishes a behavior, route, dependency or missing branch | Repository path, symbol, baseline commit; line number when useful |
| Fixture-observed | Reproduced with an existing controlled browser fixture | Fixture, scenario, viewport, browser, screenshot/test result, mocked dependencies |
| User-reported | User experiences the issue; reproduction not yet established | Report and workflow, without invented timings |
| Hypothesis | Plausible impact inferred from source or composition | Measurement/reproduction needed to confirm |
| Proposed | Target behavior, thresholds, or architecture | Owning ticket, rationale, acceptance criteria |
| Device-unverified | Requires real OS/browser/assistive technology | Device and scenario needed before release |

Do not convert a hypothesis into a measured defect. Conversely, a deterministic wrong route or unawaited save can be fixed from source evidence without waiting for a subjective visual study.

## Current ownership

| Area | Current location | Renewal boundary |
| --- | --- | --- |
| Shared renderer | `apps/client/src`, Vite/Tailwind config in `apps/client` | All shared feature UI remains here |
| Root router/providers | `apps/client/src/App.tsx` | BrowserRouter, lazy route boundaries, query persistence, timer/theme/reward providers |
| Screens | `apps/client/src/screens` | Preserve route identities and feature gates; see complete inventory in 02 |
| Shell | `components/MobileLayout.tsx`, `MobileHeader.tsx`, `NativeHeader.tsx`, `MobileBottomNav.tsx`, `AppSidebar.tsx` | Introduce clear ownership incrementally; do not clone entire feature trees by runtime |
| Navigation registry | `config/navigation.ts`, app-back components/hooks | Stable destination labels/routes and active-state matching |
| Runtime detection | `services/platform.ts` | Existing Capacitor, desktop bridge, standalone PWA functions are the starting point |
| Legacy platform styling | `lib/platform.ts`, consumers of `usePlatform` | User-agent OS detection is not proof of native runtime |
| Brand | `contexts/ThemeContext.tsx`, `lib/themes.ts`, `components/ThemeAwareLogo.tsx`, `components/theme-aware-logo.css` | Retain theme identities, theme-aware artwork and persisted choices |
| Icons | `config/iconography.ts`, `components/ui/app-icon.tsx`, `docs/design/iconography.md` | Retain Iconoir semantic mapping; icon dimensions are separate from hit-target dimensions |
| UI foundation | `components/ui`, feature-specific component folders | Radix/shadcn is existing infrastructure, not an obligation to retain generic card composition |
| Data-facing UI hooks | `hooks`, `contexts` | Continue service delegation; no direct backend imports introduced by redesign |
| Service contracts | `services/api`, `services/local`, `services/sync` | No schema or write-path redesign in this frontend pass |
| Device integration | `services/platform.ts`, device hooks and services | Native APIs behind adapters with explicit web fallback |
| Capacitor workspace | `apps/mobile/capacitor.config.ts`, root `ios/`, `android/` | Own config/native packaging; do not move native projects for aesthetics |
| Electron workspace | `apps/desktop` | Native desktop bridge, main/preload and packaging remain isolated |
| Shared package | `packages/typescript-config` | Do not invent a shared UI package without another real consumer |
| Test harnesses | `apps/client/src/**/*.test.*`, `tests/fixtures`, `tests/e2e`, `tests/playwright` | Extend existing scoped fixtures before adding another testing framework |

The monorepo is a delivery boundary, not the reason the interfaces must be identical. One React renderer can share domain state and present different navigation/overlays based on runtime and window constraints. See [monorepo ownership](../monorepo.md), [frontend service boundaries](../architecture/frontend-service-boundaries.md), and [device boundaries](../architecture/mobile-device-boundaries.md).

## Dependency facts and implications

Root `package.json` declares React 18, React Router 6, Capacitor 7, Tailwind 3, TanStack Query, Radix primitives, react-day-picker 8, Vaul, Iconoir, Framer Motion, GSAP, Lottie, react-swipeable, and dnd-kit. These are manifest ranges, not a substitute for exact lockfile versions. No Ionic package is declared at the audit baseline. Existing skills describing Ionic are guidance for adoption, not evidence that Ionic routing exists.

Multiple animation libraries are installed; installation does not prove all are loaded on a route. Measure import paths and production bundles before removing or consolidating them. Pin the selected Ionic release and read its real peer dependencies before choosing a router strategy. Current upstream metadata may differ from older published documentation; see 03 and 12.

## Existing engineering principles applied

1. Keep changes focused and independently reviewable. Separate behavior corrections, shell integration, visual composition, and optional cleanup when doing so makes regressions attributable.
2. Use TypeScript contracts and existing conventions. Extract stateful behavior when reuse/complexity warrants it; avoid introducing parallel schemas for the same form.
3. UI calls domain and local/offline services. Do not add network ownership to a new visual component.
4. Device calls remain behind services/hooks. Detect actual capability before showing a permission-driven action; preserve manual alternatives.
5. Preserve local save semantics, account scoping, duplicate detection, idempotent completion, sync recovery, and timer lifecycle. A new animation cannot define when a mutation succeeded.
6. Reuse semantic tokens and brand assets. Add tokens only where an actual missing semantic role is demonstrated.
7. Maintain one scroll owner per surface and one active owner per gesture/overlay/navigation concern. Overlapping owners require an explicit arbitration contract.
8. Verify observable user behavior, not tests that mirror implementation details. Run relevant existing checks and add meaningful regressions for confirmed defects.
9. Screenshots/videos accompany visual changes. Source inspection alone does not prove layout, contrast, screen-reader behavior, or device performance.
10. Record decisions and changes to documentation. Never report an unrun command as passed.

These apply the repository's [contribution guide](../contributing.md), [must-win screens](../product/must-win-screens.md), current frontend skill, and service/device boundaries. Examples in older documentation are not universally current; e.g. `docs/testing.md` incorrectly said no automated tests existed before this documentation pass.

## Retention contract

- Keep every existing theme ID and persisted preference. Preserve light/dark and paper/glass/comic/coloring-book surface identities; test actual theme pairs rather than assuming token use guarantees contrast.
- Preserve current font-family choices and type roles. Correct hierarchy, line height, loading/fallback, and scaling without substituting a new font brand.
- Preserve logo artwork and its theme-aware selection. Use existing vector/logo assets for loading identity; a new generic spinner is not the target.
- Keep Iconoir and semantic app icon ownership; do not add a competing icon system because an Ionic sample uses Ionicons.
- Preserve routes, aliases, auth callback/reset behavior, social feature gates, theme access rules and offline data contracts unless a specific ticket documents a necessary change.
- Preserve calendar date-only storage/validation, birth-date and historical year selection, locale formats, nested-dialog focus, and existing regressions.
- Retain installed native integrations where useful: share, scan/camera, haptics, app lifecycle, notifications. Missing capabilities such as keyboard/status-bar adapters require version/installation verification, not assumed availability.

## Proposed file organization

Improve ownership in place first. A future `components/shell/` may own adaptive shell/header/nav containers; `components/patterns/` may own shared book rows, action groups, adaptive overlays and status surfaces; `hooks`/`services` retain application and device behavior. Names are proposed, not existing import paths.

Move a component only when its owning ticket changes it and all consumers/tests can migrate together. Avoid a mass `screens` to `features` migration, new workspace, router rewrite and visual refresh in one pull request. After stable behavior, evaluate extraction based on real reuse. Keep compatibility re-exports only temporarily, with a removal ticket. Update the graph after code changes; do not use generated Obsidian notes as editable product specifications.
