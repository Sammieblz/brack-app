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
- personalized recommendations based on reading history/preferences;
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

# 7. Ionic React strategy

BRACK uses React and Capacitor. When Ionic React is present or being adopted, use Ionic primarily where it improves **native interaction behavior**, not merely because a component exists.

## 7.1 Keep adaptive styling

Default to:

- `ios` mode on Apple platforms;
- `md` mode on Android;
- platform-appropriate behavior elsewhere.

Do not force `ios` mode on Android to make the product "look premium."
Do not force `md` mode everywhere for visual consistency.

BRACK's brand should live in tokens, imagery, typography choices, layout, custom content components, and restrained surface styling—not by erasing platform behavior.

---

## 7.2 Prefer Ionic for mobile application primitives

When appropriate, prefer Ionic primitives for:

- page shell — `IonPage`;
- scroll container — `IonContent`;
- headers — `IonHeader`;
- toolbars — `IonToolbar`;
- titles — `IonTitle`;
- toolbar actions — `IonButtons`;
- back navigation — `IonBackButton`;
- tabs — `IonTabs`, `IonTabBar`, `IonTabButton`;
- routing container — `IonRouterOutlet`;
- search — `IonSearchbar`;
- segments — `IonSegment`;
- toggles — `IonToggle`;
- selectors — `IonSelect`;
- date/time — `IonDatetime`;
- pull-to-refresh — `IonRefresher`;
- mobile lists — `IonList`, `IonItem`;
- swipe row actions — `IonItemSliding`;
- modals/sheets — `IonModal`;
- popovers — `IonPopover`;
- action sheets — `IonActionSheet`;
- toasts — `IonToast`;
- loading indicators — Ionic progress/spinner primitives where suitable.

Do not rebuild mature mobile interaction behavior with generic `div`s unless BRACK has a concrete need Ionic cannot satisfy.

---

## 7.3 Do not mix component systems randomly

BRACK may use shadcn/ui for web/desktop and Ionic for mobile-native behavior.

That is acceptable only with an intentional adaptive boundary.

Good:

```text
Feature component
  -> Adaptive primitive
      -> Ionic implementation on touch/mobile
      -> Web/desktop implementation where appropriate
```

Bad:

```text
IonModal
  containing Radix Dialog
    containing custom focus trap
      containing another portal
```

Do not stack competing overlay/focus systems.

Create wrappers when the same product action needs different surface behavior.

Examples:

- `AdaptiveDialog`
- `AdaptiveActionMenu`
- `AdaptiveDatePicker`
- `AdaptiveNavigation`
- `AdaptiveBookActions`

The wrapper should normalize product semantics, not hide every platform capability behind an enormous prop API.

---

# 8. Navigation architecture

Navigation is product structure, not decoration.

## 8.1 Ionic routing fundamentals

When using Ionic React routing:

- use `IonReactRouter`;
- routes rendered as Ionic pages should use `IonRouterOutlet`;
- router-controlled views should be proper Ionic pages;
- `IonPage` is required for normal page sizing and transition behavior;
- allow `IonRouterOutlet` to preserve page state and provide platform transitions;
- keep non-route children outside `IonRouterOutlet`;
- use nested outlets primarily for legitimate cases such as tabs;
- avoid gratuitous nested routing.

For nested `IonRouterOutlet` patterns, follow the current Ionic React documentation for the installed version.

---

## 8.2 Preserve tab stacks

Mobile tabs are independent navigation stacks.

If BRACK has persistent main tabs:

- switching tabs should not unexpectedly reset each tab;
- returning to a tab should generally restore its last meaningful position/state;
- Back inside a tab should navigate within that tab's stack;
- browser-history assumptions must not break mobile tab behavior.

Do not use `navigate(-1)` as a universal back strategy in a non-linear tab architecture.

Prefer Ionic-aware back behavior such as `useIonRouter().goBack()` when using Ionic's stack model.

---

## 8.3 URLs still matter

Because BRACK also serves the web:

- meaningful screens should have addressable URLs when appropriate;
- book details should be deep-linkable where product/privacy rules allow;
- back/forward should behave reasonably in browser mode;
- refresh should not destroy route identity;
- avoid placing durable application state only in an in-memory modal.

Cross-platform routing should support both mobile navigation semantics and web addressability.

---

## 8.4 Primary navigation rules

Do not invent or rename BRACK's primary destinations without product direction.

When primary tabs/navigation exist:

- keep the set stable;
- do not reorder tabs based on transient state;
- avoid hiding a primary tab unexpectedly;
- use icon + label when discoverability benefits from text;
- do not use a bottom action toolbar as if it were navigation;
- do not use bottom navigation for temporary contextual actions.

On larger screens, a bottom tab bar may adapt into:

- a left navigation rail;
- a sidebar;
- a top-level desktop shell.

The destinations should remain conceptually consistent even if placement changes.

---

# 9. Responsive and adaptive layout

## 9.1 Responsive does not mean "scale everything"

At larger sizes, restructure information.

Examples:

### Compact phone

- single-column;
- bottom navigation if BRACK's current IA uses tabs;
- reachable primary actions;
- sheets and full-screen flows;
- concise metadata.

### Large phone / foldable

- wider cards;
- optional two-column grids;
- still touch-first;
- do not stretch paragraphs edge-to-edge.

### Tablet

- two-pane master/detail where useful;
- library/search list on one side and book detail on the other;
- persistent secondary navigation when it reduces unnecessary drilling;
- modal width constraints.

### Desktop/web

- navigation rail/sidebar where appropriate;
- multiple visible information regions;
- pointer hover affordances;
- keyboard support;
- right-click/context menus only for nonessential shortcuts;
- denser tables/analytics when readable;
- constrained reading widths.

Do not simply turn a mobile card into a 1600px-wide card.

---

## 9.2 Margins and safe areas

For handheld content:

- respect system safe areas;
- treat 24dp-equivalent side margin as a strong default minimum where appropriate;
- never allow essential touch controls under notches, system gestures, or rounded display cutouts;
- use Ionic/Capacitor safe-area variables rather than hard-coded device exceptions.

On web/desktop:

- use a centered max-width or structured multi-column layout rather than infinite text width;
- allow data-heavy pages such as analytics to use more width than prose-heavy pages.

---

## 9.3 Touch targets

Interactive touch targets should be comfortably tappable.

Prefer a minimum target around 44×44 CSS px / platform-equivalent even when the visible icon is smaller.

Do not make tiny icons the only way to perform important actions.

