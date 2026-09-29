# Screen-by-screen frontend implementation specifications

Status: proposed implementation contract, not implemented or visually approved. Read the [source audit](02-screen-audit.md) before assigning tickets. Current behaviors are identified there; components named as proposed patterns below are design responsibilities, not claims that those files already exist.

This document covers every current route and embedded reading/social/settings surface. It preserves BRACK's book-tracking product, themes, logos, typography, Iconoir iconography, service boundaries and authoritative domain behavior. Visual changes must not accidentally change rewards, privacy, reading history, date semantics, offline support or permissions.

## Shared contract for every specification

### Runtime and layout vocabulary

- **N — native phone:** Capacitor iOS/Android. Retain primary bottom navigation in browsing contexts. Focused editors, scanner and conversation/session flows may replace browsing chrome with their own explicit controls. Safe-area and keyboard ownership belongs to the shell.
- **W — phone browser:** Safari/Chrome with browser chrome. Use the packet's compact browser navigation policy; do not add a second persistent bottom navigation layer by default. Keep navigation discoverable and addressable. Do not intercept browser edge gestures.
- **P — standalone PWA:** Detect display mode separately from native capability. May use the installed-app navigation treatment; native plugins remain unavailable unless explicitly supported. Always maintain browser-compatible URLs and history.
- **T — tablet/foldable:** Touch-capable content layouts, including iPad split view, Android multi-window and foldable resizing. Choose one/two panes from usable content width, not OS or a hardcoded “desktop” label. A keyboard/trackpad may be attached without changing the route, draft or selection.
- **D — wide browser/Electron:** Navigation rail/sidebar, readable content widths, keyboard and pointer efficiency. Electron is a distinct capability runtime; do not assume a desktop browser API works identically in its shell.

The packet's platform/navigation architecture owns the final shell breakpoint and router decisions. Screen implementations consume that contract. Do not install Ionic or replace React Router within a screen task. Any Ionic candidate must first pass the packet's compatibility and interaction proof, including current React Router v6 constraints and overlay ownership.

Default touch controls have at least 44×44 CSS-pixel hit boxes, preferably 48px for frequent actions; icon art can remain 18–24px. This is BRACK's product baseline, not a blanket statement of legal conformance. Keep normal text legible, line length bounded, focus visible, and content usable at 200% text and browser zoom/reflow. Never hide essential information in a tooltip or gesture.

### C0 — state matrix, required on every screen

| State | Required presentation and behavior |
| --- | --- |
| First load | Render title/back/shell promptly; use shape-matched regional skeletons only for unknown content. Decorative global launch motion does not own route readiness. |
| Ready | Make identity, task and primary action clear; restore valid per-route position/filter state. |
| Refresh with retained data | Keep readable data and actionable safe controls visible; small region-specific progress/status; do not replace a populated screen with a launch loader. |
| True empty | State what is empty and one relevant next action; do not show empty on an unresolved query. |
| Filtered empty | Show active filters/search and Clear or change action; do not imply the account has no data. |
| Error without data | Explain the affected operation, Retry, and a safe exit/fallback. Separate denied/not-found from a retryable network problem when service contracts permit. |
| Error with data | Retain data with a restrained stale/error message and targeted retry. |
| Offline | Show cached/local content where currently supported; state unavailability for unsupported actions. Do not invent an offline social queue. |
| Local pending / syncing / failed sync | Reading-core writes remain locally visible with accurate status; link to existing review/retry UI. Never claim server-confirmed rewards before confirmation. |
| Saving / submitting | Acknowledge immediately, prevent duplicate submission, keep the draft and existing content. Local durability and remote confirmation are separate states. |
| Success | Update the affected region immediately; use one concise announcement and optional brief contextual feedback. Do not delay navigation for decoration. |
| Validation | Keep entered values, associate each error to its control, focus/announce the first actionable error, and avoid color-only meaning. |
| Permission/capability | Explain required capability before an intentional request; offer deny/restricted/unsupported recovery and a non-capability fallback. |
| Auth/feature/visibility change | End loading deterministically; preserve safe drafts within account boundaries; clear inaccessible data and show appropriate recovery. A disabled feature must not leak its content through a drawer or deep link. |
| Resizing/lifecycle | Rotation, folding, split-window resize, app background and browser history must not duplicate a mutation or discard a draft. |

Every screen ticket must mark each C0 state as implemented, inherited with a concrete component reference, or not applicable with a reason. “Handled by shadcn/Ionic” is insufficient. F01–F09 did not consistently maintain this record; [checkpoint20](20-coverage-reconciliation.md) reopens missed live consumers and defines the required route/task/state evidence row. The later placement of a visual screen ticket does not waive this cross-cutting contract.

### C1 — interaction ownership

Back closes the topmost transient surface first, then leaves the focused task, then follows the navigation stack or documented fallback. Save/discard protection is required for dirty substantial forms. Browser Back, native system Back, visible Back and supported gestures resolve the same task state. Closing a dialog returns focus to its connected trigger; route change focuses the new page heading or equivalent context without replaying every list item.

Long press is an optional shortcut to a visible More menu or selection mode. Swipe is an optional shortcut for safe row actions or pane navigation; never the only way to perform an action. Pinch is limited to an explicit image viewer where useful; do not prevent normal browser zoom. Drag/reorder always has keyboard and button/menu alternatives. A scroll, carousel drag, reorder drag, text selection or canceled pointer sequence must not activate its parent card or navigate Back.

### C2 — composition and preservation

Use custom BRACK content patterns for book identity, reading progress, journal writing, goals, streaks, Journey and cover-led discovery. Use established semantic primitives for buttons, fields, focus, dialogs, list selection and date navigation. Custom appearance is not permission to rebuild ARIA patterns carelessly. A single modal owns focus; do not nest independent dialog engines.

Preserve existing hooks and services. New UI selectors derive presentation only. `QuickProgressWidget`/correction, `ProgressLogger`/reading activity, session completion and status changes must retain documented domain semantics unless a separately reviewed product/domain change authorizes otherwise. No UI task awards Ink, changes a streak rule, bypasses role checks or rewrites dates.

### Shared dependencies

| ID | Dependency / exit condition |
| --- | --- |
| D0 | Platform shell/navigation contract, capability model, safe areas, keyboard strategy, scroll owner and overlay/back coordinator proven in a small fixture. |
| D1 | Brand tokens, focus/pressed states, adaptive field/menu/dialog/date controls and semantic book/list row contracts. |
| D2 | Loading, error, empty, offline and mutation feedback contracts using current hooks and repositories. |
| D3 | Editor naming, draft retention, save lifecycle, attachment state and discard protection. |
| D4 | Native scanner/image/share/permission presentation through existing adapters; explicit unsupported web fallbacks. |
| D5 | Motion/reward/gesture contract, reduced-motion behavior and conflict ownership. |
| D6 | Device/accessibility/performance fixtures and before/after evidence for each affected flow. |

