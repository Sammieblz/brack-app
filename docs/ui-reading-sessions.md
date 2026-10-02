# Reading session presentation and lifecycle

This is the implemented frontend contract for F11c. The coordinated delivery record is [checkpoint33](frontend-renewal/33-timer-and-book-editing.md), with browser/visual evidence recorded in the [F11c evidence folder](frontend-renewal/evidence/f11c/README.md). Source inspection, controlled browser behavior, local repository tests and physical device behavior are separate evidence categories. This document does not certify native execution or assistive-technology conformance.

Preserve the existing themes, fonts, Iconoir icons, reading domain rules and local repository/device boundaries. The work reconstructs the session presentation and repairs ownership/completion orchestration; it does not replace timer arithmetic, add a new backend endpoint or install Ionic routing/modal infrastructure. See the [Ionic integration decision](ui-ionic-fit.md), [adaptive shell](ui-adaptive-shell.md), [adaptive overlays](ui-adaptive-overlays.md), [app Back](ui-back-navigation.md) and [reading capture](ui-reading-capture.md) contracts.

## Actual owners and entry coverage

| Source | Responsibility and entry |
| --- | --- |
| `apps/client/src/contexts/TimerContext.tsx` | One application-owned timer state and completion/recovery owner, mounted by `App.tsx` above route content. Owns start/replacement permission flow, pause/resume, finish, discard, auth invalidation, scoped restoration and native callbacks. |
| `apps/client/src/components/ShellUtilities.tsx` | Keeps one utility portal host through route-shell changes, and mounts the application-owned `ReadingSessionTasksProvider`. The visible slot changes geometry without creating another timer. |
| `apps/client/src/components/FloatingTimerWidget.tsx` | Historical export name for the measured shell session strip and its adaptive details/finish task. It is not a draggable floating timer. |
| `apps/client/src/components/reading-session/ReadingSessionTasks.tsx` | Shared, reader-owned start picker with custom book rows. Owns the open task across responsive header changes, obtains reading books through `useBooks`, and renders loading, refresh failure, empty and starting states. |
| `apps/client/src/components/HeaderTimerWidget.tsx` | Conditional `NativeHeader` timer action; opens the shared picker. The active session uses the utility strip instead of another header timer controller. |
| `apps/client/src/components/FloatingActionButton.tsx` | Compact/inline Quick actions “Start Reading Timer” invokes the same picker. It does not own another book chooser or start outcome. |
| `apps/client/src/screens/BookDetail.tsx` | Early Start/Pause/Resume reading action. Same-book state uses the existing session; a different book invokes provider replacement confirmation. Saving/starting/frozen states have explicit labels and explanations. |
| `apps/client/src/screens/Dashboard.tsx` | Daily Focus timer action and streak “Read” action both delegate to the provider. Pending/frozen actions explain why another session cannot start. Neither announces success before the provider starts. |
| `apps/client/src/screens/Achievements.tsx` | Journey quest timer selection delegates to the provider; the progress alternative retains its progress route. Timer pending/frozen feedback is separate from non-timer quest actions. |
| `apps/client/src/components/reading-session/TimerRecoveryDialog.tsx` | Custom minutes review for a recovered overlong session, with strict validation, save/retry and explicit discard confirmation. |
| `apps/client/src/components/JournalPromptHandler.tsx` | Queues same-reader journal prompts after successful local completion. New events cannot replace an existing journal draft. |

`TimerModal` and `MiniTimer` are stale names in older planning material, not live components. `toggleMinimized` and `hideWidget` remain compatibility methods without current production callers; hiding no longer deletes the persisted session. Do not build a new timer owner from those historical names.

## Session interaction

The strip identifies the book, textual reading/paused/saving state, elapsed time and Details/Review action. Elapsed text has an accessible name and is not a per-second live announcement. Details expose Pause/Resume, Finish and explicit cancellation. No decorative motion delays a control, a confirmed save or navigation.

Finish first pauses the current session and shows the measured time, rounded minutes and the fact that saved page position is unchanged. Back to session retains that paused time. The explicit Save session action submits the timed session; notes or page logging are not mandatory detours. A zero-time session cannot save. Progress capture remains the separate [reading capture](ui-reading-capture.md) task, with its own page/activity semantics.

The provider is authoritative for pending state and completion outcome. `finishTimer` retains `Promise<void>` compatibility and reports errors through `saveError`; a resolved promise alone is not proof of success. A successful provider clears the active session. The widget retains a failed or uncertain session and exposes Retry. Shared `isSaving`, `isStarting`, `saveFrozen` and `storageWarning` communicate provider state across every control owner.

