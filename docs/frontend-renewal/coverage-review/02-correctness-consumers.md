# F01–F04 consumer coverage review

Reviewed 2026-09-28 against committed application source at `db076cf` (F09). This is a source and coverage audit, not a new implementation or a new test run. No application files were changed. Existing test results below are historical evidence recorded in checkpoints 13–15, not rerun results.

The early tickets repaired several real defects, but their completion records are too easy to read as completion of an application-wide foundation. F03 missed live writing surfaces while changing and testing an unreferenced counterpart. F04 repaired a long-press primitive whose only application-file consumer is itself unreferenced by the live app. Similar navigation, save-outcome and feedback defects remain in reachable surfaces. Later screen-family tickets were already intended to redesign those screens; that does not make these coverage omissions disappear.

## Continuation status

CR01 is now committed in `93b63bc`. [CR02/checkpoint22](../22-responsive-composers.md) owns the RC-08 post/club creation subset: stable actual Feed/BookClubs/Readers tasks, upload/write pending locks, retained rejection drafts, explicit discard, account/unmount invalidation and separate confirmed-write/read-refresh outcomes. Consult22 for completed checks and evidence limits. ReviewForm, BookClubDetail discussion/announcement and DiscussionThread reply ownership remain open; this does not close all RC-08 or F14 work. The baseline rows below are historical findings, not current claims that these two creation components are unchanged.

This report records the `db076cf` source baseline. [CR01/checkpoint21](../21-live-composers.md) preserves committed live CommentThread/MessageThread/ClubChatThread writing and media repairs, including real local-tab owners, stale completion guards and retry semantics. Its exact browser/unit limits supersede RC-01/02's original missing-implementation status for that bounded scope. Responsive Messages replacement/gestures and other RC findings remain assigned to their later corrective batches; do not repeat CR01 or infer whole-screen acceptance from it.

## Evidence and method

- Read the frontend delivery and UX skills, F01–F04 in [09](../09-execution-plan.md), findings and route table in [02](../02-screen-audit.md), relevant S03/S04/S10/S14–S18 requirements in [05](../05-screen-specifications.md), checkpoints [13](../13-implementation-tracker.md), [14](../14-next-implementation-batch.md), [15](../15-feedback-environment-batch.md), and the living journal/form/navigation/feedback contracts.
- Queried existing Graphify for `JournalEntryForm RichTextEditor NotificationCenter NavigationItem actionFeedback SaveBar` (the matching `RichTextEditor` node exposed the six actual rich-text consumers), then separately queried `CommentThread` and `hapticToast`. These bounded queries were truncated; conclusions do not depend on absent edges.
- Read generated Obsidian notes `RichTextEditor.tsx.md`, `useJournalEditor.ts.md`, `UserNotificationsPopover.tsx.md`, `CommentThread.tsx.md`, and `BookListManager.tsx.md`, then verified maintained source and incoming production imports.
- Used `rg` consumer searches and a read-only TypeScript AST walk of screen/component input JSX. Candidate unnamed fields were checked against visible labels, wrappers, FormControl and incoming imports. A missing literal `aria-label` alone is not a defect.
- Read existing fixture entrypoints/specs and focused form/submission tests. A component in a fixture is not proof that the production router reaches it. Import absence is qualified below as “no production importer found,” not proof that arbitrary runtime loading is impossible.

All source paths below are relative to `apps/client/src`; line numbers describe `db076cf` and will move after repairs. **SV** means source-verified behavior/structure; **VG** means verification gap; **LATER** means already assigned to a later screen-family ticket; **UNWIRED** means no incoming production importer found in the renderer search. None of these labels means a device or screen-reader test passed.

## What the early tickets actually cover

