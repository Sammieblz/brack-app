# Messages task, layout and gesture contract

Current implementation: [CR05 checkpoint](frontend-renewal/25-messages-layout-gestures.md), based on `ef5b2f9`. Its checkpoint and evidence manifest own verification status. This contract describes renderer behavior; it does not establish physical keyboard, native gestures, assistive-technology or live-service acceptance.

## Live entry and owner map

| Entry / task | Production owner and disposition |
| --- | --- |
| `/messages` through social FeatureGate | `Messages` → stable `MobileLayout` → inbox and conversation sections. Main shell destinations and NativeHeader's Messages control use this route. Feature authorization is unchanged. |
| UserProfile Message action | Existing `location.state.startConversationWith` → `useConversations.getOrCreateConversation`; loading/error/retry is owned by Messages. StrictMode subscribers share a dispatched request; explicit newer row selection defeats a late response. |
| Existing conversation entry intent | `location.state.conversationId` selects the existing conversation without creating one. Durable URL identity remains F15 work. |
| Inbox open/search/refresh/read/mute/hide/profile | The only live `ConversationsList` caller is Messages. Native buttons separate opening a thread, opening a profile and revealing actions. Search and rows stay mounted when the compact thread hides the inbox. |
| History, reply, media/GIF/emoji, send, reaction, copy, delete, block, profile | The only live `MessageThread` caller is Messages. Existing useMessages and service boundaries remain authoritative. CR01 upload/send identity, newer text and retry contracts remain in force. |
| Conversation departure | Header/app Back and row selection use Messages' task guard. Thread and inbox profile links ask the same guard. Registered overlays take Back first; pending mutations consume departure. |
| Loading/refresh/empty/error/offline/account change | Existing hook loading/access contracts stay intact. A loaded refresh retains the task; account/auth-loading owner changes withdraw private state. Connection is still required for sends; text can be drafted offline. |

Source discovery includes incoming imports and actual JSX use, not only the generated graph. Club Chat has its own CR01 composer contract and is not a MessageThread alias. `SwipeableSheet` has no current definition/import; OnboardingReadingPractice has no swipe recognizer. Readers/UserProfile's independent page gestures remain explicitly owned by later route/screen work, not silently accepted here.

## Geometry and continuity

The workspace measures its available width after shell/sidebar occupancy. A hidden one-rem probe detects live root-text changes. Two panes require at least52rem of measured width; otherwise a single pane shows inbox or the selected thread. This threshold is a task-fit choice, separate from runtime, input capability and the shell's window class. Expanded browser windows at200% text may correctly show one pane.

One ancestor chain remains mounted through layout changes. Headers may change presentation outside that chain; the conversation key changes only when selecting another conversation. Normal-flow header height and the shell's remaining height replace guessed viewport deductions and minimum thread heights. Draft text, files, reply target, pickers, pending send, textarea node/caret and history position belong to that stable task. Composer icon targets use CSS-pixel sizing to avoid becoming oversized alongside enlarged text; meaningful text still scales and wraps.

The inbox heading/refresh controls scroll with the list. Pinning that large-text header above the scroller previously left too little height for a wrapped action when the timer was visible. Verification requires the full action rectangle to fit its clipping ancestors, not only a clickable center point. The subtitle does not claim a raw server count while confirmed local hide outcomes are waiting for refresh.

Back returns focus to the connected selected inbox control, with Inbox heading as fallback. Opening a thread focuses its section after content/error is ready rather than opening the software keyboard. If a layout change hides the focused inbox, focus moves to the visible conversation; an existing composer caret is left alone. A user reading earlier history is not pulled down by incoming messages or refresh. `Latest messages` resumes following; this is immediate functional scrolling, not decorative animation.

## Departure and action outcomes

Written drafts retain the existing per-reader/per-conversation local storage behavior. Files and reply selection are transient: leaving them through owned actions asks to Keep composing or Leave conversation. Pending send/upload, delete/block/reaction and inbox mutations use synchronous locks and appropriate Back guards. Async continuations are scoped to the mounted account/conversation/route intent. This is not a global link interceptor or browser POP/reload guarantee.

Inbox actions reveal a wrapping, named group through a visible Actions button or a local swipe. A rejected operation retains the action and exposes an inline error. A confirmed result is projected locally until refresh acknowledges it, so refresh failure does not reverse a confirmed read/mute/hide. Hiding means the existing service's hide behavior, not a new destructive backend operation. Read receipt fallback errors now reject instead of reporting false success; the existing request/filter/payload and service fallback order are unchanged.

Block and message delete have owned adaptive confirmation tasks with pending/error/retry. Reaction failure is visible beside the relevant message or in its open action surface. Copy failure leaves selectable native text and explains the fallback. The former Report control had no reporting operation and only claimed success in a toast; it is removed. A functional reporting workflow remains future product work, not a completed action.

The useMessages reaction/delete continuations also check mounted identity and generation before changing state, emitting success events or showing failure toasts. Account changes, unmount and leaving/reopening the same conversation invalidate prior work. This guards feedback ownership without changing the request's actual success/failure return value or service payload.

## Gesture and keyboard ownership

Messages has no whole-thread swipe-to-leave handler. Native/system edges retain ownership. Inbox row swipes reveal/close exactly the same actions as the visible button; bubble right-swipe selects a reply, also available through Message actions → Reply. Ordinary taps, Enter/Space, native selection/context menu and media/profile controls remain available.

Both local interactions use the [existing contact policy](ui-local-gestures.md): one identified contact, reserved edges, native-control exclusion, first-axis decision, vertical pan/pinch allowance and cancellation on extra contacts, selection, overlay, blur/visibility/scroll/context-menu interruption. No document-wide recognizer, pointer capture or synthetic route history is added. Reply release uses a short transform return that honors reduced motion. Gesture thresholds are interaction choices, not measured OS edge widths.

Keyboard submission retains Enter/Shift+Enter and IME safeguards from CR01. All touch actions have named visible keyboard alternatives. Accessibility is always active; no screen-reader enable switch is introduced. The retained icon/font/theme system supplies presentation. Full theme contrast, actual screen-reader output, physical touch/keyboard and native Back remain separate acceptance evidence.

## Verification entrypoints

- Actual screen fixture: [messages-layout](../tests/fixtures/messages-layout/README.md), with real Messages/ConversationsList/MessageThread/hooks and explicitly controlled API/auth/device boundaries.
- Parent task tests: `screens/Messages.tasks.test.tsx`; loading/privacy: `screens/social-loading.test.tsx`.
- Local owners: `components/messaging/ConversationsList.test.tsx`, `MessageThread.test.tsx`.
- Read adapter: `services/api/messaging.read-receipt.test.ts`; existing social access tests remain unchanged.

Use checkpoint25 for executed commands, failures/corrections, exact distinct counts and remaining evidence. Passing mock or synthetic tests alone does not close the actual route, its backend integration or native gesture acceptance.
