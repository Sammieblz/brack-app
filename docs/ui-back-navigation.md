# App Back ownership

Current F07 implementation; [checkpoint and actual checks](frontend-renewal/17-back-ownership.md). Browser history, native operating-system behavior and app-controlled Back are separate contracts.

## Owner and resolution

`AppNavigationProvider` sits inside the existing BrowserRouter and receives resolved account scope from App. `useAppBack`, visible `AppBackButton` controls and the single Android App plugin subscription use this coordinator. Browser Back/Forward are observed and never intercepted. No new routing package or keyboard plugin is installed.

One request resolves in this order:

1. Ask a registered active overlay to process its existing Escape behavior. Radix/Vaul choose the top layer and retain focus/dismissal ownership. A refused close or an in-progress exit consumes Back; the route must not also pop.
2. Ignore a duplicate request while confirmation or navigation is unresolved. Invalidate pending confirmations on route/account changes or unmount.
3. Run the current route's highest-priority guard (latest registration wins ties). A guard may exit a mode, refuse a pending operation, or await explicit discard confirmation.
4. Honor an explicit callback or destination. Otherwise pop one verified internal predecessor, or replace the unowned entry with its contextual fallback. Explicit destinations retain push semantics.

Android uses the last visible, connected, enabled AppBackButton's current action. Without a visible detail control, Back at a primary root/auth boundary minimizes the app rather than traversing primary destinations. This is source/unit/fixture verified, not physical Android acceptance. iOS retains system-owned edges; this change does not create an iOS navigation stack or promise native swipe-back.

The plugin adapter subscribes only to `App.addListener('backButton')`, not the duplicate DOM event. Late listener resolution and disposal are guarded. It does not infer usable app history from WebView `canGoBack`. Hardware IME consumption and predictive Back require device checks.

## Proven ancestry and recovery

`lib/appHistory.ts` stores at most 128 observed contiguous entries in per-tab sessionStorage (`brack.navigation.ancestry.v1`): version, resolved reader scope, router key/index and predecessor key. It stores no URL, query, history payload, token or draft. Storage failure preserves usable in-memory tracking.

Positive router `idx`, non-default key and browser history length are insufficient. Activation rechecks live browser key/index against the observed route. Unknown entries, gaps, malformed storage, account changes and auth/onboarding boundaries reset ancestry; a matched reload can restore it. Auth loading defers normal-route observation but still clears a known auth boundary. PUSH, REPLACE, browser POP and forward-branch replacement are covered by focused tests.

`config/routeBack.ts` supplies presentation-only root/task/boundary metadata and fallback parents. Matching follows Router's case-insensitive fixed paths while preserving encoded entity IDs. Route authorization and feature gates remain in App/FeatureGate. Outside the provider, useAppBack safely honors explicit actions or replaces with its fallback; it never guesses a predecessor.

## Tasks and overlays

- Add Book protects nonempty manual/scanned form values and consumes Back during a pending add.
- Edit Book protects changed book fields, invalid date input and pending save/image upload. Its Cancel button uses the same discard guard. The unrelated rendering blocker discovered in this path was repaired with a nonempty `none` Select sentinel mapped to a null rating.
- Library Back exits selection/reorder mode before navigation. Pending removal consumes departure; its active confirmation and nested membership tasks retain the first overlay request. Mode guards use priority 100; task guards use the default priority. [Library/list ownership](ui-library-list-tasks.md) records the CR04 pending, partial-result and focus contracts.
- Existing journal pending/dirty guards remain owners of journal closure. Confirmation dismissal resolves to Keep editing; discarded route changes invalidate old asynchronous responses.
- Shared Dialog, AlertDialog, Sheet, Drawer, Popover, Select, menu variants and their direct primitive consumers register content with `useBackLayer`. A new custom overlay must register its actual dismissable content, not infer membership from arbitrary roles or z-index.
- F08 Goals uses one controlled adaptive Dialog with a visible Close button and a stable Dashboard parent. The obsolete dismissable wrappers and disconnected delayed pull hook remain removed. No drag handle is implied; [adaptive surfaces](ui-adaptive-overlays.md) preserve the same Back registration and primitive Escape policy.

These guards cover app/native Back, not every link, browser reload or browser Back. They do not add persistence for every form. Timer state remains in its existing provider; the new synthetic fixture checks only that its representative timer/draft state survives navigation.

## Touch and regression boundaries

Duplicate document edge recognizers and delayed swipe navigation were removed. Horizontal overscroll on html/body/root is browser-default `auto`; app scroll CSS permits `pan-y pinch-zoom`. Local row/refresh interactions follow [local gesture ownership](ui-local-gestures.md); ordinary visible controls remain available. Computed CSS is not physical gesture acceptance. Do not add a global touch-action restriction or synthetic edge recognizer without a verified platform contract.

Use the [Back fixture](../tests/fixtures/back-ownership/README.md), real Add Book browser cases, real Edit Book form integration tests and existing overlay/Library/shell regressions. Synthetic native callbacks prove coordinator policy only. Native tab stacks, shell scroll/focus restoration, physical keyboard/gesture behavior and real assistive technology remain later/device acceptance work.
