import { describe, expect, it, vi } from "vitest";
import type { Book } from "@/types";
import {
  bookListItemsRepo,
  bookListsRepo,
  booksRepo,
  goalsRepo,
  journalRepo,
  progressRepo,
  sessionsRepo,
} from "@/services/local";

const { trackCoreEventMock } = vi.hoisted(() => ({
  trackCoreEventMock: vi.fn(),
}));

vi.mock("@/services/connectivity", () => ({
  isConnectivityAvailable: () => false,
}));

vi.mock("@/services/telemetry", () => ({
  trackCoreEvent: trackCoreEventMock,
}));

import {
  commitReadingImport,
  decryptBackup,
  encryptBackup,
  parseReadingImport,
  previewReadingImport,
  type ParsedReadingImport,
} from "./dataPortability";

const makeBook = (overrides: Partial<Book> = {}): Book => ({
  id: "book-1",
  user_id: "user-1",
  title: "Kindred",
  author: "Octavia E. Butler",
  isbn: "9780807083697",
  genre: "Science Fiction",
  pages: 288,
  chapters: null,
  cover_url: null,
  description: null,
  status: "reading",
  tags: null,
  metadata: null,
  current_page: 80,
  date_started: "2026-01-01",
  date_finished: null,
  rating: null,
  notes: null,
  source_provider: null,
  source_id: null,
  shelf_position: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
  ...overrides,
});

describe("reading backup encryption", () => {
  it("round-trips an AES-GCM encrypted archive", async () => {
    const source = new TextEncoder().encode("brack backup payload");
    const encrypted = await encryptBackup(source, "correct horse battery staple");
    const decrypted = await decryptBackup(encrypted, "correct horse battery staple");
    expect(new TextDecoder().decode(decrypted)).toBe("brack backup payload");
  });

  it("rejects the wrong passphrase", async () => {
    const encrypted = await encryptBackup(
      new TextEncoder().encode("private"),
      "correct-passphrase"
    );
    await expect(decryptBackup(encrypted, "incorrect-passphrase")).rejects.toThrow(
      "Incorrect passphrase"
    );
  });
});

describe("CSV import parsing", () => {
  it("recognizes Goodreads CSV and normalizes reading state", async () => {
    const csv = [
      "Book Id,Title,Author,ISBN13,Exclusive Shelf,My Rating,Number of Pages",
      '123,Kindred,Octavia E. Butler,"9780807083697",read,5,288',
    ].join("\n");
    const file = {
      name: "goodreads_library_export.csv",
      arrayBuffer: async () => new TextEncoder().encode(csv).buffer,
    } as File;
    const parsed = await parseReadingImport(file);
    expect(parsed.sourceFormat).toBe("goodreads_csv");
    expect(parsed.payload.books[0]).toMatchObject({
      title: "Kindred",
      author: "Octavia E. Butler",
      isbn: "9780807083697",
      status: "completed",
      rating: 5,
      pages: 288,
    });
  });
});

