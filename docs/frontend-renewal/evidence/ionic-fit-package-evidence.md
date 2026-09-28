# Ionic F06 package and API evidence

Retrieved 2026-09-27 against BRACK baseline `2ddc1c2`. This record establishes the experiment's dependency/API boundary, not a final adoption decision or native-device validation. The F06 implementation checkpoint owns the final fixture, measurements and decision.

## Published dependency matrix

Official npm registry metadata was retrieved with read-only `npm view <package>@<version> ... --json --offline=false`. The web retrieval tool could not open registry endpoints, and the default sandbox npm cache had no matching metadata; approved network retrieval succeeded. Exact installed fixture artifacts must match these pins.

| Package | Published pin | Peers / relationship | License |
| --- | --- | --- | --- |
| `@ionic/react` | `9.0.5` | React and React DOM `^18 || ^19`; depends on exact `@ionic/core` `9.0.5` | MIT |
| `@ionic/react-router` | `9.0.5` | React/DOM `^18 || ^19`; `react-router` and `react-router-dom` `>=6.4.0 <7`; published artifact depends on exact `@ionic/react` `9.0.5` | MIT |
| `@ionic/core` | `9.0.5` | No Capacitor peer requirement declared; dependencies include Stencil, Ionicons and tslib | MIT |
| BRACK `react` / `react-dom` | `18.3.1` installed | Satisfy the candidate peers | Existing dependency |
| BRACK `react-router` / `react-router-dom` | `6.30.4` installed | Satisfy the candidate peers | Existing dependency |
| BRACK `@capacitor/core` | `7.4.4` installed | Remains the native runtime; Ionic UI does not require a Capacitor upgrade | Existing dependency |

