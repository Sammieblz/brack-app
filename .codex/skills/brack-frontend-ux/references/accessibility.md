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