describe("reading import commit", () => {
  it("merges a duplicate book and reports a completed import", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const existing = makeBook({ user_id: userId });
    const incoming = makeBook({
      id: "source-book",
      user_id: "exported-user",
      status: "completed",
      current_page: 288,
      date_finished: "2026-02-01",
      rating: 5,
      updated_at: "2026-02-01T00:00:00.000Z",
    });

    await booksRepo.upsertRemote(userId, existing);
    const bytes = new TextEncoder().encode(JSON.stringify([incoming]));
    const parsed = await parseReadingImport({
      name: "library.json",
      arrayBuffer: async () => bytes.buffer,
    } as File);
    const preview = await previewReadingImport(userId, parsed);

    expect(preview.books[0]).toMatchObject({
      action: "merge",
      existing_book_id: existing.id,
    });

    const result = await commitReadingImport(userId, parsed, preview);
    const merged = await booksRepo.get(existing.id);

    expect(result).toMatchObject({ created: 0, merged: 1, failed: 0 });
    expect(merged).toMatchObject({
      id: existing.id,
      user_id: userId,
      status: "completed",
      current_page: 288,
      rating: 5,
    });
    expect(trackCoreEventMock).toHaveBeenLastCalledWith(
      "import_completed",
      expect.objectContaining({ created: 0, merged: 1, failed: 0 })
    );
  });

  it("does not erase rich local metadata when merging a minimal CSV duplicate", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const existing = makeBook({
      user_id: userId,
      cover_url: "https://example.com/kindred.jpg",
      description: "A rich local description",
      tags: ["favorite"],
      metadata: { edition: "anniversary" },
      rating: 4,
      notes: "Keep this personal note",
      source_provider: "google_books",
      source_id: "provider-book",
    });
    await booksRepo.upsertRemote(userId, existing);

    const csv = [
      "Title,Author,ISBN,Status",
      "Kindred,Octavia E. Butler,9780807083697,to-read",
    ].join("\n");
    const bytes = new TextEncoder().encode(csv);
    const parsed = await parseReadingImport({
      name: "minimal.csv",
      arrayBuffer: async () => bytes.buffer,
    } as File);
    const preview = await previewReadingImport(userId, parsed);
    const result = await commitReadingImport(userId, parsed, preview);
    const merged = await booksRepo.get(existing.id);

    expect(result).toMatchObject({ merged: 1, failed: 0 });
    expect(merged).toMatchObject({
      genre: existing.genre,
      cover_url: existing.cover_url,
      description: existing.description,
      tags: existing.tags,
      metadata: expect.objectContaining({
        ...existing.metadata,
        import_source: "csv",
      }),
      status: "reading",
      current_page: 80,
      rating: 4,
      notes: existing.notes,
      source_provider: existing.source_provider,
      source_id: existing.source_id,
    });
  });

  it("uses stable identities when the same full backup is imported twice", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const sourceBook = makeBook({
      id: "source-book",
      user_id: "source-user",
      current_page: 120,
    });
    const parsed = {
      sourceFormat: "brack",
      payload: {
        manifest: {
          format: "brack-reading-backup",
          version: 1,
          exported_at: "2026-07-01T00:00:00.000Z",
          app_version: "test",
          user_id: "source-user",
          encrypted: false,
          includes_media: false,
          record_counts: {
            books: 1,
            book_lists: 1,
            book_list_items: 1,
            progress_logs: 1,
            reading_sessions: 1,
            journal_entries: 1,
            goals: 1,
          },
          media: [],
        },
        books: [sourceBook],
        book_lists: [
          {
            id: "source-list",
            user_id: "source-user",
            name: "Favorites",
            description: null,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
            deleted_at: null,
            is_public: false,
            order_version: 0,
          },
        ],
        book_list_items: [
          {
            id: "source-list-item",
            user_id: "source-user",
            list_id: "source-list",
            book_id: sourceBook.id,
            position: 0,
            added_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
            deleted_at: null,
          },
        ],
        progress_logs: [
          {
            id: "source-progress",
            user_id: "source-user",
            book_id: sourceBook.id,
            page_number: 120,
            logged_at: "2026-01-02T00:00:00.000Z",
            log_type: "manual",
            created_at: "2026-01-02T00:00:00.000Z",
          },
        ],
        reading_sessions: [
          {
            id: "source-session",
            user_id: "source-user",
            book_id: sourceBook.id,
            start_time: "2026-01-02T10:00:00.000Z",
            end_time: "2026-01-02T10:30:00.000Z",
            duration: 30,
            client_session_id: "source-client-session",
            created_at: "2026-01-02T10:30:00.000Z",
          },
          {
            id: "invalid-source-session",
            user_id: "source-user",
            book_id: sourceBook.id,
            start_time: "2026-01-03T10:00:00.000Z",
            end_time: "2026-01-03T22:01:00.000Z",
            duration: 721,
            client_session_id: "invalid-source-client-session",
            created_at: "2026-01-03T22:01:00.000Z",
          },
        ],
        journal_entries: [
          {
            id: "source-journal",
            user_id: "source-user",
            book_id: sourceBook.id,
            content: "A note",
            entry_type: "note",
            created_at: "2026-01-02T00:00:00.000Z",
            updated_at: "2026-01-02T00:00:00.000Z",
          },
        ],
        goals: [
          {
            id: "source-goal",
            user_id: "source-user",
            target_books: 12,
            start_date: "2026-01-01",
            end_date: "2026-12-31",
            reminder_time: null,
            is_completed: false,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
            deleted_at: null,
          },
        ],
        preferences: null,
      },
    } as unknown as ParsedReadingImport;

    const firstPreview = await previewReadingImport(userId, parsed);
    const firstResult = await commitReadingImport(userId, parsed, firstPreview);
    const secondPreview = await previewReadingImport(userId, parsed);
    const secondResult = await commitReadingImport(userId, parsed, secondPreview);

    const counts = await Promise.all([
      bookListsRepo.list(userId),
      bookListItemsRepo.list(userId),
      progressRepo.list(userId),
      sessionsRepo.list(userId),
      journalRepo.list(userId),
      goalsRepo.list(userId),
    ]);
    expect(counts.map((records) => records.length)).toEqual([1, 1, 1, 1, 1, 1]);
    expect((await progressRepo.list(userId))[0].log_type).toBe("import");
    expect((await sessionsRepo.list(userId))[0].client_session_id).toMatch(/^import:/);
    expect(firstResult).toMatchObject({ failed: 1 });
    expect(secondResult).toMatchObject({ failed: 1 });
    expect(firstResult.errors[0].code).toBe("reading_session_import_failed");
  });
});
