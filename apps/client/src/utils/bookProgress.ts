import type { Book, ReadingSession } from "@/types";

export const calculateReadingVelocity = (book: Book, sessions: ReadingSession[]): number | null => {
  if (!book.current_page || !book.date_started || book.current_page === 0) return null;
  
  const bookSessions = sessions.filter(s => s.book_id === book.id);
  if (bookSessions.length === 0) return null;
  
  const totalMinutes = bookSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  if (totalMinutes === 0) return null;
  
  // Pages per hour
  return (book.current_page / totalMinutes) * 60;
};

export const calculateEstimatedCompletion = (book: Book, sessions: ReadingSession[]): Date | null => {
  if (!book.pages || !book.current_page || book.status === 'completed') return null;
  
  const velocity = calculateReadingVelocity(book, sessions);
  if (!velocity) return null;
  
  const remainingPages = book.pages - book.current_page;
  const hoursNeeded = remainingPages / velocity;
  
  // Estimate based on average reading per day
  const bookSessions = sessions.filter(s => s.book_id === book.id);
  const sessionDates = new Set(bookSessions.map(s => new Date(s.created_at).toDateString()));
  const avgHoursPerDay = bookSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / (60 * sessionDates.size);
  
  if (avgHoursPerDay === 0) return null;
  
  const daysNeeded = Math.ceil(hoursNeeded / avgHoursPerDay);
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + daysNeeded);
  
  return estimatedDate;
};

export const getProgressPercentage = (book: Book): number => {
  if (!book.pages || !book.current_page) return 0;
  return Math.min((book.current_page / book.pages) * 100, 100);
};
