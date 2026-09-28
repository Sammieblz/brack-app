# F02 + F03 implementation checkpoint

## Current checkpoint

- Baseline: clean worktree at `229dd677e33a8b7c6e81ac31d75b34aa94ea728d`, which includes F01 and its documentation.
- Active batch: **F02 destination/navigation semantics + F03 notification states and editor labels**.
- Status: **F02/F03 implemented and browser-verified; Graphify/Obsidian refreshed; awaiting user review**. The batch is uncommitted and unreleased. Real-AT/native acceptance remains unverified.
- Authorization: the user explicitly requested the next implementation and permits two or more tickets in one pass only if completed. Finish and test both tickets; do not add F04 or leave an in-scope ticket partly implemented. Keep durable checkpoints current.
- Stop: after complete implementation, Playwright and relevant checks, update this record and stop for user review. No new commit is authorized by this message.
- Next action: **STOP for user review. Do not commit or begin F04 until the user requests it.** If feedback identifies a defect, repair this batch and rerun affected checks before updating the stop record.

This is the authoritative detailed record for this batch. [13](13-implementation-tracker.md) retains F01's results; [09](09-execution-plan.md) is the summary ledger and [11](11-agent-handoff.md) is the retrieval guide. New agents should read this checkpoint before loading broad audit documents.

## Scope and acceptance

**F02:** correct UserProfile club URLs to the registered destination; expose club and ReadingHistory cards as semantic links with keyboard, pointer and modifier/new-tab behavior; preserve independent controls and feature gates; provide meaningful 404 recovery with safe direct-entry fallback. Back should retain the relevant source context. Do not migrate the router or implement F07 globally.

**F03:** distinguish notification initial loading, empty success, error, retained refresh and pending read state; failures must not falsely clear unread state or prevent opening an accessible destination; dismissal returns focus. Audit RichTextEditor consumers and affected profile/club/review/journal writing fields for names and description/error associations. Correct these semantics while preserving F01's save/draft behavior. Native screen-reader verification remains a separately reported evidence limit; browser semantics alone do not prove AT conformance.

## Discovery evidence

- Ran scoped Graphify query for BookClub routes, UserNotificationsPopover and RichTextEditor; read generated Obsidian notes for notifications and ReadingHistory, then verified current source.
- App registers `/clubs/:clubId` behind `FeatureGate feature="social"`; UserProfile still generates `/book-clubs/:id`.
- ReadingHistory maps progress/journal items to clickable `Card` divs. NotFound uses a root anchor without app-aware recovery.
- Notifications render "You're caught up" whenever data is absent, including fetch/error states. Read mutations reject without feedback; destination navigation waits for read success and query invalidation.
- F01 already gives journal rich-text editors labels and pending-state locks; preserve those contracts when extending the shared editor semantics.

## Work ownership

- F02 agent: UserProfile, ReadingHistory, NotFound and focused route/navigation tests.
- F03 notifications agent: UserNotificationsPopover and focused notification behavior tests.
- F03 form semantics agent: shared editor contract and affected consumer labels/errors with tests.
- Root: this checkpoint, integration/browser fixture, cross-slice review, final verification and graph/vault refresh.

## Validation ledger

| Check | Status | Evidence |
| --- | --- | --- |
| Source / Graphify / Obsidian discovery | Completed | Current source findings above |
| Combined focused regressions | Passed: 86 tests in 10 files | Exact command below; includes F02, notification/service, editor/forms and existing loading/journal checks |
| F03 notification regressions | Passed: 28 tests | 15 hook and 13 real-SDK/mock-HTTP tests; owner checks, remounts, arrivals and stale errors |
| F03 editor/consumer regressions | Passed: 34 tests in 5 files | Includes Input/RTE semantics, error targeting and F01 retention |
| Additional shared Input consumer regressions | Passed: 10 tests in 4 files | Input, NativeHeader, BookSearch.loading and BookListManager.loading; 3 Input tests overlap the combined 86 |
| Playwright F02/F03 | Passed: 63 tests | 21 scenarios × Chromium/WebKit/Firefox; output collision fixed before final complete rerun |
| Playwright F01 regression | Passed: 54 tests | Full/quick journal save, failure, discard, focus and remount cases on Chromium/WebKit/Firefox |
| Types / scoped lint / build | Passed on final source | Workspace types, fixture types/lint, client production build; all changed client TS/TSX lint has zero errors and two pre-existing profile effect warnings |
| Independent review | Completed | Four notification lifecycle/account/cache findings resolved; Input scan completed with twelve additional naming fixes |
| Graphify / Obsidian refresh | Completed after final code | AST-only update: 8,559 nodes / 20,017 edges / 584 communities; vault export: 8,893 notes |
| Docs / links / whitespace | Passed | Local Markdown links resolve; `git diff --check` clean; handoff/index/ledger/current contracts updated |

