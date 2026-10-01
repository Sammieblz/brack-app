# CR06a - Social destination semantics

Status: Implemented and browser-verified within the scope below; stopped for user review, uncommitted. Baseline `a610871` commits CR05 and the worktree was clean at startup. No staging/commit requested or performed. Remaining CR06 children and main-ticket acceptance stay open.

Scope: RC-03 under F02/F14. Actual Readers profile entries; PostCard author/book/club destinations in Feed/PostDetail/UserProfile; ReviewCard destinations in Reviews/BookDetail/ReviewDetail; ReviewDetail author/book/recovery controls; BookClubCard public/member/private-preview states in BookClubs/Readers. Preserve independent follow, reaction, comment, spoiler, menu and membership controls. Do not nest interactive rich-text links inside a card link.

The previous checkpoint's suggested RS05/06/07/08 mapping was too broad: those IDs concern signed-out recovery, unavailable clubs, medium Library labels and onboarding Back. They remain separate CR06 children. This pass does not claim their completion or whole F14 composition.

Graphify startup query found 284 nodes and displayed 48; source/consumer reads supplement the truncated graph. Generated Readers Obsidian note read. Baseline source confirmed the clickable Readers div, imperative destination buttons and nonsemantic review avatars. Club preview restrictions remain intact.

Verification used a dedicated actual-screen fixture, expected baseline failures, Router link semantics, keyboard/modifier activation, independent actions, private previews, real route arrivals and phone/tablet/large-text geometry. Fonts/themes/Iconoir, services and existing task ownership are preserved. Native/AT acceptance remains distinct from browser evidence.

## Source and consumer dispositions

| Owner | Actual callers and completed behavior |
| --- | --- |
| Readers internal ReaderCard | `/readers`: avatar and name have independent, named profile links. Follow remains a sibling action. No click handler on the containing card. |
| PostCard | Feed, PostDetail and UserProfile Posts tab: author, primary title and book/club attachments expose canonical hrefs. Comments remain an in-place disclosure with its retained editor; More retains its action sheet. Rich body/media are not wrapped in the title link. |
| ReviewCard | Reviews compact preview, BookDetail noncompact Reviews tab, ReviewDetail related cards: separate author/avatar, review title/book header, comments and owned-copy/catalog links. A titleless review has a visible Read review destination. Rich text can retain its own links; spoiler disclosure stays a button. Reviews deliberately uses plain compact previews. |
| ReviewDetail | Author/avatar and owned-copy/catalog destinations; unavailable-review exit to Reviews. Existing save/delete/share/comment services and route keys stay intact. |
| BookClubCard | BookClubs and Readers My Clubs/Discover: banner/avatar/title/View Club expose links only when the existing `!preview_only || isMember` rule allows opening. Preview-only nonmembers retain static information and membership actions. |
| Reviews adjacent destinations | Trending reviewed books and the empty-library picker use catalog links. The query is preserved; modified activation leaves the source picker and its search intact. Picking an existing library book is still a local action. |

The fixture mounts nine actual screens and production FeatureGate at the same social route entries as App. Auth, reads/writes, connectivity, local repositories, native plugins and unrelated shell data are controlled. Actual profile/book/club/review destination rendering is asserted. Catalog and Dashboard are explicit outside-fixture receipts: their URLs/redirects are checked, not their UI. No live backend writes occur.

## Diagnostic history (retain at closeout)

