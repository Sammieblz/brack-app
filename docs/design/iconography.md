# Brack Iconography Rules

Brack uses icons as functional signals, not decoration.

## Source

- Use `iconoir-react` through `src/config/iconography.ts` for semantic app surfaces.
- Use `AppIcon` for app-level icon treatment.
- Direct icon imports are acceptable only in low-level UI primitives or highly local universal controls.

## Approved Uses

- Navigation items.
- Icon-only controls with tooltips or ARIA labels.
- Clear inline action labels such as Send, Delete, Share, Edit, and Search.
- Status indicators when the state benefits from a visual marker.
- Empty states and media placeholders.
- Brack identity/logo surfaces.

## Avoid

- Decorative icon tiles beside headings.
- Repeated icon boxes inside cards, settings rows, stat cards, and feed items.
- Extra borders, rings, or colored shells around an icon unless the whole element is a real button/control.
- Reusing the same semantic icon for different concepts in the same UI group.

## Sizes

- Sidebar and nav: 16px.
- Controls: 16px.
- Retained inline section icons: 18-20px.
- Empty states only: 32-48px.

## Visual Treatment

- Prefer inherited color or `text-muted-foreground`.
- Use `text-primary` only when the icon communicates an active state or primary action.
- Focus rings remain for accessibility, but they belong to the control, not an extra icon wrapper.