Adjacent destructive/confirm actions need enough separation to prevent accidental taps.

---

## 9.4 Pointer-aware behavior

Use capability queries, not screen size alone.

Examples:

```css
@media (hover: hover) and (pointer: fine) {
  /* desktop/pointer-specific hover treatment */
}
```

Do not rely on hover to reveal essential information on touch platforms.

Do not trigger hover animations on coarse pointers.

---

# 10. Page structure

A normal mobile screen should follow this conceptual hierarchy:

```text
IonPage
  Header / Toolbar
  IonContent
    Page summary / viewing area
    Primary content
    Local actions
  Optional persistent bottom interaction region
```

On a first-level screen, a larger/expanded title treatment may be appropriate.

On a deeper screen:

- use a concise navigation header;
- provide Back where platform navigation needs it;
- keep the content hierarchy clear;
- do not waste half the screen on an oversized title.

Use large-title/condensing-header behaviors when they improve browsing and fit the installed Ionic version/platform.

Do not force iOS-specific large-title conventions onto Android if Ionic's adaptive mode would choose differently.

---

# 11. BRACK feature UX patterns

## 11.1 Library

The library is a core product surface.

Priorities:

1. recognize books quickly;
2. understand reading status/progress;
3. find or filter quickly;
4. resume reading/update progress with minimal friction.

Book cards/rows should prioritize:

- cover;
- title;
- author;
- reading status;
- useful progress information.

Secondary metadata must not overwhelm the title and progress.

Provide sensible grid/list adaptation:

- grid is useful for visual browsing;
- list is useful for metadata density and accessibility;
- preserve the user's chosen mode if the product supports both.

Empty library:

- explain that the library is empty;
- provide a direct add/discover action;
- do not display a dead blank canvas.

---

## 11.2 Book detail

The book detail screen should answer:

- What book is this?
- What is my relationship to it?
- What is my current status/progress?
- What can I do next?

A typical priority order:

1. cover/title/author identity;
2. status and progress;
3. primary action such as start/resume/update;
4. reading history or session summary;
5. notes/quotes/journal related to the book;
6. metadata/details;
7. secondary management actions.

Avoid presenting Edit, Delete, Share, Change Cover, Move Shelf, Reset Progress, etc. as equally prominent primary buttons.

Put secondary management actions into a context menu or action sheet when appropriate.

---

## 11.3 Add book

BRACK supports multiple acquisition paths. The UX should degrade gracefully.

Preferred conceptual flow:

```text
Add book
  -> Search metadata
  -> Scan barcode / OCR where available
  -> Manual entry fallback
```

Do not make scanning mandatory.

For scan workflows:

- request camera permission at the moment it is needed;
- explain why permission is needed;
- show scanning state clearly;
- provide torch/flash controls when supported and useful;
- give immediate success feedback;
- allow the user to verify metadata before committing if recognition is uncertain;
- preserve the ability to correct title/author/ISBN;
- provide a manual route when scanning fails.

Do not trap a web/desktop user in a camera-first flow when text search is more appropriate.

---

## 11.4 Reading session / timer

The reading session is a high-frequency, focus-sensitive interaction.

It should be intentionally calm.

Priorities:

- current book identity;
- elapsed reading time;
- pause/resume/finish controls;
- optional progress context;
- accidental-exit protection when a session is active.

Avoid:

- decorative looping animations;
- bouncing controls;
- noisy analytics while the user is trying to read;
- hiding the session stop/end action.

The primary session control should be thumb-reachable on mobile.

When the app is backgrounded, suspended, or resumed:

- derive elapsed time from reliable timestamps rather than assuming JS timers ran continuously;
- make session recovery deterministic;
- do not double-count time after resume;
- reconcile local session state before remote sync.

If ending a session requires page/location input, keep the end flow short and focused.

---

## 11.5 Progress updates

Progress input may be pages, percentage, or another book-specific unit depending on the current domain model.

Rules:

- show the current value before editing;
- prevent impossible values;
- do not silently decrease progress unless the user intentionally changes it;
- make completion explicit;
- if a progress update changes a book to "finished," clearly communicate that consequence;
- use optimistic local feedback where safe;
- sync in the background;
- do not block progress logging because the network is unavailable.

---

## 11.6 Goals

Goals should be understandable in plain language.

A goal card should make visible:

- target;
- current progress;
- time period;
- remaining amount or completion state.

Avoid charts when a progress bar and two numbers communicate the same thing better.

Goal creation/editing should:

- use appropriate numeric keyboards on mobile;
- validate ranges inline;
- make period/date boundaries understandable;
- avoid requiring users to calculate derived values themselves.

---

## 11.7 Streaks

Streaks are motivating context, not a threat.

Display:

- current streak;
- what qualifies;
- when the next successful action is needed;
- historical/best streak where useful.

Do not use misleading urgency.
Do not punish users visually with excessive red.
Do not imply a streak is synced if the local event is still pending.

---

## 11.8 Journal, notes, and quotes

Writing is content-first.

Use:

- generous text area;
- legible line length;
- autosave/draft behavior when safe;
- explicit save state if autosave latency matters;
- keyboard-aware layout;
- persistent content during navigation interruptions.

For quotes:

- allow source/page/location metadata where supported;
- prioritize quote text;
- provide edit/copy/share actions without visually competing with the text.

On desktop, keyboard shortcuts can improve writing efficiency.
Keyboard-initiated actions should not receive decorative animations.

---

## 11.9 Analytics

Analytics should answer user questions, not merely display charts.

Start with summaries such as:

- reading time;
- books/pages completed;
- current pace;
- goal progress;
- trends.

Then provide charts when they reveal a relationship or change that is difficult to see from numbers alone.

Every chart should have:

- clear title;
- readable units;
- accessible text summary or equivalent data;
- usable contrast;
- touch/pointer interaction that is not required to understand the chart;
- empty/no-data state;
- sensible date range.

Do not create dashboard clutter with redundant mini-charts.

---

## 11.10 Recommendations

Recommendations must explain themselves enough to be useful.

Good supporting context may include:

- because you read;
- based on a genre/author preference;
- similar to a completed book;
- aligned with current reading patterns.

Do not present personalized recommendations as guaranteed user preference.

Keep recommendation actions clear:

- view;
- add/save;
- dismiss/not interested if supported.

---

## 11.11 Achievements, badges, and currencies

Achievement visuals are collectible rewards, not navigation UI.

For BRACK achievement/badge artwork, preserve the established direction:

