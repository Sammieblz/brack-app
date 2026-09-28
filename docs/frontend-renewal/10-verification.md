# Verification and release acceptance

This is the future implementation test plan. The current documentation pass inspected source and the limited [Library fixture](evidence/README.md); it did not run the application regression suite, conduct native QA, or establish accessibility conformance. Record actual commands, environments and outcomes during implementation.

## Risk-based coverage

Use pairwise combinations for routine visual checks, then deliberately test dangerous intersections: small window + large text + keyboard; native edge gesture + open dirty sheet; offline save + background/resume; touch reorder + scroll; long translation + bottom nav; reduced motion + delayed success; theme glass/comic + forced colors; account switch + cached content. Do not claim exhaustive testing merely because a viewport list is long.

| Environment | Representative coverage | Required behavior |
| --- | --- | --- |
| Small browser window | 320×568 CSS px; 360×640; portrait/landscape | Reflow, no body overflow, reachable actions, browser navigation, visible focus |
| Modern phone browser | Around 390×844 and 430×932; Safari/Chrome on actual hardware | Address/bottom toolbar expanded/collapsed, keyboard, history, pinch zoom, destination discoverability |
| Native iPhone | Small supported phone and a current larger phone; actual supported OS floor + current supported OS | Safe areas, VoiceOver, system back/edge behavior, keyboard, haptics, permissions, lifecycle |
| Native Android | Representative slower device and contemporary device; gesture nav and three-button nav | Back handling, TalkBack, edge-to-edge insets, keyboard, performance, denied permissions |
| iPad | Around 768/834/1024px windows plus split window and landscape | Native and browser/PWA; external keyboard/trackpad; large text; floating/split keyboard where available |
| Android tablet/foldable | Medium/wide tablet, cover/unfolded windows; multitasking resize | Touch-first layout, pane collapse, hinge fallback, no state loss on fold/rotation |
| Installed PWA | iOS/iPadOS and Android where supported | Standalone presentation, web capabilities/auth URLs, offline launch, update/restart behavior |
| Desktop browsers | Chrome/Edge, Firefox, Safari within support policy; 1280–1920px | Keyboard, browser zoom, links/new tabs, pointer menus, wide but readable layout |
| Electron | Supported Windows/macOS/Linux representative package matrix | Bridge-based detection, keyboard/focus, window resize, deep links, native menu/browser return |

At F00, record actual support-floor OS/browser versions from the project build configuration and product policy. These examples are viewport probes, not model detection rules or a promise to support every OS version. CSS emulation does not validate OS gestures, browser chrome, safe-area values, native permissions, accessibility settings, or hardware frame pacing.

## Required scenario fixtures

| Dataset/state | Why it matters |
| --- | --- |
| No books / first book / returning reader | Empty state, onboarding exit, first-success timing |
| 1, 30, 500+ books with mixed covers/title lengths | Density, identity, long-list performance, filter/reorder behavior |
| Active session, paused session, resumed app | Timer preservation and persistent affordance placement |
| Offline with cached data / no cached data / reconnect | Honest state and local-first capture |
| Delayed query, failed query, stale successful data | Skeleton ownership and retained content |
| Failed mutation, retry, duplicate submit, conflict | Draft preservation, idempotence, recovery |
| Social enabled/disabled; different club roles | Navigation visibility and permission-safe actions |
| Pending/confirmed/provisional rewards | No fabricated balances or repeated celebrations |
| Long labels, locale date formats, historical birth date | Reflow, date correctness, input ambiguity |
| Real text and media alternatives | Rich editor/output semantics, image descriptions, captions if media exists |
| Account sign-out/switch | No previous-account content/draft leakage; device preferences remain sensible |

Use synthetic data, supported test services and existing fixture aliases. Do not bypass authorization checks merely to reveal an administrative surface. A test account and explicit role fixtures should exercise UI permissions without changing production roles.

## Existing commands and when to use them

