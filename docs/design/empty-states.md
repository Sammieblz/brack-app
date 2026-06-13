# Brack Empty-State Illustrations

Brack uses 3D illustrations for meaningful empty, no-results, connection, and completion states. These illustrations should make a blank surface feel intentional without turning normal controls into decoration.

## Asset Source

- Use existing assets from `public/3dicons/`.
- Reference them only through `apps/client/src/config/emptyStateAssets.ts`.
- Do not add third-party icon downloads that require attribution.
- Do not point UI at generated `/empty-states` assets.

## Usage

- Use `PremiumEmptyState` for page, card, panel, popover, and dialog empty states.
- Use `EmptyStateIllustration` only when a custom layout needs the visual without the standard title/copy/action layout.
- Keep functional icons for navigation, tabs, buttons, menus, and status chips.
- Missing book covers may use the 3D notebook visual only in larger placeholder contexts; compact thumbnails can keep the existing simple fallback.

## Theme Treatment

- The icons are intentionally grey clay assets.
- Theme awareness comes from the shared wrapper: primary-color halo, surface-aware shadow, and restrained dark-mode contrast.
- Avoid per-screen filters, glows, or colored boxes around the images.
- Dark mode should use softer shadows and lower halo opacity.

## Copy

- Empty-state titles should state the current state plainly.
- Description copy should tell the user what to do next only when there is a useful next action.
- CTAs should be limited to one or two obvious actions.