Start checks that the current reader has a nondeleted local book after resolving any book alias. Repeated starts during confirmation/permission work are serialized. Starting the same active book keeps it; starting the same paused book resumes it. Starting a different book requires a destructive replacement choice. Notification permission is requested only through an intentional start, not on provider mount. Denied notification permission does not prevent the reading timer from starting.

## Ownership and storage

Active state is stored under `readingTimer:<userId>` and recovery under `readingTimerRecovery:<userId>`. Each envelope includes its reader identity; a submitted completion also carries its frozen completion payload. These keys describe frontend recovery storage, not encrypted storage or a new authorization boundary.

Legacy `readingTimer` and `readingTimerRecovery` values migrate only after book identity resolution and verification that the local, nondeleted book belongs to the current reader. A legacy record with another explicit owner or an unowned book is not adopted. The legacy key is removed only after the scoped write succeeds. A legacy timer without a client session ID receives one during validated restore, before the user starts a finish task.

Account changes and unresolved authentication immediately mask the former reader's presentation and invalidate pending async operations. The departing reader's active timer is paused and persisted under their own key. A replacement account does not acquire or delete it; switching back restores that reader's paused state. Recovery and completion drafts follow the same ownership boundary. The provider checks operation generation, current owner and submitted session around asynchronous boundaries. Deferred replacement/cancel decisions also verify their originating route and session before acting.

Auth invalidation does not cancel a repository/native operation already issued. It prevents a later stage or presentation event from being issued by an obsolete task. An in-flight old-reader commit may still finish locally, and the retained completion identity permits later readback for that reader.

Storage access is guarded. Failure leaves the in-memory timer available and explains that it may not restore after closing the app. An unreadable scoped record is retained instead of silently replaced by legacy data. Local-storage recovery depends on those writes succeeding; do not claim guaranteed process-crash recovery or cross-window serialization.

## Unchanged elapsed-time rules

`apps/client/src/services/timerSession.ts` remains the arithmetic source. Running elapsed time comes from accumulated seconds plus the timestamp delta; paused time does not keep increasing. State refreshes on interval, visibility changes and native app-state callbacks, and writes periodically and on lifecycle/action boundaries. Browser or OS suspension does not require counting every interval tick correctly.

Normal completion keeps the existing rounding/clamping rule: a nonzero session becomes a whole number of minutes between 1 and 720. A timer beyond the existing 12-hour safety limit moves to review. Recovery derives an end time from its original start and reviewed duration. F11c does not redefine pause accounting, activity dates, completion timestamps or the safety threshold.

Timestamp restoration is not proof that a native process runs indefinitely in the background. System suspension, device clock changes and notification delivery still need their own device acceptance evidence.

## Completion and retry

`apps/client/src/lib/sessionCapture.ts` freezes reader/book identity, original start/end timestamps, duration, client session ID and journal-prompt intent. The first save pauses the session and persists that attempt before calling repository writes. A retry cannot silently count time spent reading the failure message or create a different duration under the old identity.

The helper retains the existing two-stage repository contract:

1. Resolve the book alias and validate the owned, nondeleted local book. Verify any existing session with the submitted local ID or stable `client_session_id`; otherwise call `sessionsRepo.createPending`.
2. Read the latest local book. Apply only the existing to-read-to-reading and missing-start-date rules, retaining its current page and other fields. Queue `booksRepo.upsertLocal` only if those reading fields still need changing.

Each repository atomically writes its own row and outbox entry. The session and book stages are not one atomic transaction. A saved session followed by a failed book update is reported as that partial result. Retry verifies the original session and completes the outstanding book update; it does not intentionally queue another session create.

Library recency uses the stored book `updated_at`. Completion advances it to the frozen session `created_at` when necessary, preserving a newer book timestamp. Recovery uses the time the reader submits the reviewed session, not its historical end time. Readback can recognize the same applied recency after a lost response; book events carry the actual persisted/latest record, never an unpersisted new timestamp.

An ambiguous create response is read back before treating it as failure. Confirmed absence permits the same submitted identity to be retried; uncertain readback preserves the frozen attempt. Sync may replace a local session row ID with a canonical server ID, so readback also searches owned wrapper records by `client_session_id`. Equivalent timestamp formats are compared as instants. Identity or payload conflicts stop the save instead of accepting an unrelated record.

`sessionsRepo.get` returns stored data even for a tombstone, while the default repository list excludes deleted wrappers. Completion therefore reads `listRecords(userId, { includeDeleted: true })` and rejects deleted status, wrapper deletion time or data deletion time, including canonical-ID records and remembered partial saves. It explains that retry will not restore deleted activity. This is a retry safeguard; F11c does not add a session-deletion UI or change repository deletion rules.

