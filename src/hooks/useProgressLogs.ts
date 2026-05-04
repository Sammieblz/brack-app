import { useState, useEffect } from "react";
import { fetchProgressLogs, type ProgressLog } from "@/services/api";

export type { ProgressLog } from "@/services/api";

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
      setLogs(await fetchProgressLogs(bookId));
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
