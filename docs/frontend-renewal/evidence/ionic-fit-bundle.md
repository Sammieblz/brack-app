# Ionic F06 fixture bundle measurement

Measured 2026-09-27 local time (`2026-09-28T03:33:04.148Z`) after the final clean fixture-only install and rebuild, including reactive modal motion and guarded initial-focus fixes. This measures the experiment, not a BRACK production regression or final adoption decision. Dependency/version and API provenance are recorded in [package evidence](ionic-fit-package-evidence.md).

Command from repository root:

```powershell
node tests/fixtures/ionic-fit/measure-build.mjs --output test-results/ionic-fit-measurements/bundle-report.json
```

The script completed successfully. The ignored JSON artifact is separate from browser-test cleanup. Source manifest: `tests/fixtures/ionic-fit/dist/.vite/manifest.json`; SHA-256: `99CC5CFD9505F7F0842A3EFDBA128F42D8694416D126291D243D993D865A9A0B`. Rebuild and remeasure after any fixture/dependency/build-config change; these numbers describe that artifact exactly.

The final `npx vite build --config tests/fixtures/ionic-fit/vite.config.ts` completed successfully (Vite reported 9.98 seconds and 2,785 transformed modules). Warnings were stale browser-compatibility metadata, two ambiguous existing Tailwind easing classes, the fixture device adapter being both statically and dynamically imported, and an emitted chunk over 500 kB. These were not suppressed or turned into an artificial optimization exercise. The modal entry is `primitives-C__XuHfV.js`.

After removing the unused local monorepo dependency, regenerating the nested lockfile and completing a fresh fixture working-directory `npm ci`, the rebuild produced the **same manifest SHA-256, same content-hashed asset names, and same per-file raw/gzip sizes** as the browser-tested final fixture. The dependency correction did not change the emitted browser graph. Shared React/runtime versions and the singular production runtime markers were rechecked. Root/client package and lockfile SHA-256 values remained unchanged across fixture package operations.

## Initial closures

All numbers are bytes. Gzip compresses each emitted file independently using Node gzip level 9, then sums each unique file once per entry.

| Entry / purpose | Initial JS raw | Initial JS gzip | Initial CSS raw | Initial CSS gzip | Combined raw | Combined gzip |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `baseline.html`: shared reading experience/form with existing Radix dialog | 341,773 | 106,395 | 200,262 | 32,137 | 542,035 | 138,532 |
| `index.html`: same reading experience/form with Ionic modal | 1,221,108 | 291,660 | 211,347 | 34,626 | 1,432,455 | 326,286 |
| Matched primitive minus baseline | **+879,335** | **+185,265** | **+11,085** | **+2,489** | **+890,420** | **+187,754** |
| `navigation.html`: separate Ionic route/tab experience | 1,152,990 | 269,566 | 211,730 | 34,691 | 1,364,720 | 304,257 |

The navigation entry has different content and behavior. Its size is reported independently; comparing it with the form baseline as an equivalent migration delta would be misleading.

Manual manifest/HTML inspection confirmed the script's static closures:

- Baseline loads its entry, shared `NavArrowLeft` and shared `experience` JavaScript, plus the two corresponding CSS files: **3 JS + 2 CSS**.
- Ionic primitive loads its entry and those two shared chunks plus the emitted `core` chunk, with three CSS files: **4 JS + 3 CSS**.
- Navigation loads its entry, shared `NavArrowLeft` and emitted `core` chunks, plus common, core and navigation CSS: **3 JS + 3 CSS**.

Each built HTML entry's script/modulepreload/stylesheet declarations matches that closure. The six dynamic chunks below are not declared as initial HTML modulepreloads.

The emitted `assets/core-DIwFu0fO.js` is **908,442 raw / 195,114 gzip bytes**, and its CSS is **11,085 raw / 2,489 gzip bytes**. That is the bundler's named shared chunk, not a package-size claim that every byte belongs exclusively to `@ionic/core`. The current experiment imports Ionic through its public package exports. No artificial deep-import optimization or altered baseline was applied to reduce the reported delta. A future constrained-import or loading experiment would need a separate build and parity checks.

## Lazy chunks

Both Ionic entries can reach these six additional JS files. The baseline has no reachable dynamic chunk in this manifest. They are possible later loads, **not added to the initial totals**. Shared dependencies already counted in the initial closure are excluded from the additional total.

| Emitted dynamic file | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| `p-BjIkK172-CQgrqWbQ.js` | 506 | 363 |
| `p-CaLdTi8C-iprI01jS.js` | 708 | 495 |
| `p-DNT7yQ4z-Pz8PFrxu.js` | 1,649 | 850 |
| `p-DiqHxuia-_7Yduwwf.js` | 10,436 | 3,049 |
| `p-DrzCm5Hh-De9dC-Kf.js` | 4,849 | 2,182 |
| `p-ls85vUWB-iXT-3756.js` | 972 | 542 |
| Unique additional files | **19,120** | **7,481** |

The manifest repeats one dynamic import key; the traversal deduplicates it. The unique union of all emitted manifest JS/CSS for all three entries is **16 files, 1,541,080 raw bytes / 361,739 gzip bytes**. That build-wide union is neither one entry's initial transfer nor the sum of three separate cold visits.

## React identity check

The fixture has a local dependency installation and also imports shared BRACK source. `vite.config.ts` explicitly deduplicates `react`, `react-dom`, `react-router` and `react-router-dom`; installed versions were checked in the package evidence.

An inspection across every emitted `.js` asset, repeated after the final rebuild, found exactly one `react.production.min.js` notice, one `react-dom.production.min.js` notice and one `react-jsx-runtime.production.min.js` notice, all in `NavArrowLeft-CXhm9Suh.js`. Every entry references that same shared file. No duplicate production React runtime marker was found in another emitted chunk. This is artifact evidence consistent with the dedupe configuration, not a formal module-identity proof; browser integration tests remain necessary to catch actual hook/context failures.

## Limits and use in the decision

This measurement follows the Vite manifest's static versus dynamic import graph. It does not measure real network transfer, runtime parse/evaluation cost, route readiness, hydration, device memory, or whether every lazy chunk is requested in a particular interaction. Actual HTTP compression, cache state and loading strategy can change transfer cost. HTML, source maps, fonts, images, native binaries and protocol overhead are outside the JS/CSS totals.

The comparison shares BRACK's global styles and the same reading form, so its absolute baseline is larger than an empty-component microbenchmark. The measured **187,754-byte initial gzip increase** is a concrete cost of this tested fixture configuration. It should inform a limited/adopt/defer decision alongside behavior and accessibility evidence; it must not be described as bytes already added to the production application. Production dependencies and router remain outside this experiment.
