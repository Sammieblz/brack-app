# Reading capture, page correction and progress history

This contract describes the F11b source at the `ee0081e` baseline plus the current renewal changes. [Checkpoint32](frontend-renewal/32-reading-capture.md) owns implementation status, actual verification results and evidence. This document does not establish native-device acceptance, remote synchronization, accessibility conformance or completion of the wider F11 timer/Edit Book work.

## Intent and live entry points

Reading capture records an activity; page correction repairs the book's saved position. Keep those actions visibly distinct. Use the existing theme tokens, Inter/Merriweather/Playfair roles and Iconoir library. The new composition removes the equal-card statistics wall and keeps optional information behind labelled disclosures.

[Book metadata editing](ui-book-editing.md) documents the separate `/edit-book/:id` task. Its changed-field updates can correct saved page, status and dates without creating activity; they do not inherit capture's automatic completion or quick correction's status consequences.

| Live entry | Owner and behavior |
| --- | --- |
| Book Detail's early **Log progress** button | One `ProgressLogger` outside its tabs and responsive header branches. The stable button ref supplies return focus. The caller provides current page and total pages and refreshes book/history after confirmed capture. |
| Dashboard's primary reading card and reading controls | `openProgressLogger` checks the book's reader, retains the actual invoking element and mounts one logger outside the card/header presentation. Authentication/account changes clear the selected task. |
| `/book/:id/progress` | `ProgressTrackingContent` leads with book identity, saved position and **Log progress**, followed by daily activity and **Pace and insights**. The account/book/auth boundary owns one logger; resizing only changes header presentation. |
| Library selected-book actions and Book Detail's detailed-progress link | Existing navigation leads to `/book/:id/progress`; the route now provides the actual capture action. These links do not mount another logger. |
| Book Detail → Progress → **Correct current page** | `QuickProgressWidget` is an inline correction form for reading/completed books. Once visited, its tab stays mounted while hidden so changing tabs retains an unfinished correction. |
| Book Detail → Logs | `useProgressLogs` supplies account/book-owned local records and remote hydration. The screen renders initial loading, retained refresh, visible failure/retry, and confirmed empty results separately. |

The actual source owners are [ProgressLogger](../apps/client/src/components/ProgressLogger.tsx), [progressCapture](../apps/client/src/lib/progressCapture.ts), [QuickProgressWidget](../apps/client/src/components/QuickProgressWidget.tsx), [ProgressTracking](../apps/client/src/screens/ProgressTracking.tsx), [BookDetail](../apps/client/src/screens/BookDetail.tsx), [Dashboard](../apps/client/src/screens/Dashboard.tsx) and [useProgressLogs](../apps/client/src/hooks/useProgressLogs.ts). Check these live consumers before changing the shared task; a standalone modal test cannot prove its callers preserve it.

## Capture task and input

The adaptive task shows the book title, **Page reached**, the saved page and known total first. Page input is visually prominent. **Time, notes and photo** discloses minutes read, reading notes, chapter, paragraph and photo controls. Cancel and Save remain in the adaptive footer, within the same form and whole-surface scroll owner.

Inputs retain their raw strings. Numeric fields use native text inputs with `inputMode="numeric"`, explicit visible labels, associated help/errors and manual validation; no `parseInt` truncation converts a decimal or exponent into a valid page. A page must be a positive safe integer and within a known total. Optional minutes/chapter/paragraph must be positive safe integers when present. The current persisted book is revalidated before creating a log, so an outdated opening's total cannot authorize a newly invalid page. Unknown totals do not invent an upper limit or a percentage.

Validation preserves the draft, opens optional fields when needed, and focuses the first invalid field. A persistence error has its own focusable alert rather than falsely marking valid input invalid. Standard form submission works from keyboard; a textarea retains ordinary multiline editing. There are no gesture-only save/cancel actions or custom numeric keyboard parsers.

Saving the known final page explains that the book will become finished. Logging a lower page explains that it creates activity while retaining the later saved position; **Correct current page** is the way to move the saved position backwards. The capture helper keeps `current_page` monotonic with `Math.max`, retains existing started/finished dates, starts a to-read book when appropriate and preserves existing completed status. It does not create or stop a timer session.

