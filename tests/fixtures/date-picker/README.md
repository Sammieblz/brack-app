# Date picker regression fixture

This local fixture renders BRACK's real `DatePicker`, calendar/overlay primitives,
`MobileDatePicker`, and production Tailwind/theme CSS. A small controlled form
exposes committed values, validity-gated submission, and paired book-date bounds.
No authentication, network data, production credentials, or persistence is used.

The F08 presentation uses the shared adaptive dialog for compact windows and medium
touch windows, and a modal anchored popover otherwise. The primitive family stays
mounted for the current open interaction. Resizing may update its geometry, but
cannot reset a browsed year/month, move focus to another control, or discard an
invalid typed draft. Closing and opening again selects the family for the current
environment. Both families use the same accessible name, such as
`Choose date: Reading date`.

Run `npm run test:date-picker`. The dedicated
server uses strict port 8083 and is always freshly started. Browser requests are
restricted to the exact fixture origin; service workers are disabled. Screenshots
are disabled, including in retained failure traces.

Query parameters select `scenario` (`standard`, `birth-date`, `book`, `native`, `nested`),
`locale`, initial `date`, `theme=dark`, `text=200`, `required=1`, and `disabled=1`.
The scenario cutoff is fixed at 2026-09-11 for reproducible boundary checks.

The tests verify browser interaction, date-only storage, keyboard/focus behavior,
locale input, narrow layouts, enlarged text, light/dark reduced-motion states,
and picker focus restoration inside an existing editing dialog. A short-viewport
test applies explicit bottom padding to exercise safe-area layout clearance; it
does not emulate a device's real `env(safe-area-inset-bottom)` value.
Normal and forced-color keyboard focus is checked using computed outlines;
browser and console errors fail the test rather than being silently ignored.
Resize regressions cross phone, tablet, and desktop widths while preserving a
focused year and an invalid field draft, then verify presentation on reopening.
A touch-capable 834px context checks the sheet policy. At an extreme 160px height
with 200% text, the picker must switch from its calendar-body scroller to one
whole-panel scroller so enlarged actions remain reachable. This synthetic height
test does not establish physical keyboard behavior.
The native wrapper check covers its HTML date value contract, not an operating
system picker. Physical iOS/Android keyboard and picker behavior, installed PWA,
Electron, actual external font downloads, and full account/book/goal persistence
remain outside this fixture's scope.
