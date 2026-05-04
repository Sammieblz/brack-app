import { updateBookStatusForActivity } from "@/services/api";

/**
 * Checks if a book has any activity (progress logs, reading sessions, or journal entries)
 * and automatically updates status from "to_read" to "reading" if needed
 */
export const updateBookStatusIfNeeded = async (bookId: string) => {
  try {
    await updateBookStatusForActivity(bookId);
  } catch (error) {
    console.error('Error updating book status:', error);
  }
};
