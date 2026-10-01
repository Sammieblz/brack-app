import * as base from '../library-tasks/api';
import type { Book } from '../../../apps/client/src/types';
import type { BookProgressResponse } from '../../../apps/client/src/services/api/reading';
import { readAccount } from '../library-tasks/state';
export * from '../library-tasks/api';
const params = new URLSearchParams(location.search);
const decorate = (book: Book | null) => book && ({ ...book,
  ...(params.has('long') ? { title: 'The Left Hand of Darkness: A Journey Through Ice, Friendship, and the Stories We Carry Home', description: 'A long description should never stand between the reader and their next reading session. '.repeat(18) } : {}),
  ...(params.has('unknown') ? { pages: null, current_page: 42 } : {}),
  ...(params.has('completed') ? { status: 'completed' as const, current_page: 300 } : {}),
  ...(params.has('populated') ? { cover_url: null, rating: 4, isbn: '9780441478125', notes: 'Questions about belonging.', tags: ['Fiction', 'Revisit'], date_started: '2026-09-01' } : {}),
});
const patches = new Map<string, Partial<Book>>();
let releaseLoad: () => void;
const load = params.get('load') === 'defer' ? new Promise<void>(resolve => { releaseLoad = resolve; }) : Promise.resolve();
let statusMode: 'resolve' | 'reject' | 'defer' = 'resolve';
let pendingStatus: { resolve: () => void; reject: () => void } | undefined;
const statusCalls: Array<{ id: string; owner: string | null; updates: Partial<Book> }> = [];
const lookup = async (id: string) => {
  await load;
  if (params.has('missing')) return null;
  const book = decorate(await base.booksRepo.get(id));
  return book ? { ...book, ...patches.get(`${readAccount()}:${id}`) } : null;
};
export const booksRepo = { ...base.booksRepo, get: lookup };
export const fetchActiveBookById = lookup;
export const isConnectivityAvailable = () => !params.has('offline');
export const getBookProgress = async (): Promise<BookProgressResponse | null> => params.has('populated') ? {
  current_page: 42, total_pages: 300, progress_percentage: 14, pages_per_hour: 21,
  estimated_days_to_completion: 12, estimated_completion_date: '2026-10-13T12:00:00Z', total_time_hours: 2,
  reading_velocity: { overall: 21, recent: 24 }, statistics: { total_logs: 1, total_sessions: 1, avg_session_duration: 30, longest_session: 30, last_logged_at: '2026-10-01T12:00:00Z' },
} : null;
export const fetchBookReadingSessions = async () => params.has('populated') ? [{ id: 'session-1', book_id: 'book-1', user_id: readAccount()!, duration: 30, created_at: '2026-10-01T12:00:00Z', start_time: null, end_time: null, client_session_id: null }] : [];
export const fetchProgressLogs = async () => params.has('populated') ? [{ id: 'log-1', book_id: 'book-1', user_id: readAccount()!, page_number: 42, notes: 'A memorable passage.', logged_at: '2026-10-01T12:00:00Z', log_type: 'manual' as const, time_spent_minutes: 30 }] : [];
export const bookOperations = { ...base.bookOperations, update: async (id: string, updates: Partial<Book>) => {
  const owner = readAccount(); statusCalls.push({ id, owner, updates });
  if (statusMode === 'reject') throw new Error('Fixture status failed');
  if (statusMode === 'defer') await new Promise<void>((resolve, reject) => { pendingStatus = { resolve, reject: () => reject(new Error('Fixture status failed')) }; });
  patches.set(`${owner}:${id}`, updates);
} };
window.bookDetail = {
  releaseLoad: () => releaseLoad?.(),
  configureStatus: mode => { statusMode = mode; },
  settleStatus: outcome => { pendingStatus?.[outcome](); pendingStatus = undefined; },
  snapshot: () => ({ statusCalls, pendingStatus: !!pendingStatus }),
};
declare global { interface Window { bookDetail: {
  releaseLoad: () => void;
  configureStatus: (mode: 'resolve' | 'reject' | 'defer') => void;
  settleStatus: (outcome: 'resolve' | 'reject') => void;
  snapshot: () => { statusCalls: typeof statusCalls; pendingStatus: boolean };
} } }
