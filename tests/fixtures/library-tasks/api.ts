import type { Book, BookList } from '../../../apps/client/src/types';
import { controls, readAccount, request } from './state';
const initialCatalog = new URLSearchParams(location.search).get('catalogRead');
if (initialCatalog === 'defer' || initialCatalog === 'reject') controls.configure('catalog', initialCatalog);
export * from '../live-composers/api';
export { getCurrentAuthUser } from './data';
export const BOOK_LISTS_CHANGED_EVENT = 'brack:book-lists-changed';
export const BOOKS_CHANGED_EVENT = 'brack:books-changed';
const stamp = '2026-09-29T12:00:00Z';
const owners = new Map<string, { books: Book[]; lists: BookList[]; membership: Record<string, string[]> }>();
let sequence = 0;
function store(id = readAccount() ?? 'signed-out') {
  let value = owners.get(id);
  if (!value) {
    const books: Book[] = ['The Left Hand of Darkness', 'A Psalm for the Wild-Built', 'Braiding Sweetgrass'].map((title, index) => ({
      id: `book-${index + 1}`, user_id: id, title, author: ['Ursula K. Le Guin', 'Becky Chambers', 'Robin Wall Kimmerer'][index],
      status: 'reading', pages: 300, current_page: 42, genre: 'Fiction', tags: [], shelf_position: index,
      isbn: null, chapters: null, description: 'A book to return to, and a place to keep the passages that stay with you.', metadata: null,
      date_started: null, date_finished: null, rating: null, notes: null, source_provider: null, source_id: null, deleted_at: null,
      cover_url: '/brack-mark.webp', created_at: stamp, updated_at: stamp,
    }));
    if (new URLSearchParams(location.search).has('oneBook')) books.splice(1);
    if (new URLSearchParams(location.search).has('manyBooks')) {
      books.push(...Array.from({ length: 27 }, (_, index) => ({ ...books[index % 3], id: `book-${index + 4}`, title: `Reading journey ${index + 4}`, shelf_position: index + 3 })));
    }
    const lists: BookList[] = ['Weekend reading', 'Thoughtful journeys', 'Empty collection'].map((name, index) => ({
      id: `list-${index + 1}`, user_id: id, name, description: ['Books for a quiet weekend.', 'Stories to carry with you.', 'A new collection.'][index],
      created_at: stamp, updated_at: stamp, deleted_at: null, is_public: false, order_version: 1, book_count: index === 0 ? 1 : 0,
    }));
    if (new URLSearchParams(location.search).has('pagedCatalog')) {
      lists.splice(2, 0, ...Array.from({ length: 14 }, (_, index) => ({ ...lists[1], id: `extra-list-${index}`, name: `Reading collection ${index + 1}` })));
    }
    if (new URLSearchParams(location.search).has('noCollections')) lists.splice(0);
    const renewal = new URLSearchParams(location.search).has('listRenewal') && lists.length > 0;
    if (renewal) lists[1].is_public = true;
    if (renewal && new URLSearchParams(location.search).has('long')) {
      lists[0].name = 'Weekend reading and the many stories we return to across seasons';
      books[0].title = 'The Left Hand of Darkness and the stories we return to across generations';
    }
    value = { books, lists, membership: { 'list-1': renewal ? books.map(book => book.id) : ['book-1'], 'list-2': [], 'list-3': [] } }; owners.set(id, value);
  }
  return value;
}
function changed(userId: string) { window.dispatchEvent(new CustomEvent(BOOK_LISTS_CHANGED_EVENT, { detail: { userId } })); }
export const snapshotRecords = () => structuredClone([...owners.entries()]);
export async function fetchBookListsPage(userId: string, offset = 0, limit = 15) {
  await request('catalog', { userId, offset, limit }, String(offset));
  const data = store(userId);
  return { lists: data.lists.slice(offset, offset + limit).map(list => ({ ...list, book_count: data.membership[list.id]?.length ?? 0 })), hasMore: offset + limit < data.lists.length };
}
export async function fetchListIdsContainingBook(bookId: string) {
  const owner = readAccount()!; await request('book-membership', { bookId }, bookId);
  return Object.entries(store(owner).membership).filter(([, books]) => books.includes(bookId)).map(([id]) => id);
}
export async function fetchBookIdsInList(listId: string) {
  const owner = readAccount()!; await request('list-membership', { listId }, listId);
  return [...(store(owner).membership[listId] ?? [])];
}
export async function fetchListBooks(listId: string) {
  const owner = readAccount()!; await request('list-books', { listId }, listId);
  const data = store(owner); return (data.membership[listId] ?? []).flatMap(id => data.books.filter(book => book.id === id));
}
export async function createBookList(userId: string, name: string, description?: string) {
  await request('list-create', { userId, name, description });
  const list: BookList = { id: `created-${++sequence}`, user_id: userId, name, description: description ?? null,
    created_at: stamp, updated_at: stamp, deleted_at: null, is_public: false, order_version: 1, book_count: 0 };
  store(userId).lists.push(list); store(userId).membership[list.id] = []; changed(userId); return { ...list };
}
export async function updateBookList(listId: string, updates: Partial<BookList>) {
  const owner = readAccount()!; await request('list-update', { listId, updates }, listId);
  const data = store(owner); data.lists = data.lists.map(list => list.id === listId ? { ...list, ...updates } : list); changed(owner);
}
export async function deleteBookList(listId: string) {
  const owner = readAccount()!; await request('list-delete', { listId }, listId);
  const data = store(owner); data.lists = data.lists.filter(list => list.id !== listId); delete data.membership[listId]; changed(owner);
}
export async function duplicateBookList(userId: string, listId: string) {
  await request('list-duplicate', { userId, listId }, listId);
  const source = store(userId).lists.find(list => list.id === listId)!;
  const list = { ...source, id: `copy-${++sequence}`, name: `${source.name} (Copy)` };
  store(userId).lists.push(list); store(userId).membership[list.id] = [...store(userId).membership[listId]]; changed(userId); return list;
}
export async function addBookToList(listId: string, bookId: string) {
  const owner = readAccount()!; await request('membership-add', { listId, bookId }, bookId);
  const data = store(owner); data.membership[listId] = [...new Set([...(data.membership[listId] ?? []), bookId])]; changed(owner);
}
export async function removeBookFromList(listId: string, bookId: string) {
  const owner = readAccount()!; await request('membership-remove', { listId, bookId }, bookId);
  const data = store(owner); data.membership[listId] = (data.membership[listId] ?? []).filter(id => id !== bookId); changed(owner);
}
export async function addBooksToList(listId: string, bookIds: string[]) { for (const id of bookIds) await addBookToList(listId, id); }
export async function reorderBookListItems(listId: string, items: { book_id: string; position: number }[]) {
  const owner = readAccount()!;
  await request('list-reorder', { listId, items }, listId);
  store(owner).membership[listId] = [...items].sort((a, b) => a.position - b.position).map(item => item.book_id);
}
export const booksRepo = {
  list: async (userId: string) => [...store(userId).books],
  get: async (id: string) => store().books.find(book => book.id === id) ?? null,
  upsertRemoteMany: async () => undefined, upsertRemote: async () => undefined,
};
export const sessionsRepo = { list: async () => [] };
export const progressRepo = { listRecords: async () => [], upsertRemoteMany: async () => undefined };
export const readingCoreSync = { syncUser: async (userId: string) => { await request('books', { userId }); },
  getStatus: async () => ({ pending: 0, failed: 0, syncing: 0 }), syncCurrentUser: async () => undefined, listFailedCurrentUser: async () => [] };
