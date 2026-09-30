# CR02 responsive post and club composers

Run from the repository root, sequentially with other Windows browser matrices:

```sh
npx tsc -p tests/playwright/tsconfig.responsive-composers.json --noEmit
npx playwright test --config tests/playwright/responsive-composers.config.ts
```

The fixture owns port **8095**, cache `node_modules/.vite/responsive-composers`, output `test-results/cr02-responsive-composers`, and JSON report `test-results/cr02-responsive-composers-summary.json`. Existing servers are not reused. Chromium, WebKit and Firefox run with one worker. The active CR02 checkpoint records completed runs; this README describes available coverage only.

## Actual production consumers

| Entry | Live task and required cases |
| --- | --- |
| `/feed` → Feed | CreatePostDialog; real rich-text editor, type/book/visibility/genre selectors and uploaded media |
| `/clubs` → BookClubs | CreateClubDialog; name, description, privacy, genres, tags, location, member limit, banner/avatar files |
| `/readers` → Readers → Book Clubs tab | Same CreateClubDialog through its second actual responsive header owner |

All three screens and their responsive headers, triggers, composers, task fields, adaptive dialogs, nested selectors/editor popovers, dirty confirmations and Back ownership remain production components. The fixture uses the real `usePosts`, `useSocialFeed`, `useBookClubs`, `useUserSearch` and retained-resource hooks. Router, AppNavigationProvider, ConfirmDialogProvider, ShellUtilitiesProvider, TooltipProvider and Toaster remain real. It does not replace a target screen with a receipt or use a primitive-only form to claim parent retention.

The continuity cases compare actual dialog, focused field/editor and file-input nodes—not only their values—while traversing 390 → 767 → 768 → 834 → 1024 → 1280 → 390. They assert native/text selection, draft/media and metadata retention. Dismissal cases exercise visible Close/Cancel, Escape, outside pointer and the synthetic native app-Back callback. Pending upload and write phases block duplicate activation and dismissal; rejected work remains retryable. Unchanged uploaded media is reused on write retry. Successful reset returns focus to the current responsive trigger.

Club cases separately defer and reject the list refresh after a confirmed creation. That read must not hold the completed task open or report the write as failed. Account changes and route replacement during upload must invalidate its later write continuation. The fixture's `navigate` control uses the real Router to test abandonment; `/fixture-destination` is an explicit test-only destination and does not count as application navigation acceptance.

## Boundary aliases and controls

`vite.config.ts` is the exact alias inventory. No alias replaces a target UI component or the target data hooks above.

- `@/services/api`, `/clubs`, `/social`, `/readers` map to `api.ts`. It reuses the CR01 deterministic read/API surface and overrides post/club reads, creation and media uploads with controlled request outcomes. No production runtime API client is imported. Controlled requests capture payloads and account identity before awaiting completion; file uploads return synthetic metadata/paths without writing storage.
- Account/network state is mutable in `data.ts` through `useSyncExternalStore`. Existing CR01/adaptive-shell/shell-scroll fixture data supplies unrelated books, profile, themes, rewards, notifications, timer, sync and other device/service boundaries. Book selection uses the established deterministic collection (`Reading collection 1`, ID `fixture-book-0`). These aliases do not prove real account persistence, collection storage or offline sync behavior.
- Capacitor imports reuse `back-ownership/adapters.ts`. `runtime=android` invokes the real application coordinator through a synthetic callback. This is emulated app Back, not Android hardware/IME or system gesture validation.

`window.responsiveComposers` exposes configure/settle/snapshot, account/network changes, real Router navigation and synthetic Back. Upload/write/read operations can resolve, reject or defer without arbitrary sleeps. The browser waits for React readiness and observable pending state before checking outcomes. Each test has an isolated context. Existing CR01 read assets outside the target creation flows are not additional acceptance claims.

## Visual evidence and limits