## Boundaries to retain

No production account operations, deployed schema/API changes, live database introspection, dependency upgrades, router migration or theme/font/icon replacement. The existing notification client service now binds requests to the expected reader; no backend deployment is involved. No F04+ work. Browser mocks do not prove real authentication, server mutation, native back/keyboard, physical device behavior or screen-reader conformance. Mark implemented, tested, committed and shipped separately.

## Integration decisions so far

- Profile and history selected tabs use query parameters with replace, preserving unrelated parameters. This retains source context when returning from a detail link without adding tab changes as extra Back steps.
- That exposed a concrete Back defect: replacing a direct entry creates a location key without creating a prior app entry. The shared `useAppBack` predicate now requires a positive BrowserRouter history index, preserving explicit `onBack`/`to` precedence. This is a narrow F02 correction, not the broader F07 gesture/back redesign.
- Notification selection opens its existing destination immediately. Read marking has independent pending/success/failure feedback, no optimistic unread clearing and no durable/offline replay promise. Account-scoped mutation cache retains retry state through header remounts.
- Shared rich-text inputs now forward standard ARIA description/error attributes and a focus handle. All six existing consumer locations are verified in source. General save/upload failures must not falsely mark content invalid.
- Browser validation found the shared Input's synthetic `aria-label` overrode actual visible labels. Removed that fallback; preserve explicit author-provided names and native Labels/FormControl. Follow-up audit covers every direct shared Input consumer and wrappers so unnamed fields receive deliberate names.
- Notification service methods now require the expected reader, check before/after requests, and filter `user_id`. Read queries forward AbortSignal. Owner checks are tested using the real SDK and mocked HTTP, not live RLS.
- Mark-all cache confirmation is restricted to captured unread IDs; refreshed confirmed data reconciles old failure feedback. Same-reader navigation can finish a read after header unmount; late toast feedback cannot target another reader/header.

## Implemented source inventory

Paths below are relative to `apps/client/src` unless specified. [Navigation/notifications](../ui-navigation-notifications.md), [form semantics](../ui-form-accessibility.md), and the updated [journal contract](../ui-journal-editing.md) own current behavior; this checkpoint owns delivery evidence.

