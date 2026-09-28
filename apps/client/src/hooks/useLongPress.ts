import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';
import { useHapticFeedback } from './useHapticFeedback';

interface UseLongPressOptions {
  onLongPress: () => void;
  onClick?: () => void;
  delay?: number;
  hapticsEnabled?: boolean;
}

const INTERACTIVE_TARGET = 'a, button, input, textarea, select, summary, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="link"], [role="textbox"], [data-long-press-ignore]';

/** Native controls and selected text keep ownership of their own gestures. */
export const isLongPressExcluded = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest(INTERACTIVE_TARGET));

const hasTextSelection = () => Boolean(window.getSelection()?.toString());

export const useLongPress = ({
  onLongPress,
  onClick,
  delay = 500,
  hapticsEnabled = true,
}: UseLongPressOptions) => {
  const { triggerHaptic } = useHapticFeedback({ enabled: hapticsEnabled });
  const callbacks = useRef({ onLongPress, onClick, triggerHaptic });
  callbacks.current = { onLongPress, onClick, triggerHaptic };
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const contact = useRef<{ id: number; x: number; y: number }>();
  const suppressClick = useRef(false);
  const removeContactListeners = useRef<() => void>();

  const stopTimer = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  const cancel = useCallback(() => {
    if (contact.current) suppressClick.current = true;
    contact.current = undefined;
    stopTimer();
    removeContactListeners.current?.();
    removeContactListeners.current = undefined;
  }, [stopTimer]);

  const observeContact = useCallback(() => {
    const onMove = (event: globalThis.PointerEvent) => {
      const start = contact.current;
      if (!start || event.pointerId !== start.id) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) cancel();
    };
    const onAdditionalPointer = (event: globalThis.PointerEvent) => {
      if (contact.current && event.pointerId !== contact.current.id) cancel();
    };
    const onEnd = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== contact.current?.id) return;
      contact.current = undefined;
      stopTimer();
      removeContactListeners.current?.();
      removeContactListeners.current = undefined;
    };
    const onSelection = () => { if (hasTextSelection()) cancel(); };
    const onVisibility = () => { if (document.hidden) cancel(); };
    // Observe without pointer capture or preventDefault: page scroll, zoom and
    // native text/link interactions must retain their browser ownership.
    window.addEventListener('pointerdown', onAdditionalPointer, true);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onEnd, true);
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('scroll', cancel, true);
    window.addEventListener('blur', cancel);
    window.addEventListener('pagehide', cancel);
    document.addEventListener('selectionchange', onSelection);
    document.addEventListener('visibilitychange', onVisibility);
    removeContactListeners.current = () => {
      window.removeEventListener('pointerdown', onAdditionalPointer, true);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onEnd, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('scroll', cancel, true);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('pagehide', cancel);
      document.removeEventListener('selectionchange', onSelection);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [cancel, stopTimer]);

  // Changing recognition timing, unmounting or Strict Mode cleanup cancels the
  // old contact. Idle cards install no global gesture listeners.
  useEffect(() => () => cancel(), [cancel, delay]);

  const onPointerDown = useCallback((event: PointerEvent) => {
    stopTimer();
    removeContactListeners.current?.();
    removeContactListeners.current = undefined;
    // A new primary contact starts a separate action; a prior cancelled/held
    // contact must never swallow the reader's next tap.
    if (event.isPrimary === false) { cancel(); return; }
    contact.current = undefined;
    suppressClick.current = false;
    if (event.button !== 0 || event.defaultPrevented || isLongPressExcluded(event.target) || hasTextSelection()) return;
    contact.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    observeContact();
    timer.current = setTimeout(() => {
      if (!contact.current || hasTextSelection()) { cancel(); return; }
      suppressClick.current = true;
      void callbacks.current.triggerHaptic('medium');
      callbacks.current.onLongPress();
    }, delay);
  }, [cancel, delay, observeContact, stopTimer]);

  const onClickCapture = useCallback((event: MouseEvent) => {
    if (event.detail === 0) return; // Keyboard/assistive activation remains native.
    if (suppressClick.current) {
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);

  return {
    onPointerDown,
    onPointerLeave: cancel,
    onLostPointerCapture: cancel,
    onContextMenu: cancel,
    onClickCapture,
    onClick: () => callbacks.current.onClick?.(),
  };
};
