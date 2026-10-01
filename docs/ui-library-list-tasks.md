# Library selection and list task ownership

F10a changes presentation through [Library controls and rows](ui-library-presentation.md), retaining these service/task contracts. Access Library Select/Reorder from the controls sheet and shared book membership/removal actions from More.

[CR04 / checkpoint24](frontend-renewal/24-library-list-tasks.md) owns implementation status, executed checks, retained failures and acceptance evidence. This document describes current source contracts; it does not establish that every browser, native-device or assistive-technology check has passed. CR04 precedes main F10 visual simplification.

## Service outcomes and collection reads

The existing `services/api/bookLists.ts` boundary remains authoritative for account-scoped local list records, membership records, outbox writes and background synchronization. A resolved mutation confirms that service's local result; it does not establish remote synchronization or a new backend transaction guarantee. Existing reading/offline semantics, route identities, themes, fonts and Iconoir remain in place.

`useBookLists` has two separate contracts:

- `createList` and `duplicateList` return the confirmed `BookList`; update, delete, membership and reorder methods resolve with `void`. All reject the original primary service failure. A consumer must await and catch the mutation before announcing success, closing a task or updating its confirmed selection.
- Collection `loading`, `refreshing`, `loadingMore`, `hasLoaded`, `error`, `hasMore`, `loadMore` and `refetch` describe reads. A confirmed write starts an independent refresh; a slow or rejected refresh cannot turn that write into a retryable failed mutation. `error` describes collection reads rather than swallowing mutation failures. Previous-account/unmounted continuations do not start a new refresh or replace the current reader's collection.

Ordinary refresh failure can retain already loaded content with a visible retry. Confirmed access failures propagate through the existing service/hook access-error path instead of being represented as successful cached access. Initial failure is distinct from a successfully loaded empty collection.

Duplication and multi-book addition have different partial-outcome handling. The existing duplicate service creates its copy before copying memberships; a later rejection can leave a partial copy. The hook refreshes after that failure, and the manager explicitly tells the reader to inspect the partial copy before repeating the action. It does not automatically create another copy.

`AddBooksToListDialog` owns the same sequential single-book service calls used by the existing bulk wrapper. Each resolved add removes that book from the remaining selection and records it as existing membership. Failure preserves failed and unattempted books, reports any confirmed count, and retries only the remaining selection. A partial outcome with at least one confirmed addition refreshes the parent once, as does complete success. Parent refresh failure is logged separately and does not undo membership or discard the remaining selection. This is UI bookkeeping around existing services, not an atomic bulk-write promise.

## Membership tasks

`AddToListDialog` changes the lists containing one book. It opens with unknown membership, displays checking/error/retry states, and does not render unchecked choices until membership is known. List-catalog reads have their own loading/error/retry state and pagination action. Known cached list data can remain usable after a background read failure. A confirmed empty catalog offers a real Router link to `/lists`, an existing alias of `/book-lists`, preserving normal browser link semantics.

Each checkbox has a unique ID and an accessible list name; its description and mutation error remain associated separately. A synchronous pending lock serializes changes, disables conflicting controls and refuses dismissal. Success updates the checked membership and reports the confirmed result; failure retains the previous visible selection with an inline retry instruction. Because each change saves immediately, this task has no unsaved multi-selection draft.

`AddBooksToListDialog` selects books to add to one list. Library loading/error and membership lookup have separate retry controls. Unknown membership never appears as an empty list or a complete set of available books. Known existing books are excluded. Checkbox names come from book titles; decorative duplicate cover descriptions are omitted. Retry and pagination buttons wrap, and the adaptive surface owns scrolling instead of a fixed-height inner list.

Selected books form a draft. Close, Cancel, Escape, backdrop and app Back share the pending/dirty policy: pending refuses dismissal; dirty idle selection offers **Keep selecting** or **Discard selection**. Declining keeps the selection. Explicit discard resets it. Complete confirmed addition closes the task; rejected or partial addition keeps its remaining selection and error.

Both task identities include the reader and target book/list. Auth loading/account changes withdraw the old task. Opening generations suppress late lookup results after close/reopen, and mounted/generation checks prevent abandoned writes from changing a newer task or starting later sequential additions. An already-dispatched service request retains its own service lifecycle. These forms do not introduce cross-route persisted drafts or intercept browser history.

## Stable parents and removal ownership

`LibraryBookshelfSelection` uses one `Dialog` plus `AdaptiveDialogContent` across window changes. Its selected book, nested `LibraryBookActions`, membership and removal tasks remain under that same owner. Compact presentation changes styling, not the component family. When shelf rows regroup, the parent resolves the selected book's currently connected trigger for return focus.

Flat Library cards always remain inside `SwipeableBookCard`; phone width and selection mode now change its `enabled` gesture policy instead of inserting/removing the wrapper. This preserves nested task ownership through the former 768px replacement boundary. Gesture arbitration remains in the established swipe/Back contracts.

Nested dialog portals remain outside the card's DOM even though React events can bubble through the card's component ancestry. `SwipeableBookCard` checks `event.currentTarget.contains(event.target)` before its pointer-down capture, click capture and fallback card activation handle an event. A portaled backdrop or dialog control must not reset the card's swipe suppression, consume its click as a cancelled swipe, or invoke book navigation. These checks preserve the dialog's own dismissal and control handlers; they do not add a global gesture listener or replace the existing local touch arbitration. The swipe wrapper also composes its DOM ref with the swipe library's ref so its surviving primary book control remains available for return focus when the swipe action disappears after resize.

