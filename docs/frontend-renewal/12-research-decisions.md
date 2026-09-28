# Research provenance and decision register

Research date: 2026-09-27. Official product/standards/legal sources are linked beside the decisions they support. BRACK-specific architecture, thresholds and layouts are proposed applications, not requirements quoted from those sources. Recheck version-sensitive guidance when implementing.

## Requested sources

| Source | Retrieval and relevance | Application / limits |
| --- | --- | --- |
| [Ionic components](https://ionicframework.com/docs/components) | Reviewed component catalogue and selected component guidance | Candidate mobile primitives; select by task and preserve BRACK identity. Catalogue availability does not mean packages are installed. |
| [Ionic native](https://ionicframework.com/docs/native) | Reviewed native integration entry point with versioned Capacitor API references | Native functionality belongs behind adapters. Ionic web components are not automatically OS-native widgets; Capacitor capability is separate from presentation. |
| [Samsung One UI guide](https://design.samsung.com/global/contents/one-ui/download/oneui_design_guide_eng.pdf) | Retrieved 93-page PDF, read relevant architecture/navigation/component text; requested screenshots of printed pages 7, 31, 32 | Reachability, adaptive layout and stable navigation inform the proposal. This is an older design reference, not a requirement to copy Samsung visuals or old numeric dimensions. |
| [Apple swipe gestures](https://developer.apple.com/documentation/uikit/handling-swipe-gestures) | Full article retrieval limited; official indexed material and [Apple HIG gestures](https://developer.apple.com/design/human-interface-guidelines/gestures) supplement it | Recognizable task gestures with visible alternatives. UIKit recognizer APIs are not directly usable React APIs; use the owning platform/web gesture system. Recheck full article for any implementation-specific claim. |
| [Material gestures](https://m3.material.io/foundations/interaction/gestures) | Requested page returned a JavaScript shell, not readable full guidance | Do not claim a complete read. Use official [Android gesture navigation](https://developer.android.com/develop/ui/views/touch-and-input/gestures/gesturenav) guidance for system-edge conflicts; validate behavior on device. |
| [Laws of UX](https://lawsofux.com/) | Reviewed catalogue and twenty selected principle pages linked in 08 | A heuristic lens for task decisions. Catalogue has more than twenty entries; selected twenty are explicit, not a purported exhaustive modern index. |

### One UI interpretation for BRACK

The guide separates viewing and reachable interaction regions (printed p7), adapts to tablets/foldables (p12), distinguishes bottom action toolbars from destination tabs (p30), and describes stable labeled primary tabs plus tablet spacing (pp31–32). These ideas support reachable reading controls, distinct navigation/action ownership and window-aware composition. They do not require copying Samsung typography, iconography, exact margins, every expandable header, or horizontal swipes between primary destinations. [One UI guide](https://design.samsung.com/global/contents/one-ui/download/oneui_design_guide_eng.pdf).

BRACK's proposed response is concrete: simplify fixed chrome, keep native compact bottom tabs, use a browser-specific destination surface, retain touch-friendly tablet patterns and avoid a giant expanded title when the keyboard or short landscape window needs the space. Validate these decisions against task completion and accessibility rather than treating a brand guide as conformance law.

## Additional primary references

- Ionic [modal behavior](https://ionicframework.com/docs/api/modal), [datetime](https://ionicframework.com/docs/api/datetime), [hardware Back](https://ionicframework.com/docs/developing/hardware-back-button), and [dynamic font scaling](https://ionicframework.com/docs/layout/dynamic-font-scaling) inform 03/04/07. Version-match them to any selected dependency.
- The rendered [Ionic React navigation page](https://ionicframework.com/docs/react/navigation) was retrieval-limited. Upstream [router package metadata](https://raw.githubusercontent.com/ionic-team/ionic-framework/main/packages/react-router/package.json) indicated version 9.0.4 and React Router 6-compatible peer ranges during research, while [documentation source](https://raw.githubusercontent.com/ionic-team/ionic-docs/main/docs/react/navigation.md) included older v5-style examples. `main` may change and is not proof of the published stable release. F06 must inspect the selected release artifact/registry and installed peers before any migration decision.
- Capacitor's versioned [App API](https://capacitorjs.com/docs/v7/apis/app), [Keyboard API](https://capacitorjs.com/docs/v7/apis/keyboard), and [Haptics API](https://capacitorjs.com/docs/v7/apis/haptics) are relevant to the current major. Verify which plugins are actually installed; a documentation link is not evidence of app support.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) is the engineering target; [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) provides widget interaction references. The accessibility document links criterion-specific material and conditional US/EU obligations. No conformance certification is implied.
- [Web Vitals](https://web.dev/articles/vitals) supports web field metrics. Proposed local route/gesture budgets remain BRACK measurements, not borrowed legal or universal limits.

## Decisions

| ID | Status | Decision and reason | Revisit when |
| --- | --- | --- | --- |
| D01 | Fixed direction | Preserve brand assets, font roles, theme IDs and Iconoir. Improve hierarchy/composition rather than rebrand. | Explicit user direction changes identity |
| D02 | Fixed direction | Reuse one renderer/domain model with adaptive presentation; no new UI workspace or full source-tree move initially. | Proven additional consumer/ownership boundary justifies extraction |
| D03 | Proposed default with validation gate | Native and standalone compact app surfaces keep bottom destinations; compact browser uses header + explicit destination menu. | Browser findability test supports slim tabs instead; record tradeoff, keep single chrome owner |
| D04 | Fixed initial rollout | Keep Home/Library/Lists/Feed/Readers destination identities and social gating. | Evidence supports a separately scoped information-architecture change |
| D05 | Proposed default | Compact <600, medium 600–1023, expanded ≥1024 CSS px are trial bands; pane fit/text/input decide details. | Large-text, localization or physical tablet tests show poor fit |
| D06 | F06 decision: defer production adoption | The isolated published Ionic9.0.5 experiment failed tab lifecycle and modal focus-cycle gates; retain React Router6/Radix and custom BRACK composition. [Decision and evidence](../ui-ionic-fit.md). | A pinned supported release passes the unchanged gates, measured cost is justified, then physical-device/AT checks pass |
| D07 | Fixed behavioral constraint | One scroll owner and one effective back/gesture/overlay owner; system gestures have priority. | A documented scoped nested surface needs explicit arbitration |
| D08 | Fixed behavioral constraint | Visible gesture alternatives, preserved zoom, cancellation/movement thresholds and accessible reorder. | Particular nonessential gesture fails ergonomics and should be removed |
| D09 | Fixed behavioral constraint | No decorative delay before content, save or navigation; brand effect follows state. | Never weaken for exposure time; adjust art/timing only |
| D10 | Proposed measured budget | 06 owns candidate feedback/route/frame targets; establish baseline before release enforcement. | Representative device traces justify documented calibration |
| D11 | Fixed behavioral constraint | Preserve custom date-only/calendar/input behavior and existing regressions. | A replacement demonstrably passes all parity contracts |
| D12 | Fixed behavioral constraint | Accessibility works without opt-in; reduced effects/haptics preferences add control. | Scope of an optional preference changes, never basic access |
| D13 | Conditional legal scope | WCAG 2.2 AA engineering target; applicable statutes/contracts require actual business/jurisdiction review. | Deployment market, customer type, service scope or law changes |
| D14 | Fixed evidence policy | Separate confirmed source, fixture observation, hypothesis and unverified device claims. | Always maintained; new evidence changes status explicitly |

## Outstanding evidence and who resolves it

| Question | Default that lets work proceed | Resolution owner / gate |
| --- | --- | --- |
| Exact supported OS/browser floor | Use current project build targets; don't invent support policy | Product/release owner at F00; actual device matrix recorded |
| Which Ionic release and routing boundary | F06 tested published9.0.5; production adoption deferred. Existing router/primitives support continued renewal. | Reopening criteria in the [integration decision](../ui-ionic-fit.md) |
| Browser destination menu discoverability | Proposed explicit labeled menu with current primary routes | UX/implementation owner at F09 study; slim-tab fallback in 03 |
| Warm route lag root causes | Preserve data and remove proven artificial waits; trace suspects | Frontend performance owner F00/F19 |
| Contrast of every theme and native text behavior | Keep brand; treat contrast/AT as unverified until measured | Accessibility/design owner each slice and F20 |
| Real fold/hinge/platform gesture behavior | Continuous adaptive fallback; no dependence on experimental APIs | Native QA F09/F20 |
| Legal applicability and final policy copy | No global compliance claim; current support placeholders remain truthful | Product/legal/content owner before relevant release |
| Need for pinch beyond ordinary page/image zoom | Preserve standard zoom; don't add a pinch feature without useful task | UX owner of media/chart surface |

These are evidence gates with explicit fallback, not unanswered questions that block this documentation deliverable. New user choices can revise defaults, but future agents should not ask for repeated permission merely to carry out an already-authorized implementation slice.