## S01 — Public entry and landing

**Source:** `Index.tsx`. **Priority:** P2 after native entry shell; P1 if auth resolution creates a measured blocking loop. **Dependencies:** D0, D1, D2, D6.

**Task and hierarchy.** A new visitor should understand that BRACK tracks reading, books and progress and find one clear start action. An authenticated reader should reach the established post-auth destination without traversing marketing content. Keep existing approved artwork, logo variants and typography. Use a concise hero, concrete reading benefit, illustrative product context and restrained supporting sections. Do not use the authenticated card grid as marketing content.

**Adaptive behavior.** W/D retain a public website header with labelled sign-in/start links and support access. N/P launch should prioritize session resolution and a compact welcome/start screen; if reusing landing, fit the first decision without long decorative scrolling. T retains comfortable prose width and landscape artwork only when it leaves the action legible. Large text may stack art below copy; art must never push controls off a short viewport.

**States and interactions.** Apply C0, including session resolving, signed out, signed in, callback return and offline entry. Do not show contradictory sign-in and signed-in CTAs while session status is unknown. Static hero artwork needs useful alternative text only when it conveys content. Scroll reveals must never leave content invisible with reduced motion or script failure. Links retain normal web open-in-new-tab behavior.

**Acceptance.** FS-S01-1: signed-in and signed-out entry routes resolve predictably under fast/slow/offline conditions without a decorative minimum delay. FS-S01-2: at compact/landscape/200% text, the main message and a start action remain available without horizontal scrolling. FS-S01-3: all marketing claims match implemented product capabilities; no invented “native”, recommendation or offline promises.

## S02 — Support, legal anchors and unknown-route recovery

**Source:** `SupportCenter.tsx`, `SupportContact`, `SupportPageLink`, `NotFound.tsx`. **Priority:** P2; accessible recovery is P1. **Dependencies:** D0–D3, D6; approved legal copy is external.

**Hierarchy.** Support presents search, FAQ categories, contact and a concise way back. Keep existing semantic FAQ details, labelled search, result announcement and skip link. On compact screens show one useful section at a time through in-page headings/disclosure; Terms and Privacy remain directly addressable anchors. Do not make a giant row of equal-priority navigation pills compete with the search field.

**Contact behavior.** Persist the contact draft through validation and recoverable failure. Show attachment progress/cancel only if supported. State sending/sent/failed accurately; a timeout is not successful delivery. Any optional device information is labelled and does not require opening developer terminology. Retain support delivery rules and current consent/captcha behavior.

**Unknown route.** Give “Page unavailable” context, a session-aware Home/Library destination, and safe Back when meaningful. Do not require a full document reload to leave 404. A genuinely inaccessible resource and an unregistered URL remain distinguishable in logs without exposing private resource details to the reader.

**Adaptive behavior.** N/T get an explicit return affordance and safe-area controls. W/D preserve browser anchors/history; T/D may place FAQ navigation beside the content when width permits. Keyboard focus follows a jumped-to section, not an invisible header overlap.

**States.** Include no FAQ matches, contact validation, challenge pending/expired, sending, sent, offline, service error, signed out and authenticated return. Keep the current honest placeholder labels for known issues and legal material until reviewed content replaces them; a design refresh does not certify legal completeness.

**Acceptance.** FS-S02-1: every support anchor opens directly, scrolls below the header and is reachable by keyboard/screen reader. FS-S02-2: failed contact send preserves all text and allows retry without duplicate submission. FS-S02-3: unknown route recovers in browser, PWA, native and Electron without leaving a broken stack.

## S03 — Authentication, callback and password recovery

**Source:** `Auth.tsx`, `AuthCallback.tsx`, `ResetPassword.tsx`. **Priority:** P1. **Dependencies:** D0–D3, D6. Preserve existing authentication and security behavior; this is a presentation audit.

**Hierarchy.** One task-specific heading, a short instruction, labelled fields, primary action, relevant alternate path and unobtrusive help. Native compact presentation prioritizes the form. Brand imagery may sit above or beside it where space permits; never shrink labels or inputs to preserve decorative art. Sign in and Create account are explicit modes with distinct headings and submit labels.

**Form contract.** Preserve password-manager/autofill and platform keyboard semantics, paste, password visibility, validation and challenge handling. Focus the first useful field only when doing so will not unexpectedly open the keyboard during passive entry. Associate password guidance and errors with controls; announce server errors once. Repeated submit does not issue overlapping requests. Never clear a password or email merely because the viewport changed. Recovery copy must preserve existing privacy behavior around account existence.

**Callback.** Show a stable branded context and short status while processing. Give explicit terminal failure/expired-link recovery, safe retry and a sign-in link. No looping loader after an unrecoverable callback. Never treat mere callback arrival as successful authentication.

**Adaptive behavior.** N/T use reachable submit controls above the IME; landscape may scroll the form, but only one primary vertical scroll container owns it. W/D preserve query modes/deep links and browser Back. Support hardware keyboards on tablet and desktop. Return from an external/native auth flow restores the correct route and draft state when safe.

**States.** Existing sign-in, sign-up, email verification/resend, recovery, callback processing/success/failure, challenge required/expired/failed, request pending/rate-limited/offline, invalid form, expired session and password reset completed. Do not assume an uninspected auth mode is absent: enumerate current `Auth` branches before editing.

**Acceptance.** FS-S03-1: VoiceOver/TalkBack and keyboard complete each mode with correct field names, focus and errors. FS-S03-2: 320px width, short landscape, large OS text and IME do not obscure the submit or recovery link. FS-S03-3: callbacks and reset links work on fresh entry and after background/resume; request outcomes and current authentication tests remain unchanged.

## S04 — Onboarding and post-signup permissions

**Source:** `Onboarding.tsx`, onboarding components, `PostSignupPermissions.tsx`, `OnboardingEntryRedirect`. **Priority:** P1. **Dependencies:** D0–D5, D6.

**Preserve.** Keep existing onboarding substance, theme choice, taste/reading rhythm/goal settings, reading-practice step, review, skip/resume rules and account-scoped drafts. Use `ONBOARDING_STEPS` and existing service validation as the step inventory; do not invent a shorter sequence that silently drops saved preferences.

**Hierarchy.** Each chapter has progress context, one short question/purpose, the current controls and a reachable Back/Next or Finish area. Optional fields are explicitly optional. Review groups answers with visible Edit actions that return to the relevant chapter and then back to review. Keep the custom chapter identity, but avoid two competing progress indicators or a reward celebration between ordinary steps.

