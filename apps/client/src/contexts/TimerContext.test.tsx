import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Book } from "@/types";
import { booksRepo, sessionsRepo } from "@/services/local";
import { createSessionCapture } from "@/lib/sessionCapture";
import {
  TIMER_RECOVERY_STORAGE_KEY,
  TIMER_STORAGE_KEY,
} from "@/services/timerSession";

const mocks = vi.hoisted(() => ({
  reader: { id: null as string | null, loading: false },
  confirm: vi.fn(),
  nativeStop: null as null | ((action: "stop", identity?: { userId: string; clientSessionId: string }) => void),
  getCurrentAuthUser: vi.fn(),
  emitBooksChanged: vi.fn(),
  syncUser: vi.fn(),
  syncTimerNotification: vi.fn().mockResolvedValue(undefined),
  requestNotificationPermissions: vi.fn().mockResolvedValue(undefined),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.reader.id ? { id: mocks.reader.id } : null, loading: mocks.reader.loading }) }));

vi.mock("@/services/api", () => ({
  getCurrentAuthUser: mocks.getCurrentAuthUser,
  emitBooksChanged: mocks.emitBooksChanged,
}));

vi.mock("@/services/connectivity", () => ({
  isConnectivityAvailable: () => false,
}));

vi.mock("@/services/sync/engine", () => ({
  readingCoreSync: { syncUser: mocks.syncUser },
}));

vi.mock("@/services/timerNative", () => ({
  timerNativeService: {
    onAppStateChange: () => () => undefined,
    onTimerAction: (callback: typeof mocks.nativeStop) => { mocks.nativeStop = callback; return () => { mocks.nativeStop = null; }; },
    syncTimerNotification: mocks.syncTimerNotification,
    requestNotificationPermissions: mocks.requestNotificationPermissions,
  },
}));

