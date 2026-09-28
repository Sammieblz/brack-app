import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLongPress } from './useLongPress';

const haptic = vi.hoisted(() => vi.fn());
vi.mock('./useHapticFeedback', () => ({ useHapticFeedback: ({ enabled = true } = {}) => ({ triggerHaptic: (pattern: string) => { if (enabled) haptic(pattern); } }) }));

class TestPointerEvent extends MouseEvent {
  pointerId: number;
  isPrimary: boolean;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.isPrimary = init.isPrimary ?? true;
  }
}
const press = vi.fn();
const click = vi.fn();
function Fixture({ hapticsEnabled = true, delay = 500 }: { hapticsEnabled?: boolean; delay?: number }) {
  const handlers = useLongPress({ onLongPress: press, onClick: click, hapticsEnabled, delay });
  return <div data-testid="surface" {...handlers}><span>Book title</span><button>Inner control</button><a href="#book">Book link</a><input aria-label="Book note" /></div>;
}
const down = (target: Element, extras: PointerEventInit = {}) => fireEvent.pointerDown(target, { pointerId: 1, isPrimary: true, button: 0, clientX: 50, clientY: 50, ...extras });
const wait = () => act(() => { vi.advanceTimersByTime(501); });

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal('PointerEvent', TestPointerEvent);
  window.getSelection()?.removeAllRanges();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('long-press contact ownership', () => {
  it('emits once for a hold and suppresses its click before child navigation', () => {
    render(<Fixture />);
    const surface = screen.getByTestId('surface');
    down(surface);
    wait();
    expect(press).toHaveBeenCalledOnce();
    expect(haptic).toHaveBeenCalledExactlyOnceWith('medium');
    fireEvent.pointerUp(surface, { pointerId: 1 });
    fireEvent.click(surface, { detail: 1 });
    expect(click).not.toHaveBeenCalled();
    down(surface);
    fireEvent.pointerUp(surface, { pointerId: 1 });
    fireEvent.click(surface, { detail: 1 });
    expect(click).toHaveBeenCalledOnce();
  });

  it('uses the native click exactly once for a short press', () => {
    render(<Fixture />);
    const surface = screen.getByTestId('surface');
    down(surface);
    fireEvent.pointerUp(surface, { pointerId: 1 });
    expect(click).not.toHaveBeenCalled();
    fireEvent.click(surface, { detail: 1 });
    wait();
    expect(click).toHaveBeenCalledOnce();
    expect(press).not.toHaveBeenCalled();
  });

  it.each(['move', 'scroll', 'second-pointer', 'cancel', 'leave', 'lost-capture', 'blur', 'pagehide'] as const)('cancels a pending hold on %s', (reason) => {
    render(<Fixture />);
    const surface = screen.getByTestId('surface');
    down(surface);
    if (reason === 'move') fireEvent.pointerMove(window, { pointerId: 1, clientX: 61, clientY: 50 });
    if (reason === 'scroll') fireEvent.scroll(surface);
    if (reason === 'second-pointer') down(surface, { pointerId: 2, isPrimary: false });
    if (reason === 'cancel') fireEvent.pointerCancel(surface, { pointerId: 1 });
    if (reason === 'leave') fireEvent.pointerLeave(surface, { pointerId: 1 });
    if (reason === 'lost-capture') fireEvent.lostPointerCapture(surface, { pointerId: 1 });
    if (reason === 'blur') fireEvent(window, new Event('blur'));
    if (reason === 'pagehide') fireEvent(window, new Event('pagehide'));
    wait();
    expect(press).not.toHaveBeenCalled();
    expect(haptic).not.toHaveBeenCalled();
    fireEvent.click(surface, { detail: 1 });
    expect(click).not.toHaveBeenCalled();
    down(surface);
    fireEvent.pointerUp(surface, { pointerId: 1 });
    fireEvent.click(surface, { detail: 1 });
    expect(click).toHaveBeenCalledOnce();
  });

  it('does not swallow a keyboard or assistive click after a cancelled contact', () => {
    render(<Fixture />);
    const surface = screen.getByTestId('surface');
    down(surface);
    fireEvent.pointerCancel(surface, { pointerId: 1 });
    fireEvent.click(surface, { detail: 0 });
    expect(click).toHaveBeenCalledOnce();
  });

  it('retains native controls, links, secondary click and selected text', () => {
    render(<Fixture />);
    for (const element of [screen.getByRole('button'), screen.getByRole('link'), screen.getByRole('textbox')]) { down(element); wait(); }
    down(screen.getByTestId('surface'), { button: 2 });
    wait();
    const range = document.createRange();
    range.selectNodeContents(screen.getByText('Book title'));
    window.getSelection()?.addRange(range);
    down(screen.getByTestId('surface'));
    wait();
    expect(press).not.toHaveBeenCalled();
    expect(haptic).not.toHaveBeenCalled();
  });

  it('cancels when selection begins during the hold', () => {
    render(<Fixture />);
    down(screen.getByTestId('surface'));
    const range = document.createRange();
    range.selectNodeContents(screen.getByText('Book title'));
    window.getSelection()?.addRange(range);
    fireEvent(document, new Event('selectionchange'));
    wait();
    expect(press).not.toHaveBeenCalled();
  });

  it('clears pending work on unmount', () => {
    const { unmount } = render(<Fixture />);
    down(screen.getByTestId('surface'));
    unmount();
    wait();
    expect(press).not.toHaveBeenCalled();
    expect(haptic).not.toHaveBeenCalled();
  });

  it('clears a pending contact when recognition timing changes', () => {
    const { rerender } = render(<Fixture />);
    down(screen.getByTestId('surface'));
    rerender(<Fixture delay={800} />);
    wait();
    expect(press).not.toHaveBeenCalled();
  });

  it('observes global events only while a contact is active', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    render(<Fixture />);
    expect(add.mock.calls.filter(([name]) => name === 'pointermove')).toHaveLength(0);
    down(screen.getByTestId('surface'));
    expect(add.mock.calls.filter(([name]) => name === 'pointermove')).toHaveLength(1);
    fireEvent.pointerUp(window, { pointerId: 1 });
    expect(remove.mock.calls.filter(([name]) => name === 'pointermove')).toHaveLength(1);
    add.mockRestore();
    remove.mockRestore();
  });

  it('cancels on native context-menu handoff and document hiding', () => {
    render(<Fixture />);
    const surface = screen.getByTestId('surface');
    down(surface);
    fireEvent.contextMenu(surface);
    wait();
    expect(press).not.toHaveBeenCalled();
    down(surface);
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    wait();
    expect(press).not.toHaveBeenCalled();
    hidden.mockRestore();
  });

  it('opens normally with haptics disabled', () => {
    render(<Fixture hapticsEnabled={false} />);
    down(screen.getByTestId('surface'));
    wait();
    expect(press).toHaveBeenCalledOnce();
    expect(haptic).not.toHaveBeenCalled();
  });
});