**Adaptive behavior.** N/W/P compact uses a single-column chapter with keyboard-aware controls. T uses optional summary/illustration beside the form only above its minimum reading width; split view collapses without resetting. D uses bounded form width, keyboard traversal and an optional chapter outline. A horizontal theme carousel retains click buttons and selected announcements; dragging must not advance the chapter or trigger system Back.

**Permissions.** Post-signup permissions are contextual capability choices, not a compulsory wall. Native notification/camera/etc. behavior follows actual implemented options; show pre-request explanation, pending/allowed/denied/restricted/unavailable and OS-settings recovery. W does not display native permission promises. A decline remains a valid completion path. Camera requests should still occur when a reader invokes a scan when possible.

**Dates.** Preserve the shared picker/date-only contract for goal start/end. Typed invalid drafts block progression with local errors; browsing a month/year does not commit. Same-day dates, historical starts and future deadlines follow existing domain rules.

**Acceptance.** FS-S04-1: interruption/reload/background/resize restores the correct authorized draft and step; changing accounts does not expose another draft. FS-S04-2: Back/edit-from-review/skip/finish produce existing domain outcomes exactly once. FS-S04-3: `/welcome`, `/questionnaire` and `/goals` retain compatibility redirects; `/goals-management` remains the independent goal screen. FS-S04-4: permission denial is recoverable and no animation delays readiness.

## S05 — Home / Dashboard

**Source:** `Dashboard.tsx`, `ContinueReadingSection`, `ReaderHud`, `DailyFocusCard`, `DashboardStreakCard`, `GoalsSheet`. **Priority:** P1, must-win. **Dependencies:** D0–D2, D5, D6.

**Primary decision.** “Continue this book” or “Add your first book” leads. Put current book identity, last known page/progress and Start/Resume reading together. Log progress is a clearly labelled secondary action in the same local context. If a session is active, show its current state rather than a conflicting second Start action. Multiple current books appear in an explicit switcher or short secondary list, preserving domain ranking.

**Declutter.** Keep one compact streak/goal summary after the reading action. Place detailed quests, balances, league information, milestones and recent activity behind labelled “Journey”, “Goals” and “Recent activity” access. Do not remove those capabilities or obscure pending sync. ReaderHud and a separate streak card must not repeat the same large numbers at equal weight. Lists are a small shortcut rather than a full promotional panel when space is constrained. Setup-resume notice is brief and dismissibility follows existing onboarding behavior.

**Adaptive behavior.** N/P place current reading within the first meaningful viewport and retain main bottom destinations. W uses the browser shell and ordinary content actions. T/D may place a compact goal/streak summary beside current reading; activities remain subordinate. Do not force two columns if the reading card becomes narrower than its controls/title need. Use a comfortable content gutter without multiplying card padding at every nesting level.

**States.** C0 plus no books, no currently-reading book, one/several reading books, active/paused session, no goal, gamification disabled, live/cached/expired Journey, provisional rewards, freeze ineligible/available/pending, partial dashboard error and setup unfinished. A rewards failure must not block a cached book's reading action.

**Acceptance.** FS-S05-1: on a compact fixture, a reader can find and activate the next reading action before secondary analytics/metadata; long titles and 200% text stay usable. FS-S05-2: Dashboard → timer/progress → saved result updates the same book without duplicate side effects. FS-S05-3: partial Journey failure, expired period or offline state preserves available reading core and makes confirmation status truthful. FS-S05-4: a cold/warm trace proves the shell and next task render within the packet's performance budget.

## S06 — Library, search, selection, shelf and carousel

**Source:** `MyBooks.tsx`, `components/library/*`, `SwipeableBookCard`. **Priority:** P1. **Dependencies:** D0–D2, D5, D6. Existing [library interaction contract](../ui-library-interactions.md) is mandatory regression coverage.

**Hierarchy.** Title and one Add action; labelled local search; one status selector with counts; content. A single “Filter and sort” or “Library controls” entry exposes genre, sort, view and relevant actions. Show concise active-filter chips and clear-all state, not another decorative stats panel. Preserve flat, bookshelf and carousel choices, preference saving, selection mode, reorder eligibility and filtered context rules.

**Book content.** Cover, readable title/author, status and relevant progress dominate. Metadata is subordinate. Long title must remain obtainable without hover; truncated rows open full detail with meaningful accessible name. One semantic primary action opens the existing representation's destination. Secondary controls remain siblings, not nested buttons. Missing/broken cover uses existing brand fallback with stable aspect ratio.

**Modes.** Normal mode opens a book. Selection mode toggles once, announces selection count and provides Select all/Clear/Done plus supported bulk actions. Reorder mode is explicit, with a visible handle, keyboard sensor and move alternative. A request to reorder an incompatible filtered/sorted shelf explains why and offers a safe change; never silently reorder unseen books. Large selections need failure recovery that identifies retained failures, preserving current behavior.

**Gestures.** Swipe rows only for available contextual actions with visible More equivalents. Long press can enter selection after movement thresholds and exclusions are proven; it must not suppress text/image context behavior globally. Bookshelf drag and Embla carousel own horizontal drag within their regions. Do not enable navigation swipes across those same surfaces. Keep current click-suppression, focus return and canceled-pointer guarantees.

**Adaptive behavior.** N/W compact supports list or cover grid with sufficient title space. Controls open an adaptive sheet/menu, not an expanding multi-section wall above the books. T supports library/detail split view only when content widths allow; selecting a book updates the detail pane and URL while preserving list position. D can use denser controls and optional rail filters, but no essential hover-only action. View choice does not reset because a tablet rotates.

**States.** Empty library, filtered empty, loading initial/more, retained-data failure, offline, cover failure, selected/partially selected, reorder pending/error, preference-save failure, bulk partial failure and account change.

**Acceptance.** FS-S06-1: existing primary-action, selection, drag, keyboard and focus tests still describe behavior. FS-S06-2: clear/search/view/filter hit targets pass actual geometry checks. FS-S06-3: all book modes remain available and a phone user can see book content without passing duplicate status summaries. FS-S06-4: 1,000-item fixture meets scrolling budget without a virtualization change that loses focused/selected items.

## S07 — Add book, metadata search, barcode and cover OCR

**Source:** `AddBook.tsx`, `BookSearch`, `BarcodeScannerFlow`, `ScanBarcode.tsx`, `ScanCover.tsx`. **Priority:** P1, must-win. **Dependencies:** D0–D4, D5, D6.

**Acquisition hierarchy.** Search is the clear default path; Scan and Enter manually are explicit alternatives. Keep text queries and manual form data across changes of acquisition method. Results prioritize cover/title/author/edition and a clearly labelled Add or Review details action. Existing-library matches say “In your library” with View book; do not treat a duplicate as an unexplained failure. Search scope and loading remain localized to results.

