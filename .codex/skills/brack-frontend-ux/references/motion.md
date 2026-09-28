# 31. Motion system

Current add/haptic/context-action behavior is maintained in the [action-feedback contract](../../../../docs/ui-action-feedback.md). Preserve immediate confirmed navigation and one feedback owner; use its focused fixture rather than recreating production accounts to inspect gesture timing. Device API requests are not proof of physical haptic or OS gesture behavior.

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

