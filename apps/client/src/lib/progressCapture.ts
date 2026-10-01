import type { Book } from "@/types";
import type { ProgressLogPayload } from "@/services/sync/types";
import { booksRepo, createLocalId, progressRepo } from "@/services/local";
import { todayDateOnly } from "@/lib/dateOnly";

export interface ProgressCaptureDraft {
  pageNumber: number;
  chapterNumber: number | null;
  paragraphNumber: number | null;
  timeSpent: number | null;
  notes: string;
  photoUrl: string | null;
}
export interface ProgressCaptureAttempt {
  userId: string;
  bookId: string;
  log: ProgressLogPayload & { id: string };
  activityDate: string;
  logAttempted: boolean;
  logCommitted: boolean;
  bookCommitted: boolean;
  updatedBook?: Book;
}
export class ObsoleteProgressCapture extends Error {}

/** One submitted payload keeps its identity across a partial local-save retry. */
export function createProgressCapture(userId: string, bookId: string, draft: ProgressCaptureDraft): ProgressCaptureAttempt {
  const now = new Date();
  return { userId, bookId, activityDate: todayDateOnly(now), logAttempted: false, logCommitted: false, bookCommitted: false,
    log: { id: createLocalId(), user_id: userId, book_id: bookId, page_number: draft.pageNumber,
      chapter_number: draft.chapterNumber, paragraph_number: draft.paragraphNumber,
      time_spent_minutes: draft.timeSpent, notes: draft.notes || null, photo_url: draft.photoUrl,
      log_type: "manual", logged_at: now.toISOString(), created_at: now.toISOString() } };
}

/** Existing repositories each atomically commit their row/outbox. Do not repeat a committed log. */
export async function persistProgressCapture(attempt: ProgressCaptureAttempt, isCurrent: () => boolean): Promise<Book> {
  const assertCurrent = () => { if (!isCurrent()) throw new ObsoleteProgressCapture(); };
  assertCurrent();
  const book = await booksRepo.get(attempt.bookId);
  assertCurrent();
  if (!book || book.user_id !== attempt.userId || book.deleted_at) throw new Error("This book isn't available for this account on this device. Reopen it from your library and try again.");
  if (!Number.isSafeInteger(attempt.log.page_number) || attempt.log.page_number <= 0) {
    throw new Error(book.pages ? `Enter a whole page number from 1 to ${book.pages}.` : "Enter a whole page number greater than zero.");
  }
  if (!attempt.logCommitted) {
    const keys = ["user_id", "book_id", "page_number", "chapter_number", "paragraph_number", "time_spent_minutes", "notes", "photo_url", "log_type", "logged_at"] as const;
    // Readback also recognizes a bridge response failure after its atomic commit.
    const existing = await progressRepo.get(attempt.log.id);
    assertCurrent();
    if (existing) {
      if (keys.some(key => existing[key] !== attempt.log[key])) throw new Error("This save could not be verified. Keep this task open and try again.");
      attempt.logCommitted = true;
    } else {
      attempt.logAttempted = false;
      if (book.pages && attempt.log.page_number > book.pages) throw new Error(`Enter a whole page number from 1 to ${book.pages}.`);
      attempt.logAttempted = true;
      try {
        await progressRepo.createPending(attempt.userId, attempt.log);
        attempt.logCommitted = true;
      } catch (error) {
        assertCurrent();
        // Native bridges can lose the response after a successful atomic commit.
        // Keep the submitted identity until a local read confirms its outcome.
        const committed = await progressRepo.get(attempt.log.id);
        assertCurrent();
        if (!committed) { attempt.logAttempted = false; throw error; }
        if (keys.some(key => committed[key] !== attempt.log[key])) throw new Error("This save could not be verified. Keep this task open and try again.");
        attempt.logCommitted = true;
      }
    }
  }
  assertCurrent();
  if (!attempt.bookCommitted) {
    // A retry merges the latest local book; never write a stale whole-book snapshot.
    const latest = await booksRepo.get(attempt.bookId);
    assertCurrent();
    if (!latest || latest.user_id !== attempt.userId || latest.deleted_at) throw new Error("Your reading log is saved, but this book is no longer available to update.");
    const status = latest.pages && attempt.log.page_number >= latest.pages ? "completed" : latest.status === "to_read" ? "reading" : latest.status;
    const updated: Book = { ...latest, current_page: Math.max(latest.current_page || 0, attempt.log.page_number), status,
      date_started: latest.date_started || attempt.activityDate,
      date_finished: status === "completed" ? latest.date_finished || attempt.activityDate : latest.date_finished,
      updated_at: new Date().toISOString() };
    await booksRepo.upsertLocal(attempt.userId, updated, "update");
    attempt.bookCommitted = true;
    attempt.updatedBook = updated;
  }
  assertCurrent();
  return attempt.updatedBook!;
}
