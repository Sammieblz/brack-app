import { useSyncExternalStore } from 'react';
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext';
const params = new URLSearchParams(location.search);
let state = { bookId: params.get('session') === 'other' ? 'book-2' : 'book-1', bookTitle: params.get('session') === 'other' ? 'A Psalm for the Wild-Built' : 'The Left Hand of Darkness',
  isVisible: params.has('session'), isRunning: params.get('session') !== 'paused', isMinimized: true, time: 1325 };
const subscribers = new Set<() => void>();
const calls: string[] = [];
const subscribe = (fn: () => void) => { subscribers.add(fn); return () => { subscribers.delete(fn); }; };
function update(next: Partial<typeof state>, action: string) { calls.push(action); state = { ...state, ...next }; subscribers.forEach(fn => fn()); }
export function useTimer() {
  const current = useSyncExternalStore(subscribe, () => state); const confirm = useConfirmDialog();
  return { ...current,
    // Controlled timer boundary: verifies screen dispatch and the live confirmation surface, not timer persistence.
    startTimer: async (bookId: string, bookTitle: string) => {
      if (state.isVisible && !await confirm({ title: 'Replace running timer?', description: 'A timer is already running. Cancel it and start a new one?', confirmText: 'Start new', cancelText: 'Keep current' })) return;
      update({ bookId, bookTitle, time: 0, isVisible: true, isRunning: true }, 'start');
    },
    pauseTimer: () => update({ isRunning: false }, 'pause'), resumeTimer: () => update({ isRunning: true }, 'resume'),
    toggleMinimized: () => update({ isMinimized: !state.isMinimized }, 'toggle'),
    finishTimer: async () => update({ isVisible: false }, 'finish'), cancelTimer: () => update({ isVisible: false }, 'cancel'),
  };
}
window.bookDetailTimer = () => ({ state, calls });
declare global { interface Window { bookDetailTimer: () => { state: typeof state; calls: string[] } } }
