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
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  phone_number: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  color_theme: string | null;
  theme_mode: string | null;
  profile_visibility: string | null;
  show_reading_activity: boolean | null;
  show_currently_reading: boolean | null;
  allow_friend_requests: boolean | null;
  is_active: boolean;
  current_streak: number;
  longest_streak: number;
  last_reading_date: string | null;
  streak_freeze_used_at: string | null;
  onboarding_status: OnboardingStatus;
  onboarding_version: number;
  onboarding_last_step: string | null;
  onboarding_completed_at: string | null;
  onboarding_skipped_at: string | null;
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
  chapters: number | null;
  cover_url: string | null;
  description: string | null;
  status: string;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  current_page: number | null;
  date_started: string | null;
  date_finished: string | null;
  rating: number | null;
  notes: string | null;
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
  preferred_session_minutes: number | null;
  preferred_reading_time: string | null;
  reading_frequency: string | null;
  motivation: string | null;
  book_format: string | null;
  created_at: string;
  updated_at: string | null;
}

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

export type PreferredBookLength = 'short' | 'medium' | 'long' | 'varied';
export type PreferredReadingTime = 'morning' | 'afternoon' | 'evening' | 'night' | 'mixed';
export type ReadingFrequency = 'daily' | 'weekdays' | 'weekends' | 'few_weekly' | 'occasional';
export type PreferredBookFormat = 'print' | 'ebook' | 'audio' | 'mixed';

export interface OnboardingFormData {
  favoriteGenres: string[];
  slowestGenre: string;
  preferredBookLength: PreferredBookLength | "";
  booksReadSixMonths: number | null;
  booksReadYear: number | null;
  averageDaysPerBook: number | null;
  preferredSessionMinutes: number | null;
  preferredReadingTime: PreferredReadingTime | "";
  readingFrequency: ReadingFrequency | "";
  motivation: string;
  preferredBookFormat: PreferredBookFormat | "";
  goalTargetBooks: number | null;
  goalStartDate: string | null;
  goalEndDate: string | null;
  reminderEnabled: boolean;
  reminderTime: string | null;
}

export interface UserLearningProfile {
  user_id: string;
  onboarding_answers: Record<string, unknown>;
  derived_preferences: Record<string, unknown>;
  signal_version: number;
  created_at: string;
  updated_at: string;
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

export interface ReadingStreakDay {
  id: string;
  user_id: string;
  activity_date: string;
  session_count: number;
  progress_log_count: number;
  total_minutes: number;
  used_freeze: boolean;
  created_at: string;
  updated_at: string;
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

export interface ReadingStreakHistory {
  id: string;
  user_id: string;
  streak_count: number;
  achieved_at: string;
  created_at: string;
}
