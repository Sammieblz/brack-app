import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Book } from "@/types";
import {
  createProgressCapture,
  ObsoleteProgressCapture,
  persistProgressCapture,
  type ProgressCaptureDraft,
} from "./progressCapture";

const repository = vi.hoisted(() => ({
  bookGet: vi.fn(), bookWrite: vi.fn(), logGet: vi.fn(), logWrite: vi.fn(), createId: vi.fn(),
}));
vi.mock("@/services/local", () => ({
  booksRepo: { get: repository.bookGet, upsertLocal: repository.bookWrite },
  progressRepo: { get: repository.logGet, createPending: repository.logWrite },
  createLocalId: repository.createId,
}));

const originalBook = {
  id: "book-one", user_id: "reader-one", title: "A reading book", pages: 300,
  status: "reading", current_page: 42, date_started: "2026-09-20", date_finished: null,
  deleted_at: null, notes: "Original book notes", updated_at: "2026-09-20T16:00:00.000Z",
} as Book;
const draft: ProgressCaptureDraft = {
  pageNumber: 60, chapterNumber: 3, paragraphNumber: null, timeSpent: 20,
  notes: "A reading observation", photoUrl: "https://example.test/reading-photo.webp",
};
const freshAttempt = (changes: Partial<ProgressCaptureDraft> = {}) =>
  createProgressCapture("reader-one", "book-one", { ...draft, ...changes });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-01T16:00:00.000Z"));
  repository.bookGet.mockReset().mockResolvedValue(originalBook);
  repository.bookWrite.mockReset().mockResolvedValue(undefined);
  repository.logGet.mockReset().mockResolvedValue(null);
  repository.logWrite.mockReset().mockResolvedValue(undefined);
  repository.createId.mockReset().mockReturnValue("log-one");
});
afterEach(() => vi.useRealTimers());