Metadata sources: [React registry](https://registry.npmjs.org/@ionic%2freact/9.0.5), [router registry](https://registry.npmjs.org/@ionic%2freact-router/9.0.5), [core registry](https://registry.npmjs.org/@ionic%2fcore/9.0.5). The [official 9.0.5 release](https://github.com/ionic-team/ionic-framework/releases/tag/v9.0.5) is dated 2026-09-23; npm records router publication at `2026-09-23T18:45:54.379Z`. Both React packages were registry `latest` at retrieval, not merely versions read from an upstream development branch.

**Router 6 is supported by this published candidate.** A read-only comparison of `@ionic/react-router@8.8.0` found Router/DOM peers `^5.0.1`; that older requirement does not describe 9.0.5. Do not downgrade BRACK routing or reject the candidate based on old examples. Matching peer ranges permits the experiment; it does not establish that BRACK's complete route/overlay behavior works unchanged.

Registry integrity values:

```text
@ionic/react@9.0.5
sha512-a77jWFtVxWZ5nprZqu8DMOpPjwIoCX3UxUbgQcPQ2ARu4a+Lqr9s045ddFoo8NHDCfBTcpMFbIby0Sns6AOMrQ==

@ionic/react-router@9.0.5
sha512-0m3AjK4D1nmeEOSMmUzvgqg11N48SXyeCbPVMIp1doDypewT+PqPXNGJrgcxP269/RQFa/Cn6n15HSPMBCe/aQ==
```

Registry unpacked sizes are React **1,144,749 bytes**, router **479,351 bytes**, and core **20,775,238 bytes**. These describe installation artifacts, not browser transfer. The isolated lockfile pins the resolved transitive packages; no main application dependency or native plugin upgrade is implied. React/core introduce Ionicons transitively; BRACK continues to use Iconoir for product icons.

Installed verification in `tests/fixtures/ionic-fit` succeeded: `npm ls @ionic/react @ionic/react-router @ionic/core react react-dom react-router react-router-dom --depth=1` exited 0, and the installed package peers matched the table. Both React-package integrity values in the fixture lockfile matched the registry values above. The fixture has its own React installation and imports shared BRACK source through Vite aliases; the Vite experiment resolves/dedupes React and Router consistently to avoid two runtime instances even when version strings match.

Final dependency isolation correction: the initial fixture package unexpectedly contained `brack-monorepo: file:../../..`, with a linked root package and `../../..` metadata in its nested lockfile. The originating install log had rotated out, so the specific cause is unverified; do not infer that `--prefix` alone necessarily creates this link. The dependency was removed, package operations were rerun with the fixture as the explicit working directory, and the nested lockfile was regenerated to remove npm's retained orphan metadata. The corrected lockfile has 54 package records (fixture root plus 53 installed packages), no parent-path records, and no link entries. Shared component imports require no dependency on the monorepo package. Reproduction instructions now use fixture working-directory `npm ci --workspaces=false --ignore-scripts --no-audit --no-fund`.

Final clean-install verification: `npm ci` installed 53 packages successfully; scoped `npm ls` again exited 0 with the same Ionic/React/Router versions, and `npx tsc -p tests/playwright/tsconfig.ionic-fit.json --noEmit` passed using the freshly installed type packages. The [remeasured production fixture](ionic-fit-bundle.md) retained its prior manifest hash and content-hashed assets. SHA-256 checks confirmed that root `package.json`, root `package-lock.json` and `apps/client/package.json` were unchanged.

Installed transitive versions inspected directly: `ionicons@8.1.0`, `@stencil/core@4.45.1`, `@stencil/react-output-target@1.6.2` (all MIT), and `tslib@2.8.1` (0BSD). The React output-target package also brings `@lit/react`, `html-react-parser`, `react-style-stringify` and `ts-morph`; the isolated lockfile is authoritative for their full resolved graph. No assertion is made that every installation dependency is shipped into the browser bundle.

## Version-matched route API

The rendered Ionic navigation/API pages returned HTTP 403 during retrieval. The accessible [raw navigation guide](https://raw.githubusercontent.com/ionic-team/ionic-docs/main/docs/react/navigation.md) still used Router 5 `Redirect`, `render` and `component` examples. The experiment therefore uses installed types and the official **v9.0.5 tag**, successfully fetched through approved read-only HTTP requests, as the version-specific API evidence.

| Verified source | Consequence for the fixture |
| --- | --- |
| [`IonReactRouter.tsx`](https://raw.githubusercontent.com/ionic-team/ionic-framework/v9.0.5/packages/react-router/src/ReactRouter/IonReactRouter.tsx) | Owns a BrowserRouter and accepts its props, including `basename`. Replace the experiment's outer BrowserRouter; never nest both roots. Internal `useLocation` and `useNavigationType` feed Ionic routing. |
| [`routeElements.ts`](https://raw.githubusercontent.com/ionic-team/ionic-framework/v9.0.5/packages/react-router/src/ReactRouter/utils/routeElements.ts) | Supports `IonRouterOutlet > Routes > Route element={...}` and direct Route/IonRoute children. Use Router 6 elements rather than obsolete render/component props. |
| [`IonRoute.tsx`](https://raw.githubusercontent.com/ionic-team/ionic-framework/v9.0.5/packages/react/src/components/IonRoute.tsx) | Optional IonRoute uses `element`, `path`, `index`, `caseSensitive` and Ionic page-management options. |
| [`IonTabs.tsx`](https://raw.githubusercontent.com/ionic-team/ionic-framework/v9.0.5/packages/react/src/components/navigation/IonTabs.tsx) | Recognizes the outlet as a direct child; requires either an outlet or standalone IonTab children and rejects mixing both. Avoid an arbitrary wrapper between tabs and outlet. |
| [`ReactRouterViewStack.tsx`](https://raw.githubusercontent.com/ionic-team/ionic-framework/v9.0.5/packages/react-router/src/ReactRouter/ReactRouterViewStack.tsx) | Owns retained view items and Router 6 route context. Lifecycle and hidden-page behavior need direct tests; React unmount cannot be treated as page leave. The supported peer range explicitly excludes Router7. |

Pages in the route-stack experiment use IonPage and one Ionic scroll owner. The primitive experiment keeps BRACK's BrowserRouter and ordinary application scrolling. Success in one boundary is not evidence for the other.

Source investigation during the navigation experiment identified a concrete gate concern in `StackManager.transitionPage`: the installed 9.0.5 router maps route directions `none`/`root` to an undefined transition direction. With a leaving page and no progress animation, its special non-animated branch skips `routerOutlet.commit` and changes DOM visibility without emitting the page enter/leave lifecycle events. The installed bundle anchors are `@ionic/react-router/dist/index.js` around 2581 and 2697–2781; the matching [tagged StackManager source](https://raw.githubusercontent.com/ionic-team/ionic-framework/v9.0.5/packages/react-router/src/ReactRouter/StackManager.tsx) contains the same branch. This depends on route direction, not simply the global reduced-motion/animated setting. The navigation fixture's independent lifecycle/subscription probes must establish the observed consequences and final gate result; do not compensate by fabricating Ionic lifecycle events or weakening the assertions.

## Primitive, style and effect ownership

[`IonModal.tsx`](https://raw.githubusercontent.com/ionic-team/ionic-framework/v9.0.5/packages/react/src/components/IonModal.tsx) wraps a custom element without importing Ionic routing. The [modal implementation](https://raw.githubusercontent.com/ionic-team/ionic-framework/v9.0.5/core/src/components/modal/modal.tsx) defaults `focusTrap=true`, `keepContentsMounted=false`, and `canDismiss=true`; it exposes breakpoints and dismissal events. A tested adapter must keep one focus/dismissal owner, synchronize React `isOpen` after dismissal, provide a visible close/cancel path, protect a dirty draft, and return focus. Do not wrap a Radix/Vaul overlay around the same IonModal.

The [datetime implementation](https://raw.githubusercontent.com/ionic-team/ionic-framework/v9.0.5/core/src/components/datetime/datetime.tsx) supports date presentation, min/max, year values, locale and explicit confirmation. This does not prove BRACK date parity. Retain date-only strings, existing validation/parsing and direct historical entry; test calendar confirmation/cancellation and timezone behavior. Do not convert a civil date into a UTC timestamp to satisfy a widget interface.

[`core.scss`](https://raw.githubusercontent.com/ionic-team/ionic-framework/v9.0.5/core/src/css/core.scss) defines Ionic color/font variables, platform font defaults, and overlay/body rules. [`structure.scss`](https://raw.githubusercontent.com/ionic-team/ionic-framework/v9.0.5/core/src/css/structure.scss) applies global body layout, overflow and overscroll rules. Importing Ionic is therefore not automatically style-isolated. Compare the primitive fixture with and without necessary Ionic CSS, verify ordinary body/main scrolling, and map BRACK's existing fonts/theme tokens into Ionic variables and shadow parts, including portal content. Avoid importing a complete Ionic stylesheet catalogue into production without these checks.

Safe areas retain an explicit owner; do not apply the same inset to both page shell and nested IonContent. Modal focus/scroll ownership is distinct from page scrolling. Native plugins, permissions, hardware Back, predictive Back and system gestures remain separate runtime/device concerns. Browser emulation cannot certify them.

## License and measurement boundary

The packages declare MIT; the [tagged core license](https://raw.githubusercontent.com/ionic-team/ionic-framework/v9.0.5/core/LICENSE) includes the Drifty copyright and MIT notice. Preserve shipped third-party notices in the existing release process. Registry license metadata does not replace checking installed notices and the actual transitive lockfile.

Installed notice inspection: `@ionic/core/LICENSE` matches the tagged Drifty MIT text. Ionicons and Stencil core include `LICENSE`; the React output target includes `LICENSE.md`; tslib includes `CopyrightNotice.txt` and `LICENSE.txt`. The two Ionic React package roots contain MIT metadata but no separate top-level license/notice file. A shipping notice inventory should retain the upstream Ionic MIT notice rather than assume each package ships its own copy. This experiment does not claim a complete legal audit of the monorepo.

`tests/fixtures/ionic-fit/measure-build.mjs` reads the production Vite manifest after a successful fixture build. It follows static imports for each entry's initial JS/CSS closure, counts files once, and reports dynamic/lazy chunks separately. Raw bytes are emitted file lengths; gzip values compress each file independently at level 9. HTML, images/fonts, native binaries, caching and HTTP overhead are excluded. The matched primitive comparison is `index.html` against `baseline.html`; `navigation.html` contains a different route/tab experience and must not be described as an equivalent baseline delta.

The completed F06 decision is **DEFER production Ionic adoption**, as recorded in the [living decision](../../ui-ionic-fit.md) and [checkpoint 16](../16-ionic-fit-experiment.md). The final combined browser run recorded 97 ordinary passes, 5 declared failed adoption gates and no unexpected outcomes. Published peer compatibility was established, but the observed route lifecycle and modal keyboard-focus gaps prevent adoption of the tested configuration. Preserve current BRACK primitives and the isolated reproduction, then reopen only against the decision's concrete criteria. No production adoption or legal/accessibility conformance is established by this package record.
