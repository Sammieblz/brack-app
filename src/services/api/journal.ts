import { supabase } from "@/integrations/supabase/client";

export interface JournalEntry {
  id: string;
  user_id: string;
  book_id: string;
  entry_type: "note" | "quote" | "reflection";
  title?: string | null;
  content: string;
  page_reference?: number | null;
  tags?: string[] | null;
  photo_url?: string | null;
  created_at: string;
  updated_at: string;
}

export const fetchJournalEntries = async (
  bookId: string
): Promise<JournalEntry[]> => {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as JournalEntry[]) || [];
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
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data || []).map((entry) => ({
    ...entry,
    book_title: entry.books?.title,
    book_author: entry.books?.author,
  })) || []) as QuoteEntry[];
};

export const createJournalEntry = async (
  entryData: Record<string, unknown>
): Promise<JournalEntry> => {
  const { data, error } = await supabase
    .from("journal_entries")
    .insert(entryData)
    .select()
    .single();

  if (error) throw error;
  return data as JournalEntry;
};

export const updateJournalEntry = async (
  entryId: string,
  updates: Record<string, unknown>
): Promise<void> => {
  const { error } = await supabase
    .from("journal_entries")
    .update(updates)
    .eq("id", entryId);

  if (error) throw error;
};

export const deleteJournalEntry = async (entryId: string): Promise<void> => {
  const { error } = await supabase
    .from("journal_entries")
    .delete()
    .eq("id", entryId);

  if (error) throw error;
};
