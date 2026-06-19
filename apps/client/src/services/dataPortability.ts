import { Capacitor } from "@capacitor/core";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import Papa from "papaparse";
import {
  bookListItemsRepo,
  bookListsRepo,
  booksRepo,
  createLocalId,
  goalsRepo,
  journalRepo,
  profilePreferencesRepo,
  progressRepo,
  sessionsRepo,
} from "@/services/local";
import type {
  Book,
  BookList,
  BookListItem,
  ImportCommitResult,
  ImportIssue,
  ImportPreview,
  ReadingBackupManifestV1,
  ReadingBackupMediaFile,
  ReadingBackupPayloadV1,
} from "@/types";
import { trackCoreEvent } from "@/services/telemetry";
import { findExistingLibraryBook } from "@/utils/bookIdentity";
import { canonicalizeIsbn } from "@/utils/isbn";
import { normalizeGenre } from "@/utils/genres";
import { readingCoreSync } from "@/services/sync/engine";
import { isConnectivityAvailable } from "@/services/connectivity";

const BACKUP_FORMAT = "brack-reading-backup" as const;
const BACKUP_VERSION = 1 as const;
const PBKDF2_ITERATIONS = 250_000;

interface EncryptedBackupEnvelope {
  format: "brack-encrypted-backup";
  version: 1;
  algorithm: "AES-GCM";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export interface ParsedReadingImport {
  payload: ReadingBackupPayloadV1;
  sourceFormat: ImportPreview["source_format"];
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

const base64ToBytes = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const sha256 = async (bytes: Uint8Array) => {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const deriveEncryptionKey = async (passphrase: string, salt: Uint8Array, usages: KeyUsage[]) => {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    usages
  );
};

export const encryptBackup = async (bytes: Uint8Array, passphrase: string) => {
  if (passphrase.length < 8) throw new Error("Backup passphrase must be at least 8 characters");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveEncryptionKey(passphrase, salt, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  const envelope: EncryptedBackupEnvelope = {
    format: "brack-encrypted-backup",
    version: 1,
    algorithm: "AES-GCM",
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };
  return strToU8(JSON.stringify(envelope));
};

export const decryptBackup = async (bytes: Uint8Array, passphrase: string) => {
  let envelope: EncryptedBackupEnvelope;
  try {
    envelope = JSON.parse(strFromU8(bytes)) as EncryptedBackupEnvelope;
  } catch {
    throw new Error("This encrypted backup is invalid");
  }
  if (envelope.format !== "brack-encrypted-backup" || envelope.algorithm !== "AES-GCM") {
    throw new Error("Unsupported encrypted backup format");
  }
  try {
    const salt = base64ToBytes(envelope.salt);
    const iv = base64ToBytes(envelope.iv);
    const key = await deriveEncryptionKey(passphrase, salt, ["decrypt"]);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      base64ToBytes(envelope.ciphertext)
    );
    return new Uint8Array(decrypted);
  } catch {
    throw new Error("Incorrect passphrase or damaged backup");
  }
};

const toCsvRows = (books: Book[]) =>
  books.map((book) => ({
    Title: book.title,
    Author: book.author ?? "",
    ISBN: book.isbn ?? "",
    Genre: book.genre ?? "",
    Status: book.status,
    "Current Page": book.current_page ?? 0,
    Pages: book.pages ?? "",
    Rating: book.rating ?? "",
    "Date Started": book.date_started ?? "",
    "Date Finished": book.date_finished ?? "",
    Notes: book.notes ?? "",
  }));

export const createLibraryCsv = (books: Book[]) => Papa.unparse(toCsvRows(books));

const collectMedia = async (
  progressLogs: Array<Record<string, unknown>>,
  journalEntries: Array<Record<string, unknown>>
) => {
  const candidates = [
    ...progressLogs.map((record) => record.photo_url),
    ...journalEntries.map((record) => record.photo_url),
  ].filter((value): value is string => typeof value === "string" && /^https?:\/\//.test(value));
  const unique = Array.from(new Set(candidates));
  const manifest: ReadingBackupMediaFile[] = [];
  const files: Record<string, Uint8Array> = {};

  for (let index = 0; index < unique.length; index += 1) {
    const sourceUrl = unique[index];
    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      const contentType = response.headers.get("content-type");
      const extension =
        contentType?.includes("png") ? "png" :
        contentType?.includes("webp") ? "webp" :
        contentType?.includes("gif") ? "gif" : "jpg";
      const path = `media/${String(index + 1).padStart(4, "0")}.${extension}`;
      files[path] = bytes;
      manifest.push({
        path,
        source_url: sourceUrl,
        content_type: contentType,
        size: bytes.length,
        checksum: await sha256(bytes),
      });
    } catch {
      // Media export is best-effort; the source URL remains in the data payload.
    }
  }

  return { manifest, files };
};

export const collectReadingBackup = async (
  userId: string,
  options: { includeMedia?: boolean } = {}
): Promise<{ payload: ReadingBackupPayloadV1; archive: Uint8Array; csv: string }> => {
  const [
    books,
    bookLists,
    bookListItems,
    progressLogs,
    readingSessions,
    journalEntries,
    goals,
    preferences,
  ] = await Promise.all([
    booksRepo.list(userId),
    bookListsRepo.list(userId),
    bookListItemsRepo.list(userId),
    progressRepo.list(userId),
    sessionsRepo.list(userId),
    journalRepo.list(userId),
    goalsRepo.list(userId),
    profilePreferencesRepo.get(userId),
  ]);

  const media = options.includeMedia
    ? await collectMedia(
        progressLogs as Array<Record<string, unknown>>,
        journalEntries as Array<Record<string, unknown>>
      )
    : { manifest: [], files: {} };
  const manifest: ReadingBackupManifestV1 = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    app_version: String(import.meta.env.VITE_APP_VERSION || "0.0.0"),
    user_id: userId,
    encrypted: false,
    includes_media: media.manifest.length > 0,
    record_counts: {
      books: books.length,
      book_lists: bookLists.length,
      book_list_items: bookListItems.length,
      progress_logs: progressLogs.length,
      reading_sessions: readingSessions.length,
      journal_entries: journalEntries.length,
      goals: goals.length,
    },
    media: media.manifest,
  };
  const payload: ReadingBackupPayloadV1 = {
    manifest,
    books,
    book_lists: bookLists,
    book_list_items: bookListItems,
    progress_logs: progressLogs as Array<Record<string, unknown>>,
    reading_sessions: readingSessions,
    journal_entries: journalEntries as Array<Record<string, unknown>>,
    goals,
    preferences: preferences as Record<string, unknown> | null,
  };
  const csv = createLibraryCsv(books);
  const archive = zipSync(
    {
      "manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
      "data.json": strToU8(JSON.stringify(payload)),
      "library.csv": strToU8(csv),
      ...media.files,
    },
    { level: 6 }
  );
  return { payload, archive, csv };
};

export const saveExportFile = async (
  bytes: Uint8Array,
  fileName: string,
  mimeType: string
) => {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const result = await Filesystem.writeFile({
      path: fileName,
      data: bytesToBase64(bytes),
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({ title: "Brack reading backup", url: result.uri });
    return;
  }

  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const makeEmptyPayload = (books: Book[]): ReadingBackupPayloadV1 => {
  const timestamp = new Date().toISOString();
  return {
    manifest: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exported_at: timestamp,
      app_version: "external",
      user_id: "",
      encrypted: false,
      includes_media: false,
      record_counts: {
        books: books.length,
        book_lists: 0,
        book_list_items: 0,
        progress_logs: 0,
        reading_sessions: 0,
        journal_entries: 0,
        goals: 0,
      },
      media: [],
    },
    books,
    book_lists: [],
    book_list_items: [],
    progress_logs: [],
    reading_sessions: [],
    journal_entries: [],
    goals: [],
    preferences: null,
  };
};

const statusFromCsv = (value: unknown) => {
  const normalized = String(value || "").toLowerCase().trim();
  if (["read", "completed", "done"].includes(normalized)) return "completed";
  if (["currently-reading", "currently reading", "reading"].includes(normalized)) return "reading";
  return "to_read";
};

const csvRowToBook = (row: Record<string, unknown>): Book => {
  const timestamp = new Date().toISOString();
  const title = String(row.Title || row.title || "").trim();
  const author = String(row.Author || row.author || row["Author l-f"] || "").trim() || null;
  const rawIsbn = String(row.ISBN13 || row.ISBN || row.isbn || "").replace(/^="?|"?$/g, "");
  const pages = Number(row["Number of Pages"] || row.Pages || row.pages);
  const currentPage = Number(row["Current Page"] || row.current_page || 0);
  const rating = Number(row["My Rating"] || row.Rating || row.rating);
  return {
    id: createLocalId(),
    user_id: "",
    title,
    author,
    isbn: canonicalizeIsbn(rawIsbn),
    genre: normalizeGenre(String(row.Genre || row.genre || "")),
    pages: Number.isFinite(pages) && pages > 0 ? pages : null,
    chapters: null,
    cover_url: null,
    description: null,
    status: statusFromCsv(row["Exclusive Shelf"] || row.Status || row.status),
    tags: null,
    metadata: { import_source: row["Book Id"] ? "goodreads_csv" : "csv" },
    current_page: Number.isFinite(currentPage) && currentPage >= 0 ? currentPage : 0,
    date_started: String(row["Date Started"] || row.date_started || "") || null,
    date_finished: String(row["Date Read"] || row["Date Finished"] || row.date_finished || "") || null,
    rating: Number.isFinite(rating) && rating > 0 ? rating : null,
    notes: String(row.Notes || row.notes || "") || null,
    source_provider: null,
    source_id: String(row["Book Id"] || "") || null,
    shelf_position: null,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  };
};

const parseCsv = (text: string): ParsedReadingImport => {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });
  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    throw new Error(parsed.errors[0]?.message || "Could not parse CSV");
  }
  const books = parsed.data.map(csvRowToBook).filter((book) => book.title);
  const isGoodreads = parsed.meta.fields?.includes("Exclusive Shelf") || parsed.meta.fields?.includes("Book Id");
  return {
    payload: makeEmptyPayload(books),
    sourceFormat: isGoodreads ? "goodreads_csv" : "csv",
  };
};