- cozy magical 3D storybook feel;
- soft clay-like rounded forms;
- warm golden fantasy lighting;
- pastel parchment / amber / terracotta / sage / dusty-purple / soft-teal family;
- transparent composition when used as an asset;
- one main focal subject;
- at most one or two supporting elements;
- minimal text;
- generous negative space;
- readable silhouette;
- premium, collectible, playful, storybook-like;
- never flat corporate, sci-fi, or visually crowded;
- do not include author/person silhouettes unless a specific badge explicitly calls for them.

Currency concepts such as **Lifetime Ink** and **Gold Leaves** should use simpler, more icon-like representations than achievement badges.

Do not let collectible art dictate the functional UI color system.

---

# 12. Component hierarchy and states

Every reusable interactive component must account for the states relevant to it.

Possible states:

- default;
- hover;
- focus-visible;
- pressed/active;
- disabled;
- loading;
- selected;
- error;
- success;
- offline/pending;
- syncing;
- destructive.

Do not ship components that look correct only in their default state.

---

# 13. Buttons and actions

## 13.1 Hierarchy

Within one action group:

- one primary action;
- secondary actions visibly quieter;
- tertiary actions may be text/icon treatments;
- destructive actions use semantic warning/destructive styling.

Do not use destructive red for ordinary navigation.

---

## 13.2 Feedback

A press should feel acknowledged immediately.

Good feedback:

- subtle background change;
- opacity change;
- tiny scale/transform response;
- platform-native ripple/highlight where Ionic provides it;
- haptic feedback for selected high-value native interactions.

Do not wait for the network before showing that the press was received.

---

## 13.3 Labels

Prefer clear verbs:

- Add book
- Start reading
- Resume session
- Finish session
- Save note
- Update progress

Avoid vague labels such as:

- OK
- Submit
- Continue

unless context makes them unambiguous.

---

# 14. Forms and input

## 14.1 Native input semantics

Use the correct:

- `type`;
- `inputmode`;
- `enterkeyhint`;
- autocomplete;
- autocorrect;
- capitalization behavior.

Examples:

- ISBN/page numbers -> numeric-oriented input where suitable;
- email -> email keyboard;
- search -> search semantics;
- URLs -> URL semantics.

---

## 14.2 Validation

Validate near the field.

Error text should explain how to recover.

Bad:

> Invalid value.

Better:

> End page cannot be lower than your current page of 184.

Do not clear the user's input on validation failure.

---

## 14.3 Labels

Do not rely on placeholders as labels.

Labels should remain understandable when a field contains a value.

Required/optional semantics must be explicit where ambiguity matters.

---

## 14.4 Keyboard behavior

On mobile:

- prevent focused fields from being hidden by the software keyboard;
- keep the primary form action reachable;
- test sheets/modals with the keyboard open;
- listen to Capacitor keyboard lifecycle events when custom layout response is necessary;
- use the correct resize strategy for the app shell;
- avoid brittle `100vh` assumptions.

---

# 15. Search UX

Search is a high-frequency workflow.

Use debouncing for remote queries.
Do not delay local filtering unnecessarily.

Search states:

- untouched;
- typing;
- loading remote results;
- results;
- no results;
- offline/local-only results;
- recoverable error.

For book search:

- visually distinguish title and author;
- include cover/edition identifiers when needed;
- avoid accidental duplicate library entries;
- show whether a result is already in the user's library if known.

Do not show a full-screen spinner on every keystroke.

---

# 16. Lists, rows, and selection

Lists should support fast scanning.

Use consistent alignment/keylines for:

- cover/icon;
- primary text;
- secondary text;
- trailing metadata/action.

Selection mode should clearly change the interface state:

- show selected count;
- reveal only actions relevant to the selection;
- provide an obvious exit/cancel;
- preserve accessibility semantics.

Do not overload normal row taps with multi-select behavior unless selection mode is active.

---

# 17. Swipe actions

Swipe may accelerate frequent row actions, but it must not be the only path.

If using `IonItemSliding`:

- map actions semantically to start/end rather than hard-coded left/right;
- ensure RTL remains sensible;
- reserve full-swipe destructive behavior for cases with strong recovery/undo;
- close other sliding rows when appropriate;
- expose the same actions through an accessible menu.

---

# 18. Modals, sheets, popovers, action sheets, and dialogs

Choose the surface based on the task.

## 18.1 Sheet / bottom sheet

Prefer for mobile contextual tasks such as:

- book actions;
- filters/sort;
- quick progress updates;
- compact creation/editing;
- secondary details.

Use Ionic sheet modal breakpoints when the interaction benefits from partial/full heights.

Do not force a desktop-like centered dialog for every mobile task.

---

## 18.2 Centered modal/dialog

Use for:

- focused decisions;
- content that benefits from stable centered reading;
- destructive confirmation;
- larger tablet/desktop modal workflows.

---

## 18.3 Popover

Use for content spatially tied to a trigger.

It should emerge from the trigger region.

On touch/compact screens, an action sheet or sheet may be more appropriate than a tiny popover.

---

## 18.4 Ionic vs. actual native system UI

Use Ionic overlays when BRACK requires:

- custom branding;
- custom content;
- consistent product controls;
- React content;
- complex flow.

Use Capacitor/native system UI when the operating system's own prompt/action surface is materially better and the plugin is appropriate.

Examples can include native:

- action sheet;
- dialog;
- share;
- permission prompt;
- haptic feedback;
- keyboard behavior;
- status bar behavior.

Do not invoke a native dialog merely to avoid styling an ordinary BRACK screen.

---

# 19. Toasts, alerts, and feedback

Use feedback proportional to importance.

### Inline message

Use when the message belongs to a specific field/section.

### Toast

Use for short, nonblocking confirmation such as:

- saved;
- copied;
- added to library;
- sync completed after a background operation.

Action toasts may include Undo when appropriate.

### Dialog

Use when the user must decide before continuing.

Do not use a modal alert for routine success.

---

# 20. Loading and progress

Distinguish determinate from indeterminate work.

Use:

- spinner/skeleton for unknown duration;
- progress bar/percentage for known progress;
- local button loading for local actions;
- region-level skeleton for data sections;
- optimistic content for safe local-first changes.

Do not fake progress percentages.

For file/cover uploads, if present:

- show file/asset state;
- show upload progress when known;
- allow retry;
- allow cancellation when feasible;
- explain failures.

---

# 21. Empty states

Every important BRACK collection needs an intentional empty state.

Examples:

- no books;
- no current reads;
- no notes;
- no quotes;
- no goals;
- no session history;
- no analytics for the selected period;
- no search results.

