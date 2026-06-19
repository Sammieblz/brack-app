import { useState, useEffect } from "react";
import { getCurrentAuthUser } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { updateBookStatusIfNeeded } from "@/utils/bookStatus";
import { journalOperations } from "@/utils/offlineOperation";
import { fetchJournalEntries, type JournalEntry } from "@/services/api";
import { journalRepo } from "@/services/local";
import { isConnectivityAvailable } from "@/services/connectivity";

export type { JournalEntry } from "@/services/api";

export const useJournalEntries = (bookId: string) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const user = await getCurrentAuthUser();
      const localEntries = user
        ? (await journalRepo.listRecords(user.id, { includeDeleted: false }))
            .filter((record) => record.data.book_id === bookId)
            .map((record) => record.data)
        : [];

      if (localEntries.length > 0) {
        setEntries(localEntries);
      }

      if (!isConnectivityAvailable()) {
        setEntries(localEntries);
        return;
      }

      const remoteEntries = await fetchJournalEntries(bookId);
      setEntries(remoteEntries);
      for (const entry of remoteEntries) {
        await journalRepo.upsertRemote(entry.user_id, entry);
      }
    } catch (error) {
      console.error('Error fetching journal entries:', error);
      toast({
        title: "Error",
        description: "Failed to load journal entries",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addEntry = async (entry: Omit<JournalEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    try {
      const user = await getCurrentAuthUser();
      if (!user) throw new Error('No user found');

      await journalOperations.create({
        ...entry,
        user_id: user.id,
      });

      toast({
        title: "Success",
        description: "Journal entry added",
      });
      
      await updateBookStatusIfNeeded(bookId);
      await fetchEntries();
    } catch (error) {
      console.error('Error adding journal entry:', error);
      toast({
        title: "Error",
        description: "Failed to add journal entry",
        variant: "destructive",
      });
    }
  };

  const updateEntry = async (id: string, updates: Partial<JournalEntry>) => {
    try {
      await journalOperations.update(id, updates);

      toast({
        title: "Success",
        description: "Journal entry updated",
      });
      
      await fetchEntries();
    } catch (error) {
      console.error('Error updating journal entry:', error);
      toast({
        title: "Error",
        description: "Failed to update journal entry",
        variant: "destructive",
      });
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      await journalOperations.delete(id);

      toast({
        title: "Success",
        description: "Journal entry deleted",
      });
      
      await fetchEntries();
    } catch (error) {
      console.error('Error deleting journal entry:', error);
      toast({
        title: "Error",
        description: "Failed to delete journal entry",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [bookId]);

  return {
    entries,
    loading,
    addEntry,
    updateEntry,
    deleteEntry,
    refetchEntries: fetchEntries,
  };
};