const parseArchive = (bytes: Uint8Array): ParsedReadingImport => {
  const files = unzipSync(bytes);
  const dataFile = files["data.json"];
  if (!dataFile) throw new Error("Backup archive is missing data.json");
  const payload = JSON.parse(strFromU8(dataFile)) as ReadingBackupPayloadV1;
  if (payload.manifest?.format !== BACKUP_FORMAT || payload.manifest.version !== BACKUP_VERSION) {
    throw new Error("Unsupported Brack backup version");
  }
  return { payload, sourceFormat: "brack" };
};

export const parseReadingImport = async (
  file: File,
  passphrase?: string
): Promise<ParsedReadingImport> => {
  let bytes = new Uint8Array(await file.arrayBuffer());
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "brack") {
    if (!passphrase) throw new Error("Enter the backup passphrase");
    bytes = await decryptBackup(bytes, passphrase);
    return parseArchive(bytes);
  }
  if (extension === "zip") return parseArchive(bytes);
  if (extension === "csv") return parseCsv(strFromU8(bytes));

  const parsed = JSON.parse(strFromU8(bytes)) as ReadingBackupPayloadV1 | Book[];
  if (Array.isArray(parsed)) {
    return { payload: makeEmptyPayload(parsed), sourceFormat: "json" };
  }
  if (parsed.manifest?.format !== BACKUP_FORMAT) {
    throw new Error("Unsupported JSON import");
  }
  return { payload: parsed, sourceFormat: "json" };
};