Commands are verified against the baseline root `package.json`. Recheck when package scripts change. Run from repo root with the canonical npm toolchain; use existing installed dependencies or the normal development setup.

| Change | Existing command | What it does / limitation |
| --- | --- | --- |
| General client type correctness | `npm run check-types` | Workspace type checks; does not prove UX |
| Lint | `npm run lint` | Existing lint contract; record pre-existing failures separately |
| Relevant unit/component contracts | `npm --workspace @brack/client run test -- <relevant-file>` | Vitest against selected files; choose real behavioral regression cases |
| Release build | `npm run build` | Production compilation/bundling; compare actual chunk output |
| Shell geometry | `npm run test:e2e:shell:check`, then `npm run test:e2e:shell` | Existing browser fixture with mocked services; not real native chrome |
| Date/calendar changes | `npm run test:date-picker:check`, then `npm run test:date-picker` | Locale, date-only, focus/reflow fixture; OS picker requires separate native test |
| Loading and brand feedback | `npm run test:loading:check`, then `npm run test:loading` | Existing controlled loading fixture and contracts |
| Library interactions | `npm run test:library-interactions:check`, then `npm run test:library-interactions` | Selection/drag/primary-action behavior; keep non-gesture alternatives |
| Whole web workflows | `npm run test:e2e` | Inspect configured environment/account prerequisites first; do not accidentally target production |
| Desktop smoke | `npm run test:electron` | Requires prepared package/runtime; inspect config before execution |
| Native build preparation | `npm run cap:sync:ios`, `npm run cap:sync:android` | Builds/copies assets and mutates native generated output; use deliberately for implementation QA |

A documentation-only change does not warrant running every app suite. A new script must be executed and checked. After a meaningful shared primitive change, run its consumers' relevant contracts; broaden only for new failures or unresolved concerns. Compare behavior assertions, not exact class strings or arbitrary animation snapshots.

## Behavior acceptance scripts

### Q01 — Back and history

Enter book detail from Library after scrolling/filtering; open editor; change a field; Back; keep draft; save; Back to the same Library state. Repeat from a cold deep link, external origin history, notification link, and after refresh. Open a menu/sheet; press Escape or Android Back; only the top owned surface resolves. If a keyboard is open, ensure the first platform Back performs the expected keyboard action rather than popping the route too. Cancel an edge gesture midway. Rapidly repeat forward/back. There must be one owner and no duplicate pop.

### Q02 — Browser/native distinction

On the same physical phone, compare browser tab, installed PWA and Capacitor build. Browser destination navigation remains discoverable without persistent stacked bars; native app retains labeled bottom tabs in compact layout. Toolbar collapse must not move important content under chrome. PWA does not use native-only plugins or custom-scheme auth simply because its navigation looks app-like.

### Q03 — Core reading loop

Find/add a book; open it; start/pause/resume a timer; background/resume; finish with progress; optionally journal; return to Library. Repeat offline and after retry. Confirm correct book state once, understandable sync status, preserved draft, no wait imposed by animation, and reachable reading actions. Capture normal and reduced-motion recordings.

### Q04 — Touch and gesture arbitration

Scroll from within a book row, swipe a supported action, long-press then move/cancel, drag reorder, tap a nested action, open a sheet and scroll its content, pull-to-refresh only at the owned top boundary. Two-finger zoom still works outside an explicitly scoped zoom surface; image zoom has button alternatives. No unintended Back, context menu or mutation fires. Mouse/keyboard equivalents remain available.

### Q05 — Tablet/window transformation

Open Library/detail and Messages/thread in a wide window; focus an input and type; reduce to split-window/compact size; rotate/fold; expand again. The route/selection/draft/timer/scroll remain coherent. Hidden panes are not keyboard-focusable. Save stays reachable with keyboard and large text. Continuous fallback works without hinge APIs.

### Q06 — State and accessibility parity

