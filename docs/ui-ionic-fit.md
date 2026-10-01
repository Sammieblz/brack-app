# Ionic integration decision

F10b evaluates List/Reorder group/Item sliding separately in [checkpoint29](frontend-renewal/29-lists-reconstruction.md#component-specific-ionic-decision). It retains custom rows and the installed dnd-kit owner with visible move alternatives; this is not production Ionic adoption or a new incompatibility finding.

F10a re-evaluates Segment/Searchbar/Action Sheet/Item Sliding per component in [checkpoint28](frontend-renewal/28-library-reconstruction.md). Its custom Library composition retains native inputs and the existing overlay/swipe owners. This is not production Ionic adoption; the gate below applies to the tested router/modal integration, not every Ionic component or all future shell work.

**Decision: defer production adoption of the tested Ionic 9.0.5 route shell and modal.** Continue frontend renewal with BRACK's existing React Router 6 and accessible Radix primitives, composed into the planned custom phone/tablet/browser surfaces. This is a completed feasibility decision, not permission to stop the UI renewal or replace branding.

The isolated F06 experiment follows committed baseline `2ddc1c25c3b453a5b3f923c99f4d3e58b45b7754`. [Checkpoint 16](frontend-renewal/16-ionic-fit-experiment.md) owns current validation and the review stop. No Ionic package or stylesheet has been added to the application dependency graph or production renderer. The fixture and its exact lockfile live in `tests/fixtures/ionic-fit/`.

## Why this decision

| Gate | Observed result | Consequence |
| --- | --- | --- |
| Published package compatibility | Ionic React/router 9.0.5 accepts installed React 18.3.1 and Router 6.30.4 peers | Routing is not rejected because of an obsolete Router 5 example |
| Tab lifecycle | Tab switches change visible page/URL but omit enter/leave callbacks in Chromium, WebKit and Firefox; a hidden page's test subscription remains active | Do not hand production timers, queries or focus ownership to this route shell |
| Modal keyboard boundary | Chromium and WebKit move focus out of the modal after the last control; Firefox cycles correctly; the same Radix form cycles in all three | Do not replace the existing modal with this candidate or add a second competing focus trap |
| Form/date behavior | Shared parser/calendar, draft guards, failure/retry, resize and token adapters have working representative checks | Keep those established BRACK contracts; they do not waive the failed modal gate |
| Incremental fixture build | Matched Ionic primitive variant adds 890,420 raw bytes / 187,754 gzip bytes of initial JS+CSS | Material cost must have a demonstrated benefit; this is not a measured production bundle regression |

The focus requirement follows the [WAI-ARIA modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): keyboard navigation cycles within the dialog, and dismissal returns focus appropriately. This is an implementation acceptance condition, not a legal or assistive-technology conformance certificate.

Evidence owners:

- [Published packages, exact source and licenses](frontend-renewal/evidence/ionic-fit-package-evidence.md)
- [Navigation reproduction and retained-page observations](frontend-renewal/evidence/ionic-fit-navigation.md)
- [Modal/date/focus integration observations](frontend-renewal/evidence/ionic-fit-modal.md)
- [Manifest-based build comparison](frontend-renewal/evidence/ionic-fit-bundle.md)

Expected-failing adoption tests deliberately preserve the desired contract. Playwright may include them in its successful-run summary; report ordinary behavioral passes and declared gate failures separately. A fixture test run finishing successfully does not mean either Ionic adoption gate passed.

## Ownership for the next implementation

| Concern | Continue with | Constraint |
| --- | --- | --- |
| Runtime, window and input | [UI environment](ui-environment.md), canonical platform service | Runtime/auth identity stays separate from layout and presentation |
| URL navigation and Back | Existing React Router 6; F07 consolidates current handlers | No IonReactRouter around or inside the existing BrowserRouter; preserve deep links and fallbacks |
| Overlays and focus | Existing Radix roots; F08 builds a small adaptive surface boundary | One overlay/focus/dismissal owner, retained draft, visible Close/Cancel and focus return |
| Date values and typing | Existing date-only parser and [date-picker contract](ui-date-pickers.md) | Gregorian YYYY-MM-DD/null; locale-aware typing, historical years, field bounds, invalid-draft protection |
| Shell and scrolling | Existing [scroll contract](ui-shell-scrolling.md), evolved under F07–F09 | One page scroller; native bottom tabs remain the planned destination surface |
| Visual identity | Existing palettes, theme-aware logos, Inter/Merriweather/Playfair roles and Iconoir | Custom composition does not require replacing accessible behavior or importing Ionic visual defaults |
| Native device services | Existing Capacitor 7 adapters | No new native plugins, native sync or major upgrade follows from this experiment |

F07 is the next sequenced implementation. It should consolidate Back, overlay precedence and gesture ownership using the existing router. F08/F09 can then deliver adaptive surfaces and distinct browser/native/tablet chrome without waiting for Ionic. No production implementation of those tickets is included in F06.

## Reusable findings from the experiment

- Ionic 9's installed routing API uses `Route element`/`Routes`; its published source outranks a raw guide that still shows Router 5 syntax. Check the actual release artifact before any future retry.
- The primitive experiment imports Ionic core CSS only. The route experiment separately imports structure CSS, which fixes document layout and changes body scrolling. That CSS must never enter the current shell incidentally.
- Ionic's component `--background` expects a complete CSS color; BRACK's identically named token contains HSL channels. The fixture's narrow adapter gives Ionic a full color and restores the original channels at the slotted BRACK form boundary. Without this separation, surfaces/fields become transparent or invalid.
- The modal's dialog role lives in Shadow DOM. The experiment uses a supported explicit `aria-label` after the light-DOM title reference failed its browser accessible-name check. A visually present heading alone is not sufficient evidence of a named dialog.
- Production DatePicker owns a Radix modal/popover. It is not nested inside Ionic. The fixture opens the real inline `DatePickerCalendar` intentionally and retains the original parser; IonDatetime has not established full parity and is not selected.
- Dismissal reasons pass one guard: pending saves veto dismissal; dirty drafts require an explicit same-surface discard decision; failed saves retain raw fields. No extra dialog stack or decorative save delay is introduced.
- A page's visual hidden state is not proof its subscriptions stopped. The route experiment separately observes visibility, lifecycle entry/exit and synthetic event subscriptions.

## Conditions for reconsidering Ionic

1. Select a published, pinned release with supported upstream fixes; rerun the failing gates without synthesizing lifecycle events, patching node_modules or adding another focus trap.
2. Remove an expected-failure declaration only when its desired assertion passes consistently in all supported browsers. Verify keyboard navigation both ways, dirty/pending dismissal, retained tabs, hidden-page work and entry/return focus.
3. Rebuild the matched comparison and review actual initial/lazy JS/CSS and CSS scope. Installation size is not delivered bundle size; warm fixture timings are not production latency.
4. Validate physical iOS/Android, software keyboards, native safe areas/Back/edge gestures, large text and real assistive technology before any native acceptance claim.
5. Keep a coherent boundary and rollback plan. Any later dependency adoption is a separate reviewed implementation, not a consequence of retaining this experimental fixture.

The synthetic fixture does not access accounts, databases, synchronization or native plugins. Its timer advances deterministically for state-ownership checks, not elapsed-time accuracy. Fonts retain their configured families; external font downloads are blocked during browser tests, so screenshots use available fallbacks and do not establish typography approval. Neither screenshots nor emulated runtimes prove native feel or accessibility conformance.