describe("one owned reading capture attempt", () => {
  it("copies one submitted payload, identity and timestamp without changing the draft", () => {
    const editable = { ...draft };
    const attempt = createProgressCapture("reader-one", "book-one", editable);
    editable.notes = "A later edit";
    vi.setSystemTime(new Date("2026-10-02T16:00:00.000Z"));
    expect(attempt).toMatchObject({
      userId: "reader-one", bookId: "book-one", activityDate: "2026-10-01",
      logAttempted: false, logCommitted: false, bookCommitted: false,
      log: { id: "log-one", user_id: "reader-one", book_id: "book-one", page_number: 60,
        chapter_number: 3, paragraph_number: null, time_spent_minutes: 20, notes: draft.notes,
        photo_url: draft.photoUrl, log_type: "manual", logged_at: "2026-10-01T16:00:00.000Z",
        created_at: "2026-10-01T16:00:00.000Z" },
    });
    expect(repository.createId).toHaveBeenCalledOnce();
  });

  it.each([0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, 301])(
    "does not enqueue an invalid new log for page %s", async pageNumber => {
      await expect(persistProgressCapture(freshAttempt({ pageNumber }), () => true)).rejects.toThrow(/whole page number/);
      expect(repository.logWrite).not.toHaveBeenCalled();
      expect(repository.bookWrite).not.toHaveBeenCalled();
    },
  );

  it.each([null, { ...originalBook, user_id: "reader-two" }, { ...originalBook, deleted_at: "2026-10-01T15:00:00Z" }])(
    "rejects an unavailable or unowned local book before touching reading logs", async book => {
      repository.bookGet.mockResolvedValue(book);
      await expect(persistProgressCapture(freshAttempt(), () => true)).rejects.toThrow(/isn't available for this account/);
      expect(repository.logGet).not.toHaveBeenCalled();
      expect(repository.logWrite).not.toHaveBeenCalled();
    },
  );

  it("allows unknown totals and preserves the existing book maximum and completed dates", async () => {
    repository.bookGet.mockResolvedValue({ ...originalBook, pages: null, current_page: 90,
      status: "completed", date_finished: "2026-09-25" });
    const updated = await persistProgressCapture(freshAttempt(), () => true);
    expect(updated).toMatchObject({ current_page: 90, status: "completed", date_started: "2026-09-20", date_finished: "2026-09-25" });
    expect(repository.logWrite).toHaveBeenCalledExactlyOnceWith("reader-one", expect.objectContaining({ page_number: 60 }));
  });

  it.each([[60, "reading", null], [300, "completed", "2026-10-01"]] as const)(
    "records page %s with existing start/completion rules", async (pageNumber, status, finished) => {
      repository.bookGet.mockResolvedValue({ ...originalBook, current_page: 0, status: "to_read", date_started: null });
      const updated = await persistProgressCapture(freshAttempt({ pageNumber }), () => true);
      expect(updated).toMatchObject({ current_page: pageNumber, status, date_started: "2026-10-01", date_finished: finished });
    },
  );

  it("retries only the remaining book write, merges its latest fields and timestamps the new update", async () => {
    const attempt = freshAttempt();
    repository.bookWrite.mockRejectedValueOnce(new Error("Book transaction unavailable"));
    await expect(persistProgressCapture(attempt, () => true)).rejects.toThrow("Book transaction unavailable");
    expect(attempt).toMatchObject({ logAttempted: true, logCommitted: true, bookCommitted: false });
    vi.setSystemTime(new Date("2026-10-02T16:00:00.000Z"));
    const latestBook = { ...originalBook, title: "Latest title", current_page: 99,
      notes: "Latest book notes", updated_at: "2026-10-02T15:00:00.000Z" };
    repository.bookGet.mockResolvedValue(latestBook);
    const updated = await persistProgressCapture(attempt, () => true);
    expect(repository.logWrite).toHaveBeenCalledOnce();
    expect(repository.bookWrite).toHaveBeenCalledTimes(2);
    expect(updated).toMatchObject({ title: "Latest title", current_page: 99, notes: "Latest book notes", updated_at: "2026-10-02T16:00:00.000Z" });
    expect(Date.parse(updated.updated_at)).toBeGreaterThan(Date.parse(latestBook.updated_at));
    expect(attempt.log).toMatchObject({ logged_at: "2026-10-01T16:00:00.000Z", created_at: "2026-10-01T16:00:00.000Z" });
    expect(attempt.activityDate).toBe("2026-10-01");
    expect(attempt).toMatchObject({ logCommitted: true, bookCommitted: true, updatedBook: updated });
    await persistProgressCapture(attempt, () => true);
    expect(repository.logWrite).toHaveBeenCalledOnce();
    expect(repository.bookWrite).toHaveBeenCalledTimes(2);
  });

  it("keeps reading start and completion on the activity date when the book update is retried the next day", async () => {
    const attempt = freshAttempt({ pageNumber: 300 });
    repository.bookGet.mockResolvedValue({ ...originalBook, status: "to_read", current_page: 0, date_started: null });
    repository.bookWrite.mockRejectedValueOnce(new Error("Book update unavailable"));
    await expect(persistProgressCapture(attempt, () => true)).rejects.toThrow("Book update unavailable");
    vi.setSystemTime(new Date("2026-10-02T16:00:00.000Z"));
    const updated = await persistProgressCapture(attempt, () => true);
    expect(updated).toMatchObject({ status: "completed", current_page: 300,
      date_started: "2026-10-01", date_finished: "2026-10-01", updated_at: "2026-10-02T16:00:00.000Z" });
    expect(repository.logWrite).toHaveBeenCalledOnce();
  });

  it("finishes a committed-log retry even if total pages changed after the first save", async () => {
    const attempt = freshAttempt();
    repository.bookWrite.mockRejectedValueOnce(new Error("Book write failed"));
    await expect(persistProgressCapture(attempt, () => true)).rejects.toThrow();
    repository.bookGet.mockResolvedValue({ ...originalBook, pages: 50 });
    const updated = await persistProgressCapture(attempt, () => true);
    expect(updated).toMatchObject({ pages: 50, current_page: 60, status: "completed" });
    expect(repository.logWrite).toHaveBeenCalledOnce();
  });

  it("recognizes an identical existing log and does not enqueue another activity", async () => {
    const attempt = freshAttempt();
    repository.logGet.mockResolvedValue({ ...attempt.log });
    await persistProgressCapture(attempt, () => true);
    expect(repository.logWrite).not.toHaveBeenCalled();
    expect(attempt.logCommitted).toBe(true);
    expect(repository.bookWrite).toHaveBeenCalledOnce();
  });

  it.each(["user_id", "book_id", "page_number", "notes", "photo_url", "logged_at"])(
    "rejects a log identity collision with a different %s", async field => {
      const attempt = freshAttempt();
      repository.logGet.mockResolvedValue({ ...attempt.log, [field]: "unrelated" });
      await expect(persistProgressCapture(attempt, () => true)).rejects.toThrow(/could not be verified/);
      expect(repository.logWrite).not.toHaveBeenCalled();
      expect(repository.bookWrite).not.toHaveBeenCalled();
      expect(attempt.logCommitted).toBe(false);
    },
  );

  it("reads back a lost create response before continuing to the book update", async () => {
    const attempt = freshAttempt();
    repository.logGet.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...attempt.log });
    repository.logWrite.mockRejectedValueOnce(new Error("Lost native bridge response"));
    await persistProgressCapture(attempt, () => true);
    expect(repository.logGet).toHaveBeenCalledTimes(2);
    expect(repository.logWrite).toHaveBeenCalledOnce();
    expect(repository.bookWrite).toHaveBeenCalledOnce();
    expect(attempt).toMatchObject({ logAttempted: true, logCommitted: true, bookCommitted: true });
  });

  it("permits ordinary retry/edit only after readback establishes no log was committed", async () => {
    const attempt = freshAttempt();
    repository.logWrite.mockRejectedValueOnce(new Error("Log transaction failed"));
    await expect(persistProgressCapture(attempt, () => true)).rejects.toThrow("Log transaction failed");
    expect(attempt).toMatchObject({ logAttempted: false, logCommitted: false, bookCommitted: false });
    expect(repository.bookWrite).not.toHaveBeenCalled();
    await persistProgressCapture(attempt, () => true);
    expect(repository.logWrite).toHaveBeenCalledTimes(2);
    expect(repository.logWrite.mock.calls[0]).toEqual(repository.logWrite.mock.calls[1]);
  });

  it("freezes the attempt if neither create response nor readback can establish its outcome", async () => {
    const attempt = freshAttempt();
    repository.logWrite.mockRejectedValueOnce(new Error("Lost response"));
    repository.logGet.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("Readback unavailable"));
    await expect(persistProgressCapture(attempt, () => true)).rejects.toThrow("Readback unavailable");
    expect(attempt).toMatchObject({ logAttempted: true, logCommitted: false, bookCommitted: false });
    expect(repository.bookWrite).not.toHaveBeenCalled();
    repository.logGet.mockResolvedValue({ ...attempt.log });
    await persistProgressCapture(attempt, () => true);
    expect(repository.logWrite).toHaveBeenCalledOnce();
    expect(repository.bookWrite).toHaveBeenCalledOnce();
  });

  it("cannot treat an unrelated record found after create failure as the submitted reading", async () => {
    const attempt = freshAttempt();
    repository.logWrite.mockRejectedValueOnce(new Error("Create response lost"));
    repository.logGet.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...attempt.log, page_number: 61 });
    await expect(persistProgressCapture(attempt, () => true)).rejects.toThrow(/could not be verified/);
    expect(attempt).toMatchObject({ logAttempted: true, logCommitted: false, bookCommitted: false });
    expect(repository.bookWrite).not.toHaveBeenCalled();
  });

  it("releases an ambiguous attempt once retry readback proves it absent, even if the book total now rejects its page", async () => {
    const attempt = freshAttempt();
    repository.logWrite.mockRejectedValueOnce(new Error("Response lost"));
    repository.logGet.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("Readback unavailable"));
    await expect(persistProgressCapture(attempt, () => true)).rejects.toThrow("Readback unavailable");
    expect(attempt.logAttempted).toBe(true);
    repository.bookGet.mockResolvedValue({ ...originalBook, pages: 50 });
    await expect(persistProgressCapture(attempt, () => true)).rejects.toThrow(/from 1 to 50/);
    expect(attempt).toMatchObject({ logAttempted: false, logCommitted: false });
    expect(repository.logWrite).toHaveBeenCalledOnce();
  });

  it("does not update a removed book after saving its reading log", async () => {
    const attempt = freshAttempt();
    repository.bookGet.mockResolvedValueOnce(originalBook).mockResolvedValueOnce(null);
    await expect(persistProgressCapture(attempt, () => true)).rejects.toThrow(/reading log is saved/);
    expect(attempt.logCommitted).toBe(true);
    expect(repository.logWrite).toHaveBeenCalledOnce();
    expect(repository.bookWrite).not.toHaveBeenCalled();
  });
});

