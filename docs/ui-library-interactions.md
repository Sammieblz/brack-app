# Library book interaction contract

Implements [issue #69](https://github.com/Sammieblz/brack-app/issues/69). Keep the current Library layouts, detail destinations and book data operations; this is a hit-target and input-behavior fix, not a redesign.

## Primary action and modes

| Representation | Normal activation | Selection mode | Reorder mode |
| --- | --- | --- | --- |
| Flat cards (responsive list/grid) | Open `/book/:id`, including cover, title, metadata and surrounding space | Toggle that book once; never navigate | Not applicable |
| Bookshelf | Open the existing desktop book dialog or phone sheet | Toggle that book once; never open the preview | Native primary button becomes the dnd-kit activator; moving/dropping never opens a book |
| Carousel | Open the existing detail sheet | Toggle that book once; never open the sheet | Carousel dragging changes slides, not selection or navigation |

The explicit **View details** action in previews and action rows still opens the full book route. Flat covers now share the book's primary action instead of launching a separate image lightbox. Edit, Log progress, Add to list, Delete/confirmation, accordion, and carousel navigation retain their separate actions.

## Semantics and event ownership

- Each book has one native primary `button`, named `Open [title]` or `Select [title]`. Selection exposes `aria-pressed` with a stable label. The selection marker is decorative, not a second checkbox/tab stop.
- The card wrapper is not a button or focus stop. The full-size primary button is a **sibling**, never an ancestor, of metadata and secondary controls. Native Enter/Space behavior needs no custom keyboard emulation. Secondary controls follow it in document/tab order.
- Flat/carousel content sits above the primary button so text can still be selected. `activateLibraryBookSurface` delegates only unclaimed, primary-pointer clicks. It excludes links, native/ARIA controls, labels, editable content, explicitly marked `data-library-book-control` areas, cancelled events, and portal targets outside the actual card. Keep this guard when adding new controls.
- Do not stop pointer-down events on the card: Embla needs them to distinguish a drag from a click. Its cancelled drag click must not activate the primary action. `SwipeableBookCard` owns touch direction locking and capture-phase suppression of clicks following movement/cancellation; vertical scrolling stays native.
- Shelf drag attributes/listeners apply only in reorder mode. The normal/selection button does not expose dormant sortable semantics. Pointer activation requires the existing six-pixel threshold; the existing keyboard sensor supports Space, arrows, Space to drop, Escape to cancel.
- Programmatically opened previews explicitly restore focus to their originating button on dismissal, including Safari pointer activation. Do not restore to a disconnected button or steal focus during a responsive dialog/sheet switch. Escape dismisses the innermost open layer (for example an action tooltip before the preview).

This follows the native activation and focus expectations in the [WAI button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/). The reorder-only touch policy follows the installed legacy [dnd-kit pointer sensor guidance](https://dndkit.com/legacy/api-documentation/sensors/pointer/).

## Motion and layout

BRACK frontend UX and UI animation skills guided this change: frequent selection/navigation should feel immediate, and decoration must never move a target away from the user.

| Before | After | Why |
| --- | --- | --- |
| GSAP lifted, scaled and rotated the shelf hit target | Stable native full-book target; quiet fine-pointer color/shadow feedback | No edge-hover oscillation or competing drag transform ownership |
| Physical covers tilted/lifted on hover | Preserve the existing static dimensional cover; no hover transform | Book remains visually and physically easy to target |
| Nested action buttons lifted on hover; tiny carousel dots | Fixed action targets and 44px dot buttons surrounding small visual indicators | Reliable mouse/touch targets without oversized decorative dots |
| Swipe could also activate the card or block a vertical scroll | Direction-locked horizontal interaction, click suppression, native vertical scrolling | One gesture performs one action |

Focus uses the current theme's ring token, including paper, light/dark and forced-color rendering. Primary surfaces do not animate on focus or activation. Deliberate swiping/reordering still moves the book; reduced motion removes the swipe settling transition. Keep loading placeholders aligned with action and navigation target geometry.

## Verification

```sh
npm test
npm run check-types
npm run lint
npm run test:library-interactions:check
npm run test:library-interactions
npm run test:loading
```

Unit tests exercise card delegation, independent/portalled controls, selection, real Radix preview focus, dnd-kit keyboard behavior, and the real swipe handler. The isolated browser fixture mounts the production Library components, uses local book data/callbacks, and blocks external requests; it never modifies a reader's library. Tests cover stable bounds at phone/tablet/desktop widths, long metadata, registered themes, keyboard, pointer reordering and carousel drag. Touch movement is additionally exercised with Chromium CDP; this is not physical-device validation.

CI typechecks/lints the fixture and runs Chromium, Firefox and WebKit. Its dedicated suite is excluded from the normal live-app smoke configuration. Tests measure bounds and interactions without routine screenshots; failure traces omit screenshots as well.

Before a native release, manually spot-check VoiceOver/TalkBack announcements and focus, actual iOS/Android scrolling/swiping, tablet split view/sidebar, and keyboard shelf reordering on the packaged desktop app. Do not claim those checks from browser emulation alone.