| Ticket | Source-backed implemented coverage | Boundary that must remain explicit |
| --- | --- | --- |
| F01 | `JournalEntryDialog`, `QuickJournalEntryDialog`, `useJournalEditor`, `useJournalEntries`, attachment preservation and local write/hydration support. Full editor is mounted through BookDetail → JournalEntriesList; quick editor through app-owned JournalPromptHandler. Both consume success-bearing local saves. | No second journal create/update editor was found. This review did not demonstrate a missed journal editor or undo those repairs. It does not establish safe pending/draft/write outcomes in lists, progress, posts, reviews, messages, clubs or profile forms. Dirty journal sessions are in memory, not durable across process loss; documented device/AT limits remain. |
| F02 | Canonical `/clubs/:clubId` profile links, semantic UserProfile book/club cards, semantic ReadingHistory rows, contextual NotFound recovery; later F07 owns stronger app Back ancestry. | Those named paths are a bounded repair. They do not make live Readers, ReviewCard, PostCard, BookClubCard or every route destination semantic. Navigation placeholders in a fixture do not test destination screen composition. |
| F03 | All six actual RichTextEditor consumers are named; descriptions/ref/validation are forwarded by the primitive. Notification query/read states, profile/club/review/journal fields and several adjacent searches/inputs were repaired. | Live post comment/reply and direct-message textareas were missed. One repaired/tested `ReviewComments` component has no production importer. Real VoiceOver/TalkBack acceptance was explicitly unverified and remains unverified. |
| F04 | AddBook no longer waits 1.5 seconds after confirmed creation; selection feedback has a correct plugin lifecycle; ContextMenuNative/useLongPress recognize/cancel a contact with one hold-feedback owner. | Generic hook correctness does not deduplicate callers. Live duplicated feedback and a second direct-vibration path remain. ContextMenuNative → BookCard is an unwired branch; the actual Library uses LibraryBookCard/SwipeableBookCard. F04 tests do not establish delivered Library long press. |

## Consumer matrix: writing, field semantics and save outcomes

