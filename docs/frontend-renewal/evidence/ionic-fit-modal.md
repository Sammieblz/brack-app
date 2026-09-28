# F06 Ionic modal experiment

Status: **DEFER production IonModal adoption**. The corrected standalone integration reproduces a keyboard focus-boundary failure in Chromium and WebKit; the corresponding Firefox gate passes. The final modal/form matrix has **67 ordinary passes and 2 declared focus-gate failures**, with no unexpected outcomes. This decision is independent of the [route-shell deferral](ionic-fit-navigation.md); it does not imply that every Ionic component has failed evaluation.

Baseline: `2ddc1c25c3b453a5b3f923c99f4d3e58b45b7754`. Package and scope evidence: [pinned dependency report](ionic-fit-package-evidence.md). Final combined decision, commands and checkpoint: [F06 experiment](../16-ionic-fit-experiment.md). This document records an isolated fixture, not shipped UI, physical-device behavior or legal conformance.

## Surface and ownership actually tested

- `tests/fixtures/ionic-fit/main.tsx` loads Ionic React **9.0.5**, calls `setupIonicReact`, and imports Ionic `core.css` plus BRACK styles. It does not import Ionic reset/structure/typography styles into this primitive comparison.
- `ionic-surface.tsx` owns one `IonModal`. `focusTrap` retains its default `true`; breakpoints are `[0, 1]`, initial breakpoint is `1`, and `expandToScroll` is false. `canDismiss` delegates to the fixture's pending/dirty guard. The real UI environment selects presentation mode and `animated={!reducedMotion}`.
- `experience.tsx` owns one existing `BrowserRouter`, the raw reading draft, deferred synthetic save and explicit discard decision. The background is `#ion-view-container-root`; the modal is a sibling. Ionic owns background `aria-hidden` while presented. The final fixture adds no manual `inert` or competing focus trap.
- `reading-form.tsx` is the same form in both candidates. `radix-surface.tsx` provides the control using the production BRACK Dialog primitive. Modal presentation focuses `#reading-title`; dismissal requests focus return to the original opener without scrolling.
- The form has one internal vertical scroller, `data-testid="reading-scroll"`. Its header is separate; actions are within the scroller. The action group alone reserves `max(1rem, env(safe-area-inset-bottom))`; the scroller's padding is ordinary `1rem`. There is no duplicate bottom safe-area reservation.
- Opening dates mounts the real `DatePickerCalendar` inline inside the active modal. It uses production `dateOnly` parsing/formatting/validation and retains the parent-owned raw draft. It does not nest the production `DatePicker`, whose own compact Dialog or wide modal Popover would introduce another overlay owner. This is not an IonDatetime parity test or authorization to replace the production date field.

## Compatibility findings resolved within the fixture

**Accessible name across Shadow DOM.** IonModal renders its actual `role="dialog"` wrapper inside its shadow root. An initial external `aria-labelledby="reading-title"` relationship did not establish the expected accessible name in the browser probe. The fixture now supplies `aria-label="Reading note"` to IonModal, while retaining its visible Reading note heading and explicit initial heading focus. The installed `modal.js` render copies inherited attributes onto the internal dialog wrapper. This resolves this fixture's label relationship; it does not establish VoiceOver/TalkBack behavior.

**Color-variable namespace collision.** BRACK's `--background` contains HSL channels, consumed as `hsl(var(--background))`; IonModal's `--background` expects a complete CSS color. Setting the modal variable to a full color causes that same inherited name to reach slotted BRACK fields, making their HSL expression invalid. `theme.ts` preserves the selected BRACK palette in `--fit-background-channels` and bridges full colors into `--ion-*`. `style.css` supplies the full modal background and restores channel-valued `--background` on `.fit-form`. This keeps a single BRACK palette source rather than duplicating themes.

