import type { Book } from "@/types";
import { normalizeDateOnly, todayDateOnly, validateDateOnly } from "@/lib/dateOnly";
import { validateBookForm } from "@/utils/formValidation";

const textFields = ["title", "author", "genre", "isbn", "notes", "cover_url", "series_name", "status"] as const;
const numberFields = ["pages", "chapters", "current_page", "rating", "series_position", "series_total"] as const;
export type BookEditorDraft = Record<(typeof textFields)[number] | (typeof numberFields)[number], string> & {
  tags: string[];
  date_started: string | null;
  date_finished: string | null;
};

export class BookEditorValidationError extends Error {
  constructor(public fields: Record<string, string>, public latestBook?: Book) {
    super(Object.values(fields)[0] ?? "Check the book details before saving.");
  }
}

/** A conflicting newer reading value is shown without discarding edited metadata. */
export function reconcileBookEditorDraft(previous: Book, latest: Book, draft: BookEditorDraft): BookEditorDraft {
  const original = createBookEditorDraft(previous);
  const current = createBookEditorDraft(latest);
  return Object.fromEntries(Object.entries(draft).map(([key, value]) => [key,
    JSON.stringify(value) === JSON.stringify(original[key as keyof BookEditorDraft]) ? current[key as keyof BookEditorDraft] : value,
  ])) as BookEditorDraft;
}

export function createBookEditorDraft(book: Book): BookEditorDraft {
  return { title: book.title, author: book.author ?? "", genre: book.genre ?? "", isbn: book.isbn ?? "",
    notes: book.notes ?? "", cover_url: book.cover_url ?? "", series_name: book.series_name ?? "", status: book.status,
    pages: book.pages?.toString() ?? "", chapters: book.chapters?.toString() ?? "",
    current_page: (book.current_page ?? 0).toString(), rating: book.rating?.toString() ?? "",
    series_position: book.series_position?.toString() ?? "", series_total: book.series_total?.toString() ?? "",
    tags: [...(book.tags ?? [])], date_started: book.date_started, date_finished: book.date_finished };
}

/** Metadata changes never manufacture a progress log or infer a status/date transition. */
export function validateEditedBook(book: Book): Record<string, string> {
  const errors: Record<string, string> = Object.fromEntries(validateBookForm(book).map(error => [error.field, error.message]));
  const today = todayDateOnly();
  if (validateDateOnly(book.date_started, { max: today })) errors.date_started = "Choose a valid start date on or before today.";
  if (validateDateOnly(book.date_finished, { max: today })) errors.date_finished = "Choose a valid finish date on or before today.";
  const start = normalizeDateOnly(book.date_started);
  const finish = normalizeDateOnly(book.date_finished);
  if (start && finish && start > finish) errors.date_finished = "The finish date must be on or after the start date.";
  return errors;
}

/** Keep raw numeric drafts until validation, then send only fields the reader changed. */
export function buildBookEditorPatch(book: Book, draft: BookEditorDraft, pendingTag = "") {
  const initial = createBookEditorDraft(book);
  const candidate = { ...book };
  const errors: Record<string, string> = {};
  const patch: Record<string, unknown> = {};
  for (const field of textFields) {
    if (draft[field] !== initial[field]) {
      const value = field === "series_name" ? draft[field] || null : draft[field];
      patch[field] = value;
      Object.assign(candidate, { [field]: value });
    }
  }
  for (const field of numberFields) {
    const raw = draft[field].trim();
    const number = raw === "" ? field === "current_page" ? 0 : null : Number(raw);
    const decimal = field === "series_position";
    const minimum = field === "current_page" || decimal ? 0 : 1;
    if (number !== null && (!(decimal ? /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw) : /^\d+$/.test(raw) || raw === "") ||
        !Number.isFinite(number) || (decimal ? !Number.isSafeInteger(number * 2) : !Number.isSafeInteger(number)) || number < minimum)) {
      errors[field] = decimal ? "Use a non-negative number in half-book steps, such as 1 or 1.5." :
        field === "current_page" ? "Use a whole page number of zero or more." : "Use a whole number of at least 1, or leave this blank.";
    }
    if (draft[field] !== initial[field]) {
      patch[field] = number;
      Object.assign(candidate, { [field]: number });
    }
  }
  if (candidate.rating !== null && (candidate.rating < 1 || candidate.rating > 5)) errors.rating = "Choose a rating from 1 to 5, or no rating.";
  for (const field of ["date_started", "date_finished"] as const) {
    if (draft[field] !== initial[field]) { patch[field] = normalizeDateOnly(draft[field]); candidate[field] = normalizeDateOnly(draft[field]); }
  }
  const tags = [...draft.tags];
  const nextTag = pendingTag.trim();
  if (nextTag && !tags.includes(nextTag)) tags.push(nextTag);
  if (JSON.stringify(tags) !== JSON.stringify(initial.tags)) { patch.tags = tags; candidate.tags = tags; }
  return { patch, errors: { ...validateEditedBook(candidate), ...errors } };
}