The serialized completion is not trusted as proof of a committed stage. After reload/account return, the helper verifies actual local records again. A book write whose response was lost is not repeated when its current reading fields already satisfy the submitted session. Reader/session checks prevent obsolete work from continuing to a later stage.

These protections do not provide an atomic transaction across local storage, session/book repositories, sync acknowledgements or concurrent application windows. Already-issued operations cannot be revoked. Clearing local storage or explicitly closing an incomplete save can remove its recovery context while a committed row remains. A missing/deleted book or conflicting existing session can require closing the timer instead of completing its book update. Do not label this entire workflow exactly-once persistence or assume a remote acknowledgement from local success.

## Feedback and journal handoff

After both required local stages succeed, the provider clears the active/recovered task and reports “saved on this device.” It requests existing sync work when connected. An offline session remains a local repository/outbox result; an online attempt is not automatically confirmed remotely. Existing `readingSessionSaved` events carry reader/book/session identity, activity date, duration and pending-sync semantics. Existing streak/reward consumers remain responsible for their own confirmed data.

Journal is offered after local saving for the existing eligible duration, and notification-initiated finishing continues to suppress that prompt. `showJournalPrompt` now carries `userId`. `JournalPromptHandler` accepts only the current resolved reader, clears context during auth loading/account changes and queues subsequent prompts behind an open draft. Skipping or dismissing journal does not undo saved reading time. A saved session is not retried because a later presentation, refresh or sync request fails.

## Recovery, focus and dismissal

Recovery has a native text field with a numeric keyboard hint and a visible “Minutes actually read” label. Blank, fractional, negative, nonnumeric and out-of-range values are rejected; the task does not silently clamp an invalid typed draft into a different value. Help and errors are associated with the field, and validation focuses it. The valid range remains 1–720 whole minutes.

During a write, controls cannot dismiss, change minutes or submit again. A frozen interrupted completion disables minute editing and offers Retry for that payload. Initial focus selects the editable minutes field, otherwise an enabled save/retry action, otherwise the focusable title. This avoids trying to focus a disabled restored input.

Recovery close/Escape/outside-pointer/app Back requests lead to a keep/discard choice when idle; they do not silently discard recorded time. An incomplete completion uses wording that already-saved activity will not be deleted by closing the timer. The session details task similarly guards pending dismissal and keeps paused/frozen time when closed. These policies reuse the existing adaptive surface and registered Back layer rather than another body lock, router or global gesture handler. Arbitrary browser history, reload and process termination remain browser/OS boundaries.

The application-owned picker retains its task through responsive header changes. The real trigger or an available session/page control receives focus when a task closes. Finishing removes the old active-session invoker, so the subsequent journal task must return to a connected visible page/control rather than the removed timer button. Native system gestures, IME behavior and assistive-technology focus still require physical-device verification.

## Native notification boundary

`apps/client/src/services/timerNative.ts` is the sole Capacitor adapter for this feature. It retains web no-ops, intentional permission requests and app-state subscription. Its API use was checked against installed Capacitor 7 declarations and the [official Capacitor 7 local-notifications documentation](https://capacitorjs.com/docs/v7/apis/local-notifications).

The adapter registers an explicit “Finish reading” action. An ordinary notification tap does not finish a session. The callback must be the timer's notification ID and explicit stop action, with reader/client-session identity; the provider accepts it only when that identity matches the currently owned timer. A stale notification cannot finish a replacement session.

Notification updates are serialized with a revision guard. A pause/clear arriving during permission lookup prevents a stale schedule; a clear arriving after scheduling begins runs after that schedule. Clearing removes both the pending timer notification and its delivered notice while retaining unrelated notifications. Listener setup/removal failures are handled, and late listener registration is removed after cleanup. These are adapter/source and controlled-test contracts, not proof of Android/iOS notification behavior or background execution.

## Verification and future changes

Focused regressions live in `TimerContext.test.tsx`, `sessionCapture.test.ts`, `timerNative.test.ts`, `JournalPromptHandler.test.tsx` and the unchanged arithmetic tests in `timerSession.test.ts`. Component/browser tests must also exercise the real shell strip, picker, Book Detail, Dashboard/Journey entries, recovery and post-save journal task; testing a hook in isolation cannot close the live entry requirements.

Use [checkpoint33](frontend-renewal/33-timer-and-book-editing.md) and its [evidence record](frontend-renewal/evidence/f11c/README.md) for actual executed commands, screenshots, failures/retries and environment limits. Physical iOS/Android/tablet lifecycle, notification permissions/actions, system Back, VoiceOver/TalkBack, switch access, large text/keyboard and offline synchronization remain independent acceptance work. Do not turn a fixture pass into a native-device, backend-idempotency, legal-conformance or performance claim.
