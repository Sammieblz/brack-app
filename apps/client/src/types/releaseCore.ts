import type { Book, Goal, ReadingSession } from "./index";

export type ConnectivityState =
  | "online"
  | "degraded"
  | "offline"
  | "authentication_required";

export interface BookList {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_public: boolean;
  order_version: number;
  book_count?: number;
}

export interface BookListItem {
  id: string;
  user_id: string;
  list_id: string;
  book_id: string;
  position: number;
  added_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PendingBookImport {
  id: string;
  user_id: string;
  isbn: string | null;
  query: string;
  source: "barcode" | "qr" | "cover" | "manual";
  status: "pending" | "resolved" | "failed";
  resolved_book_id: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookSearchCacheEntry {
  id: string;
  user_id: string;
  query_key: string;
  query: string;
  isbn: string | null;
  provider: string | null;
  results: unknown[];
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface ContentSnapshot {
  id: string;
  user_id: string;
  scope: "dashboard" | "analytics" | "feed" | "clubs" | "reviews" | "conversations";
  data: unknown;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export interface ReadingBackupMediaFile {
  path: string;
  source_url: string;
  content_type: string | null;
  size: number;
  checksum: string;
}

export interface ReadingBackupManifestV1 {
  format: "brack-reading-backup";
  version: 1;
  exported_at: string;
  app_version: string;
  user_id: string;
  encrypted: boolean;
  includes_media: boolean;
  record_counts: {
    books: number;
    book_lists: number;
    book_list_items: number;
    progress_logs: number;
    reading_sessions: number;
    journal_entries: number;
    goals: number;
  };
  media: ReadingBackupMediaFile[];
}

export interface ReadingBackupPayloadV1 {
  manifest: ReadingBackupManifestV1;
  books: Book[];
  book_lists: BookList[];
  book_list_items: BookListItem[];
  progress_logs: Array<Record<string, unknown>>;
  reading_sessions: ReadingSession[];
  journal_entries: Array<Record<string, unknown>>;
  goals: Goal[];
  preferences: Record<string, unknown> | null;
}

export interface ImportIssue {
  row: number | null;
  code: string;
  message: string;
}

export interface ImportPreview {
  import_id: string;
  source_format: "brack" | "json" | "csv" | "goodreads_csv";
  valid: number;
  duplicates: number;
  mergeable: number;
  skipped: number;
  invalid: number;
  issues: ImportIssue[];
  books: Array<{
    source_index: number;
    action: "create" | "merge" | "skip" | "invalid";
    existing_book_id: string | null;
    book: Partial<Book>;
    warnings: string[];
  }>;
}

export interface ImportCommitResult {
  import_id: string;
  created: number;
  merged: number;
  skipped: number;
  failed: number;
  errors: ImportIssue[];
}

export interface ImportJob {
  id: string;
  user_id: string;
  source_format: ImportPreview["source_format"];
  status: "previewed" | "processing" | "completed" | "failed";
  total_items: number;
  processed_items: number;
  result: ImportCommitResult | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}
