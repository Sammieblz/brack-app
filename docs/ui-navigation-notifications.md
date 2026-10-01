# Navigation and notification semantics

Current renderer behavior from frontend renewal F02/F03. [Batch evidence and continuation](frontend-renewal/14-next-implementation-batch.md) distinguish tested browser behavior from native, live-service and assistive-technology checks.

## Destination links and recovery

`UserProfile` book and club cards and `ReadingHistory` progress/journal cards are React Router links. Preserve native keyboard activation, modifier/new-tab behavior, visible focus and the canonical destinations `/book/:id` and `/clubs/:clubId`. Do not put a button or another link inside these anchors. Separate future independent card actions from the destination link.

CR06a extends this contract to live Readers profiles, PostCard author/title/attachments, ReviewCard author/title/book-header/comments/copy/catalog destinations, ReviewDetail author/copy/catalog, BookClubCard, and Reviews trending/picker catalog exits. See [checkpoint26](frontend-renewal/26-social-destinations.md) for actual consumer coverage and results. Preserve a distinct named destination and visible focus; never place Follow, More, comments disclosure, spoiler reveal, membership actions or user-authored rich links inside another destination anchor. Review previews without titles expose **Read review**. Reviews' compact cards intentionally render plain previews; full rich review content keeps its own links.

Club navigation preserves `!preview_only || isMember`. Preview-only nonmembers receive static banner/avatar/title information and permitted membership actions, without a fake disabled anchor. Visibility of a link does not replace route, service or backend access checks. Existing production social FeatureGate remains responsible for disabled routes.

Keep copy/catalog query semantics unchanged. Opening the review picker's catalog destination in another tab leaves the current picker and search intact; ordinary activation navigates and unmounts the task. A destination changes location, while choosing a library book opens the existing in-place review task. Use content-driven wrapping and bounded image dimensions so enlarged text is not squeezed into fragments beside an avatar.

The profile's Books/Posts/Clubs tabs and history's Progress Logs/Journal Entries tabs retain their selection in the `tab` query parameter. The default tab omits the parameter. Changing tabs replaces the current entry and preserves other query parameters; returning from detail or reloading restores the tab. This does not persist search text, scroll position or unsaved work.

F07 supersedes the original positive-index recovery heuristic with the [app Back ownership contract](ui-back-navigation.md). `useAppBack` delegates to the coordinator: overlay/route guard, explicit `onBack`, explicit `to`, verified observed app ancestry, then a replacing contextual fallback. A positive BrowserRouter index alone does not prove a predecessor. Recheck live history identity when activating recovery.

`NotFound` offers a router link to My Library for a signed-in reader or public Home otherwise. Go back is present only when verified app ancestry exists, with an activation-time recovery fallback. Route gates remain owned by `App`/`FeatureGate`; these fixes do not add an alternate club URL or bypass social/gamification gates. Native callback policy and local gesture cancellation are implemented in F07; physical device acceptance, independent tab stacks and broader shell scroll/focus restoration remain outstanding.

## Reader route recovery

CR06b adds explicit signed-out recovery to both Lists aliases and Reading Goals. Keep auth-loading ahead of reader-owned content, including when an old user value remains during resolution. The prompt offers Sign in and public Home; it does not redirect automatically or replace backend access checks. Medium/expanded Library header destinations are native links with visible labels; the phone Analytics icon has an accessible name and title. Club loading, ready and unavailable branches each expose one contextual Back control, with `/clubs` as the coordinator fallback.

The bounded Lists/Goals sign-in return contract is documented in [authentication](authentication.md#reader-screen-return-intent). The CR06b fixture mounts these actual screens; it does not close F10/F13/F14 composition, native Back or global focus-restoration acceptance.

## Notification ownership and states

`UserNotificationsPopover` renders the list and manages opening/dismissal. `useUserNotifications` owns query and read-mutation feedback. `services/api/userNotifications.ts` owns SDK requests and expected-reader checks; components do not query Supabase directly.

| State | Reader-facing behavior |
| --- | --- |
| Initial pending, no result | Loading feedback; never “You're caught up” |
| Initial failure | Specific load error and retry |
| Successful empty result | Empty state |
| Refresh with existing data | Retain usable rows; indicate refreshing or refresh failure |
| Read pending | Retain unread state, prevent duplicate read submission, permit destination navigation |
| Read failure | Explain that read status could not be confirmed and offer retry; keep unread until confirmed |
| Read confirmed | Update affected cached rows and refresh independently |

The query key is `['user-notifications', userId]`; the read mutation key is `['user-notifications-read', userId]`. The latest 30 notifications are loaded with a 30-second stale time and 60-second polling interval. The displayed unread count describes **this list**, not an independently queried total for the account.

Selecting a row closes the popover and opens its existing Journey destination immediately; it does not await read marking or cache refresh. Ordinary close and Escape return focus to the trigger. Navigation suppresses focusing an outgoing trigger. An account change closes the popover and selects the new reader's cache.

Read mutation state survives header remounts in TanStack Query's transient mutation cache. Duplicate protection uses the account's actual pending mutations, not just local button state. A normal same-reader navigation must not cancel a requested read merely because the old header unmounted. Failed read marking is not an offline queue; no automatic retry or replay is promised. An unmounted or different-reader instance cannot emit its old global error toast.

Mark-all captures the known unread IDs at submission. Success only confirms those IDs in the cache, so a notification arriving during the request is not guessed to have been read. The server's mark-all operation still targets that reader's unread rows; subsequent refresh supplies authoritative results. Refresh confirmation also removes an obsolete retry message when all affected visible rows are already read.

## Account and service boundary

All three service functions require the expected reader ID. Reads accept the query's AbortSignal. Reads and writes verify current authentication before and after the request and include an explicit `user_id` filter. A late response for a former reader is rejected instead of being interpreted as the current reader's result. Existing RLS remains the authorization boundary; the filter does not replace it. This follows the existing table policy and the official [Supabase RLS guidance on explicit query filters](https://supabase.com/docs/guides/database/postgres/row-level-security), consulted 2026-09-27.

No schema or deployed API contract changed. A rejected or interrupted response is uncertain: the UI says it could not **confirm** read status, rather than asserting the server did not write it. SDK request tests use synthetic HTTP and do not prove live RLS execution.

## Regression entrypoints

- [Browser fixture](../tests/fixtures/frontend-semantics/README.md): real source screens, popover, router, gates and editor; synthetic service/reader boundaries.
- `screens/navigation-recovery.test.tsx` and `hooks/useAppBack.test.tsx`: canonical links, selected source tab, recovery precedence and direct-entry safety.
- `hooks/useUserNotifications.test.tsx`: loading/failure/cache state, deduplication, remounts, account changes and cache confirmation.
- `services/api/userNotifications.test.ts`: real SDK request construction with mock HTTP, owner checks/filters, error and cancellation handling.

Keep new fields consistent with the [form accessibility contract](ui-form-accessibility.md). Browser semantics do not certify VoiceOver/TalkBack behavior or native routing.
