# Frontend screen audit and evidence register

Status: planning and source audit; no application changes. Source review date: 2026-09-27. This document records the checkout inspected for this plan, not the state of a deployed build.

## How to read the evidence

`V` means the cited implementation or route declaration was directly inspected. `H` means a design/performance hypothesis requiring rendered or device validation. `U` means not measured. A source-verified implementation can establish a defect such as an unregistered link destination; it cannot establish measured latency, contrast, actual keyboard overlap, or a reader's subjective response.

The audit is primarily source-based. A separate, limited shell-scroll fixture inspection captured the Library at phone (390×844), tablet (834×1112) and desktop (1440×900) sizes; see the packet's [evidence directory](evidence/). That fixture uses mock data/overlays/sidebar and fallback fonts, and contains no real browser chrome or native runtime. It supports narrow layout observations only: duplicate phone status controls, per-book action rows and a large floating navigation surface; one scroll owner and no horizontal body overflow were measured in those fixtures. Tablet “My Library” versus phone “Library” headings were visible. Mock sidebar contents must not be treated as the actual sidebar.

No authenticated live-data walkthrough, native build, physical tablet, screen reader, user study, frame trace or browser performance recording establishes the broader findings here. Consequently, the plan does not claim those checks passed. Existing test files and documented coverage are evidence of a contract, not evidence of a successful test run today.

Priorities: **P0** prevents loss of entered work or exclusion from a core task; **P1** fixes core reading/navigation and access; **P2** improves secondary flows and consistency; **P3** is optional polish after functional gates. These are proposed implementation priorities, not claims of a production incident.

## Discovery and source authority

1. Read project `AGENTS.md`, the BRACK frontend UX skill, and Graphify query instructions.
2. Confirmed `graphify-out/graph.json` and the existing Obsidian export are available; `graphify-out/wiki/index.md` is absent.
3. Expanded a graph query using actual graph vocabulary: `screen library dashboard book settings social onboarding navigation journal search`. `graphify query` returned a scoped traversal of the 8,073-node graph; its 2,500-token result was explicitly truncated. The graph identified entry points, not exhaustive coverage.
4. Read Obsidian notes for `Dashboard.tsx`, `MyBooks.tsx`, and the documentation screen index, using their `source_file` and connections to navigate. The generated note titled “Screens (27)” is historical documentation, not the current route count.
5. Verified inventory against [`App.tsx`](../../apps/client/src/App.tsx) and inspected screen/component code. The app currently declares **39 route paths**, including aliases, redirects, and the catch-all.
6. Read the existing [must-win screens](../product/must-win-screens.md), [reading-loop audit](../product/reading-loop-friction-audit.md), [Reader Journey rules](../product/reader-journey.md), [service boundaries](../architecture/frontend-service-boundaries.md), [library interaction contract](../ui-library-interactions.md), and [date-picker contract](../ui-date-pickers.md). Older audit recommendations must be checked against current implementation before becoming tickets.

The frontend scope includes JSX, components, styles, layout, UI state, navigation, accessibility, motion, and native presentation adapters. It does not authorize changing reading semantics, service permissions, privacy, reward rules, database schemas, or persistence ownership.

## Complete route coverage

All paths in this table are verified in `App.tsx`. “Spec” references the corresponding section in [05-screen-specifications.md](05-screen-specifications.md). File names are under `apps/client/src/screens/` unless stated otherwise. A route inventory row does not imply all internal behaviors were dynamically tested.

