import { TIMER_STORAGE_KEY, TIMER_RECOVERY_STORAGE_KEY } from '../../../apps/client/src/services/timerSession';
const params = new URLSearchParams(location.search);
const mode = params.get('timer');
const owner = params.get('timerOwner') ?? 'shell-reader';
const elapsed = mode === 'stale' ? 13 * 3600 : Number(params.get('seconds') ?? 754);
if (mode && mode !== 'none' && !sessionStorage.getItem('reading-session-seeded')) {
  const start = new Date(Date.now() - elapsed * 1000).toISOString();
  const running = mode !== 'paused';
  const title = params.has('long') ? 'The Left Hand of Darkness: A Journey Through Ice, Friendship, and the Stories We Carry Home' : 'The Left Hand of Darkness';
  const legacy = params.has('legacyTimer');
  localStorage.removeItem(legacy ? TIMER_RECOVERY_STORAGE_KEY : `${TIMER_RECOVERY_STORAGE_KEY}:${owner}`);
  localStorage.setItem(legacy ? TIMER_STORAGE_KEY : `${TIMER_STORAGE_KEY}:${owner}`, JSON.stringify({ userId: owner,
    time: elapsed, accumulatedSeconds: running ? 0 : elapsed, isRunning: running, startTime: start,
    runningSince: running ? start : null, bookId: 'book-1', bookTitle: title,
    clientSessionId: 'fixture-session-1', isVisible: true, isMinimized: true }));
  sessionStorage.setItem('reading-session-seeded', 'true');
}
