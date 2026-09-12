# Brack loading motion

Issue [#74](https://github.com/Sammieblz/brack-app/issues/74) replaces the
generic floating-mark/orbit loader with one shared, finite book-opening system.
The implementation candidate can be reviewed locally in the loading fixture:

```sh
npx playwright test --config=tests/playwright/loading.config.ts --project=chromium
```

For interactive review, start the isolated fixture and open these URLs:

```sh
npx vite --config tests/fixtures/loading/vite.config.ts
```

- `/?surface=loader&variant=compact&delay=0`
- `/?surface=loader&variant=inline&delay=0`
- `/?surface=loader&variant=section&delay=0`
- `/?surface=loader&variant=fullscreen&delay=0`
- add `&progress=37` only for genuinely determinate work

The storyboard below is the production candidate. It still requires human
visual sign-off before merge; automated checks cannot approve art direction.

## Motion storyboard

| Time | Book state | Purpose |
| ---: | --- | --- |
| 0-159 ms | Nothing is shown. Inline/section placements reserve their geometry; full-screen placement does not block content. | Avoid flashing for fast work. |
| 160-360 ms | A complete hardcover volume appears with Brack's canonical B centered on its front board. The cover lifts from the shared spine. | Establish a recognizable book before it moves. |
| 361-1080 ms | The cover opens onto the left board while the page block, cover thickness, gutter, and cast shadow resolve into one perspective. | Make the hinge and physical depth legible at small sizes. |
| 792-1600 ms | One restrained paper leaf turns right-to-left around that same gutter. | Add a literary waiting cue without starting a loop. |
| 1601 ms onward | The open book is static, with a small Brack B printed on the right page. | Keep the brand visible after the cover opens and bound the motion. |
| Completion | The loader is removed immediately, with no minimum display time or delayed callback. | Never hold navigation or ready content. |

The sequence uses one 1650ms CSS timeline. It does not loop. Cover, page and
shadow share a perspective and hinge, so layer order does not drift between
placements. Motion uses only `transform` and `opacity`; `will-change` exists
only during the active/paused sequence and disappears when the component moves
to its `settled` state.

## Placement variants

| Variant | Intended use | Centering contract |
| --- | --- | --- |
| `compact` | A constrained, genuinely blocking subflow | The complete book/text group is centered by its component host. It is not a tile placeholder. |
| `inline` | A short standalone workflow wait | The complete book/text group is centered by its component host. It is not used while retained content can remain visible. |
| `section` | A focused workflow region, such as remote book search | Owns a responsive minimum block size and centers itself in both axes. |
| `fullscreen` | Auth, onboarding completion, adding a book, initial route chunks, and truly blocking bootstrap work | Fixed to the visual viewport, safe-area padded, and centered in both axes. |

Prefer retained content and `LoadingRegion` for refreshes. A full-screen loader
is not a substitute for a section skeleton or optimistic/offline content.
Dashboard, book-list, quote, reading-statistics, and streak tiles use structural
skeletons rather than repeating the branded book. Onboarding retains its folio
shell and copy for bootstrap, then uses the fullscreen treatment only while a
final save is genuinely blocking.

## Timing and state contract

- Default appearance threshold: 160ms.
- Completion: controlled by `active`; changing it to `false` removes the loader
  in the same render. There is no exit timer.
- Progress: rendered only for a finite numeric value and clamped to 0-100.
  Unknown work keeps an operation-specific status without a fake percentage.
- Route redirects: `BrandedRouteTransition` and `OnboardingRouteTransition`
  now use React Router's immediate `Navigate` path. They do not manufacture a
  wait just to show branding.
- Long waits: callers continue to own cancellation, retry and error recovery.
  The loader never invents actions it cannot perform.

## Accessibility and lifecycle

- Exactly one polite, atomic `role="status"` contains the operation-specific
  message. All book geometry and the Brack mark are decorative.
- Reduced motion and reduced-data preferences use the static open-book state.
- `visibilitychange` and `IntersectionObserver` pause the active sequence when
  the document or loader is not visible. The 1650ms state deadline still moves
  it to a static settled state, so returning to the tab cannot restart a loop.
- Forced colors keep a visible cover, pages, spine and status text.
- The canonical `apps/client/public/brack-mark.webp` remains the only raster
  dependency. It is a lossless transparent 512px media-pipeline asset, large
  enough for the biggest loader at 1x/2x/3x density. Pages remain CSS geometry
  so they are sharp, theme-aware and do not create duplicate raster variants.

## Verification budget

The loading Playwright fixture checks 320px through 1440px placement, every
registered light/dark palette, forced colors, reduced motion, fast and slow
completion, determinate/indeterminate progress, retry/error replacement, and
the 1650ms settled state. During the isolated motion interval, Chromium must
report no task longer than 50ms and no Brack loader animation may remain after
settling.

An isolated production-style esbuild measurement (minified ESM, React and the
existing shared utilities externalized) produced 15,115 bytes raw / 3,914
bytes gzip for the loader JavaScript and CSS together. The issue budget is 5
KiB gzip, so the candidate has 1,206 bytes of headroom. The normal Vite
production build also succeeds; its existing application-level chunk warning
is broader than this loader and should not be attributed to the motion module.

Before closing #74, review the prototype on representative iOS and Android
hardware with normal motion, Reduce Motion, battery saver/low-power mode and a
background/foreground cycle. Record the device/OS and any frame drops in the
issue; desktop emulation is useful evidence but is not a substitute for this
hardware check.