**Typography, styling and motion.** The bridge explicitly sets `--ion-font-family` to BRACK's Inter stack. Existing serif/display roles remain in the shared form. Modal shadow content and handle use supported CSS parts; component-specific CSS stays fixture-local. Reduced motion is passed explicitly to Ionic rather than assuming BRACK's universal CSS selector controls Ionic's animation implementation. Global Ionic animation is enabled; the live modal prop is the single preference owner. An initial globally disabled value would otherwise keep overriding the modal after the OS preference changed. A focused **3/3 cross-browser run** observed actual modal Web Animations API playback: no positive-duration play under reduced motion, then positive-duration play after changing to no preference, followed by clean dismissal and focus return. Browser 200% root text is a layout probe, not proof of native Dynamic Type or successful external font downloads.

**Dismissal timing.** Opener focus return belongs after actual dismissal, not after merely setting an open-state flag. A focused normal-motion rerun passed after the fixture observed the completed dismissal and restored focus; production adoption still fails the separate Tab-boundary gate.

**Initial-focus handoff.** The first combined run had two unexpected Chromium failures in which the mounted heading remained unfocused. Traces established that failure but did not identify its actual focus target. Installed `overlays.js` emits `didPresent` before finishing its fallback focus and accessibility cleanup. The Ionic adapter now notifies the shared heading-focus policy in a guarded microtask after that synchronous transaction. A revision check invalidated on dismissal/unmount, plus connected/open checks, prevents a stale presentation from stealing focus. This is lifecycle ordering, not a timeout, focus retry loop or additional trap. Both affected cases then passed **10/10 Chromium repetitions** (two cases, each repeated five times), and the final combined matrix passed these cases in all three engines. The separate Tab-boundary gate remains unchanged and blocked.

## Observed adoption failure

The acceptance criterion is explicit: sequential keyboard focus must stay inside the active modal, including the last-to-first boundary. The [WAI-ARIA APG modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) describes forward and reverse Tab cycling within a modal, suitable initial focus, an accessible dialog name, and focus return after dismissal. These interaction expectations support BRACK's engineering gate; citing APG is not a legal-conformance certification. The source was checked on 2026-09-27.

Chromium reproduction:

1. Open the Ionic fixture at `/?runtime=native&mode=ios` and activate **Add reading note**.
2. Observe one named dialog and focus on the visible Reading note heading.
3. Press Tab through Close, Title, Reading date, Choose reading date, Clear reading date, Notes, Ideas for your note, Save reading note, and Cancel.
4. At **Tab 10**, `document.activeElement` becomes **BODY**, while the modal remains presented. Focus has not cycled to its first control.

The original probe used a manually inert background. The corrected probe removed that intervention, supplied the supported `#ion-view-container-root`, and still failed at Tab 10. Its diagnostic artifact is `test-results/ionic-primitives-supported-root/ionic-fit-Ionic-candidate--17a0d-lean-close-and-focus-return-chromium/error-context.md`. The Radix control's corresponding focus-cycle check passed. The isolated normal-motion clean-dismiss/focus-return check also passed; those results do not negate the boundary failure.

The dedicated test **ADOPTION GATE: Ionic modal cycles Tab within the reading task** records a persistent `modal-focus-boundary.json` and attachment with each active element, containment result and `document.hasFocus()` after a requestAnimationFrame. The final-run Chromium and WebKit files both record **Tab 10, `inside: false`, `documentHasFocus: false`, active element BODY**, with the supported view root and no manual inert attribute. Thus the browser observation establishes that document focus was lost; the exact destination within browser chrome is not instrumented. Copies from the completed matrix are retained in the [artifact directory](ionic-fit/README.md).

The final-run persistent gate observations independently record:

| Engine | Modal focus gate | Evidence limit |
| --- | --- | --- |
| Chromium | Failed | Final-run JSON: BODY at Tab 10, `inside: false`, `documentHasFocus: false`. |
| WebKit | Failed | Final-run JSON independently records the same Tab 10 result. |
| Firefox | Passed | All 12 Tab observations remain inside; the final observation also has `documentHasFocus: true`. This is not native or assistive-technology verification. |

