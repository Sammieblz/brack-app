# Adaptive task surfaces

F08's [checkpoint](frontend-renewal/18-adaptive-overlays.md) owns delivery status and validation. This is the implemented source contract, not a native-device or accessibility-conformance certificate.

## Ownership and presentation

Use `Dialog`/`DialogTrigger` from `components/ui/dialog.tsx` with `AdaptiveDialogContent` from `components/ui/adaptive-dialog.tsx` for migrated modal tasks. It retains Radix Dialog 1.1.2 for the focus scope, background accessibility and scroll lock, and registers the actual content with `useBackLayer`. Do not add another body lock, Escape handler or swipe-dismiss owner.

`prefersSheetPresentation` chooses a sheet for compact windows, or medium windows with a coarse pointer capability; other windows use a centered surface. Width bands remain 600/1024 from UIEnvironment. Runtime identity does not change with width. The same content DOM survives presentation changes, retaining uncontrolled input values, editor state, focus and caret selection.

`AdaptiveDialogHeader`, `Body` and `Footer` are composition slots. General task content has one whole-surface scroller. Header/footer remain reachable by scrolling when text or available height is large/small; they do not consume fixed budgets that hide the form. Actions wrap. The visible Close target is 44px. No nonfunctional drag handle is shown.

Supply a meaningful `AdaptiveDialogTitle` and a concise optional `AdaptiveDialogDescription`; when omitting the description, pass `aria-describedby={undefined}`. Raw Radix content props, the forwarded content ref, custom initial/return focus, size (`compact`, `regular`, `wide`), `showClose`, `openHaptic` and `disableHaptic` are supported. Feature code owns draft validation and controlled `onOpenChange`: a refused dismissal keeps the same task open. Keep submit buttons inside their form or explicitly associated with it.

These routine surfaces open/close immediately without a decorative transition or an animation-completion delay. Resize never animates layout. Keyboard actions, reduced motion and live preference changes cannot prolong a task. Existing app feedback stays with its owning action; `openHaptic={false}` suppresses opening feedback independently from subsequent actions.

## Viewport and zoom

`useOverlayViewport` reuses the existing UIEnvironment subscription. `deriveOverlayViewport` returns finite layout-bounded CSS-pixel geometry. At scale 1 it follows valid VisualViewport dimensions/offsets; absent/zero geometry falls back to layout. While pinched it uses the layout rectangle without counter-scaling or chasing the magnified visual window. The browser retains zoom/pan ownership.

CSS owns safe-area spacing once. The legacy `--app-viewport-height` remains layout-based; the overlay does not resize the page scroller or infer a keyboard-visible state. F09's [adaptive shell](ui-adaptive-shell.md) independently consumes the same derived unscaled geometry to size its main region. VisualViewport shrink may have multiple causes. Capacitor Keyboard is not installed by either change. Native iOS content insets, Android IME resize/pan and hardware Back require physical-device validation.

When unscaled geometry changes, an occluded focused control is scrolled into view without replacing it, moving focus or changing its caret. Outside-pointer default focus is suppressed before Radix requests dismissal, so it cannot blur a confirmation that a feature guard opens synchronously. Adaptive Close focuses its invoker before that request; explicit external controls can pass a return-focus ref. Forced colors uses a system-color focus outline, including action buttons whose normal theme focus uses shadows.

## Migrated consumers

| Surface | Preserved behavior / adaptation |
| --- | --- |
| MobileDialog | Stable responsive root, named task and optional description; className applies to body and contentClassName to surface. Timer recovery deliberately hides Close because only Save/Discard resolves recovery. |
| MobileAlertDialog | Same controlled confirmation callbacks and dialog role; safe Cancel receives initial focus. Invoker restoration supports nested confirmations. This is not a new async transaction controller. |
| ActionSheet | Controlled or internal open state; action/Cancel/Close actually dismiss trigger-only use. Contextual title or Actions fallback, separate destructive group and external invoker ref for PostCard. |
| Goals | One root; Dashboard hoists it outside its responsive header branches. Open GoalManager/date drafts survive header and window changes. Existing explicit-close behavior and goal persistence remain unchanged. |
| Full/quick journal | Same useJournalEditor guards, retained drafts, pending writes, inline discard and confirmed-save close. Only surface composition changes. |
| DatePicker | Shared compact/medium-touch policy and geometry; Dialog versus modal Popover is latched for one open session. See the date-specific scrolling/selection contract below. |

## Dates and intentional nesting

The date picker chooses its primitive family on opening and keeps it until closed; a resize cannot replace its calendar/focus scope. The next opening reevaluates current space/input. Dialog presentation may adapt sheet/center geometry while retaining that family. Its accessible name is consistently `Choose date: <field label>` (localized prefix).

Date header/actions stay visible with one calendar-body scroller when they fit. A ResizeObserver measures actual header/footer occupation; if less than a 44px row remains, the whole panel becomes the only scroller so every control stays reachable. This observes element fit, not native keyboard state. Keep the existing localized Close/Cancel rather than adding another generic Close.

Year/decade/month browsing never commits; selecting a day commits immediately. Typed drafts, strict locale formats, required/null/bounds, full spoken day labels, forced colors and `onValidityChange` remain in [the date contract](ui-date-pickers.md). No parser, date domain or persistence replacement is authorized by a surface migration.

Nested date/select/confirmation content retains its own primitive layer; Escape/app Back dismisses only the active layer and respects feature guards. Return focus to the invoker when connected, or the current replacement trigger after a responsive header changes. A closing surface must not steal focus from an action's newly opened modal.

## Evidence and sources

The checkpoint records actual tests and local artifacts. Browser fixtures keep rendering/focus/scroll code real while replacing account/device/data boundaries. Synthetic viewport geometry and bridge callbacks do not prove native keyboard or OS gesture behavior; real VoiceOver/TalkBack and other AT remain unverified.

Design/API sources consulted 2026-09-28: [WAI-ARIA modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [Radix Dialog API](https://www.radix-ui.com/primitives/docs/components/dialog) and [VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport). Live documentation was checked against installed Dialog/Popover 1.1.2; installed Dialog uses RemoveScroll with pinch zoom allowed. F06's [Ionic defer decision](ui-ionic-fit.md) still governs production adoption.
