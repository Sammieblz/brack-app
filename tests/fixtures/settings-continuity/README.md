# CR03 actual Settings continuity fixture

This fixture renders production `Settings` and all eight actual sections. It owns port **8096**, cache `node_modules/.vite/settings-continuity`, and output/report prefix `test-results/cr03-settings-continuity`. Run browser matrices sequentially on this Windows workspace with one worker. Preserve diagnostic runs under distinct output/report names.

```sh
npx tsc -p tests/playwright/tsconfig.settings-continuity.json --noEmit
npx eslint tests/fixtures/settings-continuity tests/e2e/settings-continuity.spec.ts tests/playwright/settings-continuity.config.ts --max-warnings=0
npx playwright test --config tests/playwright/settings-continuity.config.ts
```

## What remains real

Settings categories, section URL ownership, the one active editor, all forms, `ReadingHabitsSection`, `DatePicker`, `ImagePickerDialog`, `useImagePicker`, `useFollowing`, `useReadingProfile`, `useOnboardingStatus`, `usePushNotifications`, ProfileContext and ThemeContext remain production code. Router, the application Back coordinator, local Settings guards, confirmation primitives, shell layout and utility presentation also remain real. The native picker callback is controlled at the Camera plugin boundary; a separate browser case exercises the actual ephemeral file-input fallback through Playwright's file chooser.

The fixture inherits unrelated shell books/rewards/timer/notification/scanner state aliases from the earlier fixtures. Those aliases are enumerated in `vite.config.ts` and explicitly do not prove those workflows. Target Settings hooks/components are not replaced. Profile and theme contexts have their real providers.

## Service and device boundaries

`api.ts` supplies deterministic profile, reading, notification, following, theme and privacy reads/writes. The privacy Supabase client adapter implements only the existing profile read/update chain; it makes no database connection. `portability.ts` controls parse/preview/commit/export outcomes, so these cases verify the form's file/preview ownership rather than archive parsing, encryption or actual import persistence. Export saving does not write outside the fixture.

`devices.ts` reuses the synthetic Capacitor Back bridge and adds Camera, geolocation and push service boundaries. A location case fulfills the existing reverse-geocode request with deterministic service data; it does not validate GPS permissions or geocoding providers. `runtime=android` is emulated app Back and native-picker dispatch, not a physical Android device. The tablet-touch profile explicitly overrides capability media queries separately from runtime. Native time fields remain actual `input[type=time]` controls; no application TimePicker is invented.

`window.settingsContinuity` exposes controlled resolve/reject/defer requests, recorded payloads, account/auth-loading changes, actual Router navigation and synthetic app Back. Account password draft continuity uses the actual form; external CAPTCHA and real password updates are not acceptance claims.

## Scenario coverage

- Six editable sections retain the same owner and field nodes, focus, supported caret selection and draft across 767/768, 834, 1024, 1280 and 320 pixels. Data retains the actual file input and import preview; reading retains genre/time choices; notifications retain native quiet-hour values.
- Actual section departure exercises Keep editing, emulated app Back, Escape of the dirty confirmation, expanded category Discard and new-heading focus, and compact return-category focus.
- Profile, personal information, reading and notification saves cover pending locks, duplicate suppression, deferred rejection, retained draft, retry and clean departure. Data covers pending/rejected commit and retained preview; privacy covers serialized optimistic updates and rollback.
- Nested photo and date tasks retain real nodes through resize. Photo failures retain the selected preview for retry without overwriting unsaved text. An obsolete native picker result cannot upload for a replacement account. Account changes also withdraw obsolete dirty confirmations.
- Sign out covers pending refusal to close, rejection and explicit retry. Existing current-location automatic save remains intact and tested through a rejected write.
- Actual Menu, sidebar and emulated native tabs exercise pending/dirty route departure; Menu and sidebar Sign out hand off to the Settings-owned confirmation. The native-tab case ends field editing with a real heading click before accessing tabs because the production shell deliberately hides them during editing.
- Visual cases exercise all eight actual sections at 320, 834 with 200% text, explicitly coarse 834 with 200% text, and short 390×480. Each requires loaded declared Inter/Merriweather/Playfair faces, no horizontal editor overflow, and pointer/viewport access to writing and final action controls before PNG capture. Coarse tablet cases also inspect actual photo/calendar sheet presentation.