**Manual/review form.** First group: title, author, cover and core bibliographic input already supported. Additional metadata such as description, chapters and series opens in a labelled details group. Required/optional fields are clear; unknown page count is supported where the domain permits it. Numeric fields have suitable keyboard and errors; do not add arbitrary constraints. The form's Save action is reachable above the keyboard; an action dock must share shell bottom space with navigation and timer, not independently stack fixed offsets.

**Scanning.** Request camera on explicit scan intent; explain permission purpose. Show framing, recognized result, retry and manual fallback. Torch/zoom controls appear only when actually supported. Audio/haptic success always has visual/text equivalence. Stop/release camera on leaving the flow. Cover OCR shows recognized text as editable uncertainty, not verified metadata. Distinguish camera capture, recognition and search. If a stage cannot be canceled, describe that accurately and provide safe eventual exit; do not offer a fake Cancel.

**Feedback.** Remove fixed navigation delays from ordinary adds (A07). On local successful add, return to the intended destination and highlight the new book once, or allow Add another where the existing flow supports it. First-book delight can be brief and dismissible after the action succeeds. It must not block controls or imply Ink confirmation. Keep duplicate restore/identity behavior unchanged.

**Adaptive behavior.** N uses existing native camera/scanner adapters; W/D expose supported browser/file/text paths and do not copy native claims. T can show results beside a metadata review form; narrow split view becomes sequential. Browser Back from scan returns to the acquisition draft, not an empty manual form. `/scan` remains a compatibility alias.

**States.** Searching/debouncing/canceled/outdated result, no results, API rate/error, duplicate, offline manual add, local queued add, permission denied/restricted, camera unavailable/busy, barcode unrecognized, OCR partial/failed, review, saving, success and retry.

**Acceptance.** FS-S07-1: search/manual/barcode/OCR converge on existing identity/persistence rules; repeated submit cannot create duplicate books. FS-S07-2: denying camera still allows search/manual completion. FS-S07-3: browser/native Back and resize preserve drafts and release hardware. FS-S07-4: after a successful ordinary add, the next action is available immediately without a 1.5-second success gate.

## S08 — Book detail and editing

**Source:** `BookDetail.tsx`, `EditBook.tsx`, `AddToListDialog`, `QuickProgressWidget`. **Priority:** P1, must-win. **Dependencies:** D0–D3, D5, D6.

**Hierarchy.** Back + concise book title + More; cover/title/author; status/progress; **Start/Resume reading** and **Log progress**; then secondary content. Correct A02 by putting primary actions before long descriptions/tabs in DOM order. Use one progress summary. Do not repeat the same current-page/percentage/session count in hero and “At a Glance”. Reading history, journal, reviews and bibliographic details are grouped and remain easy to discover.

**Content navigation.** Prefer a small set of clear content groups with current identity/URL state preserved. Current Overview/Progress/Reviews/Journal/Logs must remain accessible; consolidation may group Logs under Progress only if no capability disappears and migration preserves relevant deep-link/UI state. Horizontal tab overflow needs visible affordance and keyboard behavior; no page-wide horizontal swipe over text or charts. Keep private book data distinct from social review visibility.

**Actions.** More groups Add to list, share, edit and delete. Mark finished remains visible in the reading context when applicable, with existing consequences clearly stated. Destructive actions are separated and confirmed; selection of Delete never happens from the first swipe alone. Share invokes current adapter and treats cancellation quietly. Active timer uses Resume/Open session semantics; an unrelated active book requires existing session decision flow rather than silent replacement.

**Editing.** Focused form groups identity, reading metadata, dates, organization and extended metadata. Preserve canonical date-only values and paired bounds. Save waits for supported durability, errors retain the draft, dirty Back offers keep/discard. Date or page metadata corrections must not be sold as reading activity or reward-generating work. Keep labels explicit about those semantics.

**Adaptive behavior.** N/P may use a reachable reading action region with one owner above bottom safe area; W can keep actions in normal flow/sticky locally without stacking browser-like tabs. T library/detail split retains visible library context and independent pane scroll; compact tablet returns to the full detail route. D uses a restrained action sidebar only when it preserves the same logical reading order. At large text the action region wraps or returns to flow.

**States.** Missing/deleted/inaccessible/cached book, no cover/pages, not-started/reading/finished, active/paused different-book session, incomplete dates, invalid edit, save/sync failure, empty journal/reviews/history and partial child-tab fetch failures.

**Acceptance.** FS-S08-1: reading actions precede description and secondary tabs on compact layouts; no keyboard/screen-reader traversal through a long Overview is required to find Start. FS-S08-2: every entry path has a predictable Back and direct-link fallback. FS-S08-3: changing tabs/editing/rotation preserves context and domain semantics; delete confirmation and cache/offline behavior remain correct.

## S09 — Active reading session, finish and progress tracking

**Source:** `TimerContext`, `FloatingTimerWidget`, `HeaderTimerWidget`, `ProgressLogger`, `ProgressTracking.tsx`, `ProgressLogItem`, `JournalPromptHandler`. **Priority:** P1, must-win; draft loss is P0. **Dependencies:** D0–D3, D5, D6.

**Session surface.** One recognizable compact session indicator across the app, expandable to book identity, elapsed time, Pause/Resume and Finish. Elapsed time does not animate decoratively or reannounce every second to screen readers. Large, stable controls stay reachable with one hand; running/paused is textually clear and not color-only. Move/drag of a floating widget is optional and cannot be its only reposition/dismiss mechanism; prefer shell-owned placement that avoids controls.

**Finish.** Present a concise finish summary and optional supported page/progress input, with notes/journal offered after the session is safely saved. Do not add a mandatory writing detour. Existing timestamp-based lifecycle and idempotent completion behavior stay untouched. A failed remote sync is not a failed local reading session if local durability succeeded. The UI explains the difference. Back from finish restores the active/paused session rather than silently discarding it.

**Progress entry.** Show current page and unit before input, labelled new value and optional existing time/note/photo fields. Keep essential input visible; put extra metadata in an optional disclosure. Inline validation explains impossible values and intentional correction semantics. Completing a book is communicated before or at confirmation according to current domain behavior. Unknown total pages is handled without invented percentage precision.

**Progress route.** `/book/:id/progress` leads with that book's progress/history and an obvious log action; summary metrics are compact and advanced insights disclosed. Avoid a wall of four equal statistic cards before the timeline. History entries expose correction/delete controls according to current permissions and services.

**Adaptive behavior.** N/P focused session can hide browsing navigation, retaining explicit close/back and a compact resumed indicator. W permits normal browser behavior and does not claim background execution guarantees. T/D may use an anchored session panel while reading other app content; entering a different route does not create a new session. Controls work with IME, keyboard, switch access and landscape.

