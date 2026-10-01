# Lists presentation and ordering

F10b source contract; validation and limitations belong to [checkpoint29](frontend-renewal/29-lists-reconstruction.md). The [task contract](ui-library-list-tasks.md) still owns mutations, dirty drafts, membership and account boundaries.

## Collection discovery

`BookLists` keeps authenticated/sign-in/loading entries. The manager remains mounted across responsive changes; `showTitle` avoids repeating the compact heading. Its count is loaded collections, with a plus when more pages remain. It does not sum overlapping memberships as unique books or promote a duplicate featured collection.

One Create List action remains visible, including an empty catalog. Search, five filters and four sorts retain their meaning. The filter/sort task is one adaptive Dialog; selected filters have pressed state and text, with a clear action. Native search and select controls keep browser/keyboard behavior. Search `q`, `filter` and `sort` are validated URL parameters; changes replace history and preserve unrelated parameters and route state. Returning from detail preserves this context. Scroll-position restoration is not implemented here.

Names/descriptions wrap. `BookListOverviewCard` retains its export name but renders an article with one native Router Link and a separate named actions menu. During writes, actions remain guarded; Edit/Duplicate/Delete retain their owners. Dates, counts and visibility use real records; list cover previews are unavailable from this API and are not fabricated. The theme-aware Iconoir list mark is decorative. Pagination retains its observer and gains a visible Load more alternative.

## List detail

Compact chrome uses the short Book List title. The full name scrolls with description/count/visibility so a long name cannot consume the sticky viewport. Expanded layouts retain the full page heading. Back ownership/fallback remain unchanged.

Each book is an article with a single book link, actual cover or existing fallback, full title/author/status/genre, and named progress where page progress exists. Separate Remove from list opens the original confirmation; removal never deletes the Library book. The surviving Add Books control remains the focus fallback after confirmed removal.

Reorder is explicit; Done exits, and each move saves immediately. Browsing/addition/removal are unavailable while arranging, and Done is disabled during a pending write or drag. Visible Move up/Move down, pointer handle, and keyboard sensor call one serialized move function. Boundary/pending move buttons use `aria-disabled` plus synchronous guards so focus survives a move/rollback. Rejected writes restore prior order with an alert; confirmed writes announce title and position. Drag announcements use book names/positions rather than storage IDs. Escape cancels an active drag without writing. Account/route teardown suppresses late UI feedback.

Only the handle prevents touch panning; ordinary content retains browser scrolling/zoom. No route-edge/swipe recognizer is added. Drag follows input directly; decorative scale/glow/transition-all effects are removed. Native multi-touch/OS edges still require physical-device review.

## Layout and evidence boundary

`components/library/collections.css` reuses reading-room controls and theme/font tokens. Text-relative grid minima adapt to pane width; at very narrow reading widths, covers stack above titles and the decorative collection mark disappears. Actions retain 44px minimum targets and visible focus. Skeletons share the geometry; known-zero detail does not pretend books exist. Other BookCardSkeleton variants retain their rendering.

Playwright uses actual screens/hooks/overlays with in-memory services and loaded fonts. Emulated Android presentation verifies shared shell behavior, not Capacitor hardware. These fixtures do not establish legal conformance, real screen-reader acceptance, live synchronization or measured latency. Existing Router/Radix/dnd-kit owners remain; [Ionic choices](frontend-renewal/29-lists-reconstruction.md#component-specific-ionic-decision) do not close future shell adoption.