| Paths | Source / behavior | Spec | Audit focus |
| --- | --- | --- | --- |
| `/` | `Index.tsx`; public landing and authenticated entry resolution | S01 | Separate marketing density from native entry; preserve brand assets and auth resolution. |
| `/support` | `SupportCenter.tsx`; public support, FAQs, contact, legal anchors | S02 | Keyboard/reflow, return destination, truthful policy content. |
| `/auth` | `Auth.tsx`; sign-in/sign-up/recovery modes | S03 | Password managers, keyboard, validation, challenge/retry, responsive art. |
| `/auth/callback` | `AuthCallback.tsx` | S03 | Stable processing shell, terminal error, safe retry and return. |
| `/auth/reset-password` | `ResetPassword.tsx` | S03 | Expired/recovery session, password requirements, success routing. |
| `/onboarding` | `Onboarding.tsx` | S04 | Existing resumable chapters, reachable step controls, preferences and date contracts. |
| `/app-permissions` | `PostSignupPermissions.tsx` | S04 | Native-only capability decisions, optional requests, denied/restricted states. |
| `/welcome`, `/questionnaire`, `/goals` | `OnboardingEntryRedirect` compatibility routes | S04 | Preserve entry redirects; `/goals` is not the goals manager. |
| `/dashboard` | `Dashboard.tsx` | S05 | Next reading action, duplicate gamification context, regional loading. |
| `/my-books`, `/books` | `MyBooks.tsx` canonical/alias | S06 | Discovery of books, filters, stable selection, shelf/carousel preservation. |
| `/analytics` | `Analytics.tsx` | S12 | Question-led summaries, chart accessibility, progressive disclosure. |
| `/add-book` | `AddBook.tsx`; search/manual/scan tabs | S07 | Acquisition options, draft retention, repeated-add feedback. |
| `/book/:id` | `BookDetail.tsx` | S08 | Reading action placement, overview/progress/reviews/journal/logs. |
| `/book/:id/progress` | `ProgressTracking.tsx` | S09 | Progress history and insights, visible return to book. |
| `/edit-book/:id` | `EditBook.tsx` | S08 | Group fields, keyboard-aware Save, metadata versus activity distinction. |
| `/scan-barcode`, `/scan` | `ScanBarcode.tsx` canonical/alias; `BarcodeScannerFlow` | S07 | Permission, camera ownership, recognition, duplicate/manual fallback. |
| `/scan-cover` | `ScanCover.tsx` | S07 | OCR uncertainty, progress/cancellation, review before search/add. |
| `/history` | `ReadingHistory.tsx`; logs/journals | S10 | Semantic rows, grouping, searching, source book identity. |
| `/profile` | `Profile.tsx`; own profile editing | S16 | Duplicate editor surfaces, public preview, image state. |
| `/settings` | `Settings.tsx`; `?section=` navigation | S17 | Categories/detail, tablet layout, appearance/accessibility, dangerous actions. |
| `/achievements` | `Achievements.tsx`; feature `gamification`; UI label Reader Journey | S13 | Overview, quests, shop, badges, rankings and authoritative freshness. |
| `/book-lists`, `/lists` | `BookLists.tsx` aliases | S11 | List browsing/creation, compact controls. |
| `/lists/:listId` | `BookListDetail.tsx` | S11 | List identity, order, book controls, remove versus delete distinction. |
| `/goals-management` | `GoalsManagement.tsx` and `GoalManager` | S12 | Plain-language goals, units, date selection, creation state. |
| `/users/:userId` | `UserProfile.tsx`; feature `social`; own-user alias handled inside screen | S16 | Books/posts/clubs, follow/message/block, privacy and correct links. |
| `/reviews` | `Reviews.tsx`; feature `social` | S14 | Scope/rating filters, choosing book, long-form writing. |
| `/reviews/:reviewId` | `ReviewDetail.tsx`; feature `social` | S14 | Readable text, comments, rating and reaction names, deep links. |
| `/feed` | `Feed.tsx`; feature `social`; current heading Activity | S14 | Feed content over dashboard chrome, post/activity tabs. |
| `/posts/:postId` | `PostDetail.tsx`; feature `social` | S14 | Stable detail/replies, permission-aware unavailable state. |
| `/clubs` | `BookClubs.tsx`; feature `social` | S15 | Suggested/joined discovery, club creation. |
| `/clubs/:clubId` | `BookClubDetail.tsx`; feature `social` | S15 | Overview/chat/discussions/announcements/members/admin. |
| `/readers` | `Readers.tsx`; feature `social`; current heading Discover | S15 | Reader and club discovery, nested groups. |
| `/messages` | `Messages.tsx`; feature `social` | S18 | Inbox/thread, keyboard, history, drafts, touch split view. |
| `*` | `NotFound.tsx` | S02 | Friendly recovery, session-aware destination, no full reload requirement. |