vi.mock("@/contexts/ConfirmDialogContext", () => ({
  useConfirmDialog: () => mocks.confirm,
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));

import { TimerProvider, useTimer } from "./TimerContext";

const SESSION_START = new Date(2026, 7, 10, 23, 50);

const makeBook = (userId: string, id: string): Book => ({
  id,
  user_id: userId,
  title: "Supernova",
  author: "Marissa Meyer",
  isbn: "9781250078391",
  genre: "Science Fiction",
  pages: 560,
  chapters: null,
  cover_url: null,
  description: null,
  status: "to_read",
  tags: null,
  metadata: null,
  current_page: 0,
  date_started: null,
  date_finished: null,
  rating: null,
  notes: null,
  source_provider: null,
  source_id: null,
  shelf_position: null,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  deleted_at: null,
});

const TimerProbe = () => {
  const timer = useTimer();
  return (
    <>
      <button type="button" onClick={() => timer.startTimer("book-1", "Supernova")}>
        Start timer
      </button>
      <button type="button" onClick={() => void timer.finishTimer(true)}>
        Finish {timer.bookId ?? "none"}
      </button>
      <button type="button" onClick={timer.pauseTimer}>Pause</button>
      <button type="button" onClick={timer.resumeTimer}>Resume</button>
      <button type="button" onClick={timer.cancelTimer}>Cancel</button>
      <button type="button" onClick={() => timer.startTimer("book-2", "Other book")}>Start another</button>
      <output data-testid="timer-state">{JSON.stringify({ bookId: timer.bookId, time: timer.time, isRunning: timer.isRunning, isVisible: timer.isVisible, isSaving: timer.isSaving, isStarting: timer.isStarting, saveFrozen: timer.saveFrozen })}</output>
      {timer.saveError && <p role="alert">{timer.saveError}</p>}
      {timer.storageWarning && <p>{timer.storageWarning}</p>}
    </>
  );
};

const installBookAlias = async () => {
  const userId = `user-${crypto.randomUUID()}`;
  const staleBookId = crypto.randomUUID();
  const canonicalBook = makeBook(userId, crypto.randomUUID());
  await booksRepo.remapIdentity(userId, staleBookId, canonicalBook);
  mocks.getCurrentAuthUser.mockResolvedValue({ id: userId });
  mocks.reader.id = userId;
  return { userId, staleBookId, canonicalBook };
};

const expectCanonicalSession = async (
  userId: string,
  canonicalBook: Book,
  sessionId: string,
) => {
  await waitFor(async () => {
    const session = (await sessionsRepo.list(userId)).find((item) => item.id === sessionId);
    expect(session).toMatchObject({
      id: sessionId,
      user_id: userId,
      book_id: canonicalBook.id,
      duration: 10,
      start_time: SESSION_START.toISOString(),
      end_time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    });
    expect(await booksRepo.get(canonicalBook.id)).toMatchObject({
      id: canonicalBook.id,
      status: "reading",
      date_started: "2026-08-10",
    });
  });
};

describe("TimerProvider remapped book identities", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.getCurrentAuthUser.mockReset();
    mocks.emitBooksChanged.mockReset();
    mocks.syncUser.mockReset();
    mocks.syncTimerNotification.mockClear();
    mocks.requestNotificationPermissions.mockClear();
    mocks.requestNotificationPermissions.mockResolvedValue(undefined);
    mocks.reader.id = null; mocks.reader.loading = false;
    mocks.confirm.mockReset().mockResolvedValue(false);
    Object.values(mocks.toast).forEach((mock) => mock.mockClear());
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("waits for a deliberate timer start before requesting notification access", async () => {
    mocks.reader.id = `user-${crypto.randomUUID()}`;
    await booksRepo.upsertRemote(mocks.reader.id, makeBook(mocks.reader.id, "book-1"));
    render(
      <TimerProvider>
        <TimerProbe />
      </TimerProvider>,
    );

    expect(mocks.requestNotificationPermissions).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Start timer" }));

    await waitFor(() => {
      expect(mocks.requestNotificationPermissions).toHaveBeenCalledOnce();
    });
  });

  it("saves a persisted stale-ID timer against the canonical book", async () => {
    const { userId, staleBookId, canonicalBook } = await installBookAlias();
    const sessionId = crypto.randomUUID();
    localStorage.setItem(
      TIMER_STORAGE_KEY,
      JSON.stringify({
        time: 600,
        isRunning: false,
        startTime: SESSION_START.toISOString(),
        runningSince: null,
        accumulatedSeconds: 600,
        bookId: staleBookId,
        bookTitle: canonicalBook.title,
        clientSessionId: sessionId,
        isVisible: true,
        isMinimized: true,
      }),
    );

    const readingEvents: CustomEvent[] = [];
    const journalEvents: CustomEvent[] = [];
    const onReading = (event: Event) => readingEvents.push(event as CustomEvent);
    const onJournal = (event: Event) => journalEvents.push(event as CustomEvent);
    window.addEventListener("readingSessionSaved", onReading);
    window.addEventListener("showJournalPrompt", onJournal);

    try {
      render(
        <TimerProvider>
          <TimerProbe />
        </TimerProvider>,
      );
      fireEvent.click(await screen.findByRole("button", { name: `Finish ${canonicalBook.id}` }));

      await expectCanonicalSession(userId, canonicalBook, sessionId);
      await waitFor(() => {
        expect(mocks.emitBooksChanged).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "upsert",
            userId,
            book: expect.objectContaining({ id: canonicalBook.id }),
          }),
        );
        expect(readingEvents[0]?.detail).toMatchObject({
          userId,
          bookId: canonicalBook.id,
          sessionId,
          activityDate: "2026-08-10",
        });
        expect(journalEvents[0]?.detail).toMatchObject({
          bookId: canonicalBook.id,
          bookTitle: canonicalBook.title,
          durationMinutes: 10,
        });
      });
    } finally {
      window.removeEventListener("readingSessionSaved", onReading);
      window.removeEventListener("showJournalPrompt", onJournal);
    }
  });

  it("saves reviewed recovery time against the canonical book", async () => {
    const { userId, staleBookId, canonicalBook } = await installBookAlias();
    const sessionId = crypto.randomUUID();
    localStorage.setItem(
      TIMER_RECOVERY_STORAGE_KEY,
      JSON.stringify({
        reason: "duration_limit",
        bookId: staleBookId,
        bookTitle: canonicalBook.title,
        clientSessionId: sessionId,
        startTime: SESSION_START.toISOString(),
        elapsedSeconds: 600,
        suggestedMinutes: 10,
      }),
    );

    const readingEvents: CustomEvent[] = [];
    const onReading = (event: Event) => readingEvents.push(event as CustomEvent);
    window.addEventListener("readingSessionSaved", onReading);

    try {
      render(
        <TimerProvider>
          <TimerProbe />
        </TimerProvider>,
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "Save reviewed time" }),
      );

      await expectCanonicalSession(userId, canonicalBook, sessionId);
      await waitFor(() => {
        expect(readingEvents[0]?.detail).toMatchObject({
          userId,
          bookId: canonicalBook.id,
          sessionId,
          activityDate: "2026-08-10",
        });
      });
    } finally {
      window.removeEventListener("readingSessionSaved", onReading);
    }
  });
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const timerState = () => JSON.parse(screen.getByTestId("timer-state").textContent!);
const seedOwnedTimer = async (options: { userId?: string; bookId?: string; running?: boolean; seconds?: number } = {}) => {
  const userId = options.userId || `reader-${crypto.randomUUID()}`;
  const book = makeBook(userId, options.bookId || crypto.randomUUID());
  await booksRepo.upsertRemote(userId, book);
  const sessionId = crypto.randomUUID();
  const state = { userId, time: options.seconds ?? 600, accumulatedSeconds: options.seconds ?? 600,
    isRunning: Boolean(options.running), runningSince: options.running ? new Date().toISOString() : null,
    startTime: SESSION_START.toISOString(), bookId: book.id, bookTitle: book.title,
    clientSessionId: sessionId, isVisible: true, isMinimized: true };
  localStorage.setItem(`${TIMER_STORAGE_KEY}:${userId}`, JSON.stringify(state));
  mocks.reader.id = userId;
  return { userId, book, sessionId, state };
};

