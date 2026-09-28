# Action feedback fixture (F04)

Local synthetic fixture for real AddBook, BookSearch, mobile inputs, loading feedback, haptic hook, ContextMenuNative, ActionSheet and Dialog. It does not access a real reader, database, search provider or native device.

F07 adds the real AppNavigationProvider/ConfirmDialogProvider and two Add Book Back cases per engine: dirty keep/discard, and pending/rejected-write retention. The low-level App plugin is a fixture adapter; dedicated [Back ownership](../back-ownership/README.md) exercises synthetic native callbacks. This server uses its own Vite optimizer cache to avoid cross-fixture module invalidation.

```powershell
npx playwright test --config tests/playwright/action-feedback.config.ts
npx tsc -p tests/playwright/tsconfig.action-feedback.json --noEmit
npx eslint tests/playwright/action-feedback.config.ts tests/e2e/action-feedback.spec.ts tests/fixtures/action-feedback --max-warnings=0
```

The configuration starts a fresh Vite server at `127.0.0.1:8088`, runs Chromium/WebKit/Firefox with two workers, and blocks non-local requests and service workers. Twenty scenarios per browser cover 80/180/700/4500ms deferred completion without a success delay, draft/error/retry/duplicate behavior, search quick-add, leaving a pending save, native semantic selection, disabled/missing haptics, one long-press feedback owner, contact cancellation, subsequent clicks, keyboard actions/focus and native link/input ownership. Compact 390px, tablet-width 834px and wide 1280px windows are used where relevant. These are browser windows, not physical devices.

Time-dependent cases install the Playwright clock before page load and pause it before the interaction. Destination assertions occur after the controlled create resolves without advancing a post-success timer. Only after navigation is proved does the test advance Sonner's rendering timers. Gesture tests use explicit PointerEvents with pointer IDs; they do not simulate OS edge gestures, hardware haptic sensation or native text-selection arbitration. The default reduced-motion mode exercises functional access with reduced effects; it does not certify every animation in the app.

The fixture mocks authentication, book/search data, the local create adapter, reading profile, scanner, shell wrappers and Capacitor device adapters. The canonical platform/environment services, legacy width/platform hooks and actual UI controls are real. Unexercised Browser/AppLauncher operations throw at their synthetic boundary. Library destination screens are route markers with the returned highlight identity. Production local persistence and scanner flows are tested separately.

For manual inspection run `npx vite --config tests/fixtures/action-feedback/vite.config.ts`, then open `/add-book?isbn=9780140328721`, `/add-book?search=fixture`, or `/gestures?runtime=ios`. Optional `runtime=android`, `haptics=off`, `plugin=off`, and `duplicate=1` initialize synthetic states. `window.actionFixture.snapshot()` reports creates, pending requests and plugin calls; `resolveCreate()`/`rejectCreate()` settle the pending create; `clearHaptics()` clears the adapter log. Those methods do not represent backend behavior.

JSON results: `tests/playwright/test-results/action-feedback-report.json`. Failure artifacts: `test-results/action-feedback`. Screenshots are disabled; interaction tests do not imply visual approval. Do not run a suite that clears the parent artifact folder concurrently. [Checkpoint 15](../../../docs/frontend-renewal/15-feedback-environment-batch.md) owns actual final results, known limitations and the review stop.
