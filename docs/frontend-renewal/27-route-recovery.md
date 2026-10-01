# CR06b — route recovery and Library action names

Status: **Historical: implemented and verified within the scope below; committed in `d944fef`.** Baseline `182230f` commits CR06a; worktree was clean at startup. No staging, commit, deployment or live account mutation performed. This completes three findings under CR06, not all of CR06 or the main screen tickets.

## Scope and verified baseline

Findings RS05/RS06/RS07 in [route-shell consumers](coverage-review/03-route-shell-consumers.md):

| Production consumer | Source baseline | Result and evidence disposition |
| --- | --- | --- |
| BookLists, `/lists` and `/book-lists` | Resolved anonymous auth returned null. Loading had a shell; signed-in manager was keyed by reader. | Signed-out prompt with Sign in and public Home. Both aliases retain their destination through actual Auth submission. Loading/session loss/account replacement exercised; per-reader manager ownership retained. |
| GoalsManagement, `/goals-management` | Anonymous auth returned null; a stale non-null user during auth loading still mounted GoalManager. | Loading takes precedence; old GoalManager unmounts. Prompt and same-route return. Actual GoalManager loads distinct controlled goals for successive reader identities. |
| BookClubDetail, `/clubs/:clubId` | Compact Back existed in all branches. Expanded loading/ready had Back; expanded unavailable/error did not. | Added expanded contextual AppBackButton to unavailable/error. One reachable Back for loading/ready/empty/401/403/404/network at 390/834/1280. Direct fallback reaches actual BookClubs; traversed entry returns to actual Library. Retry recovers the actual club. |
| MyBooks, `/my-books` and unchanged `/books` App alias | Phone Analytics had no accessible name. Medium Book Lists/Analytics/Add Book hid their only names. | Header destinations are native Router links. Medium/expanded labels stay visible and wrap as a group; phone Analytics has name/title. Enter/traversal, touch and modified-click reach actual Lists. Analytics/AddBook hrefs remain unchanged; their destination screens are outside this fixture. `/books` keeps the unchanged App component mapping, source-verified only in this child. |

Preserved themes, logos, Inter/Merriweather/Playfair roles, Iconoir, offline/reader service ownership, setup precedence, feature gates and Back coordination. No global gesture, Ionic, backend auth or SDK replacement.

## Return-intent implementation and consumers

`services/authReturnIntent.ts` is a bounded presentation helper: exact allowlist `/lists`, `/book-lists`, `/goals-management`; path and timestamp only; per-tab sessionStorage; 15-minute TTL; memory fallback if storage is unavailable. Invalid, malformed, expired, future-dated and external destinations are rejected. It accepts no query strings/fragments and does not authorize data access.

Auth captures the query before its signed-in redirect effect. The resolver and successful draft finalization use the helper only where they previously returned Dashboard. Onboarding, failed-draft recovery, native permission setup and password-reset routing retain precedence. Onboarding skip/finish and PostSignupPermissions exits share the normal destination; completed Settings edits still return to Settings. Explicit Home cancellation in Auth/Onboarding clears the intent. `useAuthReturnArrival` clears a matching intent on authenticated target arrival, because OnboardingRouteGuard also reads the resolver and must not consume it prematurely.

ReaderSignInPrompt is mounted only by Lists/Goals inside existing shells. Its actions grow and wrap at large text. It offers visible recovery without automatically navigating an anonymous reader. Auth loading precedes both prompt and reader manager. Accessibility requires no opt-in.

Changed consumers were traced through source and real calls: Auth, authRedirect, Onboarding, PostSignupPermissions, Lists/Goals and the existing OnboardingRouteGuard. AuthCallback inherits the resolver; recovery/replay/bootstrap regressions pass. OnboardingEntryRedirect and existing backend-unavailable/bootstrap fallbacks remain unchanged. The intent is scoped to one tab and its lifetime; fresh-device/email-tab and expired flows can use Dashboard. No cross-device promise or OAuth callback URL change.

## Verification and retained failures

The [verification manifest](evidence/cr06b-route-recovery/verification.json) records report/source hashes, exact browser cases and 70 captures. Raw logs/traces remain under `test-results/cr06b-*`; retained screenshots and case errors are in the durable evidence directory, even if local test-results are cleaned.