describe("capture ownership across awaited boundaries", () => {
  it("does nothing if the task is already obsolete", async () => {
    await expect(persistProgressCapture(freshAttempt(), () => false)).rejects.toBeInstanceOf(ObsoleteProgressCapture);
    expect(repository.bookGet).not.toHaveBeenCalled();
  });

  it.each(["initial-book", "existing-log", "latest-book"])("cancels followups after the %s read", async stage => {
    const pending = deferred<Book | null>();
    let current = true;
    if (stage === "initial-book") repository.bookGet.mockReturnValueOnce(pending.promise);
    if (stage === "existing-log") repository.logGet.mockReturnValueOnce(pending.promise);
    if (stage === "latest-book") repository.bookGet.mockResolvedValueOnce(originalBook).mockReturnValueOnce(pending.promise);
    const result = persistProgressCapture(freshAttempt(), () => current);
    if (stage === "existing-log") await vi.waitFor(() => expect(repository.logGet).toHaveBeenCalledOnce());
    if (stage === "latest-book") await vi.waitFor(() => expect(repository.bookGet).toHaveBeenCalledTimes(2));
    current = false;
    pending.resolve(stage === "existing-log" ? null : originalBook);
    await expect(result).rejects.toBeInstanceOf(ObsoleteProgressCapture);
    expect(repository.bookWrite).not.toHaveBeenCalled();
    expect(repository.logWrite).toHaveBeenCalledTimes(stage === "latest-book" ? 1 : 0);
  });

  it.each(["resolve", "reject"])("allows an initiated log transaction to %s without starting later work for an obsolete owner", async outcome => {
    const pending = deferred<void>();
    repository.logWrite.mockReturnValueOnce(pending.promise);
    const attempt = freshAttempt();
    let current = true;
    const result = persistProgressCapture(attempt, () => current);
    await vi.waitFor(() => expect(repository.logWrite).toHaveBeenCalledOnce());
    current = false;
    if (outcome === "resolve") pending.resolve();
    else pending.reject(new Error("Original owner's transaction failed"));
    await expect(result).rejects.toBeInstanceOf(ObsoleteProgressCapture);
    expect(repository.logGet).toHaveBeenCalledOnce();
    expect(repository.bookGet).toHaveBeenCalledOnce();
    expect(repository.bookWrite).not.toHaveBeenCalled();
    expect(attempt.logCommitted).toBe(outcome === "resolve");
  });

  it("does not return a success to an obsolete owner after an initiated book write finishes", async () => {
    const pending = deferred<void>();
    repository.bookWrite.mockReturnValueOnce(pending.promise);
    const attempt = freshAttempt();
    let current = true;
    const result = persistProgressCapture(attempt, () => current);
    await vi.waitFor(() => expect(repository.bookWrite).toHaveBeenCalledOnce());
    current = false;
    pending.resolve();
    await expect(result).rejects.toBeInstanceOf(ObsoleteProgressCapture);
    expect(attempt).toMatchObject({ logCommitted: true, bookCommitted: true });
    expect(repository.bookWrite).toHaveBeenCalledExactlyOnceWith("reader-one", expect.objectContaining({ user_id: "reader-one" }), "update");
  });

  it("cancels the book update if ownership changes during ambiguous-log readback", async () => {
    const pending = deferred<unknown>();
    const attempt = freshAttempt();
    repository.logWrite.mockRejectedValueOnce(new Error("Response lost"));
    repository.logGet.mockResolvedValueOnce(null).mockReturnValueOnce(pending.promise);
    let current = true;
    const result = persistProgressCapture(attempt, () => current);
    await vi.waitFor(() => expect(repository.logGet).toHaveBeenCalledTimes(2));
    current = false;
    pending.resolve({ ...attempt.log });
    await expect(result).rejects.toBeInstanceOf(ObsoleteProgressCapture);
    expect(repository.bookWrite).not.toHaveBeenCalled();
  });
});
