import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PullToRefresh } from './PullToRefresh';
import { SwipeableBookCard } from './SwipeableBookCard';
import type { Book } from '@/types';
import { registerBackLayer } from '@/lib/backLayers';

const mocks = vi.hoisted(() => ({ mobile: true, haptic: vi.fn() }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => mocks.mobile }));
vi.mock('@/hooks/useHapticFeedback', () => ({ useHapticFeedback: () => ({ triggerHaptic: mocks.haptic }) }));
vi.mock('@/contexts/ConfirmDialogContext', () => ({ useConfirmDialog: () => vi.fn() }));
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));

const touch = (target: HTMLElement, type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number, identifier = 1) => {
  const event = createEvent[type](target, { touches: type === 'touchEnd' ? [] : [{ identifier, clientX: x, clientY: y }], cancelable: true });
  fireEvent(target, event);
  return event;
};

function renderRefresh(disabled = false) {
  const refresh = vi.fn().mockResolvedValue(undefined);
  const view = render(<div data-app-scroll-container="true"><PullToRefresh onRefresh={refresh} disabled={disabled}>
    <p>Reading list</p><input aria-label="Reading note" /><button type="button">More actions</button>
    <span data-gesture-ignore>Ignored surface</span>
  </PullToRefresh></div>);
  return { ...view, refresh, surface: screen.getByText('Reading list'), scroller: view.container.firstElementChild as HTMLElement };
}

