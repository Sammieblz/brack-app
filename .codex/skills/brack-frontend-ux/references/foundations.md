
# BRACK Frontend & UX Skill

## Purpose

This skill defines how BRACK should **look, behave, adapt, and feel** across web, mobile, and desktop.

It is not a generic style guide. It is a product-specific implementation standard for BRACK.

The goal is:

> Build one coherent BRACK product from one React codebase, while allowing each platform to feel native to itself.

"One codebase" does **not** mean "one identical layout everywhere." Reuse domain logic, data access, design tokens, feature components, and interaction intent. Adapt navigation, density, overlays, input, hover behavior, keyboard behavior, safe areas, and system integrations to the platform.

BRACK should feel:

- calm, focused, warm, and book-centered;
- fast and predictable;
- obvious without being simplistic;
- tactile on touch devices;
- efficient with mouse and keyboard;
- accessible at large text sizes and with assistive technology;
- resilient offline;
- visually distinctive without fighting platform conventions.

---

# 1. When to use this skill

Use this skill for any BRACK work involving:

- page or screen design;
- React component creation or refactoring;
- Ionic React integration;
- Capacitor/native integration;
- routing and navigation;
- mobile, tablet, web, desktop, foldable, or responsive layout;
- library, book, reading, session, progress, goal, streak, note, quote, journal, or analytics UX;
- search, add-book, barcode, OCR, or manual-entry flows;
- forms and validation;
- loading, error, empty, success, offline, syncing, disabled, selection, or edit states;
- modals, sheets, popovers, toasts, action sheets, dialogs, or menus;
- gestures, swipes, drag interactions, pull-to-refresh, or haptics;
- accessibility;
- motion or animation;
- typography, spacing, icons, color semantics, theme, or dark mode;
- performance or perceived-performance work;
- UI review or design QA.

Do not limit this skill to "styling." UX behavior and system integration are part of the frontend contract.

---

# 2. Source-of-truth priority

When instructions conflict, use this order:

1. The user's explicit request in the current task.
2. Existing BRACK product behavior that the task explicitly says must be preserved.
3. Current BRACK code and established product/domain terminology.
4. This skill.
5. Current official Ionic/Capacitor platform guidance.
6. General web/mobile design conventions.

Do not invent a new product direction because a design pattern is fashionable.

When working in the repository:

1. Inspect the current implementation before changing architecture.
2. Reuse existing tokens, hooks, components, services, and feature boundaries when sound.
3. Refactor only when the requested change or maintainability clearly justifies it.
4. Do not silently replace the application's routing, state, persistence, or component system.

---

# 3. BRACK product context

BRACK is a cross-platform book-tracking and reading companion.

Known product capabilities include:

- personal book library / book management;
- reading status and progress tracking;
- reading sessions and timers;
- reading-speed/time/page statistics;
- goals;
- streaks;
- journaling;
- notes;
- quotes;
- analytics;
- reader/club discovery and book metadata search; do not infer a personalized book-recommendation service from suggested people/clubs or product copy;
- book discovery/search;
- book lookup using external book metadata;
- barcode/OCR-assisted book entry;
- manual book entry as a reliable fallback;
- reminders/notifications;
- achievements/badges;
- app currencies/reward concepts including **Lifetime Ink** and **Gold Leaves**.

Known technical direction:

- React;
- TypeScript;
- Vite;
- Capacitor for iOS/Android;
- web/PWA delivery;
- desktop delivery from the shared React application;
- Supabase PostgreSQL;
- Supabase Auth;
- Supabase Edge Functions;
- Supabase Realtime where useful;
- Supabase Storage where useful;
- TanStack Query;
- Tailwind CSS;
- shadcn/ui in the existing web-oriented component layer where appropriate;
- local durable storage using IndexedDB and/or SQLite depending on platform;
- local-first/offline-aware reading progress;
- an outbox/sync model for reconnecting local changes;
- Sentry or equivalent production error monitoring where configured.

If the current repository differs from this remembered context, inspect the repository and follow the actual implementation unless the task explicitly requests migration.

---

# 4. BRACK's product design principles

## 4.1 Recognition over invention

Prefer recognizable interaction patterns.

Users should not have to learn that:

- a decorative object is actually a button;
- swiping is the only way to expose a critical action;
- a custom icon means "save";
- tapping a title means "edit";
- a nonstandard control means "back."

Novel visuals are welcome. Novel interaction grammar should be rare.

---