An empty state should include:

1. what this area is;
2. why it is empty when helpful;
3. a relevant next action.

Do not use whimsical illustration at the expense of clarity.

---

# 22. Offline and sync UX

Offline support is a first-class BRACK requirement, especially for reading progress and sessions.

## 22.1 Local-first interaction

For user-generated state that is safe to capture locally:

1. validate locally;
2. persist locally;
3. update the UI immediately;
4. queue remote mutation if offline/unavailable;
5. sync when connectivity returns;
6. reconcile result;
7. surface conflict only when user intervention is actually necessary.

Never make a reader lose a session/progress update solely because the connection disappeared.

---

## 22.2 Sync states

Prefer quiet, understandable state:

- saved locally;
- syncing;
- synced;
- needs attention.

Avoid constant success toasts for background sync.

Only interrupt when user action is needed.

---

## 22.3 Conflict handling

Design for conflicts before they occur.

For simple monotonic data such as some progress cases, domain rules may resolve automatically.

For rich text or ambiguous edits:

- preserve both versions if needed;
- show timestamps/context;
- never silently discard the user's newer local writing.

Conflict logic belongs in the domain/sync layer, not scattered UI conditionals.

---

# 23. Supabase and query UX rules

Use TanStack Query (when present) as the server-state coordinator rather than duplicating remote loading state manually.

Principles:

- cache stable data;
- use query keys consistently;
- invalidate narrowly;
- use optimistic mutations when rollback is safe;
- distinguish remote cache from durable local storage;
- do not treat Realtime as a replacement for a coherent query model;
- protect every client operation with server-side/RLS authorization;
- never rely on hidden UI for authorization.

When Supabase is slow/unavailable:

- preserve local reading state;
- show cached data where safe;
- communicate degraded functionality without making the whole app unusable.

---

# 24. Native-feeling behaviors with Capacitor

## 24.1 Haptics

Use selectively.

Appropriate examples:

- snapping a tactile control;
- completing a drag/reorder;
- a meaningful selection;
- successful completion of a significant action;
- warning/error for an important failed physical-style interaction.

Avoid haptics:

- on every tap;
- during continuous scroll;
- for decorative animations;
- for repetitive high-frequency actions.

Haptics must enhance feedback, not become noise.

---

## 24.2 Status bar and edge-to-edge

Treat the status bar as part of the composition.

- support edge-to-edge layouts;
- ensure content remains readable underneath system bars;
- use safe areas;
- choose light/dark foreground based on actual background;
- do not depend on obsolete status-bar background behavior.

Test modern Android edge-to-edge behavior on real devices.

---

## 24.3 Android hardware/system back

The back action should resolve the topmost temporary state before leaving the page.

Conceptual priority:

1. dismiss open picker/popover/action sheet;
2. dismiss modal/sheet;
3. close side menu or temporary mode;
4. exit selection/edit mode where appropriate;
5. navigate within the current Ionic stack;
6. exit the app only when there is no meaningful back destination.

Do not let one press dismiss an overlay and navigate the underlying page simultaneously.

---

## 24.4 Pull-to-refresh

Where refresh is useful on mobile lists:

- prefer Ionic's native-feeling refresher;
- preserve platform-specific behavior;
- avoid customizing the pulling icon if doing so disables optimized/native behavior without a strong reason;
- do not use pull-to-refresh as the only refresh mechanism on desktop.

---

## 24.5 Notifications

Notification permission should be contextual.

Do not ask on first launch without explaining value.

Ask when the user enables a feature such as reading reminders.

Notification settings should distinguish:

- app-level reminder preference;
- OS permission state;
- schedule/time;
- relevant book/goal context where supported.

---

# 25. Desktop-specific UX

Desktop is not a stretched phone.

When BRACK runs in a desktop environment:

- use pointer hover sparingly but meaningfully;
- expose tooltips for unfamiliar icon-only actions;
- support right-click/context menus as shortcuts, not exclusive functionality;
- provide keyboard focus;
- consider keyboard shortcuts for high-frequency actions;
- use multi-column layouts where they reduce navigation;
- allow denser library/analytics views;
- use resizable space intelligently;
- constrain long-form reading/editing widths;
- keep destructive actions discoverable but not dominant.

Do not animate keyboard-triggered actions merely to match mouse interactions.

If an Electron shell is present:

- keep shell-specific APIs out of shared feature components;
- respect window resizing;
- handle external links intentionally;
- do not assume mobile safe-area logic applies to desktop chrome.

---

# 26. Web/PWA-specific UX

Web users expect:

- meaningful URLs;
- refresh resilience;
- browser Back/Forward;
- selectable/copyable text where appropriate;
- standard link semantics;
- accessible anchor navigation;
- responsive layout;
- installability where PWA is configured.

Do not sabotage browser expectations for the sake of imitating a phone.

Use real links/anchors for navigation when appropriate rather than click handlers on generic elements.

---

# 27. Visual design system

Do not invent BRACK colors, fonts, radii, or shadows when the repository already defines them.

Centralize tokens.

At minimum, the design system should expose semantic tokens for:

### Color

- background;
- surface;
- elevated surface;
- primary text;
- secondary text;
- subtle text;
- border/divider;
- brand/accent;
- focus;
- success;
- warning;
- danger;
- info;
- selected;
- disabled.

### Spacing

Use a consistent scale.
Avoid arbitrary per-screen spacing values.

### Radius

Use a small intentional set:

- compact control radius;
- standard card/input radius;
- large sheet/card radius;
- pill/full radius.

Do not put a rounded rectangle around every piece of information.

### Elevation

Use only where hierarchy or overlay depth requires it.

Do not create "card soup."

---

# 28. Typography

Typography must prioritize reading.

Rules:

- use semantic type roles;
- use `rem`/scalable units for text;
- support Ionic dynamic font scaling where applicable;
- avoid hard-coding tiny pixel text;
- ensure titles, labels, captions, and metadata are visually distinct;
- keep paragraph measure comfortable on tablet/desktop;
- do not truncate essential book titles without a route to the full title;
- support large system text without destroying core actions.

At high text scaling:

- let layouts grow vertically;
- wrap labels;
- avoid fixed-height controls containing text;
- prevent text from overlapping icons or adjacent fields.

---

# 29. Color semantics and contrast

Color is never the only state indicator.

For errors use:

- error color;
- icon where helpful;
- explanatory text.

For selection use:

- color;
- shape/background/border;
- checkmark or other state cue where appropriate.

Accessibility baseline:

