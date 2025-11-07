import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface JournalEntry {
  id: string;
  user_id: string;
  book_id: string;
  entry_type: 'note' | 'quote' | 'reflection';
  title?: string;
  content: string;
  page_reference?: number;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export const useJournalEntries = (bookId: string) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('book_id', bookId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntries((data as JournalEntry[]) || []);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase
        .from('journal_entries')
        .insert({
          ...entry,
          user_id: user.id,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Journal entry added",
      });
      
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
      const { error } = await supabase
        .from('journal_entries')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

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
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;

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
