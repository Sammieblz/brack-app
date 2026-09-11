# Calendar dates and date pickers

Scope: [issue #75](https://github.com/Sammieblz/brack-app/issues/75), accessible historical-date selection across profile, onboarding, goals, and book editing.

## Interaction contract

Use the shared `components/ui/date-picker.tsx` for active date fields. Readers can type a date or open the calendar, choose a year directly from a decade, choose a month, then choose a day. Previous/next decade controls avoid hundreds of month clicks when entering a birth date such as February 5, 1999. Browsing years and months must not change the committed value; selecting a day does.

The picker uses a constrained popover on larger screens and a scrollable accessible sheet on compact screens. Essential day, month, year, and navigation controls have at least 44px targets. The compact layout must remain inside the viewport at 320px and 200% text, including its confirmation/dismissal controls. Respect viewport height, safe areas, focus restoration, and reduced motion; do not add decorative movement to keyboard navigation.

Mobile native date input is not automatically preferable: use it only when the target operating system provides equivalent direct month/year navigation. The existing `MobileDatePicker` is a compatibility input, not the active DOB, goal, or historical-book implementation. Native input value tests verify canonical value handling, not the usability or appearance of an operating-system picker.

## Locale and validation

- Store values as Gregorian `YYYY-MM-DD`, independent of the display locale. Display/entry uses the configured locale's numeric date order and separators with an explicit format hint; ISO `YYYY-MM-DD` is the unambiguous alternative.
- Interpret `02/05/1999` according to the displayed locale, not by guessing whether the reader meant February 5 or May 2. Do not silently swap day/month to make an otherwise-invalid input fit. Reject two-digit years and incomplete or impossible dates with a useful field error.
- Month names, weekday names, full accessible day names, format hints, and picker control/error labels must follow the locale/translation configuration. Caller-supplied field labels still belong to the owning screen; adding picker localization is not a translation of the entire application.
- Built-in control/error translations cover English, Spanish, and French; other locales use English controls unless the caller supplies `labels`. Numeric entry and full spoken date names use `Intl`; English US/GB, Spanish, and French calendar week conventions are configured explicitly.
- Keep a typed draft separate from its last committed date. Invalid or partial input must remain visible; it must not emit a rolled-over date or silently revert to the previous value.
- Consumers must wire `onValidityChange` and block Save, Next, or equivalent persistence while a draft is invalid. The first `onChange` argument is the canonical string or `null`; use that argument for persistence, not the optional JavaScript `Date` convenience argument.
- Optional clearing commits `null`. Required fields must distinguish an empty value from a complete valid date. Bounds apply equally to typing and calendar selection. Browsing alone cannot clear a selection.

`lib/dateOnly.ts` owns strict parsing, locale entry formatting, canonical normalization, bounds validation, and local-today derivation. Do not add a second permissive parser in a feature screen.

## Field-specific rules

| Context | Required | Earliest/latest permitted date | Today |
| --- | --- | --- | --- |
| Settings: date of birth | No | No invented minimum-age rule; no future date | Hidden: not a useful birthday shortcut |
| Onboarding: goal start | Yes | On or before the selected goal end | Offered only when within bounds |
| Onboarding: goal end | Yes | On or after the selected goal start; future deadlines allowed | Offered only when within bounds |
| GoalManager: start/end | Yes | Same inclusive range rules as onboarding; historical and future goals allowed | Offered only when within bounds |
| EditBook: date started | No | On or before today and the selected finish date | Offered only when within bounds |
| EditBook: date finished | No | On or after the selected start date and no later than today | Offered only when within bounds |

An empty partner date imposes no paired bound. Same-day starts and ends are valid. There is no single application-wide date range and no arbitrary 1900 lower limit; date-navigation limits and the parser's supported Gregorian years are not new product age restrictions.

`PersonalInfo` also guards its location autosave, which persists the whole personal-information form. It must not save an old DOB while the reader has an invalid DOB draft. `EditBook` uses the existing offline-capable book update path. `GoalManager` continues to use the existing goal persistence hook. This change does not introduce new network requests to pick or validate a date.

While a location lookup or personal-information save is pending, DOB editing is disabled. This avoids an asynchronous location callback overwriting a newer date draft with an older form snapshot. Save is also disabled until the location lookup completes.

## Persistence and existing records

Birth dates, goal start/end dates, and book start/finish dates are already database `DATE` columns. No schema migration or rewrite of stored records is needed.

Never use `new Date("YYYY-MM-DD")` followed by local formatting for these fields: that interprets the value as a UTC instant and can display the previous day. Likewise, `new Date().toISOString().split("T")[0]` is not the reader's local today near midnight. Use `normalizeDateOnly`, `todayDateOnly`, and the date-only presentation helpers instead.

Some historical client paths supplied full ISO strings for fields whose domain is a calendar date. Compatibility normalization retains the validated leading `YYYY-MM-DD`, preserving the recorded calendar day regardless of its suffix offset. This is explicitly a rule for known date-only fields, not a rule for general timestamps. Invalid persisted strings should not roll forward into another date or crash rendering; editing must offer an understandable correction path.

For a rare civil day entirely skipped in the device's timezone (for example, Samoa's 2011-12-30), the canonical value remains valid for typing and persistence even though no local JavaScript `Date` represents it. The convenience callback date may be undefined; date displays fall back to the canonical value instead of hiding or shifting it. Paired bounds are compared as canonical strings and must not crash the calendar.