Fixtures and assertions are coverage definitions, not evidence that a run passed. The active CR03 checkpoint owns exact run results and visual review. Real backend storage, import algorithms, physical devices, system pickers/keyboards, CAPTCHA, screen readers and cold-route performance remain unverified.

The actual Account password action stays disabled without its external CAPTCHA. Its visual check asserts disabled state and full viewport fit; enabled actions additionally require hit testing across their height. Unit tests cover Account write ownership. This fixture does not bypass CAPTCHA or claim an actual password change.

## Preserved diagnostic history

- `cr03-smoke-1`: 1/4 passed. Two real expanded Discard focus failures and one 320px Reading header overflow led to production corrections.
- `cr03-chromium-1`: 22/29 passed. The original focus/Reading corrections passed. Remaining failures exposed Data export-row overflow and an input-to-Preview first-click interruption; fixture assumptions also needed correction for hidden native tabs, the intentionally disabled password action, and the calendar's actual `Close calendar` name.
- `cr03-data-pointer`: zero tests selected by an incorrectly anchored title filter; this is not a pass. Corrected `cr03-data-pointer-2`: 0/2 passed, reproducing the first-click issue. `preview-pointer-trail` records the button staying in place while pointerdown hits Preview and pointerup hits a newly restored footer child, so the final click does not activate Preview.
- `cr03-data-fixed`: 2/2 passed after footer restoration waited until pointer activation completed; the same trail now records Preview receiving pointerdown, pointerup and click.
- `cr03-full-1` was stopped after all 29 Chromium cases completed: 27 passed, 2 failed at the same newly reached Account recovery-link overflow at 834px/200% text. Both Data geometry profiles, native-tab departure, disabled Account action geometry at 320/short height, and nested tablet sheet hit checks passed. A WebKit worker started but no WebKit result completed before interruption. The JSON report did not flush; console, screenshots and failure traces preserve the completed evidence. No complete three-engine result is claimed for this attempt.
- `cr03-visual-1`: 4/4 Chromium visual scenarios passed after the Account action row wrapped. All eight sections were reached in all four profiles. `test-results/cr03-visual-review` contains 66 PNGs, 32 loaded-font JSONs and 32 geometry JSONs from this run for human review.
- `cr03-full-2`: 83/87 passed: Chromium 29/29, Firefox 29/29, WebKit 25/29. Four WebKit continuity scenarios failed an Escape sent immediately after the dirty confirmation became visible; every visual profile passed in all engines.
- `cr03-continuity-final`: 17/18 passed after adding an observable safe-action focus assertion before Escape. The original four WebKit cases passed, but WebKit Data still lost one Escape despite confirmed Keep editing focus. This remains a real failure; the focus assertion alone did not resolve acceptance.
- `cr03-escape-diagnostic`: three unchanged WebKit Data repetitions passed with optional passive event recording (`CR03_ESCAPE_DIAGNOSTICS=1`). In these healthy runs, layer-update preceded Escape by 38/48/41ms; the event targeted the focused Keep editing button and was prevented during primitive dismissal. They do **not** establish the failed event's exact timing. Installed Radix source computes layer index at render and refreshes callback/layer registration through passive effects, supporting a possible readiness race; that explanation is an inference, not directly captured proof.
- Root added a localized own-content Escape fallback to `MobileAlertDialog`, respecting already-handled events, composition and nested dialog/menu/listbox ownership. A test-only transform removing the fallback made the actual immediate-safe-focus Escape regression fail; current-source immediate/nested tests passed. This establishes the behavioral correction without claiming the failed WebKit event's internal timeline was captured.
- `cr03-continuity-fixed`: **18/18 passed** across Chromium, WebKit and Firefox after that production correction, including all six complete continuity/departure scenarios. It overlaps the earlier full matrix; do not add the counts or label `cr03-full-2` a clean 87/87 result.
- `cr03-escape-fixed-repeat`: **3/3 passed** in post-fix WebKit Data repetitions with passive diagnostic recording. Browser ownership was then released for the root agent's separate shared-shell/overlay regressions.

Each run retains a separate JSON report, console log, screenshots and traces under `test-results`. [Checkpoint 23](../../../docs/frontend-renewal/23-settings-continuity.md) is authoritative for final acceptance and remaining limits.