### Feature surfaces that are not standalone routes

| Surface | Verified source entry points | Audit boundary |
| --- | --- | --- |
| Global timer/session | `FloatingTimerWidget`, `HeaderTimerWidget`, `TimerContext`, `JournalPromptHandler` | One active-session identity across routes; compact/expanded/finish presentation. |
| Progress entry | `ProgressLogger`, `QuickProgressWidget`, `ProgressLogItem` | Keep activity logging and metadata correction distinct; preserve current offline contracts. |
| Journal, note, quote, reflection | `JournalEntriesList`, `JournalEntryDialog`, `QuickJournalEntryDialog`, `JournalEntryCard`, `RichTextEditor` | Book detail and History entry points; no `/journal` route currently. |
| Book search | `BookSearch` inside Add Book; local library search in `MyBooks` | No global `/search` route currently; do not invent recommendation services. |
| Lists and goals dialogs | `BookListManager`, `AddToListDialog`, `GoalsSheet`, `GoalManager` | Preserve the same list/goal operations when changing surfaces. |
| Notifications | `UserNotificationsPopover`; settings `NotificationSettings` | Journey-related in-app notification popover; no standalone notifications route. |
| Rewards | `ReaderHud`, `DailyFocusCard`, `DashboardStreakCard`, `StreakCelebrationOverlay`, reward/badge providers, Journey components | Server-confirmed rewards and provisional offline values. |
| Social composers | `CreatePostDialog`, `ReviewForm`, comments, club composers | Long-form work retention, permissions and attachment states. |
| Club administration | `BookClubDetail` admin tab | Existing role-dependent controls; no general administrative route or console in `App.tsx`. |
| Image actions | `ImagePickerDialog`, cover/avatar/photo previews, scanner flows | Photo picker permissions, uploads, errors, cancellation, optional image zoom. |
| Sync review | `ReadingSyncIndicator` and associated sync UI | Local pending/failed state stays understandable; do not imply unavailable social writes are queued. |

## Verified findings and implementation tickets

Line numbers are approximate landmarks; symbols and filenames are the durable anchors. “Acceptance” gives the specific result required in addition to the common state/device gates in the screen specifications.