- target at least 4.5:1 contrast for normal text;
- target at least 3:1 for qualifying large/bold text and relevant UI graphics/boundaries where required;
- verify disabled states are still understandable;
- do not communicate reading status solely through cover tint.

---

# 30. Icons

Use icons with familiar meaning.

Rules:

- prefer the platform/Ionic icon where it matches the action;
- keep icon stroke/fill style consistent within a context;
- pair unfamiliar icons with labels/tooltips;
- use accessible labels for icon-only controls;
- decorative icons should be hidden from assistive technology;
- do not use a logo/illustration as an ambiguous control.

Icon state transitions may animate subtly when the meaning remains continuous:

- copy -> copied;
- bookmark -> bookmarked;
- play -> pause.

Use restrained opacity/scale/blur transitions; do not overlap two fully visible icons.

---

# 31. Motion system

Motion must serve one of four purposes:

1. **Feedback** — the app received input.
2. **Orientation** — this surface came from there.
3. **Continuity** — this is the same object/state changing.
4. **Delight** — rare, deliberate personality.

If an animation serves none of these, remove it.

---

## 31.1 Frequency rule

The more often an interaction happens, the quieter its motion should be.

High-frequency examples:

- library row tap;
- page/progress increment;
- keyboard navigation;
- tab switch;
- session pause/resume.

These should be fast and nearly invisible.

Rare examples:

- onboarding milestone;
- achievement unlock;
- major reading goal completion.

These can carry more personality.

---

## 31.2 Timing defaults

Use these as starting points, not rigid constants:

| Interaction | Duration | Easing |
|---|---:|---|
| Press feedback | 100–160ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Tooltip/small popover | 125–200ms | ease-out / enter curve |
| Dropdown/select | 150–250ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Modal/drawer/sheet | 200–350ms | platform/Ionic default or enter curve |
| On-screen movement | 200–300ms | `cubic-bezier(0.25, 1, 0.5, 1)` |
| Simple hover | ~200ms | `ease` |
| Rare illustrative celebration | up to ~1000ms | carefully tuned spring/custom |

Prefer platform/Ionic defaults when they already provide the right native transition.

Exits should generally be faster than entrances.

Avoid `ease-in` for ordinary entrances.

---

## 31.3 Continuity

Never make related UI teleport unnecessarily.

If the same conceptual element exists before and after:

- animate it in place where practical;
- preserve spatial direction;
- avoid duplicating persistent elements just to crossfade them.

A sheet should feel connected to the region/edge it came from.
A popover should emerge from its trigger.
Forward/back transitions should preserve direction.

---

## 31.4 What to animate

Prefer:

- `transform`;
- `opacity`.

Acceptable for state feedback:

- `color`;
- `background-color`;
- `border-color` where inexpensive and appropriate.

Avoid animating:

- `width`;
- `height`;
- `top`;
- `left`;
- layout-heavy properties.

Never use:

```css
transition: all;
```

---

## 31.5 Implementation preference

Default preference:

1. Ionic's built-in/native platform transition;
2. CSS transition;
3. Web Animations API / Ionic Animations;
4. spring for direct-manipulation release or physics;
5. CSS keyframes for predetermined sequences;
6. requestAnimationFrame/manual JS only when genuinely required.

Animations on rapidly toggled UI must be interruptible.

---

## 31.6 Springs

Use springs for:

- drag release;
- momentum;
- snap interactions;
- interruptible physical motion;
- rare playful effects.

Do not apply spring bounce to every modal, button, fade, or color transition.

Professional routine UI should generally have little or no bounce.

---

## 31.7 Reduced motion

Respect `prefers-reduced-motion`.

When reduced motion is enabled:

- remove decorative movement;
- simplify large spatial transitions;
- preserve instantaneous state feedback;
- do not make content inaccessible because an animation was removed.

---

# 32. Gestures and direct manipulation

During direct manipulation:

> pointer/finger movement should map directly to the object.

Do not ease between the pointer and the object while dragging.

After release:

- calculate destination;
- apply momentum/velocity rules if appropriate;
- then use spring/easing.

Use:

- pointer capture;
- sensible distance threshold;
- velocity threshold;
- boundary damping/friction;
- multi-touch protection.

Do not use hard stops at gesture boundaries when friction would feel more natural.

Do not make a hidden gesture the only route to a critical action.

Test gestures on physical devices.

---

# 33. Accessibility

Accessibility is a product requirement.

## 33.1 Keyboard

All web/desktop functionality must be reachable by keyboard unless the interaction inherently requires a pointer and an equivalent alternative is provided.

Ensure:

- logical Tab order;
- visible focus;
- no keyboard traps;
- Escape dismisses appropriate temporary surfaces;
- Enter/Space activate controls according to element semantics;
- arrow-key behavior follows component convention.

---

## 33.2 Screen readers

Use semantic elements first.

Provide:

- accessible names;
- labels;
- descriptions where necessary;
- heading hierarchy;
- state announcements;
- live regions for async changes that materially affect the user;
- meaningful alternative text for content images.

Book covers should have meaningful alt text when the cover itself conveys identity, e.g. "Cover of [Title] by [Author]."

Decorative badge glows/sparkles should not generate noisy announcements.

---

## 33.3 Dynamic type / zoom

Core functionality must remain usable at large text sizes and browser zoom.

Target robust behavior around 200% text scaling/zoom.

Do not:

- clip labels;
- hide required actions;
- overlap controls;
- force horizontal scrolling for simple forms.

---

## 33.4 Motion and vestibular safety

Avoid:

- excessive parallax;
- rapid full-screen zoom;
- long unsolicited motion;
- looping decorative motion in reading-focused screens.

Respect reduced-motion preferences.

---

## 33.5 Touch and dexterity

Provide generous targets.
Do not depend on precise drag gestures.
Provide button/menu alternatives to drag/swipe interactions.

---

# 34. Focus management

When opening a modal/sheet/dialog:

- move focus into it appropriately;
- trap focus only while the modal interaction requires it;
- restore focus to the initiating element after close where applicable.

After navigation:

- ensure screen readers/keyboard users can determine that context changed;
- do not force focus unpredictably while a user is typing.

When validation fails:

- focus/announce the first actionable error where appropriate;
- preserve entered values.

---

# 35. Performance

A polished interface that drops frames is not polished.

## 35.1 Rendering

Avoid unnecessary React rerenders during:

- drag;
- timer updates;
- scrolling;
- animation frames.

Keep rapidly changing timer state localized.

Do not rerender an entire library page every second because a reading session timer is running elsewhere.

---