For each changed screen: loading, retained refresh, empty, success, invalid form, network error, offline, pending mutation, disabled and permission-denied states where meaningful. Complete the task keyboard-only and with relevant screen reader; verify labels, heading order, live announcements, focus return, modal containment, list/grid navigation and charts. An empty success state cannot stand in for an error.

### Q07 — Brand and theme retention

Enumerate actual theme IDs from `lib/themes.ts`, including both light/dark modes and all special surface styles. Check logos, Inter/Merriweather/Playfair roles, Iconoir semantics, focus and text contrast, selected/disabled/error/pending distinction, image placeholders and overlay dimming. Capture actual fonts loaded and fallback/offline fonts separately. Keep screenshot tests deterministic but review real font/device output too.

### Q08 — Feedback timing and interruption

Exercise immediate success, sub-reveal-delay pending, long pending, failure, cancellation and retry. A cached route stays usable. New book/list/post feedback corresponds to the correct item and actual result. Rewards do not replay after remount/refetch; pending local save does not claim server-confirmed reward. Dismiss during animation, navigate away, change motion preference and background the app. No orphan overlay/timer/announcement remains.

## Performance measurements

[06](06-motion-gestures-performance.md) owns the candidate timing budgets: immediate feedback within 100ms and warm route usable content p95 at or below 300ms with local data, subject to baseline calibration. Measure device/browser/version, network/cache, dataset, build mode and repeat count. Separate code download, data fetch, local read, render/commit, layout/paint and animation. Measure production builds; development StrictMode and Vite timing are not release performance.

Initial protocol: at least 20 repeated warm traversals per representative core path for exploratory p95, with cold launch reported separately; use more samples/field evidence before generalizing. Include slower Android and tablet hardware. Treat JS tasks over 50ms overlapping interaction as investigation targets. Record frame timing during drag/scroll and memory after repeated route/overlay cycles. The plan does not assume a particular bundle reduction or that replacing shadcn improves speed.

Web field targets from current [Core Web Vitals guidance](https://web.dev/articles/vitals) are LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at the 75th percentile. These describe web page experience; lab traces, SPA transitions and native WebViews need their own task measures. Do not manufacture field percentiles from a handful of local fixture captures.

## Usability study

Test a small formative cohort first, including new and returning readers, phone/tablet users and participants with relevant access needs. This is issue-finding, not statistical proof of universal preference. Give goals rather than UI instructions: “Find a book you started,” “Record today's reading,” “Change the date,” “Return to the list,” “Find Messages,” “Recover your failed journal save.”

Record unassisted completion, wrong turns, backtracking, accidental actions, time to first useful content, comprehensibility of pending state, and subjective comfort. Compare the proposed browser menu to slim persistent tabs only if findability worsens; retain the best supported pattern. Accessibility blockers cannot be averaged away by high success in other participants. Obtain consent and avoid collecting reading content or disability details beyond what the study requires.

## Release checklist

- Every in-scope route/surface has reviewed normal/failure/offline/large-text behavior.
- P0/P1 correctness and accessibility blockers are closed with evidence; remaining lower-priority issues have owners.
- Physical iOS, Android and tablet tasks completed; actual supported browser/PWA/Electron checks recorded.
- Existing theme/font/icon/logo identity retained; contrast and accessible names checked for all newly affected token roles.
- Baseline/candidate performance compared under equivalent conditions; no decorative delay or runaway listener left.
- Core data, timer, draft, auth callback, route alias and feature-gate contracts preserved.
- Native permissions occur only after meaningful user action and include clear fallback.
- Documentation, dependency decision and rollback path updated; legal applicability/content review handled as in 07.

## Evidence record

For each result record: ticket; baseline/candidate commit; scenario/data; runtime/device/OS/browser; viewport/text/theme/motion; command or manual steps; expected/actual; screenshot/video/trace; pass/fail/unverified; owner/date; follow-up. Store private traces appropriately and link only sanitized artifacts from this repository. A clean test count without this context is insufficient release evidence.
