# F08 action sheets and reading goals

Source baseline: `83e032bfc77d240b545cbbbc2a091ceac76538b0`; implementation and unit evidence recorded 2026-09-28. The [F08 checkpoint](../18-adaptive-overlays.md) owns the final browser matrix and review status. Graphify's scoped query and generated Obsidian notes for `ActionSheet`, `GoalsSheet` and `MobileDialog` were used to locate sources; actual source and consumers were then verified.

## Implemented scope

- `components/ui/action-sheet.tsx` uses the shared adaptive Radix content with one focus, Back and scrolling owner. Presentation follows window/input policy, replacing the previous native-iOS-only bottom placement. It always has an accessible title, separates destructive actions, wraps long labels, keeps visible Cancel/Close, and owns internal state when uncontrolled. Previously its uncontrolled action/Cancel handlers only called an optional external setter and could leave it open.
- `ContextMenuNative` retains its visible trigger and F04 feedback ownership. `openHaptic={false}` suppresses only the opening feedback; the action/close feedback channel remains available unless `hapticsEnabled={false}`. No new hold or drag recognizer was added.
- `components/social/PostCard.tsx` connects its existing external Post options button to `ActionSheet.returnFocusRef`. Closing can restore a pointer invoker that did not receive focus on click. A connected invoker is not focused over a different active dialog opened by an action. The action callback still runs immediately in the user activation task; sharing, deletion and blocking semantics are unchanged.
- `components/GoalsSheet.tsx` keeps one Dialog root and content across presentation changes. It accepts controlled open state, an optional trigger and a return-focus ref, while retaining its standalone trigger by default.
- `screens/Dashboard.tsx` owns Goals open state and mounts the sheet outside the conditional MobileHeader/NativeHeader branches. Source inspection found that changing only GoalsSheet's internal root would still lose its state when its Dashboard parent changed type. The shared invoker ref points at the replacement header's visible Goals button.
- `components/GoalManager.tsx` uses adaptive content for its nested Create Goal surface, preserving the actual target/date state and callbacks. Its title now has a description. Date parsing, required/bound behavior, service calls and confirmation semantics are unchanged.

There is no new decorative handle or drag-to-dismiss behavior. A gesture would need its own demonstrated benefit, cancellation rules, focus contract and draft veto; the visible controls and established Escape/app Back owner already dismiss these surfaces.

## Focused verification

From `apps/client`:

```sh
npx vitest run src/components/ui/action-sheet.test.tsx src/components/ui/context-menu-native.test.tsx src/components/GoalsSheet.test.tsx src/screens/Dashboard.goals.test.tsx
```

Final run: **17 passed, 0 failed** across four files. This includes:

- Uncontrolled action, Cancel and app Back closing and returning focus; controlled close veto; title/description and destructive grouping.
- Existing six context-menu checks, including exactly one recognized-hold feedback event, keyboard alternatives, native link/selection ownership and haptics opt-out. The synthetic Capacitor adapter now supplies `getPlatform()` because adaptive presentation reads the canonical runtime service.
- External pointer invoker restoration and action-to-confirmation handoff. The handoff test flushes Radix's scheduled unmount autofocus and verifies both new-dialog focus and **no attempted call** to the old invoker's `focus()`.
- Real GoalsSheet, GoalManager and DatePicker retaining the same nested dialog/input nodes, target value, incomplete raw date text and focus at 390 → 834 → 1280 → 390 CSS pixels. Only auth/goals/toast boundaries are synthetic.
- The actual Dashboard component switching its two header parents while the real Goals create draft remains mounted, followed by nested and parent app Back and focus return to the replacement trigger. Unrelated header/layout and service hooks are synthetic; this does not establish browser geometry.

The first normal-sandbox Vitest start failed before tests because its native compiler subprocess was denied. The approved rerun exposed an incomplete existing Capacitor test adapter, which was corrected without changing production runtime behavior. Subsequent focused runs passed. Existing Vite/SWC and browser-data deprecation warnings remain unrelated to these assertions.

From the repository root:

```sh
npx tsc -p apps/client/tsconfig.app.json --noEmit
npx eslint apps/client/src/components/ui/action-sheet.tsx apps/client/src/components/ui/action-sheet.test.tsx apps/client/src/components/ui/context-menu-native.test.tsx apps/client/src/components/GoalsSheet.tsx apps/client/src/components/GoalsSheet.test.tsx apps/client/src/components/GoalManager.tsx apps/client/src/screens/Dashboard.tsx apps/client/src/screens/Dashboard.goals.test.tsx apps/client/src/components/social/PostCard.tsx --max-warnings=0
```

Client types and scoped lint passed. The parent checkpoint records the sequential Playwright runs for shared adaptive geometry, focus, zoom, visual viewport and action-feedback regressions; these unit results do not substitute for them.

## Deliberate boundaries

GoalManager's existing create flow has no pending deduplication or dirty-close confirmation. Explicitly closing the outer Goals surface still ends that mounted editing session; F08 prevents accidental loss from responsive remount but does not claim a new goal-save transaction policy. ActionSheet likewise dispatches existing callbacks and closes; asynchronous mutations retain their feature-owned error/confirmation behavior. PostCard's current Block uses `window.confirm`, not a second Radix confirmation.

Physical keyboard/IME delivery, native safe-area values, iPad/foldable behavior, VoiceOver/TalkBack and hardware haptics remain device-unverified. The shared viewport policy and browser fixtures describe renderer behavior, not native or legal conformance.