| Reachable surface / component | Current evidence | Gap or disposition |
| --- | --- | --- |
| `/book/:id` journal: `JournalEntriesList:51`, `JournalEntryDialog:23`, `useJournalEditor:231–292` | Explicit result awaited; synchronous saving state; dirty/pending dismissal rules; rich-text and field names. | Existing F01 fixture is relevant. Full BookDetail composition/device keyboard still separate acceptance. |
| Timer completion → `JournalPromptHandler:43` → `QuickJournalEntryDialog:25–26` | Same journal lifecycle; queued prompt ownership. | Existing quick-journal coverage is relevant; physical background/resume remains separate. |
| `/history` journal/progress destinations | Real `Link` rows, query-backed tab selection in ReadingHistory. | This is navigation coverage, not a third editor. |
| MobileHeader/NativeHeader → `UserNotificationsPopover` → `useUserNotifications` | Existing initial pending/error/empty, retained-refresh, read pending/failure/retry and route-independent read ownership are implemented. Both shared headers use the same component. | F03 fixture is relevant to this notification list, not to push permission/settings, full social messaging or every notification destination. Native/browser presentation and real AT remain separate acceptance. |
| `/reviews`, `/book/:id` → `social/ReviewForm:66–99,175` | Named rating/title/content, RHF descriptions/ref/blur, rejected result keeps draft. | Fields remain editable and dismissal remains available while submit is pending. Existing F03 semantics tests do not establish complete F14 draft lifecycle. See RC-08. |
| `/feed` → `social/CreatePostDialog:119–175,294` | Named content, field-specific validation, media/submit error associations; actual hook failure catches retain values. | Pending field/edit/dismiss ownership still differs from journal; post media upload/publish and resize/device states need actual consumer coverage. RC-08. |
| `/clubs/:clubId` discussion/announcement composer: `BookClubDetail:602–685` | Named Message editor and associated submit error; title and attachment label present. | Pending edit/reset/dismiss behavior not covered by the F03 review-browser scenario. RC-08; F14 owns full composer. |
| `/clubs/:clubId` nested replies: `clubs/DiscussionThread:68–86,190–222` | Reply editor named and rejected request exposes associated error without clearing text. | Reply fields/Cancel remain usable during pending request; verify retained/new draft ownership rather than infer from journal. RC-08. |
| `/feed`, `/posts/:postId`, `/users/:userId` posts → `PostCard:251` → `social/CommentThread:45,203` | Live top-level/nested textareas have only placeholders; generic Textarea adds no name. | **Missed F03 counterpart**, RC-01. No composer pending guard, error association or input lock; full save-lifecycle repair belongs with F14 and must precede claiming post writing is complete. |
| `/reviews/:reviewId` inline comment composer: `ReviewDetail:425–445` | Actual route composer named and error-associated; `ReaderSubmissionLoading.test.tsx` imports this screen. | This live repair counts. It must not be conflated with unreferenced ReviewComments. Broader pending re-edit behavior still requires F14. |
| `social/ReviewComments:29–95` | F03 named/error-associated component and focused test exist. | **UNWIRED**: no incoming production importer found. Keep its tests classified as component evidence; do not credit it as coverage of live post comments. |
| `/clubs/:clubId` chat: `clubs/ClubChatThread:687–710` | Main textarea has “Message the club,” help/error descriptions; actual consumer failure/loading tests exist. | Media/dialog and pending re-edit lifecycles remain separate requirements, not certified by a named textarea. |
| `/messages` → `messaging/MessageThread:710–730` | Main textarea has placeholder only; GIF search at758 is named. | **Missed F03 counterpart**, RC-02. The F03 inventory included this file but only naming GIF search did not complete the composer. |
| `/profile` and `/settings?section=profile` → `Profile`, `settings/ProfileSettings` | Name and Bio have IDs/visible labels/help; save errors describe Save. Both are in focused F03 tests. | Duplicated profile presentation remains F16. Image picking/upload and whole-form pending/draft tests are separate. |
| `/clubs` creation → `clubs/CreateClubDialog` | Name/description/location fields and privacy instructions are associated; create rejection tested in F03. | Significant form remains dismissible/editable while loading; full lifecycle/visual work remains F14/RC-08. |
| Club discovery join note; club detail join/invite/admin fields | `BookClubCard:199` note named; `BookClubDetail:507,774,996,1076,1167` names note, roles, invite search and options. | This audit found those names present; no claim that every admin state, control or keyboard flow is verified. |
| `/book-lists` → `BookListManager`; `/my-books` and `/book/:id` → `AddToListDialog` | Fields named; mutation hook swallows update/delete/membership failure while consumers announce success. | Concrete unclosed correctness debt RC-06, already F10 scope; prevent this from being hidden behind visual simplification. |
| `/dashboard` and `/book/:id` → `ProgressLogger` | Visible labels exist. Local log is created before separate book update. | Postcommit failure handling can present a retryable total failure after the log already exists; source-derived RC-07 fault case. F11 owns repair. |
| `/book/:id` → `QuickProgressWidget` | Current Page label and explicitly worded correction operation; caught service error keeps input. | Do not count as journal entry or reading-session completion; no contrary failure was established here. F11 owns whole control. |
| `/add-book`, `/edit-book`, `/scan-cover` acquisition fields | F04 verified immediate AddBook completion; named Input/MobileInput/MobileTextarea consumers; ScanCover title/author labels present. | Scanner haptic duplication RC-04; whole acquisition draft/permission recovery remains F12. |
| `/auth`, `/auth/reset-password`, `/support`, `/settings` account/personal/support fields | Names/IDs present on inspected native inputs; SupportContact descriptions present. | These were included in consumer discovery, not claimed newly repaired or AT-verified. Full S02/S03/S17 behavior remains later tickets. |
| `/onboarding`, `OnboardingReadingPractice` | Named motivation/numeric fields, labels/validation descriptions; practice is a distinct sample rather than journal mutation. | Completion waits for a decorative 520ms seal outside reduced-motion mode: RC-09. Existing onboarding's own history/tests remain relevant; F01 does not own it. |
| `/settings` reading profile → `settings/ReadingProfileSettings` → `ReadingHabitsSection` | Inspected fields have visible labels/IDs; loading/error ownership remains feature-specific. | This is a reachable settings editor, not the onboarding practice component. It still needs its own form/save/device acceptance under F16. |
| `MobileInput`, `MobileTextarea` wrappers used by Add/Edit | IDs/ARIA can be forwarded and labels use caller IDs. | Caller naming is necessary; wrappers do not automatically establish help/error association. A wrapper's presence is not a field-family audit. |

The AST candidate scan also returned hidden file inputs, wrapper internals and ReviewForm's FormControl-wrapped Input. Those are not automatically unnamed live controls: file inputs are hidden or inside labels; FormControl injects attributes; wrappers forward caller props. Only verified unmatched live controls are elevated below.

## Findings and bounded repairs

