import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ProgressLog {
  id: string;
  user_id: string;
  book_id: string;
  session_id?: string;
  page_number: number;
  paragraph_number?: number;
  notes?: string;
  logged_at: string;
  log_type: 'manual' | 'timer_based' | 'automatic';
  time_spent_minutes?: number;
  created_at: string;
}

export const useProgressLogs = (bookId?: string) => {
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    if (!bookId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('progress_logs')
        .select('*')
        .eq('book_id', bookId)
        .order('logged_at', { ascending: false });

      if (error) throw error;
      setLogs((data as ProgressLog[]) || []);
    } catch (error) {
      console.error('Error fetching progress logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [bookId]);

  return {
    logs,
    loading,
    refetchLogs: fetchLogs,
  };
};