`LibraryRemoveDialog` owns the asynchronous removal confirmation. It retains failure and inline retry, serializes confirmation and blocks dismissal while pending. Confirmation only closes after the supplied callback resolves; obsolete openings cannot close newer ones. Named Cancel/Keep and removal actions remain visible, with the shared adaptive focus/scroll boundary. The parent owns the surviving focus destination when the removed row or its trigger no longer exists.

MyBooks single-book deletion waits for the existing removal service before its explicit local update and success feedback. Bulk removal uses settled per-book outcomes: confirmed removals leave the local view, failed books remain selected, and retry sends only that retained selection. The bulk confirmation remains owned by the screen independently of an individual row. Account/auth-resolution changes key the Library task boundary. The surviving Library content is the fallback focus destination after confirmed removals.

`BookListDetail` owns one controlled AddBooks task outside its empty/nonempty rendering branch. Header and empty-state buttons invoke that same task. Closing restores the invoking button when connected, otherwise the surviving header Add Books button. A partial add can therefore refresh an empty parent into a populated list without replacing the open selection task.

List detail searches later catalog pages before declaring a deep-linked list missing. Its route/account-scoped last confirmed metadata keeps the live task mounted when refresh replaces the catalog with page one. Pagination follows the current catalog, not that retained snapshot. A transient read failure retains the task and exposes retry; a completed missing lookup or access failure withdraws it, and later recovery does not reopen abandoned selection. Membership removal and reorder share a synchronous write lock. Their controls and app Back refuse conflicting work while pending. Reorder rejection restores the previous visible order and exposes its error. Confirmed removal stays projected out until a read acknowledges it, preventing a stale refresh from briefly restoring the removed item; later legitimate additions remain allowed. A removed row's surviving screen owner restores focus to Add Books.

List cards keep cover and metadata above a separate drag/details/remove toolbar. Icon actions retain44px targets; text can wrap. Columns use a22rem content minimum capped to100% rather than forcing two columns at a fixed pixel breakpoint, so increased root text reflows the cards. Shared shell scroll clearance reserves room for the visible Scroll to top action; keyboard revelation must clear that action as well as the header and footer.

## Live consumer dispositions

After a preview's selected book is deleted, its trigger may no longer exist. MyBooks supplies its surviving named Library books main as an optional focus fallback to both bookshelf and carousel previews. Their close-autofocus callbacks prefer the connected book trigger, then the connected page fallback. This runs when the preview's focus scope releases; focusing the page only in the mutation's layout effect was too early in WebKit. Route/account unmount clears the page ref, so obsolete closures cannot focus a new reader's task. Confirmed last-book removal follows the same surviving-page contract.

| Entry or consumer | Current disposition |
| --- | --- |
| `/my-books` flat cards -> `LibraryBookCard` -> `LibraryBookActions` | Live AddToList and async removal; stable `SwipeableBookCard` wrapper through resize. |
| `/my-books` bookshelf -> `LibraryBookshelfView` -> `LibraryBookshelfSelection` | Live selected-book preview with one adaptive owner, nested membership/removal and replacement-trigger focus lookup. |
| `/my-books` carousel inline actions -> `LibraryBookActions` | Live membership/removal consumer; the existing carousel remains its presentation owner. |
| Carousel preview -> `LibraryBookDetailSheet` -> `LibraryBookActions` | Live nested membership/removal consumer. The existing Sheet remains mounted while its side changes with width; it is not claimed as a newly migrated AdaptiveDialog. Confirmed deletion is awaited before closing the preview. |
| `/book/:id` -> `BookDetail` -> `AddToListDialog` | Live standalone membership entry using the same lookup, mutation and lifecycle contract. Other BookDetail editing/removal work remains separately owned. |
| `/book-lists` and `/lists` -> `BookLists` -> `BookListManager` | Live account-keyed create/edit/delete/duplicate owner. Named form fields, preserved failed drafts, dirty discard, pending protection and explicit partial-duplicate feedback. |
| `/lists/:listId` -> `BookListDetail` | Live header/empty AddBooks invokers sharing one controlled task; read pagination, async membership removal and serialized reorder outcomes. |
| `useBookLists` | Live hook used by manager, membership and list-detail readers. Primary writes reject; independent refresh retains its own read state. |
| Legacy `BookCard` | Source contains an AddToList consumer, but current client incoming-import/JSX search establishes no live application entry. Do not count its tests or its presence as rendered coverage; do not delete it merely from this finding. |
| `SwipeableBookListsCarousel` | Source reads `useBookLists` but no current client incoming-import/JSX entry was found. It remains a discovery candidate, not an exercised production route. This differs from the live `LibraryCarouselView` above. |

## Manager and acceptance boundaries

The manager owns one named create/edit surface and one delete task outside list-card rendering. Submitted details remain locked until outcome, failures preserve the form, and dirty dismissal requires an explicit discard. A named per-list Actions menu keeps edit/delete invokers separate from opening the list. Success returns to a connected invoker or surviving Create List control. The manager's pending guard also protects app Back during duplication, which runs without an editor dialog.

Basic semantics, keyboard alternatives, names and error feedback are always enabled. Shared primitives retain focus, scroll-lock and Back coordination; this work adds no competing global overlay or navigation engine. Route removal intentionally ends these in-memory tasks.

The [CR04 checkpoint](frontend-renewal/24-library-list-tasks.md) must distinguish source review, actual-consumer browser assertions, visual inspection and real-device evidence. F10 retains whole-Library/list composition and decluttering work; broader gesture, theme/contrast, physical iOS/Android/tablet, assistive-technology and performance acceptance remain under the main plan. Passing one component fixture does not close those requirements.