## 35.2 Images

Book covers can dominate network and memory cost.

Use:

- correct dimensions;
- responsive sources where available;
- lazy loading;
- placeholders;
- stable aspect ratio;
- caching;
- graceful broken-image fallback.

Avoid layout shift when covers load.

---

## 35.3 Long lists

For large libraries/search results:

- paginate or incrementally load;
- consider virtualization only when it materially helps and does not break Ionic/page behavior;
- preserve scroll position;
- avoid rendering expensive hidden card content.

---

## 35.4 Animation performance

- prefer compositor-friendly transforms/opacity;
- pause looping animation offscreen;
- toggle `will-change` only during heavy animation;
- do not leave permanent compositor promotion everywhere;
- avoid CSS-variable-driven drag transforms that trigger expensive recalculation through large subtrees.

---

# 36. Lifecycle awareness

Ionic pages may remain mounted in `IonRouterOutlet` to preserve state.

Do not assume React unmount equals "page left."

When Ionic lifecycle hooks are available/needed:

- use them for page-enter/page-leave behavior that depends on Ionic navigation;
- clean up listeners/timers deliberately;
- do not create duplicate subscriptions every time a cached page becomes active;
- ensure camera/scanner/session resources are released appropriately.

---

# 37. Reading session reliability

Because sessions are time-based and may span platform lifecycle transitions:

- store `startedAt`, pause intervals, and durable session identity;
- derive elapsed duration from timestamps;
- persist meaningful session state locally;
- handle app background/foreground;
- prevent duplicate finalization;
- make network sync idempotent;
- recover interrupted sessions after reload/relaunch where product rules allow;
- clearly distinguish active, paused, completing, saved-locally, and synced states.

The visible timer is presentation. The timestamps are the source of truth.

---

# 38. Authentication UX

Authentication should not feel like a separate website.

Use a focused flow.

Requirements:

- clear email/password or supported provider choices;
- useful loading state;
- field-level validation;
- recoverable errors;
- password manager/autofill support;
- accessible labels;
- deep-link-safe auth callback handling;
- clear offline limitation;
- no loss of user-entered values after recoverable failure.

Do not leak raw Supabase error strings directly to users.

Translate errors into useful product language while preserving diagnostics for logging.

---

# 39. Permissions

Ask for device permissions only at the moment the user initiates a feature requiring them.

Examples:

- camera -> scanning a book;
- notifications -> enabling reading reminders.

Before the OS prompt:

- explain the value;
- tell the user what will happen.

After denial:

- keep the app usable;
- show how to continue manually;
- provide Settings guidance only when needed.

Do not repeatedly nag after denial.

---

# 40. Errors

Errors should answer:

1. What failed?
2. Was my data preserved?
3. What can I do now?

Examples:

Network search failure:

> We couldn't refresh book results. Your library is still available. Try again when you're connected.

Local session sync failure:

> Session saved on this device. We'll sync it when you're back online.

Do not say "Something went wrong" when the application knows more.

Do not expose stack traces, HTTP codes, SQL messages, or RLS details in the UI.

---

# 41. Destructive actions

High-impact examples:

- delete book;
- delete journal entry;
- remove reading history;
- reset progress;
- delete account.

Rules:

- label the exact consequence;
- use confirmation when recovery is difficult;
- prefer Undo for lightweight reversible operations;
- do not position destructive and primary confirmation buttons so close that accidental taps are likely;
- do not use a swipe-to-delete with no recovery for important data.

---

# 42. Sound

Sound is optional and should be rare.

Do not add UI sounds simply to make BRACK feel "native."

If sound is ever used:

- it must communicate a meaningful event;
- it must respect OS/device expectations;
- it must not be required to understand success/error;
- the user should be able to disable nonessential sound.

Haptics are generally preferable for subtle touch feedback.

---

# 43. Dark mode and theme

Support system theme if BRACK currently supports it or the task introduces it.

Use semantic tokens rather than inverted hard-coded colors.

Test:

- book cover legibility;
- charts;
- muted text;
- borders;
- sheets/modals;
- status bar;
- empty-state art;
- badge/currency assets.

Disable or minimize broad transitions during theme switching to avoid every element animating colors at once.

---

# 44. Data visualization accessibility

Charts must not rely on color alone.

Provide:

- labels;
- units;
- patterns/markers where needed;
- selected state;
- text equivalent or summary;
- accessible tooltip content;
- keyboard path when interaction is required.

On small screens:

- simplify rather than squeezing desktop charts;
- consider horizontal scrolling only for data that genuinely requires it;
- prioritize key values.

---

# 45. Native vs. branded decision framework

Before implementing a control, ask:

### A. Is this a standard OS/application primitive?

Examples:

- back;
- toggle;
- date/time;
- pull-to-refresh;
- action sheet;
- modal/sheet;
- system share;
- text input.

If yes, prefer Ionic/native behavior.

### B. Is this a BRACK-specific content component?

Examples:

- book progress card;
- reading session summary;
- goal card;
- achievement card;
- recommendation unit.

If yes, use BRACK's design language.

### C. Does the control need actual native OS functionality?

Examples:

- haptics;
- camera/scanner;
- notifications;
- status bar;
- share sheet;
- keyboard integration.

If yes, put the native call behind a Capacitor/platform service.

The goal is:

> Brand the product; do not unnecessarily reimplement the operating system.

---

# 46. Component design checklist

For every new component, answer:

- What job does this component do?
- Is it content, navigation, action, status, or feedback?
- Is there an existing BRACK component for this?
- Is there an Ionic/native primitive that already solves the behavior?
- What is the primary state?
- What are loading/error/disabled/selected states?
- What happens offline?
- What happens with keyboard focus?
- What happens at 200% text?
- What happens on coarse touch?
- What happens with a mouse?
- Does it need hover?
- Does it need a reduced-motion version?
- Does it need haptic feedback?
- Can it be interrupted safely?
- Is the action reversible?
- How does it behave on compact vs. wide screens?

---

# 47. Screen design checklist

Before calling a screen complete:

## Information hierarchy

- [ ] The screen's purpose is obvious.
- [ ] Primary content is visually dominant.
- [ ] The primary action is identifiable.
- [ ] Secondary actions do not compete.
- [ ] Metadata is not louder than book/content identity.

## Mobile

- [ ] Frequent controls are reachable.
- [ ] Safe areas are respected.
- [ ] Software keyboard does not cover required actions.
- [ ] Back behavior is correct.
- [ ] Touch targets are comfortable.
- [ ] Gestures have accessible alternatives.