## Task ownership, dismissal and media

One opening belongs to one resolved reader and one book. Responsive header changes do not replace its mounted form. Closing and reopening starts from the current caller page; confirmed success clears the old task. Account changes, unresolved authentication, book replacement and unmount invalidate its pending presentation callbacks. They do not cancel a repository or storage operation that has already been issued.

The existing [adaptive surface](ui-adaptive-overlays.md) and [Back coordinator](ui-back-navigation.md) remain the sole modal geometry/focus/dismissal owners. No extra body lock, global swipe recognizer or modal router is introduced. Page input receives initial focus. Connected invoker refs restore focus after dismissal; the nested photo chooser returns to its photo control.

While a reading save or photo upload is pending, Close/Cancel/Escape/outside-pointer/app Back requests cannot dismiss the task. A dirty draft requires an explicit keep/discard choice. An attempted or partially committed save uses different wording: closing may leave a saved reading log, and keeping the task open allows completion of that same attempt. A close after complete local success does not offer a new create operation. These are app-owned dismissal policies; they do not intercept arbitrary browser history, reload, process termination or external navigation.

`ImagePickerDialog` retains the actual camera/photo-library choice surface. Its synchronous selection guard prevents overlapping selections and dismissal while picking; opening generation checks reject an obsolete picker result. `useImagePicker` avoids publishing results after unmount. The shared dialog is also consumed by Edit Book, Profile and Profile Settings; these owners do not become fully renewed simply because the picker boundary changed.

The capture task keeps a selected image available after upload failure and offers Retry upload or Remove selected photo. During failed replacement, the previous successful photo remains available; removing the failed selection retains that previous photo. A successful upload URL is reused for capture retries without another upload. Photo upload has its own pending/error state and requires connectivity; it is not an offline attachment queue. Storage requests are not cancelled on task removal, and this change does not add upload idempotency or cleanup of abandoned/replaced remote assets.

## Persistence and retry boundary

`createProgressCapture` freezes one submitted payload with a local log ID, reader/book identity, activity date and original log timestamps. `persistProgressCapture` uses the existing local repositories in two stages:

1. Read the current owned, nondeleted book. Read back the proposed log ID and compare the submitted fields if it already exists. Otherwise validate the current bounds and call `progressRepo.createPending`.
2. Re-read the latest local book, preserve its other current fields, apply the existing reading/status rules, and call `booksRepo.upsertLocal`.

Each repository operation owns its existing row/outbox transaction. The two stages are **not one atomic transaction**. A saved log followed by a failed book update is reported as that partial result, and Retry finishes the book stage without creating another log. The editor freezes once the log is committed or its outcome remains uncertain, preventing a different payload from reusing the submitted ID.

If the create response throws after a possible local commit, readback checks that same log ID and payload. A matching record confirms stage one. Confirmed absence allows an ordinary failed attempt to become editable again; an uncertain readback keeps the attempt frozen for verification on retry. Obsolete ownership is checked around asynchronous reads and between stages, so an old task cannot continue a later book update or close/announce in its replacement.

The log's ID, `logged_at`, `created_at` and local calendar activity date stay tied to the original submission. A later book-stage retry uses a fresh `updated_at` and re-reads the current book before forming the update. This prevents a delayed retry from stamping a new book mutation with the older log timestamp. It does not add locking or serialization against every concurrent editor/window. An ambiguous book-write response can result in another book update on retry; the guarantee against repeating the captured log is not an exactly-once guarantee for the entire two-stage operation.

Attempt flags live only in the mounted task's memory. Closing a partial save, navigating away, reload or process death ends that attempt's recovery context; the durable log/outbox may remain. Reopening is not durable attempt recovery and may create a new log. Do not describe this as crash-safe orchestration or a new persistent transaction coordinator.

After both local stages succeed, the UI reports **saved on this device**, starts existing sync work when connectivity is available, closes without an artificial celebration delay and asks the caller to refresh. Refresh/toast/sync-trigger failure does not convert the confirmed local save into a failed create or invite a duplicate retry. This success message does not assert remote acknowledgement, awarded XP, a streak update or server reconciliation.

## Page correction

