import type { Book, Goal, LibraryViewMode, Profile, ReadingSession } from "@/types";
import type { JournalEntry } from "@/services/api/journal";

export type LocalEntityStatus = "synced" | "pending" | "failed" | "deleted";

export type SyncOperation = "create" | "update" | "delete" | "restore";

export type SyncEntity =
  | "books"
  | "reading_sessions"
  | "progress_logs"
  | "journal_entries"
  | "goals"
  | "profile_preferences";

export type OutboxStatus = "pending" | "syncing" | "failed" | "synced";

export interface LocalRecord<T = unknown> {
  id: string;
  user_id: string;
  data: T;
  status: LocalEntityStatus;
  updated_at: string;
  deleted_at?: string | null;
  last_synced_at?: string | null;
}

export interface OutboxItem<TPayload = unknown> {
  id: string;
  client_mutation_id: string;
  client_entity_id: string;
  user_id: string;
  entity: SyncEntity;
  operation: SyncOperation;
  payload: TPayload;
  status: OutboxStatus;
  attempt_count: number;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
  next_attempt_at?: string | null;
}

export interface SyncState {
  key: string;
  user_id: string;
  cursor: string | null;
  last_synced_at: string | null;
}

export interface ProgressLogPayload {
  id?: string;
  user_id?: string;
  book_id: string;
  page_number: number;
  chapter_number?: number | null;
  paragraph_number?: number | null;
  notes?: string | null;
  log_type?: string;
  time_spent_minutes?: number | null;
  photo_url?: string | null;
  logged_at?: string;
  created_at?: string;
}

export interface ProfilePreferencesPayload {
  id: string;
  color_theme?: string | null;
  theme_mode?: string | null;
  library_view_mode?: LibraryViewMode | null;
  updated_at?: string | null;
}

export interface SyncEntityPayloads {
  books: Book;
  reading_sessions: ReadingSession;
  progress_logs: ProgressLogPayload;
  journal_entries: JournalEntry;
  goals: Goal;
  profile_preferences: ProfilePreferencesPayload;
}

export interface SyncPullResponse {
  success: boolean;
  cursor: string;
  records: {
    books: Book[];
    reading_sessions: ReadingSession[];
    progress_logs: ProgressLogPayload[];
    journal_entries: JournalEntry[];
    goals: Goal[];
    profile_preferences: Partial<Profile>[];
  };
}

export interface SyncPushRequest {
  items: OutboxItem[];
}

export interface SyncPushAcceptedItem {
  id: string;
  client_mutation_id: string;
  entity: SyncEntity;
  client_entity_id: string;
  server_entity_id?: string;
  record?: unknown;
}

export interface SyncPushFailedItem {
  id: string;
  client_mutation_id: string;
  entity: SyncEntity;
  client_entity_id: string;
  error: string;
  retryable: boolean;
}

export interface SyncPushResponse {
  success: boolean;
  accepted: SyncPushAcceptedItem[];
  failed: SyncPushFailedItem[];
  cursor?: string;
}
