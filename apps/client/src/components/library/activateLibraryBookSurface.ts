import type { MouseEvent } from "react";

const independentControl = [
  "button", "a", "input", "select", "textarea", "summary", "label",
  "[role='button']", "[role='checkbox']", "[role='link']", "[role='switch']",
  "[role='combobox']", "[role='menuitem']", "[contenteditable]:not([contenteditable='false'])",
  "[data-library-book-control]",
].join(",");

/** Metadata stays selectable; only unclaimed clicks activate the sibling primary button's action. */
export function activateLibraryBookSurface(event: MouseEvent<HTMLElement>, onActivate: () => void) {
  const target = event.target;
  if (
    event.defaultPrevented || event.button !== 0 || !(target instanceof Element) ||
    !event.currentTarget.contains(target) || target.closest(independentControl)
  ) return;

  // Selecting a title/description is not a request to navigate. Ignore selections elsewhere.
  const selection = event.currentTarget.ownerDocument.getSelection();
  if (selection && !selection.isCollapsed && selection.anchorNode &&
    event.currentTarget.contains(selection.anchorNode)) return;

  event.stopPropagation();
  event.currentTarget.querySelector<HTMLButtonElement>(".library-book-primary")?.focus({ preventScroll: true });
  onActivate();
}