### RC-01 — Live post comments and replies missed the editor-semantic audit

**SV, F03 consumer omission; P1.** `social/CommentThread.tsx:45–56` and `203–213` expose comment/reply textareas without a visible associated label, explicit name or error description. `ui/textarea.tsx:7–19` only forwards attributes. `PostCard.tsx:251` mounts this component; Feed, PostDetail and UserProfile mount PostCard. A placeholder may be exposed as fallback text by some accessibility stacks; that does not satisfy the project's persistent naming/description contract.

`usePostComments.ts:79–91` catches create failure, emits a toast and returns false. The component preserves its original text on false but provides no persistent composer-specific error. Submit and reply have no pending state, and the fields remain editable during the awaited operation. The load error region describes comment-list fetches, not failed posting. F03 updated/tested `ReviewComments`, which is not mounted in these routes.

**Repair:** Give top-level/nested composers unique names, associated persistent error text, and a single submission owner. Preserve text/media/reply context on rejection. Decide and test whether editing is locked while pending or a newer draft is retained; do not clear newer input when an older submission succeeds. Keep comment fetch failures independent from posting outcomes. Do not add a synthetic generic label in Textarea.

**Acceptance:** Mount actual PostCard/CommentThread on a real reachable fixture route; submit a comment and nested reply with delayed failure/retry, double activation and continued typing; assert one write, correct field name/error association, retained draft and one truthful success. Test compact/tablet layout and keyboard. Real AT remains a separately recorded device check.

### RC-02 — Direct messages were named only at the GIF search, not at their main composer

**SV, F03 shared-consumer omission; P1.** `messaging/MessageThread.tsx:710` uses a changing placeholder (“Message”/“Messaging is unavailable”) without an explicit name or persistent help; compare the repaired `clubs/ClubChatThread.tsx:687` main composer. MessageThread's GIF search at758 has an explicit label. The living F03 inventory lists MessageThread as affected, which is insufficient coverage evidence.

`handleSend:218–247` has a sending guard and clears the composer only on successful boolean outcome, but keeps the textarea editable. It has no local catch around upload failure; validation feedback is toast-only. These are separate source-backed follow-ups, not an assertion that every message rejection loses a draft.

**Repair:** Name and describe the actual main composer, associate validation/service/upload error feedback, preserve focus/text/files on rejection, and define pending/newer draft ownership. Reuse existing message service and draft contracts. Do not alter conversation routing as part of this small semantics repair; F15 owns that larger task.

**Acceptance:** Test the actual main composer for keyboard submit/Shift+Enter, validation, delayed send rejection, media-upload rejection, newer text during pending, retry and disabled/offline state. Assert no unhandled upload rejection and no falsely cleared draft.

### RC-03 — Live social discovery/destination counterparts still lack link semantics

**Continuation:** [CR06a/checkpoint26](../26-social-destinations.md) implements this named destination contract across all actual Readers/PostCard/ReviewCard/BookClubCard callers and ReviewDetail, plus adjacent Reviews catalog links. 67 distinct browser cases pass with two independently reproduced Windows WebKit limitations;32 regressions and types/lint/build pass. Source/actual-screen/visual evidence and remaining F14/action/AT/native debt are separated in26. The paragraphs below describe the historical `db076cf` defect baseline, not the current implementation. Remaining CR06 recovery/utility/focus consumers stay open.

**SV; F02 cross-cutting coverage debt, with F14 screen owners; P1.** F02's named UserProfile/ReadingHistory cards are repaired. In live `/readers`, `Readers.tsx:331` renders its internal ReaderCard as a noninteractive Card div with `onClick={onOpen}`; `onOpen` at253 navigates to `/users/:id`. There is no link, role, tab stop or keyboard activation on the card. Its FollowButton is a separate nested control at359; converting the entire card to an anchor around that button would introduce another problem.

Other reachable destination controls use imperative buttons: `social/ReviewCard:143–145,203–206,249,295`, `social/PostCard:308–310,340–342`, and `clubs/BookClubCard:69–71,85–87,120–122,235`. ReviewCard/ReviewDetail also attach navigation directly to Avatar. Buttons are keyboard-activatable, unlike the Readers div, but do not provide browser link modifier/open-in-new-tab behavior. The route URLs themselves are canonical in the inspected examples; this is not another invented broken-path claim.

