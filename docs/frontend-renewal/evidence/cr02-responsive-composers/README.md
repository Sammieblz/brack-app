# CR02 responsive creation evidence

These 18 PNGs were captured on 2026-09-30 after the post reflow, Select viewport and club hidden-file sizing fixes. Fifteen come from the green Chromium geometry run (`test-results/cr02-visual-3`, 8/8); the three short-height action captures come from the later `cr02-endpoint-final` run (9/9 across three engines), which also checks action visibility immediately before capture. All three entries render their actual screens, task components and hooks. [Checkpoint22](../../22-responsive-composers.md) owns final verification/status and original failure history; the [fixture README](../../../../tests/fixtures/responsive-composers/README.md) lists aliases and diagnostic details.

## Captures

| Actual entry |320px writing|834px writing|390px/200% writing|834px/200% touch writing|834px/200% touch actions|390×480 actions|
|---|---|---|---|---|---|---|
| Feed post |[Image](narrow-Feed-post-writing.png)|[Image](tablet-Feed-post-writing.png)|[Image](large-text-Feed-post-writing.png)|[Image](tablet-touch-large-text-Feed-post-writing.png)|[Image](tablet-touch-large-text-Feed-post-actions.png)|[Image](short-height-Feed-post-actions.png)|
| BookClubs club |[Image](narrow-BookClubs-club-writing.png)|[Image](tablet-BookClubs-club-writing.png)|[Image](large-text-BookClubs-club-writing.png)|[Image](tablet-touch-large-text-BookClubs-club-writing.png)|[Image](tablet-touch-large-text-BookClubs-club-actions.png)|[Image](short-height-BookClubs-club-actions.png)|
| Readers club |[Image](narrow-Readers-club-writing.png)|[Image](tablet-Readers-club-writing.png)|[Image](large-text-Readers-club-writing.png)|[Image](tablet-touch-large-text-Readers-club-writing.png)|[Image](tablet-touch-large-text-Readers-club-actions.png)|[Image](short-height-Readers-club-actions.png)|

The full local review set contains36 PNGs (writing/actions × three entries × six profiles) and six font-evidence files under `test-results/cr02-visual-review`. The unselected profile is834px/200% with a fine pointer/centered dialog. Tests require actual declared Inter, Merriweather and Playfair Display faces to load before captures. Text scaling changes the root font to32px; the touch-tablet profile overrides capability media queries and asserts sheet presentation. Runtime Back is a synthetic Android bridge callback. Neither is a physical device/OS text-scaling or keyboard test.

## Review findings and boundaries

- Post writing now stacks above media when enlarged text makes two columns unworkable; normal tablet retains two readable columns. Phone writing remains within the task with wrapping formatting controls. All measured profiles have no horizontal task overflow, a usable writing width, and fully reachable/hittable Close, Cancel and submit actions.
- Both club entries keep their labeled fields and actions within the same scrollable surface. Native hidden file controls remain keyboard reachable through their associated visual labels without creating an invisible full-width overflow box.
- Independent review inspected both club entries at normal tablet and200% text, and normal-tablet post composition. Root inspected the failed narrow-column/dropdown images and successful phone, large-text and touch-tablet captures. Screenshots show scrolled portions: a label at the top edge is not evidence it was removed. One-pixel test images produce white previews; no live image service or storage result is claimed.
- F14 still owns decluttering the full post/club setup: optional club metadata and prominent image areas create a long form, and scaled single-line metadata values can require scrolling inside their input. Theme contrast across all palettes, device keyboards, screen readers and complete social-screen design acceptance remain open. Passing geometry and loaded fonts do not establish legal/accessibility conformance or final visual approval.

Original failures remain locally under `cr02-full-1`, `cr02-visual-1` and `cr02-visual-2`. They were not replaced by passing screenshots. The final matrix and bounded shared-control regressions are recorded in22.

[verification.json](verification.json) retains report summaries, explicit overlap accounting and source/test/fixture hashes for this uncommitted review stop. The final result covers 78 distinct CR02 cases plus 45 shared-consumer regressions, with the original 76/78 matrix, unchanged Firefox reproduction and 9/9 follow-up preserved separately.