Keep real event timestamps as instants: reading-session `start_time`/`end_time`, `logged_at`, `created_at`, `updated_at`, goal `completed_at`, and onboarding completion timestamps are not date-picker values. Do not truncate or reinterpret them as part of this fix. Inclusive goal-day arithmetic must stay DST-safe and preserve onboarding's existing leap-year handling.

## Keyboard and assistive technology

The day grid has one keyboard focus stop and labelled grid semantics. Arrow keys move by day/week; Home/End move to week boundaries; PageUp/PageDown move by month. Year/month navigation preserves the selected value until an explicit day selection. Enter/Space selects, Escape dismisses the temporary surface, and closing restores focus to its trigger. Announce the visible month/year and selection in concise live regions without repeatedly reading every decorative element.

The implementation retains [DayPicker v8 keyboard behavior](https://daypicker.dev/v8/using-daypicker/accessibility) and adds the input/dialog associations described in the [WAI-ARIA date-picker example](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/). In the installed DayPicker v8, `labels.labelDay` is not applied by the default day renderer; the custom `AccessibleDay` deliberately retains `useDayRender` behavior and applies the full-date accessible name itself. Do not remove it assuming the label prop alone is sufficient. On selection, focus returns to the calendar trigger, whose accessible description includes the committed date.

Check visible focus, disabled-day semantics, associated field errors, required/optional meaning, and initial focus on the selected date. A selected date outside newly changed paired bounds must remain visible with validation, not disappear as though the reader cleared it.

`date-picker.css` supplies a theme-token day-focus outline and system-color outlines in forced-colors mode. Keep the `:focus` fallback: Firefox may not mark DayPicker's programmatic arrow-key focus as `:focus-visible`, and shadow-only rings disappear in high-contrast mode. Selected days also receive a high-contrast border so their state does not depend only on a background tint.

## Automated checks

```sh
npm test
npm run test:date-picker:check
npx playwright install chromium firefox webkit
npm run test:date-picker
```

`playwright.date-picker.config.ts` starts an isolated Vite fixture on `127.0.0.1:8083` and requires its own fresh server. The tests block requests outside that fixture origin and do not authenticate, read a live backend, or mutate user data. The fixture imports the production shared picker and native compatibility input, not substitutes for their interactions. It exercises controlled examples of DOB, book ranges, and goal deadlines; it is not a full application-shell or real-screen end-to-end test.

Coverage is layered:

- Date utility tests cover strict parsing, leap years, locale formats, canonical values, legacy compatibility, and timezone-safe helpers.
- Shared picker tests exercise draft validation, bounds, navigation, and accessible semantics.
- `dateFieldContexts.test.tsx` renders actual PersonalInfo, GoalManager, and EditBook consumers with a picker-contract adapter and mocked persistence. It verifies bound configuration, optional null saves, canonical callback values, and invalid-draft save guards. It does not establish native keyboard or browser layout behavior.
- `Onboarding.substance.test.tsx` verifies the real onboarding flow's paired bounds and invalid-draft progression guard, retaining its existing goal validation and persistence boundaries.
- `tests/e2e/date-picker.spec.ts` checks real browser interactions in Chromium, Firefox, and WebKit, including locale ordering, historical years, leap dates, keyboard focus, reduced motion, disabled/required states, compact large-text layouts, and positive/negative UTC timezones around DST dates.

Root-level fixture files sit outside the client workspace's usual quality gates, so `test:date-picker:check` explicitly typechecks and lints the Playwright configuration, browser spec, and fixture. CI runs that gate in Quality Checks and the browser suite in Tests, using the existing three-engine installation. The normal preview smoke configuration excludes this fixture-specific spec. Failed browser runs retain traces without screenshots; CI uploads date-picker failure traces for seven days.

These commands and coverage descriptions are not a claim that the current working tree or a remote workflow passed. Record completed run results separately when handing off the change.

## Remaining manual validation

- Physical iOS and Android: touch navigation, system Back dismissal, keyboard open/close, safe areas, orientation changes, large OS text, and actual native picker month/year access where that path is used.
- VoiceOver and TalkBack, plus NVDA or another desktop screen reader: field names/errors, month/year announcements, grid reading order, selection, and focus return. DOM role assertions alone do not establish assistive-technology usability.
- High-contrast/forced-colors mode, all supported Brack palettes, and real browser zoom in addition to automated text scaling.
- Installed PWA and packaged Electron: platform overlays, window resizing, keyboard behavior, and focus restoration in the actual runtime.
- Real consumer forms with local/test data: selecting, clearing, saving, reopening, and cross-device display of DOB, historical book dates, and goal periods. Never edit production records simply to test a picker.