**Repair:** Use named Router links for a distinct primary destination region/title, keep Follow/reaction/More/join actions siblings, and preserve private-club preview restrictions. Do not blanket-wrap a card containing controls in a link.

**Acceptance:** Actual Readers, PostCard, ReviewCard and BookClubCard fixture paths expose valid hrefs; Tab/Enter and Ctrl/Cmd/middle-click work; nested actions do not navigate; disabled/private/social gates still apply. Use real destination components for at least one representative route, rather than counting a receipt placeholder as screen coverage.

### RC-04 — Correct haptic primitive, multiple live owners and a bypass

**SV, F04 acceptance breadth gap; P1.** `ui/button.tsx:49–59` issues a haptic before its supplied click handler unless `disableHaptic` is set. These live consumers supply another immediate haptic without disabling the button's:

| Source | Live entry | Duplicate source path |
| --- | --- | --- |
| `ThemeToggle:19–28` | Index, Auth, ResetPassword, SupportCenter, F09 ProfileDrawer | Ghost Button selection + `toggle` selection for the same activation. |
| `BarcodeScannerFlow:99–100,124–130,434,449` | ScanBarcode | Start Scan/manual-entry Button + handler light. Scanner result haptics are another event and must be evaluated separately. |
| `ScanCover:33–44,62–69,199–269` | ScanCover | Start/cancel/search/manual Button actions + explicit handler light. |
| `messaging/MessageThread:218–228,725–727` | Messages | Send Button feedback + immediate handler light; confirmed send success is a distinct later outcome, not automatically a duplicate. |
| `Settings:309–319` | Settings | Sign Out trigger Button feedback + handler medium, before the confirmation surface opens. |

`utils/hapticToast.ts:4–8` additionally calls `navigator.vibrate` directly. It is **live**, imported by `messaging/ConversationsList.tsx:14` for hide/read/mute outcomes at239–270. Its toast then reaches `ui/toaster.tsx:21–34`, which separately invokes the canonical hook. This second boundary bypasses hook capability/enable policy and can issue two outcome signals. This is not an allegation that vibration is available on every device.

`Toaster` reacts to the whole toast array rather than tracking feedback by toast identity. Updating/removing other toasts can re-evaluate the latest visible toast. That is a source-derived repetition risk requiring a focused sequence test before claiming a reproduced device defect.

**Repair:** Inventory initiation, confirmation and result feedback separately; choose one owner for each event. Use `disableHaptic` only where an explicit owner remains. Route live toast feedback through one boundary and deduplicate result events by identity. Preserve separate meaningful confirmed success/error events and hook opt-out. Persisted global haptics settings remain F16; absence of that setting was already disclosed and is not silently added here.

**Acceptance:** Instrument plugin calls for the actual ThemeToggle, scanner buttons, MessageThread and conversation mutation/toast flow. One activation yields one intended initiation event; one confirmed outcome yields one outcome event; rejected outcome never produces success. Hook opt-out and unavailable-plugin/web capability paths remain no-ops. Physical feel must be reviewed on hardware separately.

### RC-05 — F04's long-press evidence does not reach the live Library

**SV/UNWIRED, delivery-reporting gap; P1.** The only production-file importer of ContextMenuNative is `components/BookCard.tsx:8,99`. No incoming production importer of BookCard was found. `MyBooks.tsx:18,1065,1082` uses `LibraryBookCard` with `SwipeableBookCard`. The latter is live and received F07 swipe arbitration, but it does not consume the repaired long-press hook.

**Repair disposition:** Preserve the valid ContextMenuNative unit/fixture evidence as primitive evidence. Correct claims that it demonstrates delivered Library long press. F10 must explicitly decide whether actual Library cards adopt that context action, with visible More and selection alternatives and gesture conflict tests; do not blindly wire a second gesture recognizer solely to increase a coverage count.

**Acceptance:** The coverage ledger records actual route → actual card → actual gesture hook. Any implemented hold is tested on LibraryBookCard's production composition with nested action controls, normal scroll, text selection, cancelled contact, swipe, keyboard alternative and exactly one feedback owner.

### RC-06 — Lists repeat the swallowed-failure success pattern fixed for journals