## Responsive

- [ ] Compact phone tested.
- [ ] Large phone tested.
- [ ] Tablet/wide touch tested.
- [ ] Desktop/browser tested.
- [ ] Layout restructures rather than merely stretches.

## States

- [ ] Loading.
- [ ] Empty.
- [ ] Error.
- [ ] Offline.
- [ ] Syncing/pending if relevant.
- [ ] Success if relevant.
- [ ] Disabled.
- [ ] Selection/edit mode if relevant.

## Accessibility

- [ ] Keyboard.
- [ ] Visible focus.
- [ ] Screen-reader names.
- [ ] Heading hierarchy.
- [ ] Contrast.
- [ ] 200% text/zoom.
- [ ] Reduced motion.
- [ ] Color is not the only indicator.

## Performance

- [ ] No unnecessary full-screen loader.
- [ ] Covers/images do not shift layout.
- [ ] No animation jank.
- [ ] Long lists remain responsive.
- [ ] No unnecessary network call per keystroke.

---

# 48. Motion review checklist

- [ ] Animation has a purpose: feedback, orientation, continuity, or rare delight.
- [ ] High-frequency interaction is quiet.
- [ ] No keyboard-triggered decorative animation.
- [ ] Enter is not slower than the task can tolerate.
- [ ] Exit is fast.
- [ ] Transition is interruptible where users can retoggle.
- [ ] No `transition: all`.
- [ ] No routine animation of width/height/top/left.
- [ ] Popover origin matches trigger.
- [ ] Sheet/drawer direction matches spatial origin.
- [ ] Drag follows pointer directly.
- [ ] Physics starts after release.
- [ ] Reduced-motion behavior exists.
- [ ] Real-device touch behavior tested.

---

# 49. Offline review checklist

- [ ] Can the user complete the core reading action without network?
- [ ] Is user input persisted before remote sync?
- [ ] Is pending sync represented accurately?
- [ ] Can retry happen automatically?
- [ ] Are mutations idempotent?
- [ ] Is conflict behavior defined?
- [ ] Does relaunch preserve unsynced reading/session data?
- [ ] Does UI avoid falsely claiming remote success?

---

# 50. Routing review checklist

- [ ] Route belongs to the correct stack.
- [ ] Tabs preserve their own history if tabs are used.
- [ ] Browser URL is meaningful where appropriate.
- [ ] Browser refresh preserves route identity.
- [ ] Android back dismisses temporary layers first.
- [ ] No accidental `navigate(-1)` misuse in non-linear Ionic stacks.
- [ ] Nested router outlets are used only when justified.
- [ ] Router outlet contains routes, not arbitrary page chrome.
- [ ] Navigated Ionic views use the correct page wrapper.

---

# 51. Testing matrix

Do not validate BRACK only in desktop Chrome.

Minimum practical matrix for significant UI:

### Browsers

- Chromium desktop;
- Safari/WebKit behavior where available;
- responsive viewport.

### iOS

- compact iPhone;
- larger iPhone;
- safe-area device;
- software keyboard;
- large text;
- reduced motion.

### Android

- common phone size;
- hardware/system Back;
- gesture navigation;
- keyboard;
- edge-to-edge system bars;
- large font/display scaling.

### Tablet / wide

- portrait;
- landscape;
- split/multi-pane where supported.

### Desktop app

If a dedicated desktop shell exists:

- small window;
- maximized;
- resizing;
- keyboard navigation;
- external links;
- window focus.

### Network

- normal;
- slow;
- offline;
- reconnect during pending mutation.

---

# 52. Quality gates

A BRACK UI change is not complete because it matches a screenshot.

It is complete when:

- the UX is understandable;
- interaction states are implemented;
- platform behavior is correct;
- responsive layouts are intentional;
- offline behavior is safe;
- accessibility is verified;
- motion is purposeful;
- performance is acceptable;
- native integrations fail gracefully;
- the visual design still feels like BRACK.

---

# 53. Anti-patterns

Never default to these patterns:

## Cross-platform

- One identical layout forced onto phone, tablet, and desktop.
- User-agent sniffing for layout when capability/viewport queries work.
- Forcing iOS visuals on Android.
- Rebuilding native primitives purely for aesthetics.
- Platform plugin calls scattered through feature components.

## Navigation

- Every screen as a modal.
- Modals used as durable URL-addressable pages.
- Unexpected tab reordering/hiding.
- Browser-history back used blindly inside Ionic tab stacks.
- Deep nested router outlets without a real IA need.

## Mobile

- Important actions only in the top-right.
- Tiny icon-only tap targets.
- Keyboard covering the submit/save control.
- Content placed under system bars without safe-area handling.
- Destructive swipe with no alternative/recovery.

## Visual design

- Card around every section.
- Excessive shadows.
- Excessive gradients/glows.
- Multiple equally loud primary buttons.
- Badge illustration language leaking into functional controls.
- Color as the only state indicator.

## Loading

- Full-screen spinner for every mutation.
- Spinner on cached content that could remain visible.
- Fake determinate progress.
- Search spinner blocking every keystroke.

## Motion

- `transition: all`.
- Animation for animation's sake.
- Bounce on every component.
- `ease-in` entrances.
- `scale(0)` popovers.
- slow exits.
- duplicated shared elements crossfading.
- layout-property animation for routine movement.
- non-interruptible keyframes on rapid controls.
- haptics on every tap.

## Data

- Network required to save a reading session.
- Raw Supabase errors shown to users.
- UI hiding used as authorization.
- Realtime subscriptions with no cleanup.
- timer duration based only on `setInterval`.

## Accessibility

- placeholders used as labels.
- focus indicators removed.
- hover-only essential controls.
- gesture-only essential controls.
- fixed-height text containers that clip at large fonts.
- decorative images announced as meaningful content.

---

# 54. Workflow for implementing a BRACK UI task

Use this workflow.

## Step 1 — Understand the user task

Identify:

- user goal;
- frequency;
- risk;
- platform;
- offline requirements;
- navigation context.

## Step 2 — Inspect existing BRACK code

Find:

- nearest existing page;
- reusable components;
- tokens;
- query/service hooks;
- route stack;
- platform adapter;
- storage/sync behavior.

Do not start by creating new primitives.

## Step 3 — Choose the interaction pattern

Ask:

- page, sheet, dialog, popover, inline edit, or toast?
- Ionic/native or BRACK-custom?
- touch and desktop equivalents?
- primary and secondary action?

## Step 4 — Define states before styling

List:

