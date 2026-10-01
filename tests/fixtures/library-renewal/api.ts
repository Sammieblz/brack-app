import * as base from '../library-tasks/api';
import type { Book, LibraryViewMode } from '../../../apps/client/src/types';
export * from '../library-tasks/api';
const params = new URLSearchParams(location.search);
let mode = params.get('data') ?? 'ready';
const waiting: Array<() => void> = [];
let view = (params.get('view') ?? 'flat') as LibraryViewMode;
export const fetchThemePreferences = async () => ({ color_theme: 'default', theme_mode: 'light', library_view_mode: view });
export const upsertThemePreferences = async (_id: string, preferences: { library_view_mode?: LibraryViewMode }) => { if (preferences.library_view_mode) view = preferences.library_view_mode; };
export const presentationControls = { setMode: (next: string) => { mode = next; waiting.splice(0).forEach(resolve => resolve()); } };
window.libraryPresentation = presentationControls;
declare global { interface Window { libraryPresentation: typeof presentationControls } }
function decorate(book: Book): Book {
  if (!params.has('mixed') && !params.has('long')) return book;
  const index = Number(book.id.split('-').pop()) - 1;
  return { ...book, status: (['reading', 'completed', 'to_read'] as const)[index % 3], genre: ['Fiction', 'Fantasy', 'Nature'][index % 3],
    title: params.has('long') && index === 0 ? 'The Left Hand of Darkness: A Journey Through Ice, Friendship, and the Stories We Carry Home' : book.title };
}
export const booksRepo = { ...base.booksRepo, list: async (id: string) => {
  if (mode === 'defer') await new Promise<void>(resolve => waiting.push(resolve));
  if (mode === 'error') throw new Error('Controlled Library read failure');
  return mode === 'empty' ? [] : (await base.booksRepo.list(id)).map(decorate);
} };
export const fetchUserBooksPage = async (id: string) => ({ ...(await base.fetchUserBooksPage(id)), books: await booksRepo.list(id) });
export const fetchActiveBookById = async (id: string) => { const book = await base.fetchActiveBookById(id); return book ? decorate(book) : null; };