| Area | Files and outcome |
| --- | --- |
| F02 destinations/recovery | `screens/UserProfile.tsx`, `ReadingHistory.tsx`, `NotFound.tsx`; `hooks/useAppBack.ts`: canonical links, query-backed source tabs, named mobile tabs, safe history and app recovery |
| Notification UI/state/service | `components/UserNotificationsPopover.tsx`; new `hooks/useUserNotifications.ts`; `services/api/userNotifications.ts`: truthful pending/error/empty/cache states, immediate destination, retry/deduplication, expected-reader ownership |
| Shared fields | `components/ui/input.tsx`, `components/rich-text/RichTextEditor.tsx`, `RichTextToolbar.tsx`: native/explicit names, actual editor descriptions/errors/ref/blur, count IDs, cleared stale semantics, toolbar pressed state and Link URL label |
| Rich-text consumers | `components/JournalEntryDialog.tsx`, `QuickJournalEntryDialog.tsx`, `social/ReviewForm.tsx`, `social/CreatePostDialog.tsx`, `clubs/DiscussionThread.tsx`; `screens/BookClubDetail.tsx`: all six consumers named; validation/service feedback associated without misclassifying general failure as invalid writing |
| Journal error targeting | `hooks/useJournalEditor.ts`, `components/journal/JournalEditorFeedback.tsx`: content/page/photo/general classification and relevant focus; F01 persistence/draft outcome preserved |
| Adjacent field semantics | `components/JournalEntriesList.tsx`, `clubs/BookClubCard.tsx`, `clubs/ClubChatThread.tsx`, `clubs/CreateClubDialog.tsx`, `settings/AccountSettings.tsx`, `settings/ProfileSettings.tsx`, `social/ReviewComments.tsx`; `screens/Profile.tsx`, `BookClubs.tsx`, `Reviews.tsx`, `ReviewDetail.tsx`: names, descriptions, privacy/role controls, comment/chat error feedback and native review rating |
| Shared Input consumer completion | `components/BookListManager.tsx`, `BookSearch.tsx`, `GoalManager.tsx`, `NativeHeader.tsx`, `QuoteCollection.tsx`, `TagManager.tsx`, `messaging/ConversationsList.tsx`, `messaging/MessageThread.tsx`, `settings/DataBackupSettings.tsx`; `screens/EditBook.tsx`, `MyBooks.tsx`, `Readers.tsx`: deliberate names or visible-label associations, with no new product behavior |

New regressions: `screens/navigation-recovery.test.tsx`, `hooks/useAppBack.test.tsx`, `hooks/useUserNotifications.test.tsx`, `services/api/userNotifications.test.ts`, `components/FrontendFormAccessibility.test.tsx`, `components/rich-text/RichTextEditor.test.tsx`, `components/ui/input.test.tsx`. Extended `hooks/useJournalEditor.test.tsx` and `components/ReaderSubmissionLoading.test.tsx`.

New browser harness: all eight files in `tests/fixtures/frontend-semantics/` (including README), `tests/e2e/frontend-semantics.spec.ts`, `tests/playwright/frontend-semantics.config.ts` and `tests/playwright/tsconfig.frontend-semantics.json`. See its [README](../../tests/fixtures/frontend-semantics/README.md) for real components, mocks, controls and output paths. Themes, fonts, icons, routes and service/device ownership stay within existing contracts.

The final Input consumer scan covered 45 importers and 90 production JSX sites: 26 explicit ARIA names, 60 native label associations, one FormControl association and three forwarding definitions. All 15 active MobileInput callers supply paired IDs/labels; other checked wrappers have no production callers. This source inventory establishes naming ownership, not actual AT traversal of every form.

## Reproduction and results

Run from repository root, sequentially for the browser suites:

```powershell
npx playwright test --config tests/playwright/frontend-semantics.config.ts
npx playwright test --config tests/playwright/journal-save.config.ts
npx tsc -p tests/playwright/tsconfig.frontend-semantics.json --noEmit
npx eslint tests/playwright/frontend-semantics.config.ts tests/e2e/frontend-semantics.spec.ts tests/fixtures/frontend-semantics --max-warnings=0
npm --workspace @brack/client run test -- src/screens/navigation-recovery.test.tsx src/hooks/useAppBack.test.tsx src/components/skeletons/ReaderLoadingContracts.test.tsx src/hooks/useUserNotifications.test.tsx src/services/api/userNotifications.test.ts src/components/rich-text/RichTextEditor.test.tsx src/components/FrontendFormAccessibility.test.tsx src/components/ui/input.test.tsx src/hooks/useJournalEditor.test.tsx src/components/ReaderSubmissionLoading.test.tsx
npm run check-types
npm --workspace @brack/client run build
```