- `cr06-baseline-1` and `-2`: fixture bootstrap failures from missing read/local/native exports. These are not product baselines. Corrected the explicit fixture boundary before source implementation.
- `cr06-baseline-3`: two expected product failures after actual screens rendered: Readers lacked a native profile link; ReviewDetail avatar lacked a named link.
- `cr06-smoke-1`: two repaired cases passed. Initial fixture types caught an invalid `rich_text` value; corrected to the actual `tiptap` union value.
- `cr06-chromium-1`: 8/16 passed. Seven failures were incorrect fixture/assertion assumptions (real Comment label, Book Clubs tab label, UserProfile raw relation fields, compact review plain text, and BookDetail connectivity). The eighth exposed a real 320px/200% club title squeezed beside a rem-sized avatar. Fixed by capping image dimensions and wrapping the intro according to available space.
- `cr06-chromium-2`: 16/16 passed. Visual inspection then found the fixture had not loaded the production font stylesheet and had a nonexistent image URL. These captures are diagnostics, not final typography evidence. Corrected both and require loaded Inter/Merriweather/Playfair Display faces in each visual scenario.
- The first three-engine matrix additionally exposed an unavailable-review exit hidden by the existing error branch, plus WebKit keyboard traversal requiring investigation. Actual-font visual inspection exposed a remaining fragmented Readers name at 320px/200% despite passing bounding-box checks. A geometry pass alone is not a readability review.

`cr06-matrix-1` passed 56/60: three failures were the same missing error-branch recovery link and one was Windows WebKit link traversal. `cr06-correction-1` passed 2/3 after the recovery/reflow fixes; Alt+Tab still skipped every link in WebKit. A minimal plain-HTML reproduction, with no Brack code, confirmed Windows WebKit 26.6 skips anchors using both Tab and Alt+Tab. It activates a focused anchor with Enter and opens a new page on Ctrl-click, but not middle-click. Preserve the two environment limitations explicitly; do not add unnecessary tabindex attributes to production links or replace real traversal with programmatic focus and call it a traversal pass. Chromium/Firefox retain real Tab traversal; Enter/Ctrl-click are separately tested in all three engines.