## 4.2 Make the next correct action obvious

Every screen should answer, at a glance:

1. Where am I?
2. What is the most important information here?
3. What can I do next?
4. What happened after I acted?

Do not make every action equally prominent.

Use one clear primary action per local decision context whenever possible.

---

## 4.3 Viewing area vs. interaction area

On handheld devices, treat the screen as two behavioral zones:

- **Viewing area:** titles, summaries, passive information, book imagery, progress context.
- **Interaction area:** frequent controls, decisions, navigation, session controls, completion actions.

Favor reachable controls in the lower portion of handheld screens when the task is action-heavy.

Do not place every important mobile action in a tiny top-right icon just because desktop software traditionally does.

---

## 4.4 Content first

BRACK is about books and reading, not UI chrome.

Prefer:

- strong cover imagery where useful;
- readable titles/authors;
- clear progress;
- calm negative space;
- information grouping;
- restrained decoration.

Avoid dashboard noise that competes with reading information.

---

## 4.5 Consistency over cleverness

A book row should behave like other book rows.
A destructive action should be represented consistently.
Loading patterns should be consistent.
The same semantic action should not use unrelated icons across screens.

Create reusable interaction patterns, not one-off screen hacks.

---

## 4.6 Forgiving interactions

Users must be able to recover from mistakes.

Use:

- undo where practical;
- confirmation for high-impact/destructive operations;
- autosave only where loss risk is low and state is clearly communicated;
- explicit Save/Done when the decision is substantial;
- drafts for long writing where practical;
- idempotent sync operations;
- retry for network failures.

Never make a swipe gesture the only way to recover or act.

---

## 4.7 Perceived speed matters

Render stable structure quickly.

Prefer:

1. screen shell;
2. known local/cached data;
3. loading only for the region that is actually changing;
4. background refresh;
5. subtle sync state if necessary.

Avoid blocking the entire app with a spinner for a local update.

---

# 5. Cross-platform philosophy

## 5.1 Share intent, not necessarily presentation

Share:

- feature/domain models;
- business logic;
- Supabase/query logic;
- validation schemas;
- design tokens;
- analytics events;
- permissions;
- capability checks;
- accessibility semantics;
- interaction intent.

Adapt:

- navigation shell;
- toolbar placement;
- bottom bars;
- sidebars;
- modal vs. sheet behavior;
- hover;
- context menus;
- pointer affordances;
- keyboard shortcuts;
- density;
- safe-area spacing;
- system back behavior;
- native plugins;
- desktop window constraints.

---

## 5.2 Platform layers

Think in four layers.

### Layer A — Domain

Books, reading sessions, progress, goals, streaks, notes, quotes, journal entries, achievements, currencies, recommendations.

No platform-specific code.

### Layer B — Application behavior

Hooks, use cases, query/mutation orchestration, validation, optimistic updates, offline outbox, sync reconciliation.

Keep mostly platform-agnostic.

### Layer C — Adaptive UI

Shared feature components and design primitives.

They may switch presentation depending on:

- viewport;
- pointer type;
- hover capability;
- current Ionic mode;
- native/web runtime;
- device capability.

### Layer D — Platform integration

Capacitor plugins, native haptics, keyboard, status bar, notifications, camera/scanner, filesystem/share features, Android back behavior, desktop shell APIs.

Isolate these behind service/adaptor modules.

Do not call native plugins throughout arbitrary components.

---

# 6. Recommended project boundaries

Preserve the current repository structure if it is already coherent. For new modules, prefer a feature-oriented shape similar to:

```text
src/
  app/
    routing/
    providers/
    shell/
  features/
    library/
    books/
    search/
    add-book/
    reading/
    sessions/
    goals/
    streaks/
    journal/
    notes/
    quotes/
    analytics/
    achievements/
    recommendations/
    settings/
  components/
    ui/
    adaptive/
    book/
    reading/
  design-system/
    tokens/
    typography/
    motion/
    icons/
  hooks/
  services/
    supabase/
    sync/
    books/
    notifications/
    platform/
  platform/
    capacitor/
    web/
    desktop/
  storage/
    local/
    outbox/
  lib/
  types/
```

Rules:

- Feature components own feature presentation.
- Shared components must be genuinely reusable.
- Do not create a giant `components/` dumping ground.
- Platform-specific code belongs behind adapters.
- Data fetching should not be duplicated in multiple visual components.
- Avoid components that know both low-level Supabase details and detailed presentation state.

---

