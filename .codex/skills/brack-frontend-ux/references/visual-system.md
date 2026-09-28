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

