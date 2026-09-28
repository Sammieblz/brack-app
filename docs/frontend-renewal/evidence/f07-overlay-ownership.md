# F07 overlay dismissal ownership

Source work began from committed F06 baseline `f90509d`. This evidence describes the Back-to-overlay adapter and scoped checks, not a native-device result or independent authorization for subsequent tickets.

## Implemented boundary

`apps/client/src/lib/backLayers.ts` exposes `requestOverlayBack(): boolean` and `hasOpenOverlay(): boolean`. `hooks/useBackLayer.ts` composes the actual Content ref and registers/unregisters the element. Registration is explicit, independent of Router/context providers, and safe for callback/object refs, duplicate registration and StrictMode cleanup. This covers `ConfirmDialogProvider`, which is above the Router in `App`.

Shared Content wrappers register Dialog, AlertDialog, Sheet, Vaul Drawer, Popover, Select, DropdownMenu/ContextMenu/Menubar including submenus. The custom mobile DatePicker and StreakCelebrationOverlay register their raw Radix Content nodes. Existing composites such as MobileDialog, ProfileDrawer, LibraryBookDetailSheet, ActionSheet and ImageLightbox inherit registration from those primitives.

The registry does not maintain a competing overlay stack or inspect arbitrary dialog roles/z-indices. Its only job is to establish that an explicitly registered primitive owns this action. The installed primitive stack determines the highest dismissable layer. App Back dispatches one cancelable Escape through that layer's document, retaining existing `onEscapeKeyDown.preventDefault`, controlled `onOpenChange` guards, menu behavior and focus restoration. A refusal still returns `true`: the caller must stop rather than pop the route. No history entry, browser POP listener or focus trap is added by this adapter. Registration assumes the tested primitive's Escape contract; adding a custom element with only `data-state` is not a substitute for implementing dismissal ownership.

Registered connected content with `data-state="open"` owns Back. A mounted closed surface with an active own exit animation consumes Back without another dismissal until the animation completes. Closed force-mounted content without an active exit and disconnected elements do not claim ownership. Exit detection uses the standard `Element.getAnimations()` API; environments without it retain ordinary open-state ownership but cannot observe the closing-animation interval. This limitation must not be described as hardware-verified.

`ImageLightbox` previously invoked `onClose` both from Radix Escape and its own window Escape handler. Its keyboard shortcut handler now respects `defaultPrevented` and leaves Escape to Radix, preserving the existing zoom/rotate shortcuts. This prevents a second close callback or a parent lightbox closing underneath a nested surface.

## Verified installed contracts

Inspected local packages: `@radix-ui/react-dismissable-layer` **1.1.1**, `react-dialog` **1.1.2**, `react-select` **2.1.2**, `react-menu` **2.1.2**, Vaul **0.9.9**. No package changes were needed.

- `node_modules/@radix-ui/react-dismissable-layer/dist/index.js`, `DismissableLayer`, lines 97–105: Escape runs only for `index === context.layers.size - 1`; consumer prevention is honored before `onDismiss`.
- `@radix-ui/react-use-escape-keydown/dist/index.js`, `useEscapeKeydown`: listeners attach to the owner document in capture phase.
- `@radix-ui/react-menu/dist/index.js`, `MenuSubContent`: nested-menu Escape retains Radix's root-menu close semantics. The adapter does not replace this with a fabricated per-submenu policy.
- `node_modules/vaul/dist/index.mjs`, `Root`, around line 1293: `dismissible={false}` refuses the underlying close request.

Representative guarded consumer: `useJournalEditor.requestOpenChange` refuses while saving/picking/uploading, and requests inline discard for dirty writing. The registry reaches that existing callback rather than mutating `open`. The editor's in-memory draft and attachment behavior stay under the [journal contract](../../ui-journal-editing.md).

Other source findings: there was no existing client `backButton` listener to replace at baseline; native listener integration is owned by the central F07 coordinator. `MyBooks.exitSelectMode` owns selected IDs and the bulk-delete dialog, so selection is a lower-priority task guard, not an overlay DOM heuristic.

The old dismissable wrappers sent a pull completion to unused local Content state, leaving the controlled root open; their hook also scheduled delayed dismissal without cancellation. Source/import searches across apps, packages and tests confirmed GoalsSheet as the sole live consumer. GoalsSheet now uses the existing controlled Sheet on compact layouts, preserving its bottom placement, theme, heading/description, scrollable goals, and visible Close (44px target); desktop retains Dialog. The unused `dismissable-dialog.tsx`, `dismissable-sheet.tsx` and `usePullToDismiss.ts` were removed. No shared Sheet behavior changed. Handle-based drag dismissal is deferred to F08 with scroll/selection/keyboard and pending-task arbitration, rather than retaining a misleading disconnected gesture.

## Focused verification

From `apps/client`:

```powershell
npx vitest run src/lib/backLayers.test.ts src/components/ui/back-layers.test.tsx src/components/GoalsSheet.test.tsx src/hooks/useJournalEditor.test.tsx src/components/StreakCelebrationOverlay.test.tsx src/components/SyncReviewDialog.test.tsx
```