**States.** Idle/running/paused/recovered, another active book, finishing, local saved/sync pending/confirmed/failed, invalid progress, interrupted finish, photo upload failure and journal skipped. Reduced motion disables pulses and counter flourishes while preserving status changes.

**Acceptance.** FS-S09-1: start → background → resume → pause → finish succeeds without double-counting or duplicate completion in real-device QA. FS-S09-2: keyboard/system Back never silently ends or loses a session. FS-S09-3: progress save retains values on failure and reports local versus remote state accurately. FS-S09-4: reward/streak feedback occurs only through current confirmed event paths and never obscures Finish.

## S10 — Journal, notes, quotes, reflections and reading history

**Source:** journal components, `RichTextEditor`, `RichTextToolbar`, `ReadingHistory.tsx`. **Priority:** P0 for A03 draft retention; otherwise P1. **Dependencies:** D0–D3, D5, D6.

**Writing experience.** Use an adaptive editor surface: full-height compact task on N/W/P, bounded large editor on T/D. Book identity and entry type are visible; content occupies most space. Title, page reference, tags and photo are optional details. Format controls collapse into a labelled toolbar/More group without removing keyboard access. A Quote entry clearly separates quoted content from page/source context.

**Save lifecycle.** Correct A03 before decorative work. `useJournalEntries.addEntry/updateEntry` currently catch failures without exposing failure to callers, so adding `await` in the dialog alone does not fix the contract. Both normal and quick editors must consume an explicit successful/failed mutation outcome. Keep content and metadata on failed persistence, show saving state and prevent duplicates. A successful write followed by failed status/read refresh is a different outcome: preserve the saved entry identity and retry refresh, not the create operation. Remove the quick editor's unconditional success/reset timer; success feedback cannot precede known persistence. Reopening and account changes follow defined draft ownership. If adding local draft persistence requires a new storage contract, isolate that work and review it; do not silently create a syncable journal outbox. Unsaved substantial content requires keep/discard protection on close, Back, escape and gesture dismissal.

**Attachments.** Show selected/uploading/ready/failed/removing explicitly. A failure preserves the text and offers Retry/remove attachment. Do not delete the previous saved photo before an edited entry's replacement is safely committed; review existing attachment lifecycle as a dependent integrity issue. Image picker and editor should use one coordinated overlay stack, returning focus predictably.

**History.** `/history` retains logs and journals. Group by date with clear book identity and short readable excerpts; search and entry-type filters stay compact. Convert click-only cards (A04) to semantic navigation. A chronological item is not visually identical to a marketing card. Stable scroll and query state survive detail→Back. Use Load more/pagination semantics where required by current data and measured scale.

**Accessibility.** Actual contenteditable gets name, role/multiline semantics where appropriate, instructions and associated error. Toolbar buttons expose names and toggle states; shortcuts are optional. Announce save state once, not every character-count change. No essential meaning relies on colored entry-type pills, audio or handwriting-like type.

**States.** New/editing/dirty/saving/saved/failed draft; no entries/filter no match; text-only/with attachment; offline supported save or clearly unavailable action; account switch; interrupted picker; invalid page reference; limit reached. Keep rich text payload/security behavior unchanged.

**Acceptance.** FS-S10-1: injected add/update failure leaves the complete editable draft open and retry succeeds once. FS-S10-2: close/Back/rotation/picker interruptions preserve or explicitly discard content. FS-S10-3: screen reader identifies editor and format controls correctly; all history destinations open with keyboard. FS-S10-4: long writing remains readable and Save visible with mobile keyboard and 200% text.

## S11 — Lists, list detail and membership actions

**Source:** `BookLists.tsx`, `BookListManager`, `BookListDetail.tsx`, `AddToListDialog`. **Priority:** P2, with navigation/keyboard defects P1. **Dependencies:** D0–D3, D5, D6.

**Hierarchy.** Lists heading, Create list, compact search/filter and cover-led collection rows/cards. Reduce the full-width statistics/header stack on phone; list counts can appear next to the title or in a secondary summary. Each collection shows name, short description if useful, count and visibility. Keep public/private semantics explicit. Do not infer server-side sharing functionality from a pretty public badge.

**Creation/editing.** Name first, description and existing visibility options next. Save button reflects pending work, preserves invalid/error draft and confirms once. Creation feedback places the new list in context or opens it according to the chosen flow; no blocking confetti or enforced pause. Existing create/edit dialogs become the same adaptive editor contract.

**Detail.** Back to Lists, name/count, Edit/More and Add books where already supported. Book identity/progress content reuses library patterns. Removing from a list must be labelled distinctly from deleting the book from the library. Maintain existing reorder behavior only where supported; drag has a move alternative and never opens book detail on drop. Selection mode is explicit.

**Add to list.** Show current memberships with labelled check state and one clear commit model matching current mutation semantics. Creating a list from this flow is a sequential sub-step with return to the original book selection; avoid independent nested dialogs. Failed membership updates preserve known state and identify failed choices.

**Adaptive behavior.** N/W/P use one column or sufficiently wide two-column collection cards, compact filter sheet and focused editor. T/D can show collection index beside the selected list if pane widths support readable book rows. Collection order/filter/scroll survive resize and returning from a book.

**States.** No lists, no filter results, empty list, list missing/inaccessible, load-more, create/edit/delete pending/failed, add/remove membership pending/failed, mixed selection and offline behavior supported by current list hooks. Do not describe nonlocal lists as writable offline without verifying the service path.

**Acceptance.** FS-S11-1: all current filters/sorts and both `/book-lists`/`/lists` entry paths work. FS-S11-2: Create → Add book → View list → Remove from list never deletes the library book. FS-S11-3: keyboard and touch complete selection/reorder without accidental navigation; new-list feedback is immediate and nonblocking.

## S12 — Goals and analytics

**Source:** `GoalsManagement.tsx`, `GoalManager`, `GoalsSheet`, `Analytics.tsx`, chart components. **Priority:** P2; date/keyboard/data interpretation issues P1. **Dependencies:** D0–D2, D5, D6.

**Goals.** State target, progress, period and remaining amount in one plain sentence plus a progress visualization. Books, pages and minutes remain distinct units; do not add unrelated targets into a meaningless total for display. Lead with the active goal(s); completed goals live in a secondary section. Create/edit shows type/unit, target and start/end with an immediate summary. Preserve existing period semantics, timezone/date-only rules, inclusive ranges and server/local hooks.

**Date/calendar presentation.** Keep shared DatePicker parsing, typed draft validation, direct decade/year/month/day navigation, large historical range usability, focus return and labels. Style it using BRACK tokens and purposeful spacing. An Ionic/native replacement is accepted only after parity in typed/historical selection, locale, bounds, screen readers, compact 320px/200% text and timezone tests. Calendar heatmaps are a separate visualization contract, not a date-entry control.

