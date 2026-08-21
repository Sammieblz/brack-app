import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Book } from "@/types";
import { booksRepo, sessionsRepo } from "@/services/local";
import {
  TIMER_RECOVERY_STORAGE_KEY,
  TIMER_STORAGE_KEY,
} from "@/services/timerSession";

const mocks = vi.hoisted(() => ({
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
    onTimerAction: () => () => undefined,
    syncTimerNotification: mocks.syncTimerNotification,
    requestNotificationPermissions: mocks.requestNotificationPermissions,
  },
}));

vi.mock("@/contexts/ConfirmDialogContext", () => ({
  useConfirmDialog: () => vi.fn().mockResolvedValue(false),
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));

import { TimerProvider, useTimer } from "./TimerContext";

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
    <button type="button" onClick={() => void timer.finishTimer(true)}>
      Finish {timer.bookId ?? "none"}
    </button>
  );
};

const installBookAlias = async () => {
  const userId = `user-${crypto.randomUUID()}`;
  const staleBookId = crypto.randomUUID();
  const canonicalBook = makeBook(userId, crypto.randomUUID());
  await booksRepo.remapIdentity(userId, staleBookId, canonicalBook);
  mocks.getCurrentAuthUser.mockResolvedValue({ id: userId });
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
    Object.values(mocks.toast).forEach((mock) => mock.mockClear());
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("saves a persisted stale-ID timer against the canonical book", async () => {
    const { userId, staleBookId, canonicalBook } = await installBookAlias();
    const sessionId = crypto.randomUUID();
    localStorage.setItem(
      TIMER_STORAGE_KEY,
      JSON.stringify({
        time: 600,
        isRunning: false,
        startTime: "2026-08-10T10:00:00.000Z",
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
      fireEvent.click(await screen.findByRole("button", { name: `Finish ${staleBookId}` }));

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
        startTime: "2026-08-10T10:00:00.000Z",
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
        });
      });
    } finally {
      window.removeEventListener("readingSessionSaved", onReading);
    }
  });
});