**SV, existing F10 correctness debt; P0 candidate for triage before visual list work.** `hooks/useBookLists.ts:127–162` catches update/delete/add/remove failures and resolves without returning a failure-bearing result. `BookListManager.tsx:188–215` awaits those methods, emits successful update/delete feedback and closes/reset form state anyway. `AddToListDialog.tsx:45–67` awaits membership methods, changes checked membership and announces success anyway. The outer catch cannot handle an error swallowed by the hook.

Live chains are `/book-lists` → BookListManager; `/my-books` → LibraryBookCard → `library/LibraryBookActions.tsx:90` → AddToListDialog; and `/book/:id` → `BookDetail.tsx:701` → AddToListDialog. BookCard is not needed to establish reachability. The dialog also catches membership-load failure only in the console at31–34 and leaves an empty initial or retained earlier selection set, so it must distinguish unknown membership from confirmed empty state.

**Repair:** Make mutation outcomes explicit using existing service semantics; separate a committed change from subsequent refresh failure. Keep edit drafts/selection on failed mutation, show retry, prevent duplicates, and avoid confirming membership from unknown initial state. Do not reuse the journal's local/offline success wording for remote list operations without verifying their actual contract.

**Acceptance:** Fault-inject update/delete/add/remove and initial membership fetch separately. No failed write yields success feedback, closed/reset edit draft or invented membership. Successful write plus refresh failure must not invite duplicate creation/replay. These cases are required F10 acceptance, not deferred polish.

### RC-07 — Progress logging has a distinct postcommit retry hazard

**SV source-derived failure path, not runtime-reproduced; F11 correctness gate.** `ProgressLogger.tsx:109–121` writes a new pending log with `createLocalId()`. It then awaits `booksRepo.get:124` and `booksRepo.upsertLocal:145` inside the same try. Rejection after the log write reaches the generic “Failed to log progress” feedback at171–178, retaining a form whose next submit creates a new ID. This is the journal's general postcommit distinction in a different live writer, not evidence that F01's journal repair failed.

**Repair:** First reproduce a failure after the log commit in the actual component. Define committed log identity and status/book follow-up recovery so retry cannot create a second reading event. Preserve reading-core/activity/outbox contracts; do not change streak rules to simplify UI state.

**Acceptance:** Inject failure before log commit, after log commit/before book read, and at book update. Retry each case and inspect local log/outbox identity; one intended reading event survives. Saved-local state is announced accurately and book projection retry is distinct. Full capture/device work stays with F11.

### RC-08 — Named editors do not yet share journal-quality pending ownership

**SV implementation difference; LATER F14, with shared foundation follow-up.** ReviewForm (`onSubmit:66–93`, `Dialog:99`, editor175, Cancel243), CreatePostDialog (`handleSubmit:119–169`, Dialog174, editor294), CreateClubDialog (loading85, Dialog123, submit279), DiscussionThread (handleReply68, editor190, Cancel216), and BookClubDetail discussion composer (`602–685`) disable their submit actions but do not freeze all editing/dismissal while the request is pending. Successful completion resets state. Continued writing during an older pending request can therefore be cleared by that success; this is a source-derived interleaving to reproduce, not a claim that a tested user lost data here.

**Repair:** Define per-task ownership for text, media and route/dismiss actions. Either lock edits with truthful pending state or retain newer draft versions; use discard protection where the original S14/S15 significant-writing requirement applies. A shared editor's `disabled` prop only helps if each caller supplies it. Preserve service result semantics and do not claim all drafts persist across process loss.

**Acceptance:** Delayed success and rejection with edit-after-submit, close/reopen, Back/Escape, resize and route change on actual composers. Confirm one write, retained newer draft or intentionally locked fields, no late reset of another task/account, and correct focus/error state. Include media upload independently from final publish. These lifecycle tests supplement, rather than replace, field naming tests.

### RC-09 — Onboarding still makes a confirmed completion wait for decoration

**SV; original FS-S04-4 and cross-cutting F04 intent, later F18 ownership.** `Onboarding.tsx:493–503` and `523–533` defer setting the destination transition for 520ms to show `completionSeal` when reduced motion is false. Reduced motion skips that wait. These are post-success paths for preserved guest setup and saved authenticated profile. The F04 AddBook fix is intact; its narrow fixture does not establish the application's “no animation delays readiness” requirement.

