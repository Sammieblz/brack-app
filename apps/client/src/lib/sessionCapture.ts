import type { Book, ReadingSession } from "@/types";
import { booksRepo, createLocalId, sessionsRepo } from "@/services/local";
import { todayDateOnly } from "@/lib/dateOnly";
import { MAX_READING_SESSION_MINUTES } from "@/services/timerSession";

export interface SessionCaptureAttempt {
  userId: string;
  bookId: string;
  bookTitle: string | null;
  showJournalPrompt: boolean;
  session: ReadingSession;
  sessionAttempted: boolean;
  sessionCommitted: boolean;
  bookCommitted: boolean;
  savedSessionId?: string;
  updatedBook?: Book;
}
export class ObsoleteSessionCapture extends Error {}
export class DeletedSessionCapture extends Error {}

export function createSessionCapture(input: {
  userId: string; bookId: string; bookTitle: string | null; startTime: Date;
  endTime: Date; durationMinutes: number; clientSessionId: string | null;
  showJournalPrompt: boolean;
}): SessionCaptureAttempt {
  const id = input.clientSessionId || createLocalId();
  return { userId: input.userId, bookId: input.bookId, bookTitle: input.bookTitle,
    showJournalPrompt: input.showJournalPrompt, sessionAttempted: false,
    sessionCommitted: false, bookCommitted: false,
    session: { id, user_id: input.userId, book_id: input.bookId,
      start_time: input.startTime.toISOString(), end_time: input.endTime.toISOString(),
      duration: input.durationMinutes, client_session_id: id, created_at: new Date().toISOString() } };
}

/** Serialized completion keeps the submitted duration/identity after an account switch or reload. */
export function restoreSessionCapture(value: unknown, userId: string): SessionCaptureAttempt | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SessionCaptureAttempt>;
  const session = candidate.session;
  if (candidate.userId !== userId || !candidate.bookId || !session || session.user_id !== userId ||
    !session.id || session.client_session_id !== session.id || !session.book_id ||
    !session.start_time || !Number.isFinite(Date.parse(session.start_time)) ||
    !session.end_time || !Number.isFinite(Date.parse(session.end_time)) ||
    !session.created_at || !Number.isFinite(Date.parse(session.created_at)) ||
    !Number.isSafeInteger(session.duration) || session.duration! < 1 || session.duration! > MAX_READING_SESSION_MINUTES) return null;
  return { userId, bookId: candidate.bookId, bookTitle: candidate.bookTitle || null,
    showJournalPrompt: Boolean(candidate.showJournalPrompt), session: { ...session },
    // Never trust serialized completion flags; verify the actual local row again.
    sessionAttempted: true, sessionCommitted: false, bookCommitted: false };
}

/** Each repository atomically writes one entity/outbox. A retry never requeues a committed session. */
export async function persistSessionCapture(attempt: SessionCaptureAttempt, isCurrent: () => boolean): Promise<Book> {
  const assertCurrent = () => { if (!isCurrent()) throw new ObsoleteSessionCapture(); };
  assertCurrent();
  const duration = attempt.session.duration;
  if (!Number.isSafeInteger(duration) || duration! < 1 || duration! > MAX_READING_SESSION_MINUTES) throw new Error("Enter a whole number of minutes from 1 to 720.");
  const canonicalId = await booksRepo.resolveIdentity(attempt.userId, attempt.bookId);
  assertCurrent();
  const book = await booksRepo.get(canonicalId);
  assertCurrent();
  if (!book || book.user_id !== attempt.userId || book.deleted_at) throw new Error("This book is no longer available for this account on this device.");
  attempt.bookId = canonicalId;
  attempt.session.book_id = canonicalId;
  const matches = (record: ReadingSession) => ["user_id", "book_id", "duration", "client_session_id"].every(key => record[key as keyof ReadingSession] === attempt.session[key as keyof ReadingSession]) &&
    Date.parse(record.start_time || "") === Date.parse(attempt.session.start_time!) && Date.parse(record.end_time || "") === Date.parse(attempt.session.end_time!);
  const readSession = async () => {
    const direct = await sessionsRepo.get(attempt.session.id);
    assertCurrent();
    // Sync can replace a local row ID with its server ID while a book update is
    // still awaiting retry. client_session_id remains the completion identity.
    // Read wrappers including tombstones: get() returns deleted data while the
    // default list() excludes it, either of which could misclassify a retry.
    const records = await sessionsRepo.listRecords(attempt.userId, { includeDeleted: true });
    assertCurrent();
    const related = records.filter(record => record.id === attempt.session.id || record.data.client_session_id === attempt.session.client_session_id);
    if ((direct as (ReadingSession & { deleted_at?: string | null }) | null)?.deleted_at || related.some(record => record.status === "deleted" || record.deleted_at || (record.data as ReadingSession & { deleted_at?: string | null }).deleted_at)) {
      throw new DeletedSessionCapture("This reading session was deleted. Close this timer; retrying will not restore the deleted activity.");
    }
    return direct || related[0]?.data || null;
  };
  const existing = await readSession();
  assertCurrent();
  if (existing) {
    if (!matches(existing)) throw new Error("This session save could not be verified. Keep this timer and retry.");
    attempt.sessionCommitted = true;
    attempt.savedSessionId = existing.id;
  } else if (!attempt.sessionCommitted) {
    attempt.sessionAttempted = true;
    try {
      await sessionsRepo.createPending(attempt.userId, attempt.session);
      attempt.sessionCommitted = true;
      attempt.savedSessionId = attempt.session.id;
    } catch (error) {
      assertCurrent();
      const committed = await readSession();
      assertCurrent();
      if (!committed) { attempt.sessionAttempted = false; throw error; }
      if (!matches(committed)) throw new Error("This session save could not be verified. Keep this timer and retry.");
      attempt.sessionCommitted = true;
      attempt.savedSessionId = committed.id;
    }
  }
  assertCurrent();
  if (!attempt.bookCommitted) {
    const latest = await booksRepo.get(canonicalId);
    assertCurrent();
    if (!latest || latest.user_id !== attempt.userId || latest.deleted_at) throw new Error("Your session is saved, but this book is no longer available to update.");
    // Preserve Library's stored recency using the frozen save-attempt time.
    // A recovered session can have an old end_time; its save still happens now.
    const latestTime = latest.updated_at ? Date.parse(latest.updated_at) : NaN;
    const savedAt = attempt.session.created_at!;
    const updated: Book = { ...latest, status: latest.status === "to_read" ? "reading" : latest.status,
      date_started: latest.date_started || todayDateOnly(new Date(attempt.session.start_time!)),
      updated_at: Number.isFinite(latestTime) && latestTime >= Date.parse(savedAt) ? latest.updated_at : savedAt };
    const changed = updated.status !== latest.status || updated.date_started !== latest.date_started || updated.updated_at !== latest.updated_at;
    // Readback recognizes the same stable recency after a lost write response.
    if (changed) await booksRepo.upsertLocal(attempt.userId, updated, "update");
    attempt.bookCommitted = true;
    attempt.updatedBook = changed ? updated : latest;
  }
  assertCurrent();
  return attempt.updatedBook!;
}