Result: **53 tests across six files passed**. The three new files account for 23 tests, including real primitive nested dismissal/focus behavior, pending/dirty refusal, Escape prevention, non-dismissible Vaul, ContextMenu/Menubar, once-only lightbox callbacks, explicit registration, exit handling, disconnected/closed content and idempotent ref cleanup. GoalsSheet checks cover app Back, Escape and visible Close with focus return in compact and wide variants. Existing journal/celebration/sync-review regressions also passed. jsdom pointer/scroll geometry is stubbed; these tests do not establish browser layout or native behavior.

Initial sandbox execution could not spawn Vite's compiler; the same focused command succeeded with the authorized local execution permission. Scoped ESLint reported zero errors; the two existing image-lightbox warnings concern shortcut effect dependencies and mixed exports. Client/fixture typechecking and browser verification are recorded by the parent batch checkpoint once the combined source is stable.

The [Back ownership browser fixture](../../../tests/fixtures/back-ownership/README.md) uses production coordination and primitives with synthetic services/guard consumers. Its initial completed three-engine run passed **42/42 cases** (14 each in Chromium, WebKit and Firefox; no skips or expected failures). The initial report is preserved at `test-results/back-ownership-initial42/report.json`; initial artifacts are in `test-results/back-ownership`. The canonical `tests/playwright/test-results/back-ownership-report.json` now retains the final-source concurrent result described below, including its two timeouts. Scoped fixture TypeScript and ESLint checks passed. Chromium screenshots at 390px, 834px with dark theme/200% text, and 1280px were inspected: Back was visible and the fixture had no horizontal overflow. This remains synthetic-layout evidence with fallback fonts.

The initial fixture setup exposed missing aliases for the platform service's unused Capacitor external-opening imports; completing those synthetic boundaries fixed startup. The first completed Chromium pass had 11 passes and three fixture selector failures: unlabeled `role=status` queries also matched the fixture's labeled `output` elements. Naming the fixture save/selection status regions and scoping the assertions fixed those tests without a product patch. Initial traces remain at `test-results/back-ownership-chromium`; the subsequent independent Chromium run passed 14/14 at `test-results/back-ownership-chromium-recheck`, before the canonical 42-case run. Existing production journal/date fixture regressions are reported in the parent batch checkpoint when complete.

Concurrent fixture verification exposed shared Vite optimizer-cache contention in another suite. Back, journal and date fixture configs now each use a separate `node_modules/.vite/<fixture>` cache. In-flight older-cache journal/date runs were stopped without counting them as completed passes; their artifacts remain under `test-results/f07-journal-save` and `test-results/f07-date-picker`. Final runs use distinct `*-final` artifact folders. The initial completed 42-case report was preserved at `test-results/back-ownership-initial42/report.json` before the final-source recheck.

Final-source verification with isolated caches completed as follows:

| Suite | Concurrent result | Unchanged sequential retry | Artifacts |
| --- | --- | --- | --- |
| Back ownership | 40 passed; 2 Firefox timeouts | 2/2 passed, one worker, 10.9s | `test-results/f07-back-ownership-final`, `test-results/f07-back-ownership-sequential-retry` |
| Production journal save | 53 passed; 1 WebKit timeout | 1/1 passed, one worker, 11.0s | `test-results/f07-journal-save-final`, `test-results/f07-journal-save-sequential-retry` |
| Production date picker | 67 passed; 1 WebKit and 1 Firefox timeout | WebKit 1/1 passed in 10.8s; Firefox 1/1 passed in 11.3s, sequentially | `test-results/f07-date-picker-final`, `test-results/f07-date-picker-webkit-sequential-retry`, `test-results/f07-date-picker-firefox-sequential-retry` |

Those concurrent runs are not clean full-suite passes. All five affected cases passed unchanged after the other browser processes drained; assertions, production source and default timeouts were not relaxed. The ancestry trace had already reached the correct Library page when its overall 45s budget expired, and the timer/journal snapshot failures had unresolved browser evaluation calls rather than returned incorrect data. Date cases exhausted their overall 30s budget near their final selection/Escape assertions. The evidence is consistent with excessive concurrent test load; it is not a production performance measurement.

Reproduction commands for the final-source runs and narrowly scoped retries:

```powershell
npx playwright test --config tests/playwright/back-ownership.config.ts --output test-results/f07-back-ownership-final
npx playwright test --config tests/playwright/journal-save.config.ts --output test-results/f07-journal-save-final --reporter line
npx playwright test --config tests/playwright/date-picker.config.ts --output test-results/f07-date-picker-final --reporter line
npx playwright test --config tests/playwright/back-ownership.config.ts --project firefox --workers 1 --grep "observed PUSH|browser Back stays" --output test-results/f07-back-ownership-sequential-retry --reporter line
npx playwright test --config tests/playwright/journal-save.config.ts --project webkit --workers 1 --grep "editing failure and discard" --output test-results/f07-journal-save-sequential-retry --reporter line
npx playwright test --config tests/playwright/date-picker.config.ts --project webkit --workers 1 --grep "Pacific/Apia retains" --output test-results/f07-date-picker-webkit-sequential-retry --reporter line
npx playwright test --config tests/playwright/date-picker.config.ts --project firefox --workers 1 --grep "chooses February 5, 1999" --output test-results/f07-date-picker-firefox-sequential-retry --reporter line
```

An independent read-only review of the registry, primitive integrations and GoalsSheet migration found no concrete blocker. Native devices, software keyboards, predictive Back and assistive technology remain release-validation requirements.