**Analytics.** Start with “How has my reading changed?”: period selector, a small set of meaningful metrics with units and one main trend. Put genres/authors, completion, pace, time distribution, goals and streak details behind labelled analytical groups. Preserve all currently supported charts and their domain definitions; avoid showing zero for missing data. Surface snapshot freshness when relevant. Chart-only summaries require an equivalent readable summary/data list; tooltips cannot be the sole access to values.

**Adaptive behavior.** N/W compact shows one chart at a time with a legible axis and explicit details action. T/D can compare related charts side by side when their labels fit, not simply because `lg` is true. Touch allows point inspection but normal page scroll wins unless a deliberate chart interaction is active. No pinch gesture consumes browser zoom. Dense tables may scroll within a labelled region with headers retained.

**States.** No goal/no analytics, partially populated data, insufficient sample, active/completed/expired goal, invalid numeric/date draft, goal create/delete/complete pending or failure, stale snapshots, chart load failure, selected period with no data and offline cached view. A chart failure should not replace an available metric summary.

**Acceptance.** FS-S12-1: create and edit goal dates pass existing date contract; no locale/timezone regression or invented age/date bounds. FS-S12-2: each chart has a text/data equivalent, units and empty-state meaning; color is redundant. FS-S12-3: tab/period changes preserve context and do not mount every expensive chart unnecessarily; actual trace confirms improvement. FS-S12-4: goals management is reachable without confusing legacy `/goals` onboarding redirect.

## S13 — Reader Journey, streaks, Ink, badges, shop and rankings

**Source:** `Achievements.tsx`, `Journey*`, `ReaderHud`, `DashboardStreakCard`, reward/badge/streak providers. **Priority:** P2 after reading core; correctness P1. **Dependencies:** D0–D2, D5, D6.

**Preserve naming and authority.** The route `/achievements` stays compatible while the UI says Reader Journey. Ink, Competitive Ink, Gold Leaves, levels, quests, streak-freeze eligibility and league membership follow existing [Reader Journey rules](../product/reader-journey.md). No animation manufactures a reward or uses a client-derived threshold. Historical backfill, repeated fetch and reconnect do not replay celebrations.

**Hierarchy.** Overview shows level/next progress and one current useful action. Quests, Badges, Shop and Rankings are clear secondary destinations with existing query-tab compatibility. Keep collectible artwork and currency icons distinct from functional navigation. On compact layouts, wallet, league, streak, quest and badge summaries must not all compete above the first action. Show simple progress labels and optional “How this works” disclosure.

**Quest/streak behavior.** Explain what counts, relevant local date and meaningful remaining work without pressure or alarming loss language. Completed and provisional are distinguishable. Daily/weekly groups can collapse without hiding active status. A streak freeze shows eligibility/cost/quantity and explicit confirmation where required by existing economy behavior; unavailable actions explain why.

**Shop/rankings.** Keep current opt-in, privacy/anonymization, feature-flag, rollover and freshness rules. Rankings show the reader's position and nearby context before a long table; touch rows retain readable labels. Shop success waits for confirmed mutation, disables duplicate taps and displays failure/reconciliation honestly.

**Motion.** Inline change → concise optional celebration → durable Journey record is the order of feedback. Queue competing milestones; never cover an editor, scanner, session Finish or system permission prompt. Reduced motion uses static artwork/text; no sound/haptic-only result. Dismissal and replay policy is explicit and account scoped.

**Adaptive behavior.** N/P can use a focused celebration sheet only at a safe moment. W/T/D use the same confirmation semantics, with size/placement adapted to content. Tablet panes may show quest list/details or badge catalog/detail; collapse maintains selected item. UI tab state stays addressable.

**States.** Gamification/leaderboards disabled, no data, live/cached/expired, pending reading writes, ineligible league, opted out, rollover pending, no earned badges, catalog fetch failure, purchase pending/failed and already-consumed confirmed rewards.

**Acceptance.** FS-S13-1: retry/reconnect/route revisit does not double-award or replay milestones. FS-S13-2: offline/provisional displays never state rewards are confirmed. FS-S13-3: all tab query links from notifications resolve and return predictably; reduced-motion and screen-reader feedback are complete without animation.

## S14 — Feed, posts, reviews and comments

**Source:** `Feed.tsx`, `PostDetail.tsx`, `Reviews.tsx`, `ReviewDetail.tsx`, `PostCard`, `ReviewCard`, `CreatePostDialog`, `ReviewForm`. **Priority:** P2; writing/accessibility/navigation P1. **Dependencies:** D0–D3, D5, D6.

**Feed hierarchy.** Content comes before “community pulse” summaries. Header, scope/Posts–Activity choice and Create action are compact. Keep the current canonical destinations and product labels until the packet's IA decision is applied; do not silently rename Feed/Activity differently across shell and headings. On phone move supporting community statistics/suggestions into secondary sections. Feed refresh preserves reading position and offers a new-items affordance when necessary rather than inserting above the reader unexpectedly.

**Content cards.** Author/time/context, readable content and clear reply/reaction/share actions. Like/Unlike and count have a meaningful accessible name and state. Spoiler, content visibility, delete, report/block and permissions retain existing behavior. Media uses stable dimensions and explicit viewer controls; pinch zoom belongs to that viewer, not the feed page. Long press is a shortcut to a visible More menu.

**Composers.** Compact full-height writing surface; large bounded editor elsewhere. Audience and selected book/context remain visible before Publish. Rich text and attachments use D3; submission failure retains everything, and success inserts confirmed content then closes. An optimistic visual item, if used, must be visibly pending and recoverable; do not invent offline social mutation support. No celebratory takeover for each post.

**Reviews.** Search/scope/rating filters are grouped; choose-book flow clearly distinguishes library copies from public review context. Rating control exposes labelled values and keyboard operation. Reading detail shows book identity, review text and comments; replace implementation jargon (A16) with reader-oriented copy. Comments have visible/programmatic labels, clear posting/error state and pagination. Smooth scrolling respects reduced motion.

**Adaptive behavior.** N/W/P single reading column with contained filter/composer surfaces. T/D may add a restrained suggestions/review-context pane when it helps and widths permit. Browser deep links and normal link activation work; native Back returns to prior feed position. Do not assign whole-screen swipes over selectable post/review text.

**States.** Empty feed, filtered empty, end-of-list, loading more, network error with retained posts, deleted/private/blocked content, social disabled, unauthenticated interaction, send pending/failed, attachment failed, comment error and rapid reaction taps. Undo/rollback uses existing operation support rather than a decorative promise.

