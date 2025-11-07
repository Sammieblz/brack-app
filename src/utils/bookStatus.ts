import { supabase } from "@/integrations/supabase/client";

/**
 * Checks if a book has any activity (progress logs, reading sessions, or journal entries)
 * and automatically updates status from "to_read" to "reading" if needed
 */
export const updateBookStatusIfNeeded = async (bookId: string) => {
  try {
    // Get current book status
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('status')
      .eq('id', bookId)
      .single();

    if (bookError || !book) return;

    // Only update if current status is "to_read"
    if (book.status !== 'to_read') return;

    // Check for any activity
    const [progressLogs, readingSessions, journalEntries] = await Promise.all([
      supabase.from('progress_logs').select('id').eq('book_id', bookId).limit(1),
      supabase.from('reading_sessions').select('id').eq('book_id', bookId).limit(1),
      supabase.from('journal_entries').select('id').eq('book_id', bookId).limit(1),
    ]);

    const hasActivity = 
      (progressLogs.data && progressLogs.data.length > 0) ||
      (readingSessions.data && readingSessions.data.length > 0) ||
      (journalEntries.data && journalEntries.data.length > 0);

    // Update status to "reading" if there's any activity
    if (hasActivity) {
      await supabase
        .from('books')
        .update({ 
          status: 'reading',
          date_started: new Date().toISOString()
        })
        .eq('id', bookId);
    }
  } catch (error) {
    console.error('Error updating book status:', error);
  }
};