describe('Pull-to-refresh contact ownership', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.mobile = true; });

  it('refreshes once after an intentional downward pull at the scroll boundary', async () => {
    const { surface, refresh } = renderRefresh();
    touch(surface, 'touchStart', 150, 50);
    touch(surface, 'touchMove', 151, 230);
    touch(surface, 'touchMove', 151, 240);
    expect(screen.getByText('Release to refresh')).toBeInTheDocument();
    touch(surface, 'touchEnd', 151, 240);
    touch(surface, 'touchEnd', 151, 240);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(mocks.haptic.mock.calls.map(([kind]) => kind)).toEqual(['light', 'medium', 'success']);
  });

  it('rejects a horizontal row gesture even when it later moves downward', () => {
    const { surface, refresh } = renderRefresh();
    touch(surface, 'touchStart', 250, 50);
    expect(touch(surface, 'touchMove', 190, 54).defaultPrevented).toBe(false);
    touch(surface, 'touchMove', 100, 250);
    touch(surface, 'touchEnd', 100, 250);
    expect(refresh).not.toHaveBeenCalled();
    expect(mocks.haptic).not.toHaveBeenCalled();
  });

  it.each([2, 24, window.innerWidth - 2, window.innerWidth - 24])('leaves the system edge at x=%s untouched', (x) => {
    const { surface, refresh } = renderRefresh();
    touch(surface, 'touchStart', x, 50);
    expect(touch(surface, 'touchMove', x, 250).defaultPrevented).toBe(false);
    touch(surface, 'touchEnd', x, 250);
    expect(refresh).not.toHaveBeenCalled();
    expect(mocks.haptic).not.toHaveBeenCalled();
  });

  it.each(['Reading note', 'More actions', 'Ignored surface'])('preserves independent control ownership for %s', (name) => {
    const { refresh } = renderRefresh();
    const target = screen.queryByLabelText(name) ?? screen.getByText(name);
    touch(target, 'touchStart', 150, 50);
    touch(target, 'touchMove', 150, 250);
    touch(target, 'touchEnd', 150, 250);
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each(['blur', 'pagehide', 'scroll', 'contextmenu', 'touchcancel'])('cancels a pull on %s and permits the next independent contact', async (type) => {
    const { surface, refresh } = renderRefresh();
    touch(surface, 'touchStart', 150, 50);
    touch(surface, 'touchMove', 150, 250);
    fireEvent(window, new Event(type));
    touch(surface, 'touchEnd', 150, 250);
    expect(refresh).not.toHaveBeenCalled();
    touch(surface, 'touchStart', 150, 50);
    touch(surface, 'touchMove', 150, 250);
    touch(surface, 'touchEnd', 150, 250);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it('cancels for a second finger outside the component without disabling pinch', () => {
    const { surface, refresh } = renderRefresh();
    touch(surface, 'touchStart', 150, 50);
    touch(surface, 'touchMove', 150, 250);
    const second = createEvent.touchStart(document.body, { touches: [{ identifier: 1 }, { identifier: 2 }], cancelable: true });
    fireEvent(document.body, second);
    expect(second.defaultPrevented).toBe(false);
    touch(surface, 'touchMove', 150, 270);
    touch(surface, 'touchEnd', 150, 270);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('cancels a ready refresh when an overlay opens before the contact ends', () => {
    const { surface, refresh } = renderRefresh();
    touch(surface, 'touchStart', 150, 50);
    touch(surface, 'touchMove', 150, 250);
    const overlay = document.createElement('div');
    overlay.dataset.state = 'open';
    document.body.append(overlay);
    const unregister = registerBackLayer(overlay);
    try {
      touch(surface, 'touchEnd', 150, 250);
      expect(refresh).not.toHaveBeenCalled();
      expect(overlay.dataset.state).toBe('open');
    } finally {
      unregister(); overlay.remove();
    }
  });

  it('does not start from a scrolled container or finish after the container starts scrolling', () => {
    const { surface, scroller, refresh } = renderRefresh();
    scroller.scrollTop = 20;
    touch(surface, 'touchStart', 150, 50);
    touch(surface, 'touchMove', 150, 250);
    touch(surface, 'touchEnd', 150, 250);
    expect(refresh).not.toHaveBeenCalled();
    scroller.scrollTop = 0;
    touch(surface, 'touchStart', 150, 50);
    scroller.scrollTop = 1;
    touch(surface, 'touchMove', 150, 250);
    touch(surface, 'touchEnd', 150, 250);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('cancels pending tracking when disabled and cleans active listeners on unmount', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { surface, refresh, rerender, unmount } = renderRefresh();
    expect(add.mock.calls.filter(([type]) => type === 'touchstart')).toHaveLength(0);
    touch(surface, 'touchStart', 150, 50);
    const listener = add.mock.calls.find(([type]) => type === 'touchstart')![1];
    rerender(<PullToRefresh onRefresh={refresh} disabled><p>Reading list</p></PullToRefresh>);
    expect(remove).toHaveBeenCalledWith('touchstart', listener, true);
    unmount();
    expect(refresh).not.toHaveBeenCalled();
    add.mockRestore(); remove.mockRestore();
  });

  it('keeps only one refresh pending even when another contact completes before settlement', async () => {
    let resolveRefresh!: () => void;
    const refresh = vi.fn(() => new Promise<void>((resolve) => { resolveRefresh = resolve; }));
    render(<PullToRefresh onRefresh={refresh}><p>Reading list</p></PullToRefresh>);
    const surface = screen.getByText('Reading list');
    for (let attempt = 0; attempt < 2; attempt++) {
      touch(surface, 'touchStart', 150, 50);
      touch(surface, 'touchMove', 150, 250);
      touch(surface, 'touchEnd', 150, 250);
    }
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByText('Refreshing')).toBeInTheDocument();
    resolveRefresh();
    await vi.waitFor(() => expect(screen.queryByText('Refreshing')).not.toBeInTheDocument());
  });

  it.each(['horizontal', 'vertical'] as const)('allows only the %s owner when a row is inside pull-to-refresh', async (direction) => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn();
    const book: Book = {
      id: 'overlapping-row', user_id: 'reader', title: 'Orlando', author: 'Virginia Woolf',
      isbn: null, genre: null, pages: 200, chapters: null, cover_url: null,
      description: null, status: 'reading', tags: null, metadata: null,
      current_page: 30, date_started: null, date_finished: null, rating: null,
      notes: null, source_provider: null, source_id: null, shelf_position: 0,
      created_at: '2026-09-27T12:00:00Z', updated_at: '2026-09-27T12:00:00Z', deleted_at: null,
    };
    render(<PullToRefresh onRefresh={refresh}><SwipeableBookCard book={book} onEdit={vi.fn()}>
      <button type="button" className="library-book-primary" onClick={open}>Open Orlando</button>
    </SwipeableBookCard></PullToRefresh>);
    const surface = screen.getByRole('button', { name: 'Open Orlando' });
    touch(surface, 'touchStart', 250, 50);
    // Start decisively on one axis, then move diagonally beyond both thresholds.
    touch(surface, 'touchMove', direction === 'horizontal' ? 190 : 249, direction === 'vertical' ? 80 : 51);
    touch(surface, 'touchMove', 90, 260);
    touch(surface, 'touchEnd', 90, 260);
    fireEvent.click(surface, { detail: 1 });
    expect(open).not.toHaveBeenCalled();
    if (direction === 'horizontal') {
      expect(refresh).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Edit book' })).toBeInTheDocument();
    } else {
      await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
      expect(screen.queryByRole('button', { name: 'Edit book' })).not.toBeInTheDocument();
    }
  });
});