Keyboard reference: [Apple Safari shortcuts](https://support.apple.com/en-gb/guide/safari/cpsh003/mac), retrieved 2026-10-01, documents Option-Tab link traversal and the user setting. That guidance did **not** fix the Windows build. The installed Playwright version is 1.63.0; its [tagged focus tests](https://raw.githubusercontent.com/microsoft/playwright/v1.63.0/tests/page/page-focus.spec.ts) exercise the Option-Tab behavior specifically on macOS. These sources do not establish native Safari acceptance for this Windows run.

## Final verification

| Check | Result and boundary |
| --- | --- |
| Browser matrix | **67 distinct passing cases, two documented Windows WebKit skips** across 23 scenarios/three engines. `cr06-final` passed 64/66 with one traversal skip and one combined activation failure (middle-click). Splitting activation from the demonstrated platform limitation produced `cr06-keyboard-final`: 7/9 passes, two skips. These replace the prior combined/keyboard cases; do not add overlapping totals or call this a clean69-case rerun. No application source changed between those two reports. |
| Meaningful regressions | **32/32 across three files**, final `cr06-unit-final-summary.json`: navigation recovery, social loading and live CommentThread ownership. Earlier32-test results overlap this rerun. |
| Static validation | Client app/node types, fixture types and changed-file ESLint passed with no warnings; final browser-spec split was separately type/lint checked. |
| Production integration | Client build exits0 in 29.26s, 124 PWA precache entries. Existing tooling-age, ambiguous-easing, mixed-import and bundle-size warnings remain. |
| Visual evidence | Five profiles:390×844,320×740/200% text,834×1112/200%,1280×900 and834×1112 dark. Actual Readers/BookClubs/Reviews/Feed. Full clipping-ancestor containment and three-point hit testing of each primary destination and author link; author target dimensions at least 44px. Real loaded font faces verified. These checks do not establish whole-screen accessibility. |

[Evidence index](evidence/cr06-social-destinations/README.md) retains 35 final Chromium captures and two diagnostic captures. The [verification manifest](evidence/cr06-social-destinations/verification.json) contains exact reports/hashes, 69 final case dispositions,60 loaded-font records,15 source/fixture hashes and the plain-HTML WebKit reproduction results. Complete original failure traces and logs remain in ignored `test-results/cr06-*`.

Executed commands (PowerShell, root unless noted):

```powershell
$env:CR06_RUN='cr06-final'
npx playwright test --config tests/playwright/social-destinations.config.ts
$env:CR06_RUN='cr06-keyboard-final'
npx playwright test --config tests/playwright/social-destinations.config.ts --grep 'keyboard traversal|Enter and Ctrl|middle-click'
npm run check-types --workspace @brack/client
npx tsc --noEmit -p tests/playwright/tsconfig.social-destinations.json
# From apps/client:
npx vitest run src/screens/navigation-recovery.test.tsx src/screens/social-loading.test.tsx src/components/social/CommentThread.test.tsx --reporter=default --reporter=json --outputFile=../../test-results/cr06-unit-final-summary.json
npm run build
```

## Local graph and Obsidian closeout

Ran local `graphify update .`, `cluster-only . --no-label --no-viz`, `export obsidian`, `export html`, and the maintained source census after implementation; refreshed again after the browser-test split. Final graph: **10,189 nodes, 22,718 edges, 687 communities and 10,876 exported Obsidian notes**. Final bounded query found 284 nodes and displayed 37 at the 1,200-token budget. Read back the generated ReviewCard source note and its BookDetail relationship; source/caller tests remain the coverage evidence.

The first update was blocked by sandbox subprocess access (WinError5); the same local-only command succeeded with escalation. Three existing Android Gradle parser warnings remain. The first export preserved four pre-existing conflicting notes; no forced overwrite was requested. No model labeling, cloud extraction, live database inspection, hook or watcher was enabled. `graphify watch` in its console is the one-shot update logger, not a newly installed watcher. The final census reports 39 route declarations, 511 modules, 310 presentation modules, 33 screens and 273 components; those inventory counts are not acceptance counts. Logs use `test-results/cr06-graph-*-close.log`, `cr06-obsidian-export-close.log` and `cr06-census-close.log`.

## Handoff and stop

No stage or commit was made. The next authorized continuation should recheck HEAD/worktree and start **CR06b: signed-out list/goals recovery, unavailable club Back, and medium Library action names (RS05/06/07)**. These can be one bounded child if all actual route/state consumers finish: `/lists`, `/book-lists`, `/goals-management`, unavailable `/clubs/:clubId` and MyBooks834px header. Preserve auth return intent/service ownership; reproduce loading, anonymous/session-loss,401/403/404/network branches and real recovery before marking them repaired. Header utility hosting, onboarding chapter Back, Dashboard loading Menu, route focus/scroll and remaining page gestures stay separate. CR07–CR10 and F10–F19 still own the remaining overlays, feedback, loading, visual/native/AT work.

## Explicit remaining work

This is a destination contract repair, not F14 visual acceptance. Dense screen summaries/filters, oversized large-text headers, global floating utility placement, theme contrast, whole-page Readers/UserProfile swipes, action feedback/pending rules, share/report labeling, and screen composition retain their existing CR06–CR10/F14 owners. Do not claim accessibility conformance, native gesture behavior, performance improvements, or backend permission enforcement from this fixture. Native devices, real screen readers and actual service behavior remain unverified.

Specific source/visual debt retained: UserProfile still passes an existing no-op PostCard Like callback; this checkpoint verifies that its action does not navigate, not that it persists a reaction. ReviewCard's numeric-only Like label, PostCard's share count label/report feedback, low-contrast light-theme avatar initials, and large-text floating Scroll-to-top overlap with unrelated content need their owning F14/CR08/CR10 passes. Primary destination/author link checks scroll each target fully into the usable area and hit-test it; screenshots show surrounding clipped content and must not be presented as whole-screen large-text acceptance.

The next child should close the concrete CR06 signed-out/unavailable/recovery branches from `coverage-review/03-route-shell-consumers.md`, before returning to the remaining overlays/feedback/loading work. RS05/06/07/08 were not satisfied by changing the links in this checkpoint.
