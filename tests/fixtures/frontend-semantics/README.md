# Frontend navigation, notification and writing fixture

This local fixture exercises F02/F03 with synthetic readers and service results. It runs no real account operation and writes no reader data.

F07 mounts the real AppNavigationProvider so recovery tests use observed ancestry and resolved fixture identity. The server has an independent Vite optimizer cache. Broader native callback/overlay/task coverage lives in the [Back fixture](../back-ownership/README.md).

```powershell
npx playwright test --config tests/playwright/frontend-semantics.config.ts
npx tsc -p tests/playwright/tsconfig.frontend-semantics.json --noEmit
npx eslint tests/playwright/frontend-semantics.config.ts tests/e2e/frontend-semantics.spec.ts tests/fixtures/frontend-semantics --max-warnings=0
```

Playwright starts a fresh Vite server on `127.0.0.1:8087`, blocks service workers and non-local requests, and runs Chromium, WebKit and Firefox. Twenty-one scenarios per engine cover link keyboard/modifier activation, source-tab return/reload, canonical/gated destinations, direct/in-app 404 recovery, safe Back after direct-entry tab replacement, notification states/mutations/account changes/remounts, and real rich-text labels/validation/formatting. Viewports include 390, 834 and 1280 CSS pixels; these are browser windows, not physical devices. Reduced motion is enabled; this suite makes no animation/performance claim.

The suite uses real `UserProfile`, `ReadingHistory`, `NotFound`, `useAppBack`, `FeatureGate`, `UserNotificationsPopover`, `useUserNotifications`, `ReviewForm`, TipTap, Radix primitives and TanStack Query. BrowserRouter routes match the affected production patterns, but destination screens are markers. Profile/history/review/notification data, authentication, flags, haptics and unrelated presentation wrappers are mocked. Production SDK request construction is tested separately in `services/api/userNotifications.test.ts`; the browser mock does not establish auth/RLS or real server persistence.

For manual inspection:

```powershell
npx vite --config tests/fixtures/frontend-semantics/vite.config.ts
```

Open `/history`, `/users/fixture-profile`, `/missing` or `/editors`. Query options `?anonymous=1`, `?social=off` and `?journey=off` initialize synthetic identity/feature state. The fixture route links and review opener are test controls, not new application UI.

Notification reads and writes are deliberately deferred. In browser developer tools use `window.renewalFixture`:

- `snapshot()` reports pending request counts and recorded read calls.
- `resolveNotifications()` supplies two seeded unread notifications; `resolveNotifications([])` supplies empty success; `rejectNotifications()` rejects the oldest pending fetch.
- `resolveMark()` / `rejectMark()` settle the oldest read mutation. These do not simulate server storage; a later fetch must be supplied explicitly.
- `refresh()`, `remountHeader()`, `setReader('another-fixture-reader')`, and `setFeatures({ gamificationEnabled: false })` expose deterministic lifecycle cases.
- `notificationRows()` returns a copy for custom incoming/read-refresh scenarios.

Each test starts a fresh context. The controls do not implement a complete server or cancellation transport. Keep request-order assumptions explicit in tests. Tests observe uncaught browser errors; the intentional 404 console report is not an uncaught exception.

JSON results are at `tests/playwright/test-results/frontend-semantics-report.json`; retained failure traces are under `test-results/frontend-semantics`. The dedicated artifact directory avoids cleanup collisions with other suites. Avoid starting another suite that clears the parent `test-results` directory concurrently. Screenshots are disabled; these are interaction/semantics checks, not visual approval.

Actual results and known limits belong in the [batch checkpoint](../../../docs/frontend-renewal/14-next-implementation-batch.md). Rerun the [journal fixture](../journal-save/README.md) after shared editor changes. Physical iOS/Android, browser chrome, OS keyboard/back, assistive technology, large-text/zoom and live-service integration need separate evidence.
