import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Book } from "@/types";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  upsertLocal: vi.fn(),
  upsertRemote: vi.fn(),
  completeReading: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ update: mocks.update }) },
}));
vi.mock("@/services/local", () => ({
  booksRepo: { upsertLocal: mocks.upsertLocal, upsertRemote: mocks.upsertRemote },
  bookSearchCacheRepo: {},
  pendingBookImportsRepo: {},
  createLocalId: vi.fn(),
}));
vi.mock("./reading", () => ({ completeReading: mocks.completeReading }));
vi.mock("./auth", () => ({ getCurrentAuthUser: vi.fn() }));
vi.mock("./client", () => ({ invokeFunction: vi.fn() }));
vi.mock("@/services/telemetry", () => ({ trackCoreEvent: vi.fn() }));
vi.mock("@/services/connectivity", () => ({
  isConnectivityAvailable: () => false,
  getConnectivityState: vi.fn(),
  isRetryableConnectivityError: vi.fn(),
  markConnectivityFailure: vi.fn(),
  markConnectivitySuccess: vi.fn(),
}));

import { updateBookQuickProgress, updateBookStatus } from "./books";

const makeBook = (): Book => ({
  id: "book-1", user_id: "reader-1", title: "Kindred", author: "Octavia E. Butler",
  isbn: null, genre: null, pages: 288, chapters: null, cover_url: null,
  description: null, status: "to_read", tags: null, metadata: null,
  current_page: 0, date_started: null, date_finished: null, rating: null,
  notes: null, source_provider: null, source_id: null, shelf_position: null,
  created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", deleted_at: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  mocks.upsertLocal.mockResolvedValue(undefined);
  mocks.upsertRemote.mockResolvedValue(undefined);
  mocks.completeReading.mockResolvedValue({});
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterEach(() => vi.useRealTimers());

describe.each([0, 23])("automatic book dates at local hour %i", (hour) => {
  it("starts a book using the local day while retaining the modification timestamp", async () => {
    const now = new Date(2026, 11, 31, hour, 30);
    vi.setSystemTime(now);

    await updateBookStatus(makeBook(), "reading");

    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
      status: "reading", date_started: "2026-12-31", updated_at: now.toISOString(),
    });
  });

  it("uses the local completion day when an online completion omits the book", async () => {
    const now = new Date(2026, 11, 31, hour, 30);
    vi.setSystemTime(now);

    const result = await updateBookStatus(makeBook(), "completed");

    expect(result).toMatchObject({ status: "completed", date_finished: "2026-12-31", updated_at: now.toISOString() });
  });

  it("records quick progress dates locally without converting true timestamps", async () => {
    const now = new Date(2026, 11, 31, hour, 30);
    vi.setSystemTime(now);

    await updateBookQuickProgress(makeBook(), 288);

    expect(mocks.upsertLocal).toHaveBeenCalledExactlyOnceWith("reader-1", expect.objectContaining({
      status: "completed", current_page: 288, date_started: "2026-12-31", date_finished: "2026-12-31", updated_at: now.toISOString(),
    }), "update");
  });
});

it("does not overwrite dates a reader has already recorded", async () => {
  vi.setSystemTime(new Date(2026, 11, 31, 23, 30));
  const book = { ...makeBook(), status: "completed", date_started: "1999-02-05", date_finished: "2000-02-29" };

  await updateBookQuickProgress(book, 288);

  expect(mocks.upsertLocal).toHaveBeenCalledWith("reader-1", expect.objectContaining({
    date_started: "1999-02-05", date_finished: "2000-02-29",
  }), "update");
});
