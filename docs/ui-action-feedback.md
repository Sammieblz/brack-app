# Action feedback and local gesture contract

Implemented renderer behavior for frontend renewal F04, based on the working-tree changes after `06d5190`. The [F04/F05 checkpoint](frontend-renewal/15-feedback-environment-batch.md) owns final batch results and review status. Browser/plugin-adapter evidence does not establish physical-device haptic, gesture or assistive-technology behavior.

## Add Book completion

`screens/AddBook.tsx` treats a resolved `bookOperations.create` as its completion boundary for manual entry and search quick-add. It immediately opens `/my-books` with the returned `highlightBookId` and announces that the book was saved on this device and will sync. It performs no second library read to decide first-book decoration, creates no blocking success overlay and schedules no delayed route change. Scanner acquisition keeps its existing separate workflow.

A shared synchronous ref prevents repeated manual/quick submissions during one mounted create. The acquisition fieldset disables fields, tab changes and search-result actions while pending, so editing cannot create a new draft that the old completion would discard. Back remains available. Failure restores editing and preserves the current manual fields or search results. Manual failures are announced by AddBook; generic quick-add failures still belong to BookSearch, avoiding duplicate error messages. Invalid ISBN and already-known duplicate handling retain their existing behavior.

Unmount cancels presentation ownership: a later save result cannot navigate from another screen or show its old success/error toast. A late initial user lookup cannot redirect after leaving either. This is not cancellation of the underlying local write or a new durable draft system. Reopening a form creates its existing new session; F12 owns broader acquisition recovery.

The service adapter's local/outbox write and synchronization rules are unchanged. These frontend tests prove response handling, not persistence durability or immunity to every internal postcommit failure. Account switching while AddBook remains mounted and adapter ancillary side effects are existing acquisition-boundary follow-ups, not solved by removing the page's timer/read. Do not claim an account-ownership or persistence rewrite in this ticket.

## Haptic boundary

[`useHapticFeedback`](../apps/client/src/hooks/useHapticFeedback.ts) owns device calls. Components request a semantic event; they do not import Capacitor plugins. Native `selection` runs `selectionStart`, `selectionChanged` and `selectionEnd`, with cleanup in `finally`. A module-level queue serializes discrete selection lifecycles because Capacitor uses one native selection generator. Preparation/change failures release that generator where possible and do not reject the product action. Light/medium/heavy remain explicit impact styles; success/error remain notification outcomes.

The native path checks `Capacitor.isNativePlatform()` and `Capacitor.isPluginAvailable('Haptics')`. Plugin presence is an available API, not proof that the device contains haptic hardware or that the OS permits feedback. Unsupported native plugins are a no-op. The existing web fallback uses `navigator.vibrate` only when available and when an exposed `navigator.userActivation.hasBeenActive` does not report false. Web selection uses a short 5 ms pattern. Browser or plugin errors never block an action.

`useHapticFeedback({ enabled: false })` disables both native and web feedback. The callback reads the current option so an old callback cannot bypass a later opt-out; queued selections check again before running. `ContextMenuNative` and `ActionSheet` propagate their optional `hapticsEnabled` flag; `DialogContent.disableHaptic` is an additive opt-out whose default preserves other consumers. There was no persisted global haptics preference at this baseline. This API is the opt-out boundary, not a new settings screen or preference. F16 owns future preference ownership/persistence. Reduced visual motion and haptics are independent channels; disabling a visual transition must not disable the action.

The installed Capacitor 7 plugin declarations and native implementation were checked against the [version 7 Haptics documentation](https://capacitorjs.com/docs/v7/apis/haptics) on 2026-09-27. Keep the full selection lifecycle when updating the plugin; `selectionChanged()` alone does not prepare its native generator.

F08 moves ActionSheet presentation to the shared adaptive Radix surface while preserving these feedback rules. `AdaptiveDialogContent.openHaptic` separates the opening request from the full `disableHaptic` opt-out, so a ContextMenu hold still has one feedback owner. ActionSheet also owns uncontrolled close state and can restore an external invoker without stealing focus from a new dialog. The [action/Goals evidence](frontend-renewal/evidence/f08-action-goals.md) records the focused checks; the [adaptive contract](ui-adaptive-overlays.md) owns geometry and scroll behavior.

## Long-press ownership

[`useLongPress`](../apps/client/src/hooks/useLongPress.ts) is a local optional context-action recognizer, not the future F07 global gesture arbiter. Its only production consumer is [`ContextMenuNative`](../apps/client/src/components/ui/context-menu-native.tsx), currently used by [`BookCard`](../apps/client/src/components/BookCard.tsx).

- Recognition uses one primary pointer, a default 500 ms hold and a 10 CSS-pixel movement tolerance. The hook owns one medium haptic when it recognizes a hold. The context-menu callback does not add feedback. Its ActionSheet sets `openHaptic={false}` to suppress the shared dialog's otherwise independent autofocus haptic.
- Movement beyond the tolerance, scroll, another pointer, pointer cancellation/leave/lost capture, page blur/hide, document hiding, text selection and native context-menu handoff cancel pending recognition. Unmount and a changed delay clear the active contact.
- Global movement/cancellation listeners exist only during an active contact and are removed on end/cancel. Idle cards install no global gesture listeners. A hold does not capture the pointer or prevent pointer defaults, so normal scroll/zoom/native text interaction retains browser ownership.
- Native links, buttons, fields, editable elements, semantic button/link/textbox targets and `[data-long-press-ignore]` opt out. Already selected text also opts out. ContextMenuNative leaves link and selected-text context menus native.
- A short press relies on the browser's ordinary click; there is no second synthesized click on pointer-up. A recognized or cancelled contact suppresses its following pointer click in capture, before a child's navigation runs. Keyboard/assistive activation (`detail === 0`) is preserved. A new primary pointer starts an independent action and clears prior click suppression.

The visible **More actions** button is always available and has the accessible name `More actions for {title}` when a title exists. It is a Radix dialog trigger, supports normal keyboard activation, Context Menu and Shift+F10, and receives focus again on dismissal. Right-click on an eligible noninteractive region also opens the actions. The card and its visible action control share one outer element, preserving one grid item per BookCard and avoiding nested buttons. The sheet has a fallback **Actions** title. Existing action labels and behavior are preserved.

## Regression evidence

The slice's focused run passed **36 tests across 3 files**:

```powershell
# Run from apps/client
npx vitest run src/hooks/useHapticFeedback.test.tsx src/hooks/useLongPress.test.tsx src/components/ui/context-menu-native.test.tsx
```

These cover semantic plugin calls, serialized selections, error cleanup, explicit opt-out, unavailable APIs and web activation; contact cancellation and cleanup; normal/keyboard/subsequent clicks; real ActionSheet/Dialog opening with exactly one medium feedback request; visible keyboard alternatives, focus return and native link/selected-text ownership. Native plugin calls are mocked and pointer contacts are synthetic. The parent checkpoint records the final Playwright matrix, scoped lint, types and broader consumer checks. Physical iOS/Android feedback, native text-selection timing, browser/OS gesture competition, VoiceOver and TalkBack remain device-unverified.

`screens/AddBook.feedback.test.tsx` adds nine focused cases for completion, retry/locking, validation/duplicates, quick-add failure ownership, unmount and late lookup. The [action-feedback browser fixture](../tests/fixtures/action-feedback/README.md) uses real AddBook/BookSearch and context primitives with controlled service/plugin boundaries. Clock-controlled success assertions verify destination presentation before advancing any post-success timer; they are not hardware latency measurements. Its clock setup follows the [Playwright Clock reference](https://playwright.dev/docs/clock).