export const previewReadingImport = async (
  userId: string,
  parsed: ParsedReadingImport
): Promise<ImportPreview> => {
  const existingBooks = await booksRepo.list(userId);
  const issues: ImportIssue[] = [];
  const books = parsed.payload.books.map((book, index) => {
    if (!book.title?.trim()) {
      const issue = { row: index + 1, code: "missing_title", message: "Book title is required" };
      issues.push(issue);
      return {
        source_index: index,
        action: "invalid" as const,
        existing_book_id: null,
        book,
        warnings: [issue.message],
      };
    }
    const existing = findExistingLibraryBook(book, existingBooks);
    return {
      source_index: index,
      action: existing ? ("merge" as const) : ("create" as const),
      existing_book_id: existing?.id ?? null,
      book,
      warnings: [],
    };
  });

  const preview = {
    import_id: createLocalId(),
    source_format: parsed.sourceFormat,
    valid: books.filter((book) => book.action !== "invalid").length,
    duplicates: books.filter((book) => book.action === "merge").length,
    mergeable: books.filter((book) => book.action === "merge").length,
    skipped: 0,
    invalid: books.filter((book) => book.action === "invalid").length,
    issues,
    books,
  };
  trackCoreEvent("import_previewed", {
    source_format: parsed.sourceFormat,
    valid: preview.valid,
    duplicates: preview.duplicates,
    invalid: preview.invalid,
  });
  return preview;
};

const mergeBookState = (existing: Book, incoming: Book): Book => {
  const incomingIsNewer = Date.parse(incoming.updated_at || "") > Date.parse(existing.updated_at || "");
  const completed = existing.status === "completed" || incoming.status === "completed";
  const result = {
    ...existing,
    ...(incomingIsNewer ? incoming : {}),
    id: existing.id,
    user_id: existing.user_id,
    title: incoming.title || existing.title,
    author: incoming.author || existing.author,
    isbn: incoming.isbn || existing.isbn,
    cover_url: incoming.cover_url || existing.cover_url,
    pages: incoming.pages || existing.pages,
    current_page: Math.max(existing.current_page || 0, incoming.current_page || 0),
    status: completed ? "completed" : incomingIsNewer ? incoming.status : existing.status,
    date_finished: completed
      ? existing.date_finished || incoming.date_finished || new Date().toISOString().split("T")[0]
      : existing.date_finished,
    deleted_at: null,
    updated_at: new Date().toISOString(),
  };
};

