# Library presentation and controls

[F10a/checkpoint28](frontend-renewal/28-library-reconstruction.md) owns flat-view evidence; [F10c/checkpoint30](frontend-renewal/30-library-modes.md) owns bookshelf/carousel reconstruction. This contract describes source, not full F10 completion.

`MyBooks` serves `/my-books` and `/books`. Its header exposes Add; one search field and counted local status group precede books. Filter & sort (Filters on compact windows) opens a single adaptive task with view mode, sort, genres, selection/reorder and labelled Lists/Analytics links. These remain native links, including modified-click behavior. Quick actions is inline in the Library; its shared component's default floating placement remains available elsewhere.

Search uses `q`, status uses `status`, genres use repeated `genre` parameters and sort uses `sort`. Status/sort are validated and genres normalized; unknown values fall back to normal presentation. Edits replace the current URL entry, preserve unrelated parameters/route state, and do not manufacture Back ancestry. Clear filters deletes all four filter keys together. Mode remains reader preference state through the existing API. Returning through actual BookDetail Back preserves filters; arbitrary route scroll/focus restoration remains separate.

Flat books use unboxed semantic rows, physical covers and full wrapping titles. Available width and a 20rem content minimum determine columns, allowing 200% text to use fewer columns. Loading shares this geometry. Status, genre and reading progress stay visible; descriptions/notes/dates remain in Book Details. Carousel/bookshelf compositions retain their identities in this slice.

Every `LibraryBookActions` consumer has a native Log progress link and labelled More disclosure. More reveals View details, Edit book, Add to list and Delete book without another modal focus trap. Existing membership/removal tasks own pending, failure, reader identity and return focus. Selection removes secondary actions and exposes a native pressed primary button. Content-pointer and primary-keyboard semantics follow [Library interactions](ui-library-interactions.md); never replace delegated title clicks with a forced overlay-button click in browser tests.

Custom CSS uses existing theme colors, Inter/Merriweather/Playfair roles and Iconoir. Focus indicators, wrapping and 44px minimum action targets apply across viewports. Text and pressed state convey selection without relying only on color. No animation or gesture recognizer is added. Large-text wrapping takes priority over single-line geometry.

Ionic was considered per component, as recorded in checkpoint28. This code does not adopt Ionic in production or substitute CSS imitation for tested native integration. Native hardware, OS assistive technology, large-library performance, tablet detail panes remain separate acceptance work. Lists composition is covered by the [F10b contract](ui-list-presentation.md).

## Bookshelf and carousel

Shelf rows use their measured pane width and a rem probe, not device/window categories. Loaded and skeleton rows share the sizing function. Phone layouts ordinarily show two books; text scaling or a narrow pane can reduce that to one. Covers and wood retain existing theme tokens. Titles, authors and status/progress are readable below covers. A three-line shelf title obtains its full text through the native button name and full preview heading.

Reorder is explicit and only available when the whole unfiltered shelf is loaded and sorted by shelf order. Existing dnd-kit pointer/keyboard ownership remains; Earlier/Later sibling buttons provide a visible alternative. Moves retain focus across row boundaries and failed-save rollback. MyBooks locks concurrent saves synchronously, reports pending/error inline, and ignores stale completions after account change/unmount. Rollback restores only its optimistic order/timestamp fields. The existing service still decides online/offline persistence.

Carousel slides use the available pane, preserving a next-book peek on ordinary phones and multiple books when space allows. Navigation precedes content: native book chooser, current position, previous/next. There are two navigation buttons regardless of library size; rendering thousands of options/slides is not claimed optimized. Native select owns its arrow keys; portal tasks keep theirs. Embla owns dragging, uses immediate keyboard/chooser navigation and its media breakpoint for reduced motion without resetting position.

Carousel return memory stores only book IDs in a bounded40-entry map keyed by account and Router entry. Returning from real BookDetail restores the chosen book; different accounts/entries cannot reuse that selection. This does not persist across reloads or implement global page scroll/focus restoration. Filters remain URL-owned and view mode remains the existing saved preference.

Both previews share custom LibraryBookPreview content: full identity, named progress, Log progress/More, then native About this book disclosure. Descriptions and notes are not clipped when expanded. Bookshelf retains AdaptiveDialog and carousel retains Sheet; neither changes mounted owner on resize. Nested membership/deletion tasks retain their established guards. Baseline accessibility remains always on.
