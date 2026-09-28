/** Explicitly registered primitive content; Radix/Vaul retain dismissal ordering. */
const layers = new Map<HTMLElement, Set<symbol>>();

export function registerBackLayer(element: HTMLElement): () => void {
  const registration = Symbol("back-layer");
  const registrations = layers.get(element) ?? new Set<symbol>();
  registrations.add(registration);
  layers.set(element, registrations);
  return () => {
    if (!registrations.delete(registration)) return;
    if (!registrations.size) layers.delete(element);
  };
}

function isOpen(element: HTMLElement): boolean {
  return element.isConnected && element.dataset.state === "open";
}

function isExiting(element: HTMLElement): boolean {
  if (!element.isConnected || element.dataset.state !== "closed") return false;
  // Presence can keep closed content mounted during its exit. A second Back
  // must not pop the route underneath it. Closed forceMount content without an
  // active animation is not an overlay. No observer or timer is needed.
  return typeof element.getAnimations === "function" && element.getAnimations().some(
    (animation) => animation.playState === "running" || animation.playState === "paused",
  );
}

export function hasOpenOverlay(): boolean {
  return [...layers.keys()].some((element) => isOpen(element) || isExiting(element));
}

/**
 * Consume app-controlled Back once. This never changes history, forces state,
 * or handles browser Back. The primitive's highest DismissableLayer receives
 * Escape and keeps its existing preventDefault / controlled dismissal guards.
 * A guarded dismissal still consumes Back; callers must not also navigate.
 */
export function requestOverlayBack(): boolean {
  const registered = [...layers.keys()];
  // Radix Presence still owns the closing layer until its exit finishes. Do
  // not redispatch to it or close another surface beneath that transition.
  if (registered.some(isExiting)) return true;
  const openLayer = registered.find(isOpen);
  if (!openLayer) return false;
  const ownerDocument = openLayer.ownerDocument;
  const EventConstructor = ownerDocument.defaultView?.KeyboardEvent ?? KeyboardEvent;
  ownerDocument.dispatchEvent(new EventConstructor("keydown", {
    key: "Escape",
    code: "Escape",
    bubbles: true,
    cancelable: true,
  }));
  return true;
}
