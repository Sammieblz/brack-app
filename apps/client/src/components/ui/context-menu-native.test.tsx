import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const device = vi.hoisted(() => ({
  impact: vi.fn(), notification: vi.fn(),
  selectionStart: vi.fn(), selectionChanged: vi.fn(), selectionEnd: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => true } }));
vi.mock('@capacitor/haptics', () => ({
  Haptics: device,
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
  NotificationType: { Success: 'SUCCESS', Error: 'ERROR' },
}));
vi.mock('@/hooks/usePlatform', () => ({ usePlatform: () => ({ isIOS: false }) }));
import { ContextMenuNative } from './context-menu-native';

class TestPointerEvent extends MouseEvent {
  pointerId: number;
  isPrimary: boolean;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.isPrimary = init.isPrimary ?? true;
  }
}
const action = vi.fn();
function Fixture({ hapticsEnabled = true }: { hapticsEnabled?: boolean }) {
  return <ContextMenuNative title="A reading book" description="Choose an action" hapticsEnabled={hapticsEnabled} actions={[{ label: 'Edit book', onClick: action }]}>
    <article data-testid="book"><h2>A reading book</h2><a href="#book">Book details</a><button>Nested action</button></article>
  </ContextMenuNative>;
}
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('PointerEvent', TestPointerEvent); window.getSelection()?.removeAllRanges(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('accessible context action alternatives', () => {
  it('opens with exactly one medium haptic for a recognized hold', async () => {
    vi.useFakeTimers();
    render(<Fixture />);
    fireEvent.pointerDown(screen.getByTestId('book'), { button: 0, isPrimary: true, pointerId: 1, clientX: 30, clientY: 30 });
    await act(async () => { vi.advanceTimersByTime(501); });
    expect(screen.getByRole('dialog', { name: 'A reading book' })).toBeInTheDocument();
    expect(device.impact).toHaveBeenCalledExactlyOnceWith({ style: 'MEDIUM' });
    expect(device.selectionStart).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit book' })).toBeInTheDocument();
  });

  it('opens from visible keyboard control and restores it after Escape', async () => {
    const { container } = render(<Fixture />);
    // BookCard is used inside a grid: its fallback control must not become a
    // separate grid item alongside the card.
    expect(container.children).toHaveLength(1);
    const trigger = screen.getByRole('button', { name: 'More actions for A reading book' });
    trigger.focus();
    fireEvent.click(trigger, { detail: 0 });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(device.impact).not.toHaveBeenCalled();
    expect(device.selectionStart).not.toHaveBeenCalled();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it.each([{ key: 'F10', shiftKey: true }, { key: 'ContextMenu' }])('supports the keyboard context shortcut $key', (keys) => {
    render(<Fixture />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'More actions for A reading book' }), keys);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(device.impact).not.toHaveBeenCalled();
  });

  it('leaves nested links and selected text to the native context menu', () => {
    render(<Fixture />);
    expect(fireEvent.contextMenu(screen.getByRole('link'))).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const range = document.createRange();
    range.selectNodeContents(screen.getByRole('heading'));
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    expect(window.getSelection()?.toString()).toBe('A reading book');
    expect(fireEvent.contextMenu(screen.getByRole('heading'))).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    window.getSelection()?.removeAllRanges();
  });

  it('keeps actions and dismissal available when haptics are disabled', async () => {
    render(<Fixture hapticsEnabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'More actions for A reading book' }), { detail: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Edit book' }), { detail: 1 });
    expect(action).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'More actions for A reading book' }), { detail: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }), { detail: 1 });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(device.impact).not.toHaveBeenCalled();
    expect(device.selectionStart).not.toHaveBeenCalled();
  });
});
