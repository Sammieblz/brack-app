export const GENRES = [
  'Fiction',
  'Non-Fiction',
  'Mystery',
  'Romance',
  'Science Fiction',
  'Fantasy',
  'Biography',
  'History',
  'Self-Help',
  'Business',
  'Psychology',
  'Philosophy',
  'Health',
  'Travel',
  'Poetry',
  'Drama',
  'Children',
  'Young Adult',
  'Horror',
  'Thriller'
] as const;

export const BOOK_STATUSES = {
  TO_READ: 'to_read',
  READING: 'reading', 
  COMPLETED: 'completed'
} as const;

export const DEFAULT_REMINDER_TIME = '19:00'; // 7 PM

export const ROUTES = {
  INDEX: '/',
  AUTH: '/auth',
  WELCOME: '/welcome',
  QUESTIONNAIRE: '/questionnaire',
  GOALS: '/goals',
  DASHBOARD: '/dashboard',
  ADD_BOOK: '/add-book',
  BOOK_DETAIL: '/book/:id',
  TIMER: '/timer',
  SCAN: '/scan'
} as const;