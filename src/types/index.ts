export interface User {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
  };
}

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  phone_number: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Book {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  genre: string | null;
  pages: number | null;
  cover_url: string | null;
  status: string;
  tags: string[] | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Goal {
  id: string;
  user_id: string;
  target_books: number | null;
  start_date: string | null;
  end_date: string | null;
  reminder_time: string | null;
  is_completed: boolean;
  created_at: string;
}

export interface ReadingHabits {
  id: string;
  user_id: string;
  avg_time_per_book: number | null; // in minutes
  genres: string[] | null;
  avg_length: number | null; // pages
  books_6mo: number | null;
  books_1yr: number | null;
  longest_genre: string | null;
  created_at: string;
}

export interface ReadingSession {
  id: string;
  user_id: string;
  book_id: string | null;
  start_time: string | null;
  end_time: string | null;
  duration: number | null; // in minutes
  created_at: string;
}

export interface Badge {
  id: string;
  title: string;
  description: string | null;
  icon_url: string | null;
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
}

export type BookStatus = 'reading' | 'completed' | 'to_read';

export interface TimerState {
  isRunning: boolean;
  startTime: Date | null;
  duration: number; // in seconds
  bookId: string | null;
}