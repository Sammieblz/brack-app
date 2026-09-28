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
