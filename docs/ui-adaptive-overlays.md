# Adaptive task surfaces

F08's [checkpoint](frontend-renewal/18-adaptive-overlays.md) owns delivery status and validation. This is the implemented source contract, not a native-device or accessibility-conformance certificate.

Current coverage status is corrected in [checkpoint20](frontend-renewal/20-coverage-reconciliation.md). The [complete consumer review](frontend-renewal/coverage-review/04-overlay-form-consumers.md) distinguishes migrated adaptive tasks from ordinary Dialog/AlertDialog/Sheet consumers, responsive parent replacement and missing feature guards. This contract applies to the listed migrated boundary; inherited Radix/Back behavior is not evidence of universal adaptive geometry or draft safety.

## Ownership and presentation

CR01 closes the media-name/focus gap for direct-message and club-chat previews: named headings/descriptions, visible Close, failed-image feedback and explicit invoking-thumbnail restoration. Their GIF pickers retain failed-send results and refuse pending dismissal. These remain focused Dialog consumers; this does not migrate every ordinary dialog to AdaptiveDialog. See [checkpoint21](frontend-renewal/21-live-composers.md) for exact checks.

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
| CreatePostDialog | Feed owns one controlled root outside MobileHeader/NativeHeader. The header contains only CreatePostDialogTrigger; a live ref identifies its replacement after resize. The adaptive task retains text, editor selection, post/book/club/visibility choices and media. Pending and dirty policies are described below. |
| CreateClubDialog | BookClubs and Readers each own one controlled root outside responsive headers. Readers exposes its trigger in the Clubs tab. The task retains club details, privacy, location and selected images; its current trigger ref owns return focus after resize. |
| Full/quick journal | Same useJournalEditor guards, retained drafts, pending writes, inline discard and confirmed-save close. Only surface composition changes. |
| DatePicker | Shared compact/medium-touch policy and geometry; Dialog versus modal Popover is latched for one open session. See the date-specific scrolling/selection contract below. |

## Post and club creation ownership (CR02)

The three live entries are Feed/CreatePostDialog, BookClubs/CreateClubDialog and Readers/CreateClubDialog. Both task components support controlled `open`/`onOpenChange`, `trigger={null}` for external header controls and `returnFocusRef`. Default internal triggers remain supported. Keep the task root outside any responsive header branch: changing only the content primitive cannot preserve an editor that its parent unmounts.

Each task has one synchronous submission guard across upload and publish/create. Fields, selection controls and media changes are unavailable while pending; post contenteditable and formatting controls receive their explicit disabled state. Cancel is disabled, and Close/outside pointer/Escape/app Back requests are consumed without dismissing the pending task. No new route, system gesture or browser-history interception is introduced.

A nonempty draft includes selection-only or media-only changes. Attempted dismissal opens the existing MobileAlertDialog with initial focus on Keep editing. Cancelling that confirmation, including its own Escape/app Back, preserves the parent task; Discard draft explicitly clears it. A confirmed submission clears and closes once, and ordinary reopen starts clean. Return focus uses the connected current header trigger, including its replacement after resize. Nested select/confirmation layers retain primitive ownership.

Failure preserves the current task for retry. Completed post-media uploads are reused for an unchanged file array; club image results are retained per unchanged File. Club upload ownership waits for both banner/avatar outcomes, including a partial failure, before allowing another attempt. These caches are in memory for the open task; they do not add server idempotency, upload cancellation, cleanup of abandoned storage objects or offline social writes. A confirmed publish/create remains successful if the subsequent feed/list refresh fails or is slow. Club creation refreshes the current same-reader filter after its owner check.

Account changes, unresolved authentication and unmount invalidate task outcomes: obsolete upload completion cannot start a later publish/create, and obsolete results cannot close or announce into a replacement reader's task. Account changes close the controlled task and clear its draft. Route departure still ends this in-memory work; these guards do not promise persistence across browser Back, reload or arbitrary navigation.

[Checkpoint22](frontend-renewal/22-responsive-composers.md) owns the CR02 verification status, exact commands and evidence. Source implementation is not a claim that every form/header task is migrated or that native devices and assistive technology have passed. Other header utilities and Messages pane ownership retain their separate coverage findings.

## Shared description and select geometry corrections

MobileDialog and MobileAlertDialog leave a present description's ID and `aria-describedby` relationship to the installed Radix Dialog context. When no description is supplied, the wrapper explicitly passes `aria-describedby={undefined}`. Do not replace both IDs with an independent `useId`: the description may appear associated to assistive technology while Radix's context-ID check reports a missing description. Regression checks cover the actual referenced element, optional and changing descriptions, and the absence of that warning; they do not suppress console warnings globally.

SelectContent's default `position="popper"` caps its height at the smaller of 24rem and `--radix-select-content-available-height`, and caps width at `--radix-select-content-available-width`. Installed Radix Select 2.1.2 supplies these values from its Popper collision calculation; Popper does not impose the dimensions itself. The old rem-only height and intrinsic width allowed a large-text genre menu to extend above and beside the mobile viewport. The existing Select viewport remains the vertical scroller, with its trigger-based minimum width. Item-aligned placement retains its existing fallback; option labels, fonts, selection semantics, keyboard behavior and Back registration are unchanged. Actual browser geometry and first/last-option reachability require browser evidence, not a jsdom CSS assertion.

These shared corrections affect more than CR02: description wrappers also serve timer recovery, Library deletion, Settings sign-out and the confirmation provider. Direct Select consumers include book add/edit, Library, onboarding, goals, lists, journal, reading habits, club detail, privacy, support and post creation. This consumer footprint is a regression boundary, not a claim of complete screen-family validation. [Checkpoint22](frontend-renewal/22-responsive-composers.md) records the observed failure, checks and remaining limits.

## Dates and intentional nesting

The date picker chooses its primitive family on opening and keeps it until closed; a resize cannot replace its calendar/focus scope. The next opening reevaluates current space/input. Dialog presentation may adapt sheet/center geometry while retaining that family. Its accessible name is consistently `Choose date: <field label>` (localized prefix).

Date header/actions stay visible with one calendar-body scroller when they fit. A ResizeObserver measures actual header/footer occupation; if less than a 44px row remains, the whole panel becomes the only scroller so every control stays reachable. This observes element fit, not native keyboard state. Keep the existing localized Close/Cancel rather than adding another generic Close.

Year/decade/month browsing never commits; selecting a day commits immediately. Typed drafts, strict locale formats, required/null/bounds, full spoken day labels, forced colors and `onValidityChange` remain in [the date contract](ui-date-pickers.md). No parser, date domain or persistence replacement is authorized by a surface migration.

Nested date/select/confirmation content retains its own primitive layer; Escape/app Back dismisses only the active layer and respects feature guards. Return focus to the invoker when connected, or the current replacement trigger after a responsive header changes. A closing surface must not steal focus from an action's newly opened modal.

## Evidence and sources

The checkpoint records actual tests and local artifacts. Browser fixtures keep rendering/focus/scroll code real while replacing account/device/data boundaries. Synthetic viewport geometry and bridge callbacks do not prove native keyboard or OS gesture behavior; real VoiceOver/TalkBack and other AT remain unverified.

Design/API sources consulted 2026-09-28: [WAI-ARIA modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [Radix Dialog API](https://www.radix-ui.com/primitives/docs/components/dialog) and [VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport). Live documentation was checked against installed Dialog/Popover 1.1.2; installed Dialog uses RemoveScroll with pinch zoom allowed. F06's [Ionic defer decision](ui-ionic-fit.md) still governs production adoption.
