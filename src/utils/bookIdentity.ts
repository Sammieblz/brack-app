import type { Book } from "@/types";
import type { GoogleBookResult } from "@/types/googleBooks";

type BookIdentityCandidate = Pick<GoogleBookResult, "title" | "author" | "isbn">;

export const normalizeBookIsbn = (isbn?: string | null) => {
  const normalized = isbn?.toLowerCase().replace(/[^0-9x]/g, "") ?? "";
  return normalized || null;
};

export const normalizeBookText = (value?: string | null) =>
  (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export const findExistingLibraryBook = (
  candidate: BookIdentityCandidate,
  books: Book[]
): Book | null => {
  const candidateIsbn = normalizeBookIsbn(candidate.isbn);

  if (candidateIsbn) {
    return books.find((book) => normalizeBookIsbn(book.isbn) === candidateIsbn) ?? null;
  }

  const candidateTitle = normalizeBookText(candidate.title);
  const candidateAuthor = normalizeBookText(candidate.author);

  if (!candidateTitle) return null;

  return (
    books.find((book) => {
      if (normalizeBookIsbn(book.isbn)) return false;
      return (
        normalizeBookText(book.title) === candidateTitle &&
        normalizeBookText(book.author) === candidateAuthor
      );
    }) ?? null
  );
};
