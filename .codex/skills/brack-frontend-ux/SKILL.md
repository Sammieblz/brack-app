---
name: brack-frontend-ux
description: >
  Product-aware frontend, UI/UX, responsive, native-feeling, accessibility, motion,
  and cross-platform implementation guidance for BRACK, a React/TypeScript book-tracking
  application delivered from one shared codebase to web/PWA, iOS/Android through Capacitor,
  and desktop. Use this skill whenever designing, implementing, reviewing, refactoring, or
  debugging BRACK screens, components, navigation, interactions, reading workflows, responsive
  layouts, Ionic/Capacitor integrations, offline states, animation, accessibility, or visual polish.
---

# BRACK frontend and UX

Build a calm, book-centered experience from the shared React renderer, adapting presentation to runtime, window size and input capability. Preserve themes, logos, Inter/Merriweather/Playfair type roles, Iconoir semantic icons, reading semantics and offline behavior.

## Read only the relevant guidance

The detailed standard is preserved in topical references. Read the matching reference for the task; do not load all references by default. Existing numeric section names remain available for targeted search.

| Task | Reference |
| --- | --- |
| Product principles, shared architecture, source priority | [Foundations](references/foundations.md) |
| Native/browser/PWA, Ionic, navigation, tablets, safe areas, permissions | [Platform and navigation](references/platform-navigation.md) |
| Reading, books, forms, dates, lists, overlays, search, loading, offline, errors | [Feature patterns](references/feature-patterns.md) |
| Theme, typography, icons, tokens, charts | [Visual system](references/visual-system.md) |
| Motion, gestures, sound, reduced effects | [Motion](references/motion.md) |
| Keyboard, screen readers, large text, focus | [Accessibility](references/accessibility.md) |
| Rendering, images, lists, frame performance | [Performance](references/performance.md) |
| Review, test matrix, delivery workflow and quality gates | [Review and delivery](references/review-delivery.md) |

## Current renewal work

For the frontend renewal, start with [the plan index](../../../docs/frontend-renewal/README.md) and load only the selected ticket's specifications. The [agent handoff](../../../docs/frontend-renewal/11-agent-handoff.md) defines evidence and continuation records. The separate `brack-frontend-delivery` skill supports executing this plan with bounded retrieval.

The renewal dossier describes proposed behavior and audited baseline facts separately. It does not mean implementation or device QA has happened. Older examples in the detailed standard describe direction, not installed packages. The [F06 Ionic decision](../../../docs/ui-ionic-fit.md) defers production adoption after the isolated 9.0.5 experiment; the app retains React Router 6 and existing primitives. Verify actual package/lockfile versions and current official compatibility before reconsideration. Do not silently replace the router, data layer, icon library or fonts.

## Essential constraints

1. Follow the user's current instructions and preserved product behavior, then current code/domain contracts and the relevant specification. Record conflicts instead of inventing behavior.
2. Inspect the existing implementation before creating primitives. Use the existing Graphify query when the index exists, then verify cited source. Generated Obsidian notes are navigation aids.
3. Share domain logic and schemas; adapt layout, navigation, overlays and input. Runtime detection, window class and capability are separate concepts. A mobile browser is not a Capacitor runtime.
4. Keep service/device boundaries; no direct backend calls added to visual components. Core reading capture remains local/offline-safe and idempotent.
5. Give each surface one clear primary action and coherent scroll, overlay and back ownership. Critical actions need visible alternatives to gestures.
6. Keep existing accessible primitives where sound. Custom BRACK composition does not mean reimplementing focus, date parsing or keyboard behavior without equivalent tests.
7. Accessibility is always active. Honor OS reduced motion, zoom and text scaling; app preferences may further reduce effects. Never require an 'enable screen reader' switch.
8. Preserve drafts until confirmed save, distinguish pending/local/synced outcomes, and retain cached content during refresh. Do not delay navigation to finish an animation.
9. Preserve theme IDs, fonts, logos and icon semantics; verify contrast and focus on changed surfaces rather than assuming theme tokens guarantee them.
10. Prove native behavior on actual devices. Source findings, browser fixtures, performance hypotheses and legal conformance are different evidence levels.

## Delivery

Before changing Back, overlays or touch handlers, use the living [app Back](../../../docs/ui-back-navigation.md) and [local gesture](../../../docs/ui-local-gestures.md) contracts. Preserve the shared coordinator, explicit overlay registration, pending/dirty guards and browser-owned history. The Android callback fixture does not establish hardware IME or iOS edge behavior; independent native stacks remain future shell work.

Define useful states, semantic structure and responsive behavior before motion. Run relevant existing contracts, add meaningful behavior regressions, and attach actual results. Update current-behavior docs after implementation; mark incomplete device checks honestly. For code changes update an existing Graphify index locally per project instructions; do not trigger cloud extraction or a new broad index merely to finish a UI task.