Correction accepts a whole safe integer from zero through a known total, or any nonnegative safe integer when no total is set. An unchanged value cannot submit another correction. The current saved page remains visible, and an invalid value retains its raw input with an associated error and focus return.

`updateBookQuickProgress` remains the service boundary. Correction can move the saved page backwards or to zero; it does not add a progress log, reading session, streak event or reward. Reaching the final page follows the existing completion rule and shows its consequence before saving. Moving a completed book backwards does not change its completed status; the form directs the reader to Edit Book for a status change.

A synchronous guard serializes submission. Pending controls are disabled, failure retains the correction for retry, and only the same mounted owner can announce its result. The draft survives Book Detail tab changes and is not overwritten by a background page prop while dirty/pending. A confirmed local correction remains successful if the subsequent book refresh fails; that failure is presented separately rather than re-running the mutation. New account/book/auth ownership creates a new correction task.

## Saved place, logs and analytics are different read models

The progress route's saved place comes first from `booksRepo.get`, with explicit account/book/deletion checks. A missing cached book may use the existing active-book read while connected. Its read-generation guard checks ownership after each asynchronous read: an obsolete local result cannot start remote fallback, and an obsolete remote result cannot start hydration. An already-issued read/write is not cancelled. Remote hydration goes through `upsertRemoteManyPreservingLocal`; the authoritative returned record is rendered, so an in-flight older response cannot replace a pending local capture/correction. Book Detail uses the same preservation-aware hydration for its refresh. This does not mean all application reads have migrated to this boundary.

`useProgressLogs` filters local records by reader/book, excludes tombstones and sorts by event timestamp. It shows local records before remote work when available. Remote hydration preserves unsynced rows atomically, then re-reads local records to include captures that occurred while the request was waiting. Omitted cached logs remain: an older response may omit a newly acknowledged log. Authentication/account/book changes hide the former owner's data and invalidate obsolete requests. Access-rejection responses clear visible records; transient refresh errors retain already-loaded history. The hook exposes initial loading, refresh and error separately from empty results.

The progress route's daily activity, pace and forecast still use the existing remote-derived APIs. The route labels them **synced activity** and explains that new local changes may not appear yet. Offline disables those requests, retains activity already loaded, and explicitly explains the unavailable history on an uncached first visit. Local capture remains available when the owned book exists. Reconnection can refresh the retained resources. This route does not synthesize an offline chart from unsynced logs.

Daily activity appears in a semantic ordered list, newest first, with civil dates formatted through `toLocalDate` to avoid a UTC date shift. Fourteen days are initially shown, with a visible **Show earlier days** control. **Pace and insights** contains secondary metrics and mounts the existing charts only while open. Chart data reads may already occur before disclosure; this is deferred chart rendering, not a claim of deferred API fetching. Activity-day count is labelled **Days with activity**, not a consecutive reading streak. Estimated values remain estimates; no total means no fabricated completion percentage.

The audited per-log API/component path provides read-only log entries. This batch does not invent individual log editing/deletion, permission rules or remote mutations. Current-page correction is not editing a historical log. Wider history management, timer lifecycle and Edit Book remain separately owned in the execution plan.

## Accessibility, motion and evidence limits

The custom composition keeps native form/button/details/progress/list semantics and the established accessible overlay primitives. Field help/errors are associated by unique IDs, mandatory capture input has an accessible required state, and labels remain visible after entry. Primary controls retain generous targets, theme-token focus outlines, wrapping and layouts that respond to available container space; correction and capture include forced-color border treatment. Accessibility does not depend on enabling a setting.

No decorative capture animation delays persistence, navigation or feedback. These changes do not claim to finish the wider motion audit or shared chart accessibility work. Browser viewport/text-size/reduced-motion cases, before/after images and controlled persistence tests belong to checkpoint32's evidence. In-memory API/device fixtures can establish frontend ownership and retry behavior, but cannot certify actual IndexedDB/SQLite durability, native picker permissions, offline synchronization or backend idempotency.

Physical iOS/Android/tablet keyboard and safe-area behavior, native system Back/edge gestures, VoiceOver/TalkBack, switch access and broader legal conformance still require their own acceptance evidence. Keep those results distinct from browser automation and source inspection.