- Initial Chromium baseline: **5 expected product failures** — three blank anonymous routes, expanded unavailable-club Back, and unnamed/non-link tablet destinations. Fixture readiness passed first. The Library snapshot also shows unnamed buttons; the desired assertion requires the final semantic link contract.
- First repair check: **5 passed**.
- Expanded Chromium iteration: **20 passed, 2 failed**. Compact200 Home exceeded available width (a defect in the new prompt); fixed with content-height/wrapping actions. Desktop Analytics also matched the existing sidebar destination; selector corrected to scope the header, retaining full clipping/hit/focus assertions. Visual retry passed all 5 profiles.
- Final three-engine matrix: **77 passed, 1 skipped** across 26 cases per engine. Windows WebKit skips plain anchors with Tab/Alt+Tab, independently reproduced in CR06a; only traversal is skipped. Enter, touch, modified-click and focus pass in WebKit. This is not Safari-device verification.
- Existing Library regression selection: **8 Chromium passes** — list create/edit/delete, obsolete-account pending membership teardown, and four real task/large-text/short-height scenarios. Independent output preserved CR04 evidence. First invocation failed before tests because PowerShell passed an unquoted reporter comma as `line json`; quoted retry succeeded.
- Auth/setup unit/component regressions: **81 passes across 8 files**. Intent validation/expiry/storage/cancellation; resolver/callback/recovery/setup precedence; actual Onboarding skip/Settings close and permission-screen completion; existing Auth/AuthCallback/guard checks. Earlier new tests used the wrong callback return shape (two failures), then the wrong completed-edit Close label (one failure); source-confirmed assertion corrections, no weakened product requirements. Final log: `cr06b-units-final.log`.
- Client types, fixture types, scoped production/test ESLint with zero warnings, and production client/PWA build passed. Initial fixture types caught alias-union narrowing and ES-library-incompatible `replaceAll`; corrected before final checks. Existing build chunk-size, dynamic/static-import, stale browser-data and tooling warnings remain; no measured performance claim.

Commands: `npx playwright test --config tests/playwright/route-recovery.config.ts` with `CR06B_RUN=matrix1`; existing Library config with `--project chromium --grep 'List create|List edit|List delete|Account replacement'` and independent reporter/output; workspace Vitest for the 8 files in the final log; workspace `check-types` and `build`; `npx tsc -p tests/playwright/tsconfig.route-recovery.json --noEmit`; scoped ESLint. See [fixture boundaries](../../tests/fixtures/route-recovery/README.md).

## Visual and evidence limits

The matrix mounts actual Lists, Goals/GoalManager, Library, ClubDetail/BookClubs, Auth, OnboardingRouteGuard and shared shell/navigation. Service/captcha/device and unrelated shell-state boundaries are controlled. It is not live authentication, backend authorization, actual App lazy/provider loading or persistence validation. Production social FeatureGate is unchanged and had CR06a coverage; it is outside this fixture. Actual AddBook/Analytics/Home screen acceptance is not inferred from hrefs or the out-of-scope receipt. Setup completion is component/unit evidence, not whole-screen browser acceptance.

Visual profiles assert loaded Inter, Merriweather and Playfair Display faces: 390px phone, 320px/200% text, 834px/200%, 1280px desktop and 834px dark. Full target bounds against clipping ancestors, three-point hit ownership and focus are checked. The 60 matrix captures show viewport state; some large-text captures follow scrolling to the action, not the whole scroll document.

Manually inspected phone Lists, compact200 Lists/Goals, tablet200 Library, dark tablet Library and expanded unavailable-club captures. Recovery has a clear sign-in action and usable public exit; the long Home label wraps. Tablet labels are visible/reachable. Existing Library summary/filter duplication, floating-action density and tall 200% headers remain F10 composition work; the whole Library is not visually approved. Goals remains F13, clubs F14. Real iOS/Android/iPad/foldable/toolbar/IME, VoiceOver/TalkBack, every-theme contrast and legal conformance remain unverified. No latency/frame claims.

## Graphify, Obsidian and documents

Used frontend delivery/UX/accessibility and Supabase guidance, living auth/Back/navigation contracts, checkpoint26 and RS05/06/07. Startup Graphify query found 353/displayed 44 nodes at 1500 tokens; read generated BookLists note and App/BookListManager links. Bounded output was supplemented by source and incoming-consumer searches, not treated as exhaustive coverage.

After code freeze, local AST `graphify update .` succeeded: **10,262 nodes, 22,903 edges, 694 communities**, refreshed HTML/report. `graphify export obsidian` produced **10,943 notes**, preserving 6 pre-existing conflicts. Read back ReaderSignInPrompt's generated note and Lists/Goals/authReturnIntent links. Final bounded query found 169/displayed 29 at 1100 tokens. Three existing Android Gradle parse warnings remain. No cloud extraction, model labeling, live database inspection, hook or background watcher was enabled; the update's `graphify watch` prefix is its one-shot logger.

Census refreshed: 39 route declarations, 514 modules, 311 presentation modules, 33 screens, 274 components. Counts are inventory, not accepted-screen totals. README, ledger, handoff, coverage and living auth/navigation docs point here. Official Supabase redirect guidance/changelog checked on 2026-10-01; Markdown changelog request failed on content type, HTML fallback read. No provider configuration change needed.

## Historical next checkpoint

Stop for user review, with no stage/commit. After approval/continuation, begin **CR06c: RS03/RS09/RS11 and remaining HeaderUtilityActions callers** — Support/404 utility occupancy and Dashboard auth-loading navigation. Start from the census and route-state owners; complete that shell-policy child with actual screens and timer/sync/loading/error/large-text branches. Do not reopen RS05/06/07 without new evidence. Onboarding chapter Back (RS08), route focus/scroll restoration, remaining CR06 consumers, CR07–CR10 and main F10–F19 screen work stay open. Revalidate the exact next-child consumer set before edits; do not expand into an unfinished redesign.

Current continuation: user redirected the next pass to visible Library reconstruction in [F10a/checkpoint28](28-library-reconstruction.md). CR06c remains open; the earlier next-step recommendation below is historical, not the active checkpoint.
