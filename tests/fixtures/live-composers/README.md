# CR01 live composers browser fixture

Run from the repository root, sequentially with other Windows browser matrices:

```sh
npx tsc -p tests/playwright/tsconfig.live-composers.json
npx playwright test --config tests/playwright/live-composers.config.ts
```

The fixture owns Vite port **8094**, cache `node_modules/.vite/live-composers`, output `test-results/cr01-live-composers`, and JSON report `test-results/cr01-live-composers-summary.json`. The config refuses to reuse an existing server. Tests are available coverage; the active CR01 implementation checkpoint records actual runs and unresolved checks.

## Production consumer coverage

| Actual route/screen | Actual caller/task | Evidence requested by the spec |
| --- | --- | --- |
| `/feed` → Feed | PostCard → CommentThread / recursive replies | Name/help, newline and composition behavior, native keyboard activation, rejected/deferred saves, local collapse and actual Activity-tab retention, duplicate protection, newer draft, reply focus |
| `/posts/post-reading` → PostDetail | PostCard → CommentThread / recursive replies | Same full comment/reply cases through the detail entry |
| `/users/reader-taylor?tab=posts` → UserProfile | Posts tab → PostCard → CommentThread / recursive replies | Same full comment/reply cases through the profile entry, plus actual Books-tab retention |
| `/messages` → Messages | ConversationsList selection → MessageThread | Name/help, IME/Enter/Shift+Enter, upload and write failures, preserved attachments/newer text, retry request identity, GIF flow, media naming/focus/dismissal |
| `/clubs/club-one` → BookClubDetail | Actual Chat tab → ClubChatThread | Equivalent club send/upload/GIF/media cases, plus actual Overview-tab retention |

Every listed screen, its responsive parent, PostCard, all three target composers, and their primitive UI imports are source components. The fixture also mounts the real Router, AppNavigationProvider, ConfirmDialogProvider, ShellUtilitiesProvider, TooltipProvider, Toaster, shell, headers and viewport hook. It does **not** replace an audited screen/task with a fixture receipt or import dormant ReviewComments.

Opening a live composer also checks that the floating Scroll to top control is hidden. The club parent-tab case uses a 390×640 viewport, crosses the real Overview scroll threshold, verifies the control returns there, and verifies it is suppressed again on Chat. This guards the actual overlapping pointer target found by the initial WebKit/Firefox matrix; it does not replace send clicks with keyboard-only activation.

Two 200% PostDetail/Profile cases use actual Tab, mouse-wheel scroll and Shift+Tab to verify that returning to a partly obscured field clears the sticky header without losing draft or caret. Capture framing uses native nearest scrolling, which honors the production CSS scroll padding; checks require header clearance and multiple pointer hit points for fields/actions. Ordinary collapse/tab/send clicks remain pointer regressions: the shell must not move their targets during pointer focus. These cases were observed failing before the corresponding fixes; the checkpoint retains the diagnostics.

Real target data hooks include `usePosts`, `useSocialFeed`, `usePostComments`, `useConversations`, `useMessages`, `useUserProfile`, `useRetainedReaderResource`, and both typing hooks. Their API reads/mutations/subscriptions terminate at the deterministic API boundary described below.

## Exact boundaries

`vite.config.ts` is authoritative for aliases:

- `@/services/api` and `@/services/api/readers` → `api.ts`: deterministic posts/comments/profile/conversation/club reads, subscription handles, GIF results, controlled writes/uploads. Unrelated mutations throw; no live backend is used. The request controls record submitted payloads and permit resolve, reject or explicit deferred settlement. Uploaded files produce controlled metadata; no storage write occurs. Subscription handles do not simulate delivery/reconnection races.
- Account, profile, theme, feature flags, haptics, network, books, rewards, notifications, timer, local sync and unrelated feature boundaries → `data.ts`, which reuses `adaptive-shell/data.ts` and its `shell-scroll/data.ts` collection data. `useFollowing` is explicit fixture relationship data. Exact aliases are enumerated in the config; none replaces a target UI component. These stubs do not validate real account, theme persistence, offline sync, reward or collection behavior.
- Five Capacitor plugin imports → the existing `back-ownership/adapters.ts` synthetic bridge. `?runtime=android` tests the app's callback/overlay coordinator; it does not establish Android hardware Back, IME or edge behavior.

The state control is `window.liveComposers`. It is available only in this fixture. Direct-message drafts remain source localStorage behavior. Each Playwright test gets an isolated browser context.

Images use a small local SVG or an intentionally missing media URL. File upload tests provide a deterministic PNG; the upload contract is observed before storage. GIF metadata is controlled and makes no Tenor request. Emoji rendering is the real picker and may request its vendor image assets.

## Visual and evidence limits

The visual cases capture all five real callers at 320×844, 390×844, 834×1112, and 390×844 with a 32px root font (200% text). They require a usable composer width (at least 180px, or the available container width if smaller), wholly visible text/actions, no intersecting control boxes, and pointer hit testing for every composer action. Screenshots remain necessary for human inspection. These checks do **not** declare complete whole-screen visual, overflow or breakpoint continuity acceptance; responsive task ownership remains CR02/CR03/CR05 work.

The HTML uses the same Google Fonts URL as `apps/client/index.html`, retaining Inter, Merriweather and Playfair Display. Every visual case attaches declared family, `document.fonts` face/status entries and font checks. A successful `document.fonts.check` without a loaded matching face is **not** evidence that the requested font rendered. Network-unavailable font captures must be reported as fallback captures, not branded visual acceptance.

Console diagnostics and captured request payload/pending-state evidence are attached. Uncaught renderer errors and missing Radix title/description warnings fail the tests. Expected service-rejection console messages remain visible in artifacts. The fixture eagerly imports its routes, so it makes no cold lazy-route performance claim. Routes outside the five listed entries are not part of this fixture and must not be counted as navigation acceptance. Browser composition events are synthetic; physical keyboard/IME, native builds, screen readers and real service idempotency still need their respective acceptance checks.
