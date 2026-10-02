# F11c reading sessions and F11d book editing

Status: **Implementation in place; browser/visual verification in progress. No final acceptance or commit claimed.**

Baseline: `6e68b57`, clean worktree at start. This commit includes F11b; checkpoint32's previous uncommitted status is historical. User authorizes proceeding with more than one complete ticket, with Playwright and a review stop before committing.

## Scope and ownership

- F11c / S09: real timer provider, shell session controls, Header and Quick actions book picker, recovery, account ownership, completion retry and journal handoff. Preserve timestamp-based elapsed arithmetic and timed-session service semantics. Native notification actions remain supported; physical device acceptance remains separate.
- F11d / S08 EditBook child: reconstruct the actual editor into clear reading/metadata groups; preserve optional fields, date semantics, offline ownership, media drafts and Back protection. Preserve concurrent reading progress through changed-field updates. This does not close AddBook/discovery (F12).
- Root owns session presentation, app-owned picker, integration, browser verification and this ledger. Delegated bounded work: timer lifecycle/helper, EditBook/helper/service guard, deterministic browser fixture. All changes share one checkout and are reviewed together.

## Evidence reviewed before implementation

Read delivery/UX skills, Graphify existing-index workflow, root AGENTS, plan09 F11 and plan05 S08/S09, reading feature reference and overlay/shell/feedback contracts. Queried existing local Graphify for TimerContext/FloatingTimerWidget/EditBook and consulted generated Obsidian source notes; actual source and consumer search resolve omissions. `TimerModal` and `MiniTimer` in older handoffs do not exist in this checkout.

Source findings:

1. Timer elapsed arithmetic already uses timestamps. Preserve it. Timer persistence and recovery are global/unowned; auth changes can expose another reader's timer. Async permission/confirmation/save work needs owner and session validation.
2. Provider lacks a shared pending lock and durable completion-attempt stages. Session-create success followed by book-update failure must not repeat the logical session or manufacture a new duration. Errors need a visible retry state, beyond a toast.
3. Header uses a generic popover with a nested fixed-height list; Quick actions duplicates the picker. Both should invoke one stable app-owned task, with rows composed for reading and responsive geometry inherited from the existing tested overlay owner.
4. Session details currently finish immediately and recovery silently clamps invalid minutes. Provide an explicit timed-session review and strict recovery input, with pending/back guards and stable retry.
5. EditBook loads remotely despite a local repository, submits its full opening snapshot, and uses lossy numeric parsing. A title-only save can overwrite newer reading progress. Upload completion can overwrite another draft change. Consolidate responsive field owners and protect async ownership.

Official docs consulted this pass: [Ionic list](https://ionicframework.com/docs/api/list), [Ionic item](https://ionicframework.com/docs/api/item), [Capacitor 7 App](https://capacitorjs.com/docs/v7/apis/app). Ionic modal URL returned403; do not claim a fresh read. Existing F06 integration evidence still governs router/overlay ownership. Component choice will be recorded against the implemented surface, not inferred from library availability.

## Validation ledger

- Existing source baseline browser capture: prepared 10 phone/tablet cases using actual TimerProvider, Header, FloatingTimerWidget, BookDetail/Dashboard and EditBook. Fixture port8106. First command used an invalid Playwright argument ordering; corrected. Sandbox process spawn then returned EPERM; local browser run retried with scoped escalation. Results pending.
- New fixture TypeScript: passed (fixture agent).
- Implementation tests, browser matrix, visual inspection, source census and refreshed Graphify/Obsidian: pending.

## Implementation checkpoint (before final matrix)

- Ten baseline captures secured: phone/tablet session, recovery, editor and picker/empty picker. Initial picker lookup incorrectly assumed a Dashboard header entry (four failures); corrected to actual Library Quick actions at390 and NativeHeader at834, then four passed. Existing entries were not fabricated or removed.
- Added one app-owned `ReadingSessionTasksProvider`, custom flat book rows, a calm measured shell timer strip, and explicit paused finish review. Existing Radix adaptive geometry remains the sole overlay/focus/Back owner. Ionic list/item composition informed flat rows; their additional runtime adds no required behavior to this native HTML list. No Ionic package/CSS/router added. No new animation, gesture recognizer, timer arithmetic or schema introduced.
- Provider now owns account-scoped storage and frozen completion; recovery uses strict minutes and explicit discard. Capacitor adapter distinguishes notification tap from the registered Finish action and validates owner/session. Post-session journal is tested as the actual next task.
- Editor now has Book essentials and Reading details, with optional Edition and series, Cover image, Notes and tags. One field owner across widths; changed-field saves, stale operation guards and retry-preserving media.
- Initial timer Chromium27 cases:25 pass, two test defects (restored button correctly says Retry save; a test's beforeunload restored an intentionally deleted fixture key). Corrected test setup/selector. Initial editor Chromium23:22 pass, one incorrect confirmation role selector under correction. These runs are diagnosis, not final acceptance.
- Independent source review found stale widget-local pending lock, same-book picker not closing, frozen recovery autofocus on disabled input, and journal return to removed timer invoker. Corrected with targeted browser regressions. Visual inspection found narrow footer buttons and tag-label compression at200% text; corrected before final captures.
- Initial focused units: timer52, editor59, presentation14. Final combined run/count remains pending. Client types passed; fixture types/lint passed. No physical native or assistive-technology acceptance implied.

## Continuation checkpoint

Do not mark either child complete until actual states and parent entries have been exercised. Baseline is complete. Remaining: final timer/editor/Journey+Dashboard entry matrix, affected existing shell/reading regressions, final types/lint/build, source census, Graphify update and Obsidian export/readback, living contracts and evidence. Preserve failed attempts in the validation record; count distinct cases rather than summing retries. Final handoff must link durable screenshots and list device/AT/live-service limitations. Stop for user review, with no staging or commit.