| ID / priority | Source evidence and current behavior | User impact | Planned repair and acceptance |
| --- | --- | --- | --- |
| A01 / P1 / V | `UserProfile.tsx`, club card `onClick`, approximately line 515: navigates to `/book-clubs/${club.id}`. `App.tsx` registers `/clubs/:clubId` only. | Opening a reader's club goes to the catch-all instead of the club. | Use canonical destination from centralized route helpers. Exercise club card with keyboard and touch; correct club opens; Back restores source profile and tab. |
| A02 / P1 / V | `BookDetail.tsx`, `BOOK_DETAIL_GRID`: first column contains hero and all tab content; following `aside` contains Start Timer, Log Progress, Mark Done. `BookDetailSkeleton.tsx` defines columns starting at `lg`. | On single-column layouts the core reading action occurs after potentially long detail content. | Move the primary reading action directly after identity/progress in document order, with a shell-owned reachable action region when appropriate. At compact width users reach Start/Resume and Log progress before secondary metadata; large-text flow remains readable without overlap. |
| A03 / P0 / V | `JournalEntryDialog.handleSave` accepts `onSave: (...) => void`, calls it, immediately closes and resets. Caller `JournalEntriesList.handleSave` is async. `useJournalEntries.addEntry/updateEntry` catch errors without rethrowing or returning a failure result; `QuickJournalEntryDialog` awaits that resolved call, displays success and resets after 1,500ms. | Failed journal persistence can lose the editable draft; the quick editor can announce success even after the hook reports an error. Simply adding `await` to the normal editor is insufficient. | Define and consume a success-bearing mutation result across both editors and the hook; keep text/metadata/attachments on persistence failure; disable duplicates. Distinguish successful write followed by refresh failure from failed write so Retry cannot duplicate a committed entry. Inject each failure point and verify retained draft, truthful feedback and exactly one entry. |
| A04 / P1 / V | `ReadingHistory` maps logs and journals to `Card onClick`; `ui/card.tsx` renders a `div`. `UserProfile` club cards also use a click-only Card. | Essential navigation is not exposed as a native keyboard link/button by these elements. | Convert navigation surfaces to semantic links or a sibling primary control, using the established library activation contract when secondary controls exist. Tab + Enter opens the correct item; selection/copy and secondary controls remain independent. |
| A05 / P1 / V | `UserNotificationsPopover`: `!query.data?.length` selects “You're caught up”; no loading/error branch. | A pending or failed fetch can be presented as an empty, successful inbox. | Separate initial loading, genuine empty, retained-data refresh, error, offline and mark-read states. Forced network failure must never display a successful caught-up message in place of unknown data. |
| A06 / P1 / V | `UserNotificationsPopover.openNotification` awaits mark-read and invalidation before `navigate`; no catch at that handler. | Mark-read failure can prevent opening an otherwise valid destination, with no local recovery message. | Navigate independently from ancillary read-state persistence, respecting current service contract; record/announce read failure without inventing offline write support. Destination remains reachable during mark-read failure. |
| A07 / P1 / V | `AddBook.handleSubmit` shows a fixed full-screen success layer then waits 1,500ms before navigation; `handleQuickAdd` returns to library immediately. `BrandedLoadingScreen` is active during adding. | Ordinary add paths have inconsistent latency and block the next action for decorative feedback. | Use immediate local success and destination highlight; first-book delight is nonblocking and reduced-motion aware. No fixed success timeout controls navigation; duplicate detection and local persistence remain intact. |
| A08 / P1 / V | `useIsMobile()` returns only `useBreakpoint().isPhone` (`<768px`). `Messages` uses a fixed 22rem inbox plus thread whenever not phone. Many screens switch the entire presentation on this hook. | Tablet/touch input is conflated with desktop presentation. Narrow tablet or split-window content can be squeezed. | Base pane eligibility on available content width and input capabilities. At every width, a pane has its defined minimum or collapses to one navigable pane; touch target and keyboard behavior remain touch-capable on tablets. |
| A09 / P1 / V | `MessagesContent.selectedConversationId` lives in local state; external entry uses `location.state.conversationId`/`startConversationWith`; choosing a thread does not change URL. | Refresh/history and native Back cannot derive the selected thread from a durable URL alone. | Add documented thread URL state while retaining existing entry compatibility. Reload and Back/Forward reproduce inbox/thread identity; use an explicit inbox fallback for direct links. Do not add backend conversation creation on simple restoration. |
| A10 / P1 / V | `RichTextEditorProps` has no accessible name/description/id contract; `editorProps.attributes` contains only class. Journal content label is standalone. `ReviewDetail` comment textarea has placeholder but no associated label in its form. | Writing controls may lack stable, useful programmatic names; placeholders disappear while typing. | Add and forward semantic naming/description/error props; associate labels at callers. Inspect the actual contenteditable/textarea accessibility tree, then verify VoiceOver/TalkBack/NVDA name, multiline state, toolbar and error flow. |
| A11 / P2 / V | `MyBooks` renders summary chips with status filtering and a second status-control row in the toolbar. Existing advanced controls are already collapsed on compact layouts. | Multiple representations of the same state occupy reading space and may compete for attention. | Keep one status selector with counts; move sort/view/genres/selection modes to a clearly labelled adaptive controls surface. Preserve discovery of all modes and visible active-filter summary. Compare before/after task completion, not card count alone. |
| A12 / P1 / V | `MyBooks`: search-clear `h-6 w-6`; view-switcher `h-9 w-9`; genre-clear `h-7`; `BookListManager` action trigger `h-9 w-9`; book-detail management actions `h-10 w-10`. | Several explicit target sizes fall below BRACK's chosen 44px touch baseline; adjacent targets require review. | Expand interactive boxes to at least 44px (prefer 48px for frequently used touch controls), without enlarging every icon. Test actual computed hit boxes and non-overlap at large text. This does not by itself establish a WCAG failure; apply relevant exceptions/criteria separately. |
| A13 / P2 / V | `Settings` phone presentation is an accordion containing full settings editors; desktop category/detail layout uses `lg` columns. `/profile` and Settings/Profile both expose editing. | Long forms stay inside expanding category cards and editor entry points diverge. | Use compact category list → focused editor; reuse one profile form; preserve URLs and capability-specific settings. Back returns to the same category/scroll without losing draft. |
| A14 / P2 / V | `ui/card.tsx` adds border, shadow and hover transition to every Card, including passive containers. | Global primitive encourages visually repeated boxed surfaces and implies interactivity on passive groups. Actual clutter is a visual hypothesis. | Separate passive sections from interactive rows/cards; remove global interactive decoration from passive surface primitive. Preserve focus and pressed states on actual controls; review all consuming screens before changing defaults. |
| A15 / P2 / V | `Analytics` imports 13 chart components and distributes them across Overview/Detailed/Insights; primary cards precede chart tabs. | Present structure is chart-led; rendering/bundle cost and information overload require measurement. | Lead with a chosen period, small metric summary and one useful chart; expose detailed charts by question. Do not delete supported analytics. Measure lazy chunk/render cost before moving modules. |
| A16 / P2 / V | `ReviewDetail` renders product copy describing internal loading/privacy architecture (“without loading entire threads…” / private library copies). | Readers receive implementation explanations in ordinary task UI. | Replace with reader-oriented discussion/context labels; preserve privacy meaning where it informs a choice. Audit all user-visible copy for implementation jargon. |
| A17 / P2 / V | `NotFound` uses a plain `<a href="/">` and no contextual in-app return control. | Recovery can reload the app and sends both signed-in and public users through root entry. | Provide route-aware Home/Library recovery and safe Back with direct-link fallback. Verify offline/cached recovery without promising network-only screens. |
| A18 / P2 / V | `SupportCenter` explicitly marks known-issues, Terms and Privacy content as placeholders. | A visual refresh must not imply these are complete legal policies or service-status data. | Preserve truthful labels until approved content exists; route to usable support/privacy settings. Legal content approval is an external dependency, not a design-compliance assertion. |