- idle;
- loading;
- empty;
- success;
- error;
- offline;
- pending/syncing;
- disabled;
- selection/edit.

Only include states that can actually occur.

## Step 5 — Build semantic structure

Implement:

- page hierarchy;
- labels;
- headings;
- controls;
- accessible names;
- route identity.

## Step 6 — Add responsive behavior

Verify:

- compact;
- medium/tablet;
- wide/desktop;
- touch vs. pointer.

## Step 7 — Add native behavior

Only where it materially improves the experience:

- haptics;
- keyboard integration;
- safe area;
- Android back;
- refresher;
- native share/action surface;
- notifications.

## Step 8 — Add motion

Only after the interaction works without it.

Choose:

- purpose;
- duration;
- easing;
- reduced-motion behavior;
- interruption behavior.

## Step 9 — Test failure paths

Simulate:

- network loss;
- denied permission;
- stale metadata;
- invalid progress;
- duplicate add;
- sync retry;
- background/resume during session.

## Step 10 — Review against checklists

Do not skip accessibility and responsive review.

---

# 55. Code-review response format

When reviewing BRACK UI code, organize findings by severity:

### Critical

Breaks data, navigation, accessibility, or core interaction.

### High

Makes the feature unreliable or significantly non-native/non-responsive.

### Medium

Inconsistency, state gap, performance issue, or usability friction.

### Polish

Motion, spacing, visual hierarchy, microcopy, haptic tuning.

For motion-specific review, use:

| Before | After | Why |
|---|---|---|

Prefer concrete fixes over vague comments such as "make it cleaner."

---

# 56. Agent rules

When an AI coding/design agent uses this skill:

1. Do not assume the screenshot is the whole specification.
2. Infer missing states from product behavior, but do not invent new product features.
3. Inspect existing components before writing new ones.
4. Preserve BRACK domain language.
5. Prefer platform-native conventions for platform primitives.
6. Prefer BRACK-specific visuals for BRACK-specific content.
7. Keep business logic outside visual components.
8. Keep native APIs behind services/adapters.
9. Do not break web behavior while fixing mobile.
10. Do not break mobile navigation while optimizing desktop.
11. Do not make online-only changes to core reading capture.
12. Do not ship without loading/error/empty/offline consideration.
13. Do not ship interaction without keyboard/screen-reader consideration.
14. Do not add animation before interaction correctness.
15. Do not invent design tokens if existing tokens can be reused.
16. Do not hard-code device models.
17. Do not silently change primary information architecture.
18. Do not create a second design system inside one feature.
19. Do not expose database/backend implementation language to end users.
20. Prefer the simplest implementation that preserves the native/product behavior.

---

# 57. Practical decisions by scenario

| Scenario | Preferred BRACK approach |
|---|---|
| Open book detail | Real route/page, not a temporary modal |
| Quick book actions on phone | Ionic action sheet/sheet or adaptive action menu |
| Book actions on desktop | Menu/popover/context menu plus accessible button |
| Edit substantial book metadata | Dedicated page or substantial modal depending context |
| Quick progress update | Reachable sheet/inline control |
| Start reading session | Immediate action with clear session state |
| End reading session | Focused short completion flow |
| Add book on phone | Search + scan option + manual fallback |
| Add book on desktop/web | Search/manual first; scanning only when supported/useful |
| Refresh library on mobile | Native-feeling pull-to-refresh plus normal data refresh logic |
| Success after small mutation | Quiet local state / toast |
| Offline reading update | Save locally, mark pending, sync later |
| Delete important data | Explicit destructive confirmation or recoverable undo |
| Chart on phone | Simplified key metric + focused chart |
| Chart on desktop | Richer chart/table when useful |
| Permission request | Contextual explanation, then OS prompt |
| Achievement unlock | Rare, richer motion allowed; respect reduced motion |
| Normal navigation | Platform transition, not custom cinematic animation |
| Keyboard shortcut | Immediate; no decorative animation |

---

# 58. Definition of "native-like" for BRACK

A BRACK screen feels native when it:

- respects iOS/Android navigation behavior;
- uses platform-appropriate component styling;
- handles safe areas;
- responds correctly to the system keyboard;
- respects Android Back;
- uses touch-sized controls;
- uses expected sheets/action surfaces;
- has responsive gesture behavior;
- uses subtle haptics only when appropriate;
- follows system text scaling;
- handles lifecycle transitions;
- remains responsive at 60fps-class interaction;
- integrates OS permissions/services correctly.

It does **not** require copying Apple or Google visual design exactly.

BRACK should remain visually BRACK.

---

# 59. Definition of "cross-platform" for BRACK

Cross-platform means:

> Same product, same data, same user intent, same core code — platform-appropriate presentation.

It does not mean:

> Same pixel arrangement at every width.

A high-quality implementation may render one shared feature as:

- bottom-sheet workflow on iPhone;
- Material-style sheet/dialog on Android;
- centered dialog or side panel on desktop;
- route-addressable page on web when durable navigation matters.

All may still share the same:

- form schema;
- mutation hook;
- validation;
- domain component;
- analytics event;
- Supabase operation.

---

# 60. External references to consult when implementation details are version-sensitive

Always prefer the documentation matching the versions installed in BRACK.

Official Ionic references:

- Ionic docs: https://ionicframework.com/docs
- Ionic React navigation: https://ionicframework.com/docs/react/navigation
- Header: https://ionicframework.com/docs/api/header
- Modal: https://ionicframework.com/docs/api/modal
- Refresher: https://ionicframework.com/docs/api/refresher
- Gestures: https://ionicframework.com/docs/utilities/gestures
- Animations: https://ionicframework.com/docs/utilities/animations
- Dynamic font scaling: https://ionicframework.com/docs/layout/dynamic-font-scaling
- Hardware Back: https://ionicframework.com/docs/developing/hardware-back-button
- Capacitor Haptics: https://ionicframework.com/docs/native/haptics
- Capacitor Keyboard: https://ionicframework.com/docs/native/keyboard

Also consult the BRACK repository's installed package versions before copying examples from current online docs.

---

# 61. Final standard

For every BRACK frontend decision, optimize for this order:

1. **Correctness**
2. **User comprehension**
3. **Data safety**
4. **Accessibility**
5. **Platform-appropriate behavior**
6. **Responsiveness**
7. **Perceived performance**
8. **Visual hierarchy**
9. **Motion polish**
10. **Delight**

Do not sacrifice an earlier item for a later one.

The final experience should feel as though BRACK belongs on the user's device while still unmistakably belonging to BRACK.