export const SYNC_STATUS_EVENT = 'fixture:sync-status';
export const isConnectivityAvailable = () => true;
export const invalidateBooksCache = () => undefined;
export const fetchUserBooksPage = async (userId: string) => ({ books: [...store(userId).books], hasMore: false });
export const fetchActiveBookById = async (id: string) => store().books.find(book => book.id === id) ?? null;
export const fetchBookReadingSessions = async () => [];
export const fetchProgressLogs = async () => [];
export const getBookProgress = async () => null;
const unsupported = async () => { throw new Error('Mutation outside Library task fixture'); };
export const updateBookQuickProgress = unsupported;
export const createLocalId = () => `fixture-local-${++sequence}`;
export const emitBooksChanged = (detail: unknown) => window.dispatchEvent(new CustomEvent(BOOKS_CHANGED_EVENT, { detail }));
export const bookOperations = { create: unsupported, update: unsupported, delete: async (bookId: string) => {
  const owner = readAccount()!; await request('book-delete', { bookId }, bookId);
  store(owner).books = store(owner).books.filter(book => book.id !== bookId);
  window.dispatchEvent(new CustomEvent(BOOKS_CHANGED_EVENT, { detail: { userId: owner, type: 'remove', bookId } }));
} };
export const fetchThemePreferences = async () => ({ color_theme: 'default', theme_mode: 'light', library_view_mode: new URLSearchParams(location.search).get('view') ?? 'flat' });
export const upsertThemePreferences = async () => undefined;
export const fetchReadingProfile = async () => ({ habits: { favorite_genres: ['Fiction'] }, learningProfile: null });
export const getOnboardingErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
export const fetchBookReviews = async () => ({ reviews: [], averageRating: null, userHasReviewed: false });
export const fetchCommunityReviews = fetchBookReviews;
export const fetchReviewComments = async () => [];
export const fetchSingleReview = async () => null;
export const checkBookReviewLiked = async () => false;
export const addReviewComment = unsupported, createBookReview = unsupported, deleteBookReview = unsupported,
  deleteReviewComment = unsupported, likeBookReview = unsupported, toggleBookReviewLike = unsupported,
  unlikeBookReview = unsupported, updateBookReview = unsupported;

export async function reorderLibraryShelf(books: Book[]) {
  const owner = readAccount()!;
  await request('shelf-reorder', { books });
  const next = new Map(books.map(book => [book.id, book]));
  store(owner).books = store(owner).books.map(book => next.get(book.id) ?? book);
}
