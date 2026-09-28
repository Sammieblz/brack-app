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

# 36. Lifecycle awareness

Ionic pages may remain mounted in `IonRouterOutlet` to preserve state.

Do not assume React unmount equals "page left."

When Ionic lifecycle hooks are available/needed:

- use them for page-enter/page-leave behavior that depends on Ionic navigation;
- clean up listeners/timers deliberately;
- do not create duplicate subscriptions every time a cached page becomes active;
- ensure camera/scanner/session resources are released appropriately.

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