**Acceptance.** FS-S14-1: create post/review/comment failure preserves draft; success appears once without blocking animation. FS-S14-2: all reaction, rating, menu and editor controls are named and keyboard reachable. FS-S14-3: direct links/private/unavailable states disclose no inaccessible content and offer safe recovery. FS-S14-4: detail→Back restores scope, filters and scroll on all runtime families.

## S15 — Discover, readers and book clubs including administration

**Source:** `Readers.tsx`, `BookClubs.tsx`, `BookClubDetail.tsx`, club components. **Priority:** P2; broken entry/role controls P1. **Dependencies:** D0–D3, D5, D6.

**Discovery.** Search plus explicit Readers/Clubs modes; reduce nested tab strips by grouping subfilters inside one labelled control area. Preserve existing reader/club sections and recommendation reasons. Explain “suggested” using returned service text only; do not invent personalization evidence. Reader/club cards have native primary links and independent Follow/Join/More actions.

**Club identity.** Name, cover/avatar, short description, membership/privacy state and one Join/Request/Enter decision. Details are reachable without dominating the viewport. Private-club preview must not show member-only content. Preserve the existing distinction between public membership, join request, pending invitation and role-based administration.

**Club content.** Overview, chat, discussions, announcements, members and admin remain available according to existing permissions. On compact screens use a readable section selector/rail and concise current heading, not six compressed text tabs. Chat and long discussions use the messaging/editor keyboard contract. Important announcements are not only color-coded. Members list supports labelled role/state, search where already supported and a visible menu for allowed actions.

**Administration.** Existing pending requests, invitations, role-dependent actions and media edits use a focused management section. Destructive/role-changing actions name their target and consequence; submission feedback is local to that item. Do not introduce a generic site-admin console or broaden permissions. Invitations are real outbound actions during implementation QA: use fixtures/test accounts and never send to real readers as a visual test.

**Adaptive behavior.** N/W single section at a time, preserving query/scroll. T/D can show club section rail alongside content, but chat composer and member controls retain touch sizing. Split view collapses the rail first. Swipe between sections is optional only if nested chat/editor/scroll ownership is proven; visible section controls remain primary.

**States.** No results, no joined clubs, recommended content unavailable, public/private, member/nonmember, pending request/invite, banned/blocked/restricted, role change, social disabled, club deleted, chat loading/error, draft send failure, media upload failure and expired membership.

**Acceptance.** FS-S15-1: profile club card routes to `/clubs/:clubId` and returns to its source (A01). FS-S15-2: all membership/role states match current service permissions, including changes while a screen is open. FS-S15-3: no wrong action occurs from a swipe/scroll or a nested button click. FS-S15-4: invitation/admin workflows are validated without contacting real users or changing production membership.

## S16 — Own profile and reader profiles

**Source:** `Profile.tsx`, `UserProfile.tsx`, `settings/ProfileSettings`. **Priority:** P2; A01/A04 P1. **Dependencies:** D0–D3, D4, D6.

**Own profile.** Consolidate presentation around one reusable profile editor contract used by `/profile` and Settings/Profile. Preserve both entry routes until an explicit compatibility migration exists. Show avatar, display name and bio in one coherent form rather than separate equal cards per field. Public profile preview is explicit; private account/personal settings do not appear in the public preview.

**Reader profile.** Identity, follow/mutual/private state, bio and one relevant Follow/Message action lead. Statistics are concise and subordinate. Books/posts/clubs are readable content sections with accessible selected state and correct destinations. Do not treat a private library book route as a generally public catalog detail without verifying access semantics; use current service-returned permitted content and planned public review paths appropriately.

**Actions.** Avatar picker presents selected/uploading/failed/ready state and an alternative to camera. Block/report controls stay discoverable in More and explain consequences. Message eligibility is readable before composing. Follow/Unfollow pending/error states prevent duplicate rapid actions and preserve current privacy rules.

**Adaptive behavior.** N/W use a compact identity header and section navigation; T/D can pair profile summary with selected content. At large text, counts wrap with labels and action names remain visible. Avoid whole-card press-scale that moves controls; a semantic link plus independent controls reuses library ownership rules.

**States.** Own/other profile, loading/error/not found/private/blocked, missing avatar/bio, empty books/posts/clubs, follow pending/failed, message ineligible, image picker denied/upload failed, dirty editor and save failure.

**Acceptance.** FS-S16-1: both own-editor entries share field labels, validation, draft/save behavior and updated values. FS-S16-2: books/posts/clubs are keyboard accessible and use registered destinations. FS-S16-3: blocked/private states and account changes do not flash cached inaccessible content. FS-S16-4: avatar upload failure does not erase other form fields or previously saved media.

## S17 — Settings, accessibility, privacy and data controls

**Source:** `Settings.tsx`, `components/settings/*`, Theme controls. **Priority:** P1 for accessibility/navigation; otherwise P2. **Dependencies:** D0–D3, D4, D6.

**Information structure.** Preserve Account, Profile, Personal Info, Reading Profile, Data & Backup, App Preferences, Notifications, Privacy, Support. Compact layout becomes a clear category list that opens a focused editor; keep `?section=` compatibility. Add an Accessibility section or a clearly named subgroup in App Preferences according to the packet's settings decision. This is additive presentation work; any persistence required by new preferences is explicitly scoped and reviewed.

**Accessibility settings.** Accessibility works by default. Do not add a fake “Enable screen reader” toggle or try to turn VoiceOver/TalkBack on from the app. Provide concise OS guidance and optional preferences such as following system reduced motion, reducing celebrations, haptic/sound controls and comfortable density when implemented. Honor system settings without requiring an account toggle. Every audio/haptic cue has visual/text equivalent; any instructional video/audio introduced later needs captions/transcript. Do not claim a preference makes the app legally compliant.

**Appearance.** Preserve theme mode, registered palettes, theme-aware logo and established fonts. Theme preview explains current selection and applies consistently to overlays/charts. Previewing a theme must not reset editor/navigation state. High contrast is a tested theme behavior, not a label on an unverified palette. Body/font enlargement must not shrink targets to fit the old layout.

**Sensitive controls.** Account recovery, sign-out, deletion, export/import/restore and privacy changes keep existing domain/security contracts. Destructive actions are placed in a separated group with explicit consequences and confirmation. Export/import presents choosing/preparing/progress/result/failure and never calls a merge “replace” or vice versa. Synced/local/account-specific scope must remain accurate. Avoid teaching users implementation details unless they affect their choice.

**Notifications/privacy.** Separate OS permission from app preference and durable in-app messages. Denied native permission has appropriate OS-settings help; web sees its supported capability state. Quiet hours use clear time/date conventions. Privacy controls explain audience and preserve existing mutual/block semantics; do not substitute cosmetic hidden state for authorization.