- F02/F03 final browser run: **63 passed**, 1.2 minutes, no failed/skipped cases. Twenty-one scenarios run per engine at compact, tablet-width or wide browser sizes as applicable.
- F01 browser regression: **54 passed**, 2.2 minutes. No failed/skipped cases.
- Combined focused unit/component suite: **86 passed across 10 files**, 9.3 seconds. Notification service tests exercise real SDK request construction with mock HTTP; they do not execute live database policies.
- Fixture TypeScript and ESLint passed. Root workspace types and client production build also passed again **after all additional field names were complete**. Build log is locally ignored at `test-results/frontend-renewal-build.log`.
- The additional consumer command `npm --workspace @brack/client run test -- src/components/ui/input.test.tsx src/components/NativeHeader.test.tsx src/components/BookSearch.loading.test.tsx src/components/BookListManager.loading.test.tsx` passed 10 tests in four files (three Input cases also appear in the combined run).
- ESLint across every changed/new client TS/TSX file exited successfully with zero errors. Existing `react-hooks/exhaustive-deps` warnings remain in `Profile.tsx` and `settings/ProfileSettings.tsx` for `loadProfile`. Production build reports the existing stale browser-data, ambiguous easing utility, mixed sync-engine imports and >1000 kB chunk warnings. No dependency update or performance remediation was added to these tickets.
- No screenshots/visual approval, real AT, physical native/tablet device, live Supabase write, performance timing budget, deployment or release claim follows from these runs.

### Local graph and vault refresh

Ran `graphify update .` against the existing index, then `graphify export obsidian`. Update is local AST extraction, with no semantic/cloud processing, live database access, hooks or watchers enabled. The tool's log prefix says `graphify watch`; this command did not start a watcher. Generated graph/report/HTML were refreshed. A bounded post-update query found the new `useUserNotifications`, `hasAppHistory` and changed RichTextEditor source symbols.

Three existing Android Gradle parser warnings remain (`android/app/build.gradle`, `android/app/capacitor.build.gradle`, `android/build.gradle`); no symbols were extracted from those files. This does not invalidate the TypeScript source checks. Community names were retained or derived from hubs; no model-backed label refresh was run.

Obsidian export wrote 8,893 notes and `graph.canvas`, pruned 31 stale generated notes, and preserved two unowned note collisions (`operations.md`, `performance_7.md`) instead of overwriting them. Those two notes are not refreshed generated references. Use current source for authority. The vault is local/ignored and can be opened at `graphify-out/obsidian/`; no Obsidian GUI or community plugin was needed or claimed.

Maintained docs now include navigation/notification and form contracts plus fixture instructions; indexes and the two BRACK skill guidance locations link to those contracts. The delivery skill records batch authorization, shared-primitive consumer checks and Playwright output isolation without copying the full plan into always-loaded context.

### Failures resolved during integration

1. The real ReviewForm browser check could not find the visible Review Title name: shared Input synthesized `aria-label` had precedence over native labels. Removed the fallback, added real Input regression coverage, then checked all consumers for deliberate names.
2. The new fixture initially searched for “Insert link” while the product control is “Add link”; corrected the test to the actual intended label. This was a fixture error, not a product naming change.
3. Running the new and journal browser suites concurrently shared Playwright's default artifact folder. The first complete F02/F03 run had 61 passes and two WebKit teardown `ENOENT` trace errors. Added a dedicated output directory and reran all 63 successfully after journal finished. Do not hide these as an application fix or dismiss a failed final run.
4. Independent review found and resolved expected-reader service ownership, early header-unmount handling, mark-all incoming-row confirmation and stale failure-message reconciliation. All corresponding hook/service/browser regressions passed.

## Resume without re-auditing

1. Check HEAD/worktree; this batch started from clean `229dd677e33a8b7c6e81ac31d75b34aa94ea728d` and has no new commit.
2. Read the current checkpoint and validation ledger above, then only the relevant living contract and source. Generated Graphify/Obsidian notes are navigation aids, not proof of current behavior.
3. Finish any explicitly pending final check in the ledger; do not start F04 during this batch. At the completed checkpoint, stop for user review. A commit or next implementation requires the user's next instruction.
4. If the user requests the next ticket, F04 is the next sequenced candidate (action-imposed waiting/haptic ownership). Revalidate its source then; no F04 implementation was started here.
5. For release acceptance, still obtain actual VoiceOver/TalkBack and native device evidence. F03's real-AT acceptance remains unverified even after the code and browser checks are complete. Do not claim federal/international accessibility compliance from DOM tests.
