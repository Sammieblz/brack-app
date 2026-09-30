# CR04 Library/list task evidence

The implementation authority is [checkpoint 24](../../24-library-list-tasks.md); the actual consumer/alias map and full run history are in the [fixture README](../../../../tests/fixtures/library-tasks/README.md). Root owns `verification.json` and its final test/source-hash manifest separately.

These **32 Chromium PNGs** were copied from the final passing five-case visual run, `test-results/cr04-visual-final-summary.json`, using the corrected production card/scroll-clearance layout. That run passed **5/5**: four visual scenarios plus carousel pointer/keyboard and layered Back continuity. The screenshots are from the four visual scenarios. They precede a narrow post-removal focus fallback correction; that later behavior is tested separately and does not change the captured geometry. [capture-provenance.json](capture-provenance.json) identifies each original artifact and exact scenario; failed earlier artifacts remain under their original `test-results/cr04-*` paths.

Each profile has eight captures: actual bookshelf selection, its nested membership task, create/edit/delete list dialogs, Add Books, the actual list card, and list-only removal. The adjacent `*-fonts.json` files establish actual loaded Inter, Merriweather and Playfair Display faces rather than only a permissive `document.fonts.check`. The `*-geometry.json` files record modal/card dimensions and horizontal overflow. Full viewport visibility and three-point pointer hit tests are assertions in the spec, including the final captured action state.

| Profile | Actual selection | Membership | List editor | Actual list card | Add Books |
| --- | --- | --- | --- | --- | --- |
|320×740, normal text|[Selection](phone-320-bookshelf-selection.png)|[Membership](phone-320-nested-membership.png)|[Create](phone-320-create-list.png)|[Card](phone-320-list-row.png)|[Add](phone-320-add-books.png)|
|390×844, 200% root text|[Selection](phone-large-text-bookshelf-selection.png)|[Membership](phone-large-text-nested-membership.png)|[Create](phone-large-text-create-list.png)|[Card](phone-large-text-list-row.png)|[Add](phone-large-text-add-books.png)|
|834×1112, 200% root text, synthetic coarse pointer|[Selection](tablet-touch-large-text-bookshelf-selection.png)|[Membership](tablet-touch-large-text-nested-membership.png)|[Create](tablet-touch-large-text-create-list.png)|[Card](tablet-touch-large-text-list-row.png)|[Add](tablet-touch-large-text-add-books.png)|
|390×480, short viewport|[Selection](short-height-bookshelf-selection.png)|[Membership](short-height-nested-membership.png)|[Create](short-height-create-list.png)|[Card](short-height-list-row.png)|[Add](short-height-add-books.png)|

Edit, delete and removal captures use the same profile prefix with `-edit-list.png`, `-delete-list.png` and `-remove-from-list.png`. The card captures are deliberately scrolled/focused at their final action toolbar: the phone200% capture demonstrates that Scroll to top no longer intercepts Remove. A screenshot of a scrolled task is not a claim that its entire contents fit onscreen without scrolling.

Observed behavior and limits:

- The actual Bookshelf/Carousel selection and nested membership task survive the tested responsive boundaries. Closing membership restores focus to Add to list, which opens its real tooltip. The next Back dismisses that tooltip; the following Back closes the selection. Tests preserve this observed top-layer ordering and do not claim a two-Back sequence.
- Ordinary pointer input exercises delegated visible carousel metadata. The semantic primary button is independently reopened with Enter after focus restoration. No force click is used to bypass its selectable metadata layer.
- Card overflow and a floating Scroll to top collision were found by the added page-level checks, then corrected in production. Earlier failing reports and screenshots are historical evidence, not passing acceptance artifacts.
- `runtime=android` supplies an emulated native-Back callback. The tablet coarse-pointer profile is an explicit media-query shim. Only the Chromium swipe scenario injects trusted browser touch through CDP. These are not physical iOS/Android, foldable posture, browser-toolbar, screen-reader, switch-control or native gesture-conflict verification.
- 200% uses root font-size scaling, not every operating-system accessibility setting or browser zoom behavior. Font, theme and icon source remains production; book cover content is a deliberate deterministic BRACK mark fixture.
- API/auth/local-repository/sync boundaries are deterministic. No real backend, storage persistence, live account or server idempotency is claimed. Broader Library information density/visual redesign remains in F10 and subsequent coverage tickets.

The full96 scheduled three-engine run and the subsequent affected removal/focus checks are recorded separately in checkpoint24/verification manifest. The final spec registers99 checks after adding ordinary flat deletion. Do not claim that a clean99-case run occurred, or add overlapping targeted results together as unique coverage.