export const commitReadingImport = async (
  userId: string,
  parsed: ParsedReadingImport,
  preview: ImportPreview
): Promise<ImportCommitResult> => {
  const errors: ImportIssue[] = [];
  let created = 0;
  let merged = 0;
  let skipped = 0;
  const bookIdMap = new Map<string, string>();

  for (const item of preview.books) {
    const incoming = parsed.payload.books[item.source_index];
    if (!incoming || item.action === "invalid") {
      skipped += 1;
      continue;
    }
    try {
      if (item.existing_book_id) {
        const existing = await booksRepo.get(item.existing_book_id);
        if (!existing) throw new Error("Existing book disappeared during import");
        const mergedBook = mergeBookState(existing, incoming);
        await booksRepo.upsertLocal(userId, mergedBook, "update");
        bookIdMap.set(incoming.id, existing.id);
        merged += 1;
      } else {
        const newId = createLocalId();
        const importedBook = {
          ...incoming,
          id: newId,
          user_id: userId,
          deleted_at: null,
          created_at: incoming.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await booksRepo.upsertLocal(userId, importedBook, "create");
        bookIdMap.set(incoming.id, newId);
        created += 1;
      }
    } catch (error) {
      errors.push({
        row: item.source_index + 1,
        code: "book_import_failed",
        message: error instanceof Error ? error.message : "Book import failed",
      });
    }
  }

  const listIdMap = new Map<string, string>();
  for (const list of parsed.payload.book_lists) {
    const id = createLocalId();
    listIdMap.set(list.id, id);
    const importedList: BookList = {
      ...list,
      id,
      user_id: userId,
      name: list.name || "Imported list",
      deleted_at: null,
      order_version: 0,
      created_at: list.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await bookListsRepo.upsertLocal(userId, importedList, "create");
  }

  for (const item of parsed.payload.book_list_items) {
    const listId = listIdMap.get(item.list_id);
    const bookId = bookIdMap.get(item.book_id);
    if (!listId || !bookId) continue;
    const importedItem: BookListItem = {
      ...item,
      id: createLocalId(),
      user_id: userId,
      list_id: listId,
      book_id: bookId,
      deleted_at: null,
      added_at: item.added_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await bookListItemsRepo.upsertLocal(userId, importedItem, "create");
  }

  const importMappedRecords = async (
    records: Array<Record<string, unknown>>,
    type: "progress" | "journal"
  ) => {
    for (const record of records) {
      const sourceBookId = String(record.book_id || "");
      const bookId = bookIdMap.get(sourceBookId);
      if (!bookId) continue;
      const imported = {
        ...record,
        id: createLocalId(),
        user_id: userId,
        book_id: bookId,
        created_at: String(record.created_at || new Date().toISOString()),
        updated_at: String(record.updated_at || new Date().toISOString()),
        deleted_at: null,
      };
      if (type === "progress") {
        await progressRepo.upsertLocal(userId, imported as never, "create");
      } else {
        await journalRepo.upsertLocal(userId, imported as never, "create");
      }
    }
  };

  await importMappedRecords(parsed.payload.progress_logs, "progress");
  await importMappedRecords(parsed.payload.journal_entries, "journal");

  for (const session of parsed.payload.reading_sessions) {
    const bookId = bookIdMap.get(session.book_id);
    if (!bookId) continue;
    await sessionsRepo.upsertLocal(userId, {
      ...session,
      id: createLocalId(),
      user_id: userId,
      book_id: bookId,
      client_session_id: createLocalId(),
    }, "create");
  }

  for (const goal of parsed.payload.goals) {
    await goalsRepo.upsertLocal(userId, {
      ...goal,
      id: createLocalId(),
      user_id: userId,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    }, "create");
  }

  if (parsed.payload.preferences) {
    const current = await profilePreferencesRepo.get(userId);
    await profilePreferencesRepo.upsertLocal(userId, {
      ...current,
      ...parsed.payload.preferences,
      id: userId,
      updated_at: new Date().toISOString(),
    });
  }

  if (isConnectivityAvailable()) {
    void readingCoreSync.syncUser(userId).catch(console.error);
  }

  return {
    import_id: preview.import_id,
    created,
    merged,
    skipped,
    failed: errors.length,
    errors,
  };
  trackCoreEvent(errors.length > 0 ? "import_failed" : "import_completed", {
    source_format: parsed.sourceFormat,
    created,
    merged,
    skipped,
    failed: errors.length,
  });
  return result;
};
