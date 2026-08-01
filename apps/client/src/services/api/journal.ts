import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  parseRichTextDocument,
  parseRichTextFormat,
  type RichTextDocument,
  type RichTextFormat,
} from "@/types/richText";

type JournalTable = Database["public"]["Tables"]["journal_entries"];
type JournalRow = JournalTable["Row"];

export type CreateJournalEntryData = Omit<
  JournalTable["Insert"],
  "content_format" | "content_json" | "entry_type"
> & {
  content_format?: RichTextFormat;
  content_json?: RichTextDocument | null;
  entry_type: JournalEntry["entry_type"];
};

export type UpdateJournalEntryData = Omit<
  JournalTable["Update"],
  "content_format" | "content_json" | "entry_type"
> & {
  content_format?: RichTextFormat;
  content_json?: RichTextDocument | null;
  entry_type?: JournalEntry["entry_type"];
};

export interface JournalEntry {
  id: string;
  user_id: string;
  book_id: string;
  entry_type: "note" | "quote" | "reflection";
  title?: string | null;
  content: string;
  content_format?: RichTextFormat | null;
  content_json?: RichTextDocument | null;
  content_html?: string | null;
  page_reference?: number | null;
  tags?: string[] | null;
  photo_url?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

const normalizeJournalEntry = (entry: JournalRow): JournalEntry => ({
  ...entry,
  entry_type:
    entry.entry_type === "quote" || entry.entry_type === "reflection"
      ? entry.entry_type
      : "note",
  content_format: parseRichTextFormat(entry.content_format),
  content_json: parseRichTextDocument(entry.content_json),
});

export const fetchJournalEntries = async (
  bookId: string
): Promise<JournalEntry[]> => {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("book_id", bookId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeJournalEntry);
};

export type QuoteEntry = JournalEntry & {
  book_title?: string;
  book_author?: string | null;
};

export const fetchUserQuoteEntries = async (
  userId: string
): Promise<QuoteEntry[]> => {
  const { data, error } = await supabase
    .from("journal_entries")
    .select(
      `
      *,
      books:book_id (
        title,
        author
      )
    `
    )
    .eq("user_id", userId)
    .eq("entry_type", "quote")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((entry) => {
    const { books, ...journalEntry } = entry;
    return {
      ...normalizeJournalEntry(journalEntry),
      book_title: books?.title,
      book_author: books?.author,
    };
  });
};

export const createJournalEntry = async (
  entryData: CreateJournalEntryData
): Promise<JournalEntry> => {
  const { data, error } = await supabase
    .from("journal_entries")
    .insert(entryData)
    .select()
    .single();

  if (error) throw error;
  return normalizeJournalEntry(data);
};

export const updateJournalEntry = async (
  entryId: string,
  updates: UpdateJournalEntryData
): Promise<void> => {
  const { error } = await supabase
    .from("journal_entries")
    .update(updates)
    .eq("id", entryId);

  if (error) throw error;
};

export const deleteJournalEntry = async (entryId: string): Promise<void> => {
  const deletedAt = new Date().toISOString();
  const { error } = await supabase
    .from("journal_entries")
    .update({ deleted_at: deletedAt, updated_at: deletedAt })
    .eq("id", entryId);

  if (error) throw error;
};
