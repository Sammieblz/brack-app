export const GENRES = [
  'Fiction',
  'Literary Fiction',
  'Classics',
  'Historical Fiction',
  'Non-Fiction',
  'Mystery',
  'Thriller',
  'Horror',
  'Romance',
  'Fantasy',
  'Science Fiction',
  'Dystopian',
  'Adventure',
  'Short Stories',
  'Poetry',
  'Drama',
  'Biography & Memoir',
  'History',
  'True Crime',
  'Essays',
  'Self-Help',
  'Psychology',
  'Philosophy',
  'Health & Wellness',
  'Business & Economics',
  'Politics & Social Sciences',
  'Religion & Spirituality',
  'Science & Nature',
  'Technology',
  'Computers & Technology',
  'Education',
  'Travel',
  'Art & Photography',
  'Cooking & Food',
  'Sports & Outdoors',
  'Young Adult',
  'Children',
  'Juvenile Fiction',
  'Juvenile Nonfiction',
  'Comics & Graphic Novels',
  'Manga',
  'Graphic Novels',
  'Reference',
  'Humor',
  'Other'
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
  ONBOARDING: '/onboarding',
  DASHBOARD: '/dashboard',
  ADD_BOOK: '/add-book',
  BOOK_DETAIL: '/book/:id',
  TIMER: '/timer',
  SCAN: '/scan'
} as const;
