import type { ReadingHistoryData } from '../../../apps/client/src/services/api/activity';
import { fetchNotifications, markNotification } from './state';

export type { GamificationNotification } from '../../../apps/client/src/services/api/userNotifications';
export const getUserNotifications = fetchNotifications;
export const markUserNotificationRead = (id: string) => markNotification(id);
export const markAllUserNotificationsRead = () => markNotification(null);

const book = { title: 'The fixture reading book', author: 'A. Reader', cover_url: null };
export const fetchReadingHistory = async (): Promise<ReadingHistoryData> => ({
  progressLogs: [{ id: 'log-one', book_id: 'fixture-book', page_number: 43, chapter_number: null, paragraph_number: null,
    notes: 'A meaningful page', logged_at: '2026-09-27T12:00:00Z', log_type: 'manual', time_spent_minutes: 15, books: book }],
  journalEntries: [{ id: 'journal-one', book_id: 'fixture-book', entry_type: 'note', title: 'A remembered passage',
    content: 'Words worth keeping', page_reference: 43, tags: ['Reread'], created_at: '2026-09-27T12:00:00Z', books: book }],
});
export const fetchUserProfileTabData = async () => ({
  books: [{ ...book, id: 'fixture-book', status: 'reading' }], posts: [],
  clubs: [{ id: 'fixture-club', name: 'Quiet Readers', description: 'A synthetic book club', cover_image_url: null, is_private: false }],
});
