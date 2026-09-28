import { hasOpenOverlay } from '@/lib/backLayers';

/** Local content gestures never claim the browser/OS navigation edges. */
export const SYSTEM_GESTURE_EDGE = 24;

const NATIVE_CONTROL = 'a,button,input,textarea,select,summary,[contenteditable]:not([contenteditable="false"]),[role="button"],[role="link"],[role="textbox"],[role="checkbox"],[role="slider"]';

export function getLocalGestureTouch(event: Pick<TouchEvent, 'touches' | 'target' | 'defaultPrevented'>, allowedControl?: string) {
  if (event.defaultPrevented || event.touches.length !== 1 || window.getSelection()?.toString() || hasOpenOverlay()) return null;
  const touch = event.touches[0];
  if (touch.clientX <= SYSTEM_GESTURE_EDGE || touch.clientX >= window.innerWidth - SYSTEM_GESTURE_EDGE) return null;
  if (event.target instanceof Element) {
    if (event.target.closest('[data-gesture-ignore]')) return null;
    const control = event.target.closest(NATIVE_CONTROL);
    if (control && (!allowedControl || !control.matches(allowedControl))) return null;
  }
  return touch;
}

/** Observe only an active contact; never capture it or cancel native default behavior. */
export function observeTouchCancellation(identifier: number, cancel: () => void) {
  const checkContact = (event: TouchEvent) => {
    if (event.touches.length !== 1 || event.touches[0].identifier !== identifier || hasOpenOverlay()) cancel();
  };
  const onEnd = () => { if (hasOpenOverlay()) cancel(); };
  const onSelection = () => { if (window.getSelection()?.toString()) cancel(); };
  const onVisibility = () => { if (document.hidden) cancel(); };
  window.addEventListener('touchstart', checkContact, { capture: true, passive: true });
  window.addEventListener('touchmove', checkContact, { capture: true, passive: true });
  window.addEventListener('touchend', onEnd, { capture: true, passive: true });
  window.addEventListener('touchcancel', cancel, true);
  window.addEventListener('scroll', cancel, true);
  window.addEventListener('blur', cancel);
  window.addEventListener('pagehide', cancel);
  window.addEventListener('contextmenu', cancel, true);
  document.addEventListener('selectionchange', onSelection);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    window.removeEventListener('touchstart', checkContact, true);
    window.removeEventListener('touchmove', checkContact, true);
    window.removeEventListener('touchend', onEnd, true);
    window.removeEventListener('touchcancel', cancel, true);
    window.removeEventListener('scroll', cancel, true);
    window.removeEventListener('blur', cancel);
    window.removeEventListener('pagehide', cancel);
    window.removeEventListener('contextmenu', cancel, true);
    document.removeEventListener('selectionchange', onSelection);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
