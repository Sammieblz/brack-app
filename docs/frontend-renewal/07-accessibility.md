# Accessibility requirements and verification plan

Status: implementation plan and source audit, not a conformance report. Research/source date: 2026-09-27. No VoiceOver, TalkBack, keyboard walkthrough, contrast measurement, axe scan, or disabled-participant study was performed for this document. The target is an accessible default experience across native phones, tablets, mobile browsers/PWA, and desktop.

## 1. Standard, scope, and legal applicability

Adopt WCAG 2.2 Level AA as BRACK's web/frontend engineering target, plus selected stronger usability requirements described below. Evaluate complete tasks, not just individual components. Native packages also need platform accessibility behavior verified on device; passing a DOM checker does not establish that. WCAG 2.2 is a technical standard, not a blanket statement of worldwide legal compliance. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/).

| Framework | Verified public-source position | What BRACK must establish |
|---|---|---|
| US ADA Title III | DOJ describes accessibility duties for businesses open to the public, including their web services. Its general guidance is not a universal WCAG 2.2 regulation for every private app. | Record operating entity, offerings, jurisdiction, and distribution; have applicable obligations reviewed before a legal claim. Do not label this plan “ADA certified.” [DOJ web accessibility guidance](https://www.ada.gov/resources/web-guidance/) |
| US ADA Title II | Applies to state/local government web content and mobile apps, with WCAG 2.1 AA as technical standard. Current DOJ page reports an April 2026 interim final rule extending deadlines to April 26, 2027 for 50,000+ population entities and April 26, 2028 for smaller entities/special districts. | Relevant if BRACK is supplied as part of a covered public service/contract. Do not reuse older 2026/2027 dates. Recheck current rule and contract before release. [Current DOJ first steps](https://www.ada.gov/resources/web-rule-first-steps/) |
| US Section 508 | Federal agencies have accessibility requirements for ICT they develop, procure, maintain, or use; Revised 508 incorporates WCAG 2.0 A/AA and additional requirements. | Determine whether federal procurement/use applies; prepare accurate accessibility evidence if requested. Private consumer distribution alone does not establish Section 508 coverage. [Section508.gov laws](https://www.section508.gov/manage/laws-and-policies/), [applicability](https://www.section508.gov/develop/applicability-conformance/) |
| EU European Accessibility Act | Requirements apply from June 28, 2025 to selected products/services. Scope includes e-books and e-commerce; exemptions and national implementation matter. A book tracker is not automatically an e-book service. | Determine covered functionality, consumer transactions, markets, entity size, and national rules. Record any relied-on exemption with review rather than assuming it. [European Commission overview](https://digital-strategy.ec.europa.eu/en/news/eu-becomes-more-accessible-all), [Directive 2019/882](https://eur-lex.europa.eu/eli/dir/2019/882/oj) |
| Other national laws, state laws, procurement standards, EN 301 549 contracts | Coverage cannot be inferred from repository source. | Maintain a release-market/contract applicability register with owner, current authoritative source, effective date, standard version, and review date. Add requirements when markets/contracts are known. |

Legal applicability remains an explicit release diligence item; it is not a reason to postpone accessible implementation. This pass neither certifies compliance nor claims that technical AA testing satisfies every federal/international obligation.

## 2. Source evidence: preserve the good, close the gaps

`src/` below means `apps/client/src/`. These are source observations unless otherwise stated. Graphify was consulted first, then the relevant implementation was read.

| ID | Observation | Planned treatment |
|---|---|---|
| A01 | `hooks/useReducedMotion.ts` reactively reads OS preference; `index.css` reduces CSS timing globally. `BrackLoader`, confetti, rewards, streak, and some charts use reduced-motion branches. | Preserve and unify preference ownership; explicitly cover JavaScript timelines and runtime changes. Global CSS is a fallback, not the whole solution. |
| A02 | `components/animations/HeartLike.tsx` lacks reduced-motion guarding and `aria-pressed`; its default button footprint follows its 24 px icon unless a caller enlarges it. Actual rendered target size has not been measured. | Add state semantics and a touch-target contract, inspect callers, remove JavaScript bounce under reduced motion. |
| A03 | `components/ui/date-picker-calendar.tsx` includes full spoken date labels, keyboard navigation in month/year selection, polite month announcements, and 44 px minimum day heights. Base `calendar.tsx` still defines smaller generic controls. | Preserve the accessible/custom date implementation; inventory actual consumers before declaring all calendars generic or inaccessible. Validate geometry, locale, focus, and selection on devices. |
| A04 | `components/loading/LoadingRegion.tsx` publishes busy/refresh state without remounting children and places status outside the busy region. `LogoSpinner.tsx` provides status/progress semantics. | Preserve; assign a single announcement owner per operation to avoid nested loader messages. |
| A05 | `MobileLayout.tsx` supplies a main landmark but no common skip link/target. Landing `Index.tsx` and `SupportCenter.tsx` contain their own skip links. | Add consistent app-shell bypass navigation and route focus handling; do not claim skip links are absent everywhere. |
| A06 | `MobileHeader.tsx` truncates title text; layouts use fixed toolbar heights. `MobileLayout` includes nav clearance tokens. | Large text/title wrapping and focused-input visibility require runtime tests; no clipping defect is certified from classes alone. |
| A07 | `LibraryBookPrimaryAction.tsx` has a labeled button, selection `aria-pressed`, and explicit focus handling. `StreakCelebrationOverlay.tsx` uses a dialog, readable hidden title/description, dismiss button, and focus restoration. | Preserve semantic work when changing visual surfaces or adopting Ionic. |
| A08 | `SwipeableBookCard` only mounts tray buttons after swipe threshold; its wrapper has no dedicated alternative action opener. A composed child may provide one. `ContextMenuNative` itself uses a long-press wrapper. | Audit every call site for visible equivalent actions, not just wrapper internals. Add the alternative at the appropriate feature owner. |
| A09 | `ui/slider.tsx` uses a Radix thumb with visible 20 px dimensions and `touch-none`. It accepts caller props. A numerical entry/stepper alternative is not provided by the wrapper. | Audit labels, actual target area, value announcements, keyboard behavior, and single-pointer alternatives in consuming tasks. |
| A10 | `Settings.tsx` has no dedicated accessibility section; `AppPreferences.tsx` currently exposes appearance/color palette. `useHapticFeedback` has no shared user preference check. | Add a small Display & accessibility group and independent feedback choices. Basic accessibility never requires a toggle. |
| A11 | `apps/client/index.html` viewport does not prohibit scaling with `user-scalable=no` or a maximum-scale lock. | Preserve browser zoom. Do not introduce global pinch interception during gesture work. |
| A12 | `ui/live-region.tsx` provides a reusable polite/assertive helper that clears after 1 s; multiple feature-specific status regions also exist. | Test announcement reliability/duplication rather than assuming a 1 s clear always succeeds on every screen reader. |
| A13 | Contrast, magnified layout, focus sequence, switch/voice control, and accessible rich-text/media output have not been measured in this pass. | Add evidence through the verification matrix; these remain untested, not passing or failing claims. |

## 3. Accessible default experience

Do not create an “Enable screen reader” switch. VoiceOver, TalkBack, NVDA and other assistive technologies are controlled by the operating system/browser environment. BRACK's labels, reading order, landmarks, state, and controls must work automatically. A help page can explain how to use OS accessibility settings, with current platform-specific instructions reviewed at implementation time; it must not pretend to enable or detect every assistive technology.

Treat native controls and WebView content as one task. Verify focus crossing permission dialogs, camera/scanner sheets, keyboard, share menus, and app return. Do not rebuild OS permission UI. Scanner-only input is insufficient: ISBN text/search/manual entry remain usable alternatives.

The desired experience includes blindness/low vision, color-vision differences, deafness/hearing loss, limited dexterity, motor impairment, cognitive/learning disabilities, vestibular sensitivity, and combinations of needs. A single accessibility “mode” cannot represent all of them.

### Settings proposal

| Setting | Default and storage contract | Visible behavior |
|---|---|---|
| Motion | “Follow system”; optional “Reduce motion” override | A user can reduce beyond OS settings, but full motion must not override an active OS reduce preference. Resolve once for CSS/JS/platform transitions. |
| Celebrations | “Brief”; optional “Off” | Off keeps saved-state/reward text and announcements while removing decorative events. It does not disable achievements. |
| Haptic feedback | Platform-appropriate default; explicit off | No vibration when off, including selection, errors, celebrations, and menus. Muted haptics never remove visual/text feedback. |
| Sound feedback | Off unless a product requirement explicitly enables it | If introduced, separate from haptics and motion. Never a sole success/error channel. |
| Contrast/transparency | Follow available system preference; optional increased-contrast presentation | Preserve selected theme family and fonts; simplify translucent surfaces where needed, use verified semantic token pairs. |
| Text/readability | Follow OS/browser scaling; optional app text-size controls only if tested across every surface | Do not offer an in-app control as a substitute for actual zoom/Dynamic Type support. No “dyslexia cure” font claims. |
| Accessibility help | Reachable in Settings and Support | Gesture alternatives, keyboard commands, OS help links, and an accessible issue-report route; no disclosure of disability required. |

Store device accessibility choices locally first with a versioned preference contract so they are available before login/loading. Account sync is optional future scope if no existing preference field supports it; do not add a database migration just to persist display settings. Apply system changes reactively. Switching accounts must not reveal previous-account content or silently override an active system accessibility preference.

## 4. Design-system acceptance contracts

These are project requirements for every replacement/custom primitive. Style changes may reuse established Radix/Ionic semantics; “custom built” does not justify replacing working focus/keyboard behavior with generic divs.

| Area | BRACK requirement | Verification/source |
|---|---|---|
| Text contrast | Normal text at least 4.5:1; large text at least 3:1, with WCAG definitions/exceptions applied | Measure actual rendered colors for every theme/mode and state; no pass based on token names. [Contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) |
| Nontext contrast | Meaningful control boundaries/icons/state indicators at least 3:1 against adjacent colors where the criterion applies | Test focus, selected, checked, error and chart states. Decorative art and logos have different treatment. [Nontext contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) |
| Target geometry | Project default ≥44×44 CSS px hit area; aim 48 CSS px in touch-heavy Android-like controls where space permits | This is a BRACK comfort target. WCAG 2.2 AA target minimum is 24×24 CSS px or defined exceptions/spacing, not universally 44 px. Measure hit boxes, not icon dimensions. [Target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) |
| Reflow | Test content equivalent to 320 CSS px width and 400% browser zoom; no two-dimensional scrolling for ordinary forms/content | Truly two-dimensional charts/tables may need exceptions plus an accessible alternative; do not shrink text to force fit. [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) |
| Text scaling/spacing | 200% text resize without lost actions/content; test line height 1.5, paragraph spacing 2× font size, letter spacing .12× and word spacing .16× | Fixed-height headers/cards must expand; user text-spacing overrides cannot lose information. [Text spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html) |
| Focus visibility | Strong visible indicator in every theme; ensure focused element is not hidden by toolbar, bottom bar, sheet, browser chrome, or keyboard | WCAG AA requires not entirely obscured by author content; BRACK targets fully visible important controls. [Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) |
| Gesture alternatives | Every swipe, long press, multipoint action and drag has a discoverable simple control alternative | Drag keyboard support alone does not replace the required single-pointer no-drag alternative. [Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) |
| Accessible authentication | Support password managers, paste and autofill; avoid forced memory/transcription challenges without an allowed alternative | Retain entered data across validation and accessible recovery; test OTP paste/autofill. [Accessible authentication](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html) |
| Async status | Announce meaningful result/loading/error without moving focus unnecessarily | Visible and nonvisual messages agree; one owner per operation; changing decorative counters do not flood speech. [Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) |
| Motion | OS reduce preference stops nonessential spatial/decorative effects, including GSAP; users can turn celebrations off | Interaction animation control is WCAG 2.3.3 AAA; BRACK adopts it intentionally above AA, not as a mislabeled AA clause. [Animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) |

Use color plus text/shape/icon to distinguish reading status, overdue goals, errors, offline/pending sync, and chart series. Disable flashing decoration; do not build effects near seizure thresholds. No autoplay sound. Essential audio/video content, if present, needs appropriate captions/transcripts and audio description/media alternatives; establish a content workflow, not a frontend checkbox.

Icons that repeat an adjacent label are decorative. Icon-only buttons have action-specific names. A book cover with adjacent linked title can be decorative to avoid redundant speech; a standalone actionable cover needs a useful accessible name from its title/author context. Preserve the user's chosen fonts, but ensure fallback fonts, character coverage, readable line length, and text zoom work.

## 5. Navigation, overlays, and focus

### Application shell

Provide a skip-to-main link for browser/keyboard users and a stable main target. Use one primary page heading and logical subheadings; set the document title on meaningful navigation. Distinguish primary navigation (`aria-current="page"` for links) from local tab widgets. Hidden alternate shells and cached routes must not leave duplicate headings/buttons in the accessibility tree or tab order.

After deliberate route navigation, place focus at the new heading/main context where appropriate and announce context once. Back should restore the invoking item/scroll position when possible. On a data refresh, do not move focus. On tablet two-pane selection, keep list focus for arrow navigation while updating the detail region; provide an explicit way to enter detail. When a responsive breakpoint changes, preserve the selected object and recover focus on the equivalent control instead of resetting to the document body.

### Modals, drawers, and sheets

A modal must have an accessible name, an appropriate initial focus target, contained keyboard focus, a visible close/cancel path, and focus restoration. Long content may need initial focus on its heading; destructive confirmation should not default focus to the destructive action. Background content is inert only while a true modal owns interaction. A nonmodal inspector/popover must not pretend to be a modal or trap focus. Use one overlay/focus system per active surface. [WAI-ARIA modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Sheet handle dragging has explicit close and, when needed, expand controls. Escape, native Back, header close, backdrop and gesture all consult the same dirty-draft policy. A confirmation dialog above a dirty composer must return to the composer correctly when cancelled. Do not remove focus outlines for aesthetic reasons or allow a celebration to seize focus while a user types.

Toast messages supplement stable state; error correction, essential instructions, and the only recovery action cannot exist exclusively in a brief toast. If an undo action has a timeout, supply an accessible persistent recovery path or an appropriate adjustable/pauseable timing design. Announcements do not require every toast to be assertive.

## 6. Component and task specifications

| Surface | Required behavior | Failure/edge cases |
|---|---|---|
| Book card/list row | One clear primary action, separate named menu, reading status in text, accessible selection state | Avoid nested interactive elements and repeated cover/title announcements; all swiped actions available without gesture |
| Date picker | Field label and format help, reliable direct entry, full date announcement, visible selected/today states, coherent keyboard grid, month/year navigation | Preserve the existing direct-entry and date-only timezone contract, bounds, cancel/clear semantics, locales and large text; native/Ionic adapter must pass same task contract |
| Calendar/streak history | Dates and reading results available as text/list; today's/selected/completed states distinguishable beyond color | Small heatmap cells can be summarized rather than creating hundreds of unlabeled tab stops; offer range/list navigation |
| Progress input | Numeric entry plus stepper or equivalent simple controls alongside slider; value/min/max/unit | Explain invalid totals and overshoot; do not require precise dragging; save semantics distinct from animation |
| Session timer | Start/pause/finish controls named; elapsed value readable on request | Do not announce every second. Announce start/pause/finish and saved/pending/error once; background resume preserves state |
| Rich text/journal/notes | Labeled editable region, keyboard toolbar, pressed states, links with purpose, meaningful headings/lists | Preserve draft on navigation/error; text selection remains native; screen-reader editing tests are required, not inferred from editor library |
| Search/autocomplete | Persistent label, correct expanded/active-option state, keyboard/escape behavior, results count announced sparingly | Loading/errors/no results distinguishable; async results do not steal focus or clear typed query |
| Filters/sort | Named controls, current value/count, explicit reset, consistent focus return from sheet | Chips have meaningful removal names; reset does not unexpectedly navigate; selected filter not color-only |
| Lists/groups/selection | Explicit selection and move controls; selection count and bulk action context | Reorder alternative works by tap and keyboard; destructive bulk changes identify count and recovery |
| Charts/analytics | Concise trend summary plus accessible data table/list; series labels and units; focusable usable controls | Data refresh, tooltip content, chart zoom and date range accessible without hover/drag; themes and forced colors remain understandable |
| Feed/posts/reviews | Semantic content order, named author/title/actions, like pressed state, readable counts | Media alt/captions where supported; publishing error preserves draft; no repeated announcements for background feed updates |
| Messages | Conversation heading, ordered message context, concise new-message indication | Do not reannounce entire history; keep current reading position; typing status must not chatter |
| Scanner | Clear camera permission instructions and success/failure feedback | Manual ISBN/search entry always reachable; sound/vibration not sole scan feedback; focus returns after permission UI |
| Auth/onboarding | Persistent labels, appropriate input purpose/autocomplete, clear grouped choices, errors linked to fields | Password manager/OTP paste works; no disappearing instruction; optional steps can be skipped accessibly |
| Settings/theme picker | Selected state and visible theme names, preview readable in every palette | Choosing dark/light/style does not animate full-page color flash or lose focus; controls remain available at large scale |
| Empty/error/offline states | Plain task-specific explanation and named next action | Decorative illustration hidden from AT if text gives same meaning; retry preserves focus/data |
| Export/import/support | Progress/status and readable validation results; support form accessible | Frontend must not promise exported documents meet accessibility requirements without checking the export format |

Forms use persistent labels, descriptions, required-state text, semantic grouping, and errors associated with the field. On failed submit, provide a concise summary and move focus to it or the first actionable invalid field based on form size; preserve all values. Do not use placeholder-only fields or shake animation as the error explanation. Field input should not trigger unexpected navigation. These contracts implement BRACK's existing frontend skill and should be included in reusable primitive reviews.

## 7. Verification matrix

### Automated checks

Run existing relevant component tests first. Add meaningful behavior tests when a change introduces a new accessibility contract; do not add snapshots that simply repeat class names. Test role/name/state queries, keyboard operation, focus return, duplicate announcement prevention, reduced-motion toggling, pointer cancellation, and preserved drafts.

Run an accessibility checker against representative fully rendered routes and open overlays in both default and alternative themes. Investigate all serious/critical findings and document relevant lower-severity results. A clean scan does not establish conformance. Build separate contrast checks for semantic token pairs and rendered overlays; screenshots alone are not sufficient.

| Platform/device | Assistive/input configuration | Required tasks |
|---|---|---|
| Physical iPhone native build | VoiceOver, Dynamic Type largest practical sizes, Reduce Motion, portrait/landscape | Authenticate, find/add book, edit progress, date selection, open/close menu/sheet, Back, finish session |
| iPhone Safari + installed PWA | VoiceOver, browser zoom, expanded/collapsed browser chrome | Same core tasks, deep-link/back/forward, skip navigation where keyboard available; ensure browser gestures preserved |
| Physical Android native | TalkBack, font/display size, gesture navigation and 3-button navigation | Same core tasks, OS Back closes top surface first, hardware keyboard if supported |
| Android Chrome | TalkBack, page zoom, Switch Access or comparable single-switch setup | Menu alternatives, no drag-only controls, no duplicate browser/app refresh |
| iPad native and Safari | VoiceOver, split view/Stage Manager where available, keyboard, trackpad, large text | Library/detail two-pane, tab order, orientation/window resize, focused field above keyboard |
| Android tablet/foldable | TalkBack, touch + keyboard, folded/unfolded and multiwindow | Preserve focus/selection/draft across width changes; no assumptions that tablet equals mouse |
| Windows Chrome/Edge | NVDA + keyboard; forced-colors; 200% text and 400% zoom | All primary tasks, landmark/heading navigation, dialogs/date grid, data summary |
| macOS Safari | VoiceOver + keyboard | Browser navigation, controls, form/error semantics, overlays |
| iOS Voice Control / Android Voice Access | Visible-name commands and numbered targets | Add book, choose date, open actions, save/cancel, navigate without precise gesture |

Record actual versions and physical-device availability. If hardware or software is unavailable, label the case Not tested and assign a completion owner; do not substitute a viewport screenshot as a TalkBack/VoiceOver pass.

### Repeatable manual task script

1. Start without relying on vision/color/sound/drag in separate runs. Find primary navigation and identify current page.
2. Search a book, inspect a result, add it, and identify success. Simulate validation failure, slow save, offline local save, and retry without losing entry.
3. Open date picker, choose month/year/date by keyboard and screen-reader gestures, cancel once and commit once. Confirm spoken date matches stored civil date.
4. Open book actions through visible menu and then through swipe/long press; verify equivalent choices and cancellation. Delete only a fixture, checking clear consequences and focus restoration.
5. Edit progress by numerical entry and by slider; confirm correct unit. Finish a reading session while muted and reduced motion is active; identify saved state/reward from text.
6. Create a list and post with validation/network failure. Verify draft stays intact and errors can be found and corrected. Confirm return focus and updated content without scroll jump.
7. Navigate Back from direct link, nested detail, an open sheet, and a dirty composer. At each step identify where focus went.
8. Increase text/zoom, apply text-spacing overrides, switch theme and forced colors. Confirm primary actions, dates, inline error messages and bottom controls remain usable.
9. Resize a tablet/foldable mid-task with keyboard open. Confirm context/draft/focus and no horizontal page scroll in ordinary content.
10. Trigger simultaneous streak/reward/badge events from fixtures; verify concise result, no takeover during editing, and later access to achievement information.

Usability testing should include compensated participants with relevant access needs and realistic reading/library tasks. Automated and developer-led checks do not replace their feedback. Use opt-in research and synthetic/sanitized fixtures; do not collect disability status as application telemetry or infer it from assistive-technology use.

## 8. Completion gates and maintained evidence

Release blockers: inaccessible essential task; keyboard trap; missing name/state on critical control; unrecoverable focus loss; gesture-only essential action; inaccessible authentication; hidden save/cancel at supported large text; motion ignoring OS preference; unannounced blocking error; no equivalent for essential audio/visual information. Severity follows user impact, not merely checker labels.

Every affected task needs an evidence row containing route and state, source symbol, criterion/project contract, runtime/device/AT version, test steps, result, artifact, owner, and follow-up. Record Passed, Failed, Not tested, or Not applicable with rationale. Never turn Not tested into Passed because a library claims accessibility.

Complete each implementation slice only when relevant automated checks pass, manual device/AT tasks have evidence, theme/font/icon preservation is checked, and any remaining release blocker is resolved. Keep known limitations visible in the plan ledger. Publish an accessibility statement only from verified scope and a maintained contact/remediation process; do not claim compliance for untested screens, native integrations, or exports.

Before adopting a new primitive, compare it against the existing working semantic behavior. Before deleting old tests, show replacement coverage. Update the frontend skill with the durable rule and link to this plan; keep transient failure logs in evidence documents. No application behavior was changed by this planning document.
