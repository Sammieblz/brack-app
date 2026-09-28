import type { Book } from '../../../apps/client/src/types';
import type { GoogleBookResult } from '../../../apps/client/src/types/googleBooks';

const params = new URLSearchParams(window.location.search);
export const runtime = params.get('runtime') ?? 'web';
export const pluginAvailable = params.get('plugin') !== 'off';
export const hapticsEnabled = params.get('haptics') !== 'off';
export const candidate: GoogleBookResult = {
  googleBooksId: 'fixture-provider', title: 'A searched book', author: 'A. Reader', isbn: '9780140328721',
  genre: null, pages: 220, chapters: null, cover_url: null, description: 'Synthetic book metadata.',
  publisher: null, published_date: null, average_rating: null, ratings_count: null,
};
export const library = params.has('duplicate') ? [{ id: 'existing-book', title: 'Existing fixture book', isbn: candidate.isbn }] as Book[] : [];
const createCalls: Array<Record<string, unknown>> = [];
const hapticCalls: Array<{ method: string; options?: unknown }> = [];
const pending: Array<{ data: Record<string, unknown>; resolve: (book: { id: string; title: string }) => void; reject: (error: Error) => void }> = [];
let ancillaryReads = 0;
export const create = (data: Record<string, unknown>) => {
  createCalls.push(structuredClone(data));
  return new Promise<{ id: string; title: string }>((resolve, reject) => pending.push({ data, resolve, reject }));
};
export const recordHaptic = async (method: string, options?: unknown) => { hapticCalls.push({ method, options }); };
export const booksRepo = { list: async () => { ancillaryReads += 1; throw new Error('Postcommit fixture read must not be used'); } };
export const actionFixture = {
  snapshot: () => ({ creates: structuredClone(createCalls), pending: pending.length, haptics: structuredClone(hapticCalls), ancillaryReads }),
  resolveCreate: () => { const next = pending.shift(); if (!next) throw new Error('No pending create'); next.resolve({ id: 'created-book', title: String(next.data.title) }); },
  rejectCreate: () => { const next = pending.shift(); if (!next) throw new Error('No pending create'); next.reject(new Error('Fixture local write failed')); },
  clearHaptics: () => { hapticCalls.length = 0; },
};
declare global { interface Window { actionFixture: typeof actionFixture; } }
window.actionFixture = actionFixture;
Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (pattern: number | number[]) => { void recordHaptic('vibrate', pattern); return true; } });