describe("owned timer lifecycle and completion", () => {
  beforeEach(() => {
    localStorage.clear(); mocks.reader.id = null; mocks.reader.loading = false;
    mocks.confirm.mockReset().mockResolvedValue(false);
    mocks.requestNotificationPermissions.mockReset().mockResolvedValue(false);
    mocks.emitBooksChanged.mockReset(); mocks.syncTimerNotification.mockClear();
    Object.values(mocks.toast).forEach(mock => mock.mockClear());
  });
  afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

  it("pauses and retains the departing account, masks it, and restores only its owner", async () => {
    const first = await seedOwnedTimer({ running: true });
    const view = render(<TimerProvider><TimerProbe /></TimerProvider>);
    await waitFor(() => expect(timerState().bookId).toBe(first.book.id));
    mocks.reader.id = "other-reader"; view.rerender(<TimerProvider><TimerProbe /></TimerProvider>);
    expect(timerState().isVisible).toBe(false);
    expect(JSON.parse(localStorage.getItem(`${TIMER_STORAGE_KEY}:${first.userId}`)!)).toMatchObject({ isRunning: false, bookId: first.book.id });
    mocks.reader.id = first.userId; view.rerender(<TimerProvider><TimerProbe /></TimerProvider>);
    await waitFor(() => expect(timerState()).toMatchObject({ bookId: first.book.id, isRunning: false, time: 600 }));
  });

  it("does not migrate a foreign legacy timer into the current reader", async () => {
    const foreign = await seedOwnedTimer();
    localStorage.removeItem(`${TIMER_STORAGE_KEY}:${foreign.userId}`);
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({ ...foreign.state, userId: undefined }));
    mocks.reader.id = "another-reader";
    render(<TimerProvider><TimerProbe /></TimerProvider>);
    await waitFor(() => expect(timerState().isStarting).toBe(false));
    expect(timerState().isVisible).toBe(false);
    expect(localStorage.getItem(TIMER_STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem(`${TIMER_STORAGE_KEY}:another-reader`)).toBeNull();
  });

  it("invalidates a pending permission response on auth loading", async () => {
    const userId = `reader-${crypto.randomUUID()}`; mocks.reader.id = userId;
    await booksRepo.upsertRemote(userId, makeBook(userId, "book-1"));
    const permission = deferred<boolean>(); mocks.requestNotificationPermissions.mockReturnValue(permission.promise);
    const view = render(<TimerProvider><TimerProbe /></TimerProvider>);
    fireEvent.click(screen.getByText("Start timer"));
    await waitFor(() => expect(mocks.requestNotificationPermissions).toHaveBeenCalledOnce());
    mocks.reader.loading = true; view.rerender(<TimerProvider><TimerProbe /></TimerProvider>);
    await act(async () => permission.resolve(true));
    expect(timerState().isVisible).toBe(false); expect(mocks.toast.success).not.toHaveBeenCalled();
  });

  it("starts successfully when notification permission is denied and suppresses repeat starts", async () => {
    const userId = `reader-${crypto.randomUUID()}`; mocks.reader.id = userId;
    await booksRepo.upsertRemote(userId, makeBook(userId, "book-1"));
    render(<TimerProvider><TimerProbe /></TimerProvider>);
    fireEvent.click(screen.getByText("Start timer")); fireEvent.click(screen.getByText("Start timer"));
    await waitFor(() => expect(timerState().isRunning).toBe(true));
    expect(mocks.requestNotificationPermissions).toHaveBeenCalledOnce(); expect(mocks.toast.success).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText("Pause")); fireEvent.click(screen.getByText("Start timer"));
    expect(timerState().isRunning).toBe(true); expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it("freezes one finish duration and prevents native stop/start/pause from racing its write", async () => {
    const seeded = await seedOwnedTimer({ running: true });
    await booksRepo.upsertRemote(seeded.userId, makeBook(seeded.userId, "book-2"));
    const committed = deferred<Awaited<ReturnType<typeof sessionsRepo.createPending>>>();
    const original = sessionsRepo.createPending;
    const write = vi.spyOn(sessionsRepo, "createPending").mockImplementation(async (...args) => { await committed.promise; return original(...args); });
    render(<TimerProvider><TimerProbe /></TimerProvider>);
    fireEvent.click(await screen.findByText(`Finish ${seeded.book.id}`));
    await waitFor(() => expect(write).toHaveBeenCalledOnce());
    act(() => mocks.nativeStop?.("stop", { userId: seeded.userId, clientSessionId: seeded.sessionId }));
    fireEvent.click(screen.getByText("Start another")); fireEvent.click(screen.getByText("Resume")); fireEvent.click(screen.getByText("Cancel"));
    expect(timerState()).toMatchObject({ isSaving: true, isRunning: false, bookId: seeded.book.id, time: 600 });
    expect(mocks.confirm).not.toHaveBeenCalled(); expect(write).toHaveBeenCalledOnce();
    await act(async () => committed.resolve(undefined as never));
    await waitFor(() => expect(timerState().isVisible).toBe(false));
    expect((await sessionsRepo.list(seeded.userId)).filter(session => session.id === seeded.sessionId)).toHaveLength(1);
  });

  it("retries a partial save without a second session create or a changed duration", async () => {
    const seeded = await seedOwnedTimer();
    const sessionWrite = vi.spyOn(sessionsRepo, "createPending");
    const originalBookWrite = booksRepo.upsertLocal;
    const bookWrite = vi.spyOn(booksRepo, "upsertLocal").mockRejectedValueOnce(new Error("Book transaction failed"));
    bookWrite.mockImplementationOnce(originalBookWrite);
    render(<TimerProvider><TimerProbe /></TimerProvider>);
    fireEvent.click(await screen.findByText(`Finish ${seeded.book.id}`));
    await screen.findByText(/Your reading time is saved on this device/);
    expect(timerState()).toMatchObject({ isVisible: true, isRunning: false, saveFrozen: true });
    fireEvent.click(screen.getByText(`Finish ${seeded.book.id}`));
    await waitFor(() => expect(timerState().isVisible).toBe(false));
    expect(sessionWrite).toHaveBeenCalledOnce();
    expect((await sessionsRepo.get(seeded.sessionId))?.duration).toBe(10);
  });

  it("restores an interrupted completion on reload and verifies its existing session", async () => {
    const seeded = await seedOwnedTimer();
    const sessionWrite = vi.spyOn(sessionsRepo, "createPending");
    const bookWrite = vi.spyOn(booksRepo, "upsertLocal").mockRejectedValueOnce(new Error("Book transaction failed"));
    const first = render(<TimerProvider><TimerProbe /></TimerProvider>);
    fireEvent.click(await screen.findByText(`Finish ${seeded.book.id}`));
    await screen.findByText(/Your reading time is saved/);
    first.unmount(); bookWrite.mockRestore();
    render(<TimerProvider><TimerProbe /></TimerProvider>);
    await screen.findByText(/interrupted while saving/);
    fireEvent.click(screen.getByText(`Finish ${seeded.book.id}`));
    await waitFor(() => expect(timerState().isVisible).toBe(false));
    expect(sessionWrite).toHaveBeenCalledOnce();
  });

  it("does not publish another reader's events after a save crosses an account change", async () => {
    const seeded = await seedOwnedTimer();
    const pending = deferred<Awaited<ReturnType<typeof sessionsRepo.createPending>>>();
    const original = sessionsRepo.createPending;
    vi.spyOn(sessionsRepo, "createPending").mockImplementation(async (...args) => { await pending.promise; return original(...args); });
    const view = render(<TimerProvider><TimerProbe /></TimerProvider>);
    fireEvent.click(await screen.findByText(`Finish ${seeded.book.id}`));
    await waitFor(() => expect(timerState().isSaving).toBe(true));
    mocks.reader.id = "another-reader"; view.rerender(<TimerProvider><TimerProbe /></TimerProvider>);
    await act(async () => pending.resolve(undefined as never));
    expect(timerState().isVisible).toBe(false); expect(mocks.emitBooksChanged).not.toHaveBeenCalled(); expect(mocks.toast.success).not.toHaveBeenCalled();
  });

  it("ignores missing and stale native identities", async () => {
    const seeded = await seedOwnedTimer();
    const write = vi.spyOn(sessionsRepo, "createPending");
    render(<TimerProvider><TimerProbe /></TimerProvider>);
    await screen.findByText(`Finish ${seeded.book.id}`);
    act(() => { mocks.nativeStop?.("stop"); mocks.nativeStop?.("stop", { userId: seeded.userId, clientSessionId: "old-session" }); });
    expect(write).not.toHaveBeenCalled(); expect(timerState().isVisible).toBe(true);
  });

  it("does not let an old discard confirmation clear a new account's session", async () => {
    const first = await seedOwnedTimer(); const decision = deferred<boolean>(); mocks.confirm.mockReturnValue(decision.promise);
    const view = render(<TimerProvider><TimerProbe /></TimerProvider>);
    await screen.findByText(`Finish ${first.book.id}`); fireEvent.click(screen.getByText("Cancel"));
    const second = await seedOwnedTimer(); view.rerender(<TimerProvider><TimerProbe /></TimerProvider>);
    await screen.findByText(`Finish ${second.book.id}`);
    await act(async () => decision.resolve(true));
    expect(timerState()).toMatchObject({ isVisible: true, bookId: second.book.id });
  });

  it("rejects blank/fractional/out-of-range recovery minutes without creating a session", async () => {
    const seeded = await seedOwnedTimer();
    localStorage.removeItem(`${TIMER_STORAGE_KEY}:${seeded.userId}`);
    localStorage.setItem(`${TIMER_RECOVERY_STORAGE_KEY}:${seeded.userId}`, JSON.stringify({ userId: seeded.userId,
      reason: "duration_limit", bookId: seeded.book.id, bookTitle: seeded.book.title, clientSessionId: seeded.sessionId,
      startTime: SESSION_START.toISOString(), elapsedSeconds: 13 * 3600, suggestedMinutes: 30 }));
    const write = vi.spyOn(sessionsRepo, "createPending"); render(<TimerProvider><TimerProbe /></TimerProvider>);
    const input = await screen.findByLabelText("Minutes actually read");
    for (const value of ["", "0", "1.5", "721", "-2"]) {
      fireEvent.change(input, { target: { value } }); fireEvent.click(screen.getByText("Save reviewed time"));
      expect(screen.getByText("Enter a whole number of minutes from 1 to 720.")).toBeTruthy();
    }
    expect(write).not.toHaveBeenCalled();
  });
  it("keeps an active timer usable and explains failed restoration storage writes", async () => {
    const seeded = await seedOwnedTimer();
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key.startsWith(TIMER_STORAGE_KEY)) throw new Error("Storage quota exceeded");
      return original.call(this, key, value);
    });
    render(<TimerProvider><TimerProbe /></TimerProvider>);
    await screen.findByText(/cannot be restored after closing the app/);
    expect(timerState()).toMatchObject({ isVisible: true, bookId: seeded.book.id });
    fireEvent.click(screen.getByText(`Finish ${seeded.book.id}`));
    await waitFor(() => expect(timerState().isVisible).toBe(false));
    expect(await sessionsRepo.get(seeded.sessionId)).not.toBeNull();
  });
  it("focuses the enabled retry action when an interrupted recovery freezes its minutes", async () => {
    const seeded = await seedOwnedTimer();
    localStorage.removeItem(`${TIMER_STORAGE_KEY}:${seeded.userId}`);
    const completion = createSessionCapture({ userId: seeded.userId, bookId: seeded.book.id, bookTitle: seeded.book.title,
      startTime: SESSION_START, endTime: new Date(SESSION_START.getTime() + 10 * 60_000), durationMinutes: 10,
      clientSessionId: seeded.sessionId, showJournalPrompt: true });
    await sessionsRepo.upsertRemote(seeded.userId, completion.session);
    localStorage.setItem(`${TIMER_RECOVERY_STORAGE_KEY}:${seeded.userId}`, JSON.stringify({ userId: seeded.userId,
      reason: "duration_limit", bookId: seeded.book.id, bookTitle: seeded.book.title, clientSessionId: seeded.sessionId,
      startTime: SESSION_START.toISOString(), elapsedSeconds: 13 * 3600, suggestedMinutes: 30, completion }));
    const write = vi.spyOn(sessionsRepo, "createPending");
    render(<TimerProvider><TimerProbe /></TimerProvider>);
    const retry = await screen.findByRole("button", { name: "Retry save" });
    await waitFor(() => expect(retry).toHaveFocus());
    expect(screen.getByLabelText("Minutes actually read")).toBeDisabled();
    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(write).not.toHaveBeenCalled();
  });
});
