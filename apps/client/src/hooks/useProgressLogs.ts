import { useState, useEffect } from "react";
import { fetchProgressLogs, getCurrentAuthUser, type ProgressLog } from "@/services/api";
import { progressRepo } from "@/services/local";
import { isConnectivityAvailable } from "@/services/connectivity";

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
      const user = await getCurrentAuthUser();
      const localLogs = user
        ? (await progressRepo.listRecords(user.id))
            .filter((record) => record.data.book_id === bookId)
            .map((record) => record.data as ProgressLog)
        : [];

      if (localLogs.length > 0) setLogs(localLogs);

      if (!isConnectivityAvailable()) {
        setLogs(localLogs);
        return;
      }

      const remoteLogs = await fetchProgressLogs(bookId);
      setLogs(remoteLogs);
      if (user) {
        await progressRepo.upsertRemoteMany(
          user.id,
          remoteLogs.map((log) => ({ ...log, id: log.id }))
        );
      }
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