**Adaptive behavior.** N/W/P category → detail with explicit Back and dirty protection. T/D two-pane categories/detail when content width allows; changing pane layout retains active `section`, draft and focus context. Long editors scroll independently only when the shell contract makes ownership clear.

**States.** Loading, unsupported setting, denied permission, dirty/saving/saved/error, offline available/unavailable, invalid dates, import parse/preview/confirmation/result, sign-out pending/failure, feature-flagged options and changed account.

**Acceptance.** FS-S17-1: direct `?section=` links, section changes and Back work identically across compact/two-pane layouts. FS-S17-2: all existing appearance choices remain and every theme passes relevant states. FS-S17-3: accessibility is usable with no app preference setup; new controls accurately describe what they change. FS-S17-4: keyboard and screen-reader users complete sensitive actions with the same safeguards as pointer users.

## S18 — Messaging and in-app notifications

**Source:** `Messages.tsx`, `ConversationsList`, `MessageThread`, `UserNotificationsPopover`. **Priority:** P1. **Dependencies:** D0–D3, D5, D6.

**Inbox/thread navigation.** Preserve `/messages`; add durable thread identity through a documented query parameter such as `?conversation=<id>` or the packet's approved route contract. Maintain compatibility with current `location.state` entry from profile/deep links. Restoring an existing ID must not create a new conversation. Direct-thread entry has an Inbox fallback. Correct A09 so history represents opening/closing a thread, not just local state.

**Layout.** Compact opens one thread full screen with participant identity and Back. Tablet split view requires adequate inbox and thread widths; replace unconditional 22rem inbox allocation (A08) with flexible/minimum-aware panes. At insufficient width show a single navigable pane. Wide layouts can resize within safe minimums. Each pane owns its own appropriate scroll; shell and thread must not compete. Composer remains visible above virtual keyboard and safe area; do not independently calculate screen height from a guessed header constant.

**Messages.** Preserve draft per conversation within safe ownership, sending/sent/failed/retry state, existing reaction/delete permissions and eligibility. New incoming messages do not yank a reader away from earlier history; show a new-message affordance. Scroll-to-bottom acts only on explicit user intent or when already following latest. Names, timestamps, attachments and reactions remain accessible without announcing the entire thread repeatedly. Long press opens the same actions as visible More; text selection, OS context menu and screen-reader gestures must not be intercepted.

**Notifications.** Correct A05/A06. Trigger says unread count; expanded content has a heading, explicit close, and initial-load/empty/error/stale states. On compact screens use a sheet/full-height panel appropriate to message count; T/D can retain a bounded anchored surface. Selecting a notification resolves its existing destination and closes/restores focus appropriately; a mark-read failure does not block destination navigation. Show retry/error state for Mark all read and do not falsely clear the badge. Existing notification types are Journey-related; do not invent social notification schemas to make the UI broader.

**States.** Empty inbox, selected thread loading, unknown/inaccessible/deleted conversation, blocked/restricted recipient, send pending/failed, old-message loading/error, offline retained conversation, account switch, notification initial/error/true empty/unread/read, mark-read failure and destination feature disabled.

**Acceptance.** FS-S18-1: thread open → Back → Forward → reload preserves intended URL/selection without creating a conversation. FS-S18-2: real phone/tablet keyboards leave composer and Send reachable; fold/resize retains draft and selection. FS-S18-3: text selection, horizontal/vertical movement and swipe-back each produce only their intended action. FS-S18-4: unknown notifications data never displays “caught up”; mark-read failure still permits opening an accessible destination. FS-S18-5: message and notification updates announce concise status without stealing focus or scrolling.

## Execution order and review units

Do not implement all visual changes as one unreviewable patch. The full pass can be one coordinated program with coherent review units and one integrated final QA cycle.

| Batch | Screens / scope | Entry requirement | Exit evidence |
| --- | --- | --- | --- |
| 0 | Baseline captures and source confirmations | Read packet, graph queries, verify current checkout | Route matrix, fixtures, measured performance and observed accessibility defects; unknowns remain labelled. |
| 1 | A01/A03/A04/A05/A06/A10 and shared correctness contracts | Current services confirmed; no redesign dependency needed for safe fixes | Broken route, keyboard, editor failure and notification failure reproductions pass. |
| 2 | D0/D1/D2 platform shell and adaptive foundations | Platform compatibility proof accepted | Browser/native/tablet chrome, Back, overlay, keyboard and scroll matrix passes. |
| 3 | S05–S09 reading loop | Shared primitives/state/gesture contracts ready | Add → library → detail → session/progress → home passes online/offline and device matrix. |
| 4 | S10–S13 writing, organization, goals and Journey | Draft lifecycle, date parity, confirmed reward flow | Draft failure, history, list membership, goal dates and reward replay tests pass. |
| 5 | S14–S18 social, profile, settings, messaging | Adaptive editor/menu and split-pane contracts stable | Visibility/role fixtures, interaction ownership, durable history and accessible settings pass. |
| 6 | S01–S04 public entry/auth/onboarding/support completion | Auth/services preserved, shell behavior proven | Existing auth/onboarding tests plus real-device keyboard/callback and recovery QA. |
| 7 | Integrated polish and regression | All acceptance IDs satisfied or explicit owned exceptions | Full reading loop, all routes, theme/text/device matrix, latency/frame evidence and accessible task walkthrough. |

Authentication and public accessibility defects found during baseline are fixed at their severity immediately; batch order is not permission to defer a blocking entry issue. Screen-local source files should be reorganized only as their responsibilities change, using the packet's target feature boundaries. Keep imports/services working through small migrations; no mass rename just to make a proposed tree look tidy.

## Handoff checklist for each implementation ticket

1. Record spec ID, relevant A/H findings, source symbols, runtime fixtures and current behavior.
2. Name the primary task and what moves into secondary disclosure; list every existing action retained.
3. Specify URL/history, primary/secondary navigation, scroll owner, focus target and Back fallback.
4. Complete C0 states and D0–D6 dependencies applicable to that screen.
5. Record native phone, phone browser, PWA, tablet full/split/fold, desktop browser and Electron differences; shared behavior can reference a proven contract.
6. Include keyboard, screen-reader, switch/alternative input, reduced motion, text enlargement, contrast and gesture alternatives.
7. Preserve domain/service/offline/privacy contracts; flag any needed behavior change separately rather than sneaking it into a visual refactor.
8. Attach focused tests and actual before/after evidence. Do not rerun unrelated expensive suites repeatedly without a change or unresolved risk.
9. Update the source audit and docs when reality changes; mark findings fixed only with verification. Graphify/Obsidian are navigation aids and may lag the latest patch.
10. Close only when acceptance IDs pass in the relevant runtime or an explicit, owned release-blocking exception is recorded. A source review or browser emulation does not replace native-device or assistive-technology validation.