Screenshot cases render all three actual creation entries at 320×844, tablet 834×1112 at both default and 200% root text, 390×844 with 200% root text, and short 390×480. They check writing width, scrollable access to all action buttons, full viewport clearance and multiple pointer hit points before capturing writing and actions separately. Human screenshot review remains required; geometry assertions are not visual-design approval.

The additional 834×1112/200% tablet-touch profile uses the established `matchMedia` capability shim and requires sheet presentation for all three actual tasks. Other tablet profiles retain fine-pointer center presentation. This is explicit coarse-pointer emulation, separate from the synthetic Android Back callback, not physical-device verification. Every visual profile checks that the dialog has no horizontal overflow. Two post selector regressions use real wheel input and pointer hit tests to reach both first and last genre choices at 390/200% and short height; one-shot DOM scrolling can be repositioned by Radix when a scroll button first mounts.

The HTML uses the production Google Fonts URL for Inter, Merriweather and Playfair Display. Each visual case explicitly loads all three families and requires returned declared faces with `loaded` status; it also records the body family and the full face/status list. `document.fonts.check` alone does not establish this. Screenshots are saved as PNG files and attached by path for direct inspection.

Radix Select intentionally closes its menu on a window resize. The nested-layer case asserts that only the selector closes, preserving the parent task and selected value, then reopens it at the new size to check emulated app Back. The rich-text link popover keeps its own node and draft across a header replacement.

Console diagnostics and controlled request payloads are attached. Uncaught renderer errors and missing dialog names/descriptions fail checks. Expected service-rejection diagnostics remain in artifacts. Fixtures eagerly import routes, so they establish no cold-route performance result. Real backend idempotency, storage, native apps, physical keyboards, screen readers and operating-system gestures remain unverified.

## Initial diagnostic run

`cr02-smoke-1` passed all three Chromium continuity cases. `cr02-full-1` was intentionally interrupted after its first measured product failure at tablet 200% text and before the JSON reporter flushed. The last captured console block proves 21 completed Chromium cases: 16 passed and five failed. Three dirty-dismissal cases completed their behavioral assertions but reported missing Radix dialog descriptions; one nested-selector case assumed the menu stayed open through resize; one visual case measured the post editor's excessively narrow column. Failure directories retain traces, screenshots and error contexts. Later tests may have started or completed before interruption, so these are observed counts, not a complete run result. Subsequent runs use distinct output/JSON paths plus a console log.

`cr02-visual-1` finished with three passed and two failed profiles: genre options were outside the viewport at 390/200% and short height. `cr02-visual-2` finished with seven failures: the new horizontal-overflow assertion exposed five club profiles, and two new endpoint cases exposed the one-shot DOM-scroll test assumption described above. After source corrections and real wheel coverage, `cr02-visual-3` passed all eight Chromium geometry cases, including the added coarse-tablet profile. Every diagnostic output remains separate. The active checkpoint owns the final full-matrix result; these diagnostic failures must not be omitted from its evidence history.

`cr02-full-2` completed with 76 passed and two Firefox endpoint failures. The unchanged Firefox retry reproduced both failures (`cr02-endpoint-unchanged`: zero passed, two failed): default polling supplied only seven wheel inputs before its five-second timeout, leaving a correctly scrolling list midway. Bounded 100 ms observable polling over ten seconds supplies continued real input. In `cr02-endpoint-final`, Firefox needed 15 inputs each way at large text and 12 each way at short height to reach the actual endpoints. All endpoint viewport, three-point pointer and activation assertions remain intact.

`cr02-endpoint-final` passed all nine cases: both endpoint scenarios and the short-height visual scenario on all three engines. It also verifies the submit button again after the final scroll immediately before each action screenshot; this corrects earlier capture timing that could show a clipped button after preceding checks passed. Corrected short-height PNGs retain their own run output. This is split evidence, not a claim that the original 78-case run passed unchanged. The full current run ledger and shared-consumer regression results live in [checkpoint 22](../../../docs/frontend-renewal/22-responsive-composers.md).