The persistent observations are `test-results/ionic-fit/ionic-fit-ADOPTION-GATE-Io-2a759-Tab-within-the-reading-task-{chromium,webkit,firefox}/modal-focus-boundary.json`. Test output is generated and may be replaced by a later run; preserve or attach it when using this result outside the current workspace.

The known Chromium and WebKit defects are recorded as expected test failures while preserving the strict containment assertion. An expected failure is an unresolved adoption blocker, not successful modal accessibility verification. Firefox remains independently asserted as a passing requirement.

The initial matrix also found one WebKit observation race: the visible saved outcome was correct, while an immediately read fixture snapshot still held the old saved array until its React effect updated. The test now polls the same exact expected saved value. This is instrumentation synchronization, not a weakened persistence assertion or evidence of a product save failure. The corrected case passed in all three engines in the final matrix.

Evidence scope remains narrow: calling the fixture's `dismiss('gesture')` exercises the dismissal-reason guard, not physical sheet dragging. The focus adoption probe checks the forward boundary; reverse-boundary coverage remains a reopening requirement. This fixture's locale assertions preserve canonical outputs but do not constitute a new timezone matrix or complete IonDatetime parity. Four representative BRACK palette/mode combinations are checked, not every possible theme combination. Window resizing, root text scaling and configured font-family names do not establish a software keyboard, OS text scaling, downloaded font appearance or physical safe-area geometry.

## Installed-source explanation and its limits

Inspected files are under `tests/fixtures/ionic-fit/node_modules/@ionic/core/dist/collection/`, restored by the isolated pinned lockfile:

| Source | Verified behavior |
| --- | --- |
| `utils/overlays.js:141–313` | `trapKeyboardFocus` tracks focus inside the presented overlay and redirects outside DOM focus. Shadow and scoped overlays take separate branches. |
| `utils/overlays.js:321–355` | The trap is registered on document `focus` events in capture. The separate keydown handler handles Escape; it does not cycle Tab. |
| `components/modal/modal.js:1260–1296` | The rendered shadow structure includes backdrop, dialog wrapper, optional handle and slot. It contains no first/last focus sentinel pair. |
| `utils/overlays.js:407–440` | Without an Ionic router outlet, `#ion-view-container-root` is the supported background container for accessibility hiding. |
| `utils/overlays.js:703–705` | App-root lookup explicitly falls back from `ion-app` to `document.body`. |
| `components/app/app.js:10–48` | IonApp starts input, keyboard, Back and focus-visible utilities. This setup adds no modal boundary focus sentinels. |

**Inference:** moving from the final modal control to the browser/document boundary leaves BODY as the active-element fallback without producing the outside-element `focus` event on which Ionic's trap depends. The observed `documentHasFocus: false` supports the outside-document part of this explanation; the internal browser event path was not directly instrumented. The source does not support assuming that adding IonApp alone repairs it. No upstream files, custom Tab trap, dummy trailing focus control, or second overlay implementation were added to force a passing result.

## Decision and reopening evidence

Keep the production Radix/date primitives for the upcoming adaptive-overlay work. The fixture proves useful BRACK-token, inline-date and guarded-dismissal integration, but the Modal adoption gate remains blocked. The independent router lifecycle failure is documented separately; neither failure justifies downgrading BRACK's existing router or blocking all frontend work.

Reopen IonModal adoption only with a supported version/configuration that passes the unchanged boundary test in all required engines, including reverse cycling, pending/dirty states and normal/reduced motion. Then repeat actual-device keyboard, OS Back, safe-area, text-scaling and screen-reader checks. Neither a synthetic VisualViewport/inset nor emulated native runtime proves those device behaviors. No production data, schema, routes, native plugins or application primitive were migrated in this experiment.

Final combined F06 result: 97 ordinary passes,5 declared adoption failures, zero unexpected outcomes,147.5 seconds and exit 0. The modal/form subset is 67 ordinary passes plus the two declared focus failures; navigation owns the remaining 30 passes and 3 lifecycle failures. See the [retained case results](ionic-fit/browser-results.json) and [checkpoint](../16-ionic-fit-experiment.md). Expected failures are not accessibility passes.