**Repair/acceptance:** Remove decorative control of readiness while preserving account/setup/permission outcomes. Verify both guest and authenticated completion with an observable confirmed save boundary and no need to advance a decorative timer to reach the next task. Keep visual seal/reward display nonblocking and consult the separate motion coverage review before implementation. Do not treat unrelated network timeout/debounce timers as this defect class.

## Remaining verification and reachability accounting

1. **Do not rerun old suites and call this coverage fixed.** The existing frontend-semantics browser suite exercises UserProfile/ReadingHistory/recovery, notifications and ReviewForm. It does not instantiate CommentThread, MessageThread, Readers' actual card, scanner entry actions or list writes. The existing action-feedback suite exercises AddBook and context primitives. Journal fixtures are relevant to both actual journal editors, not all writers.
2. **Keep existing evidence.** F01's local repository/adapter/hydration regressions, F03's six rich-text consumers and real ReviewDetail/ClubChatThread rejection tests are meaningful. Their limits do not make those repairs nonexistent. No broad tests were run in this review; original counts remain in checkpoints 13–15.
3. **Track unwired branches separately.** No production importer found for `BookCard`, `social/UserCard`, `social/ReviewComments`, `NativeSearchBar`, `Navbar`, `MobileDatePicker`, `MobileFloatingInput`, `MobileFloatingTextarea`, `SwipeableBookListsCarousel`, or `useTapFeedback`. Their source/tests can inform future reuse, but cannot prove current user-visible coverage. Do not delete them as part of this audit. The separate full census should be used for exhaustive reachability reconciliation.
4. **Haptic discovery extends beyond tested primitives.** The search also reaches AddToListDialog, BookListManager, AppSidebar, ProfileDrawer, MobileBottomNav, PullToRefresh, SwipeableBookCard, RewardFeedbackContext, StreakCelebrationOverlay, LandingGamificationShowcase, Readers/UserProfile/Messages/Settings, scanner hooks, dialogs/action sheets, checkbox/switch/toggle/Button, Toaster and ConversationsList. Every caller needs an event-owner row before “one haptic per action” can be called application-wide. A successful result following an initiation may legitimately be two different events; do not remove result feedback indiscriminately.
5. **Actual AT/device acceptance remains outstanding.** Labels, keyboard fixtures and mocked plugin calls do not establish VoiceOver/TalkBack conformance, native IME behavior or physical haptic quality. Keep those gates visible rather than promoting browser-verified slices to legal/platform compliance.

## Recommended next implementation boundaries

| Bounded repair | Required consumers | Stop/review evidence |
| --- | --- | --- |
| Complete F03 live composer semantics | CommentThread top-level/reply; MessageThread main composer; their submit/upload error owners | Real component browser fixture on compact/tablet; names/errors, delayed rejection/retry and pending/newer text handling; no route redesign |
| Complete F02 social destination semantics | Internal Readers.ReaderCard, ReviewCard/ReviewDetail profile links, PostCard attachments/profile, BookClubCard | Keyboard/modifier navigation, independent nested actions and private/social gates; actual reachable consumers |
| Complete F04 live feedback ownership | ThemeToggle; scanner buttons; MessageThread; ConversationsList/hapticToast/Toaster; enumerated event-owner sweep | Plugin-call evidence for initiation/result separately, disabled/capability fallback, no ornamental readiness timers; native feel still device gate |
| Prioritize F10 correctness before list composition | useBookLists, BookListManager, AddToListDialog and actual LibraryBookActions | Failure/load/pending truthfulness and committed-write/refresh separation, then visible design review |
| Prioritize F11 capture integrity before visual capture | ProgressLogger in Dashboard and BookDetail | Reproduced pre/postcommit failures and exactly one saved event, then mobile/tablet capture review |
| F14 form-family lifecycle | Review/post/comment/discussion/club create/admin writing owners | Real task pending/dismiss/resize/media coverage; preserve IDs/services and current role restrictions |

The implementation checkpoint for each repair must list every reachable consumer and any intentional exclusion with its owning later ticket. Closing a primitive test suite is insufficient evidence to close this matrix.
