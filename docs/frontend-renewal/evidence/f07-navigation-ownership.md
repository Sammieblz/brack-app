# F07 navigation ownership: implementation evidence

Reviewed on **2026-09-28** against baseline `f90509d` and the F07 working tree. This evidence records source inspection and focused tests. The owning F07 checkpoint records the final combined Playwright run, build, and review stop; this document does not certify physical native behavior.

## Installed contracts and official references

| Package | Installed version | Evidence used |
| --- | --- | --- |
| React | 18.3.1 | Local package metadata |
| react-router-dom / react-router | 6.30.4 / 6.30.4 | Local package metadata and BrowserRouter implementation |
| @remix-run/router | 1.23.3 | `node_modules/@remix-run/router/dist/router.js`, `getUrlBasedHistory`, `push`, `replace`, `handlePop` |
| @capacitor/core | 7.4.4 | Local package metadata |
| @capacitor/app | 7.1.0 | Local type definitions and packaged Android `AppPlugin.java` |
| @capacitor/keyboard | Not installed | Local package resolution; no dependency added for F07 |

Official references retrieved on 2026-09-28:

- [React Router 6.30.1 useNavigationType](https://reactrouter.com/6.30.1/hooks/use-navigation-type): POP, PUSH and REPLACE describe the current navigation action. The versioned documentation is 6.30.1; exact index behavior was verified against installed 6.30.4 / router 1.23.3 source, not inferred from newer Router versions.
- [React Router 6.30.1 useNavigate](https://reactrouter.com/6.30.1/hooks/use-navigate): route targets and numeric history navigation have distinct signatures; replacement navigation replaces the current entry.
- [React Router 6.30.1 Route](https://reactrouter.com/6.30.1/route/route#casesensitive): case sensitivity is a route matching option. Installed matching defaults to case-insensitive, so Back metadata must recognize equivalent case variants while retaining identifier bytes.
- [Capacitor v7 App API](https://capacitorjs.com/docs/v7/apis/app): Android `backButton` listeners assume Back handling; `canGoBack` describes WebView history, not app-owned ancestry. `minimizeApp()` is Android-only; `exitApp()` forcibly exits. Listener registration returns an asynchronous removable handle. Runtime back-handler toggling was added in 7.1.0.
- [Capacitor v7 Keyboard API](https://capacitorjs.com/docs/v7/apis/keyboard): keyboard visibility events and hide operations belong to a separate plugin. They are not made available by installing App or observing a focused input.

Packaged App 7.1.0 Android source additionally confirms that one native press emits both the plugin `backButton` event and a DOM `backbutton` event when a plugin listener exists. The application subscribes to only the plugin event. `minimizeApp` calls Android `moveTaskToBack(true)`; it is the chosen root policy, preserving the process/task when the OS allows it. This is a product policy supported by a source-verified API, not a claim that every Android task transition has been device-tested.

## Verified ancestry implementation

The previous positive-index check did not prove ownership: Router initializes a missing index to zero, increments it for PUSH and retains it for REPLACE, but an existing positive value may belong to an unobserved entry. F07 uses `apps/client/src/lib/appHistory.ts` and a single `AppNavigationProvider` instead.

The tracker stores one contiguous branch of at most **128** records in tab-scoped session storage under `brack.navigation.ancestry.v1`. Each entry has only `key`, `index`, and `predecessor`; the envelope adds schema version and account scope. It stores no URL, query, form draft, application history state, callback credential, or token. This ledger determines navigation behavior; it is not an authorization or security boundary.

The provider matches the live browser history key to React Router's location key before observing and again before Back activation. An arbitrary positive index, direct entry, mismatched key, unknown POP, index gap, invalid record, or corrupted storage does not establish a predecessor. A recovery destination replaces the unowned entry to avoid manufacturing a Back loop. Explicit destination/callback behavior remains intentional application behavior.

An adjacent observed PUSH links to the active entry and drops the previous forward branch. A REPLACE preserves the predecessor and rewrites a retained forward entry's link to the replacement key. Known Back/Forward POPs preserve the branch. Reload restores only a matching stored key/index/account after initial observation; blocked storage leaves an in-memory tracker, so unverified reload falls back safely. Repeated observations do not create duplicate entries.

Resolved anonymous scope is `null`; unresolved authentication is `undefined` and defers normal-route observation. An auth/onboarding boundary resets ancestry immediately even while authentication is loading; normal reload preserves its ledger until the scope is known. Changing accounts also resets ancestry. Cleanup removes only this module's storage key. Removed storage or failed persistence never clears unrelated application preferences or reading data.

## One Back owner and asynchronous cancellation

The provider consults registered overlay ownership first. A surface refusing dismissal still consumes Back; route navigation must not happen underneath it. Next, the active task's highest-priority guard may approve or refuse the action. AddBook/EditBook use this mechanism for pending work and unsaved edits; it is not a blanket browser navigation blocker.

Each confirmation is associated with the current route/account identity and a request generation. A newer route, account/loading state, or unmount invalidates old work. A pending old confirmation cannot block Back on a new route, clear a newer request's busy state, or invoke a stale callback. Rapid route Back requests remain locked until a location change.

The native subscription is stable across route changes and invokes the latest coordinator callback. Disposal is idempotent; an asynchronously arriving listener handle is removed even after unmount. Registration/removal failures are caught, and cleanup never invokes `App.removeAllListeners()`. A visible, connected, enabled Back control contributes its existing action to native Back. At a root without such a task action, Android backgrounds the app.

Browser history navigation is observed, not intercepted or replaced with synthetic overlay entries. iOS/browser system edge gestures remain owned by the platform. Native Back, visible app Back, ordinary Escape dismissal, browser Back/Forward, and route links are separate inputs with stated ownership.

## Focused validation and discovered defects

Tests use actual BrowserRouter for coordinator history behavior. A separate MemoryRouter negative test establishes that memory routing does not prove browser ancestry. App/bridge calls are mocked in native service tests; these validate JS ownership and cleanup, not Java/Kotlin or OS execution.

| Test file | Status in this evidence |
| --- | --- |
| `apps/client/src/lib/appHistory.test.ts` | 28 passing: adjacent ancestry, POP/Forward, REPLACE, forward truncation, reload, account boundaries, invalid/corrupt/blocked storage, activation identity, bounded minimal persistence |
| `apps/client/src/services/nativeBack.test.ts` | 9 passing: Android-only ownership, no duplicate DOM event, ordinary/late/idempotent cleanup, bridge rejection, root minimize request |
| `apps/client/src/contexts/AppNavigationProvider.test.tsx` | 20 passing: BrowserRouter identity, direct/reload recovery, async task priority/refusal/cancellation, loading/account transitions, auth callback while loading, rapid Back and stable native ownership |
| `apps/client/src/config/routeBack.test.ts` | 3 passing: case-insensitive auth/task matching, encoded book identity, aliases and known/unknown route recovery |
| `apps/client/src/screens/EditBook.back.test.tsx` | 4 passing: Keep editing retains fields, confirmed discard reaches the book, pending/rejected save retains the draft, clean Cancel remains immediate |

The final combined five-file command passed **64/64** tests on 2026-09-28 in 33.69 seconds, including the provider cancellation cleanup and nullable-rating assertion:

```powershell
npm run test --workspace @brack/client -- src/lib/appHistory.test.ts src/services/nativeBack.test.ts src/contexts/AppNavigationProvider.test.tsx src/config/routeBack.test.ts src/screens/EditBook.back.test.tsx
```

The four EditBook tests also passed independently after adding the nullable-rating persistence assertion. Scoped ESLint over the tracker, native service, provider, and these tests passed with zero warnings. Test output includes existing Vite transformation-option deprecation and stale browser-data notices; no dependencies were updated to silence them. See the F07 checkpoint for final broader verification after integration.

The editor tests keep the actual EditBook form, Back hooks, coordinator, Router, confirmation provider and Radix dialog/select controls. Only local resource/service results, authentication, image acquisition, haptics and outer shell are synthetic. The first run discovered that the existing `SelectItem value=""` for “No rating” crashes Radix during initial rendering; hiding that failure with a mocked Select would not validate the editor. The F07 repair uses a nonempty presentation sentinel mapped back to the existing nullable rating model.

## Limits and required device checks

- jsdom and Playwright runtime fixtures cannot prove Android hardware/predictive Back, native keyboard consumption, iOS interactive pop, WebView task backgrounding, or VoiceOver/TalkBack behavior.
- No Keyboard plugin was installed. The application does not claim that focused inputs or visual viewport shrink reliably identify an open software keyboard. Verify Android IME Back followed by app Back on devices; a real keyboard adapter would need its own native integration and tests.
- Browser-owned Back/Forward is not subjected to the app's unsaved-edit confirmation. A universal navigation blocker or durable cross-reload drafts is separate work; avoid claiming protection for gestures or inputs that are not app-owned.
- App 7.1.0's plugin event handler is not an implementation of Android's predictive Back animation contract. No app-drawn edge gesture or replacement router stack was introduced.
- Confirm device sequences for keyboard → top overlay → nested overlay → selection/draft guard → detail ancestry → root backgrounding; include rapid presses, rotation, interrupted callbacks, reload/deep links and account changes. Preserve explicit controls for all actions.