### Additional journal attachment integrity finding

**A19 / P0 / V:** `JournalEntryDialog.handleImagePicked` removes the saved `editEntry.photo_url` through `removeStorageFiles` before uploading its replacement or saving the edited entry. An upload failure or cancelled edit can leave the saved entry pointing at a removed attachment. Keep the original asset/reference until replacement and entry persistence are safely committed under the existing sync contract. Cleanup must not run on mere selection, and cleanup failure must not turn a successful save into an invitation to duplicate it. Reproduce upload failure, save failure, Cancel, app interruption and successful replacement. F01 owns the integrity correction; F13 owns the broader composer presentation.

## Preserved strengths and stale-audit corrections

- **Book details already have back controls** in phone and larger-screen headers, with library fallback. The problem is not universal absence of Back; audit each route and direct-link case.
- **Book deletion already uses an app AlertDialog.** The May must-win document's browser-confirm recommendation is stale for current BookDetail.
- **Library already has three intentional modes** and carefully tested primary action, selection, reorder, drag-click suppression and focus restoration contracts. Do not discard these as generic shadcn behavior.
- **The active shared DatePicker is already specialized.** It has typed canonical date values, direct year/month navigation, compact sheet/larger popover behavior, labels, focus logic and forced-colors handling. A candidate Ionic/native presentation must meet that contract; a plain spinner picker is not automatically an improvement.
- **Region-based loading already exists** across dashboard, library, messages, social, book detail, goals and settings. Keep useful cached content and skeleton geometry; fix global and exceptional cases rather than replacing every loader.
- **Dashboard already uses `useDashboardHomeData`.** The old recommendation to introduce a dashboard read model must not become a duplicated rewrite.
- **Reader Journey already distinguishes live/cached/expired/provisional data.** Preserve current rewards, feature flags and offline boundaries.
- **Onboarding already has drafts, chapter navigation and native permission handoff.** Improve density and interaction; do not throw away the substantive flow.
- **Support already has a skip link, labelled FAQ search, result status, semantic details and deep-linkable anchors.** Extend these patterns to authenticated screens.
- Preserve `ThemeAwareLogo`, theme tokens/palettes, established display/body fonts, `APP_ICONS`/Iconoir, book-cover treatment, approved illustrations, and existing data/service boundaries throughout.

## Hypotheses requiring baseline capture

| ID / proposed priority | Hypothesis | Evidence needed before prescribing the final fix |
| --- | --- | --- |
| H01 / P1 | Persistent mobile browser bottom chrome reduces useful reading space; native bottom tabs remain desirable. | Phone browser versus installed PWA/native viewport recordings, keyboard open/closed, navigation-task success. Apply the packet's platform policy, then compare. |
| H02 / P1 | Route changes feel laggy due to global suspense, transition gating, repeated mounts, data requests or chunk loads. | Cold/warm route traces and interaction timestamps for Dashboard ↔ Library → Book → Back, plus Settings, Analytics and social. Do not assign percentages to causes from source alone. |
| H03 / P1 | Dense headers, ReaderHud, statistics and repeated cards hide the main task on short phones. | Initial viewport captures at 320/360/390px widths, long names, all themes and 200% text; task-based first-action timing. |
| H04 / P1 | Sheet/dialog fields and timer/message controls can be obscured by virtual keyboard or competing bottom surfaces. | Physical iOS/Android and tablet split view; IME composition, landscape and native permission return. |
| H05 / P1 | Page-wide swipe handlers compete with inner controls, text selection, carousels, system Back and scrolling. | Pointer/gesture ownership tests with actual touch and screen-reader gestures; test start edges, diagonal drags, cancellation, multi-touch and RTL. |
| H06 / P1 | Contrast or selected-state differentiation fails in some custom themes. | Computed contrast and visual checks for every registered palette in relevant modes; focus, charts, disabled/selected/error states and forced colors. |
| H07 / P2 | Loading and reward animations feel generic or appear at the wrong time. | Trigger recordings with cached/fast/slow/offline paths and reward replay prevention; reduced motion; concurrent timer and editor activity. |
| H08 / P2 | A long library, history, club member list or thread makes scrolling slow. | Representative 10/100/1,000-item local fixtures; main-thread/DOM/memory measurements. Virtualize only when supported by evidence and focus/selection constraints. |

## Required audit artifacts before implementation acceptance

For each S01–S18 spec, attach the route/runtime/build identifier, fixture state, viewport/content width, input method, theme/text scale, before/after capture, reproduced issue IDs, and outcome. Include phone native iOS/Android, phone Safari/Chrome browser, standalone PWA, touch tablet full/split window, keyboard tablet, web desktop and Electron where behavior differs.

Every exception must name its owner, affected surfaces, mitigation and follow-up. A screenshot alone cannot close draft safety, accessibility, offline correctness, navigation semantics, reward confirmation or performance tickets. Track source facts, observed defects and proposed improvements separately so future agents do not turn hypotheses into fabricated findings.
