import { useCallback, useEffect, useRef, useState } from "react";
import { fetchProgressLogs, type ProgressLog } from "@/services/api";
import { getApiErrorStatus } from "@/services/api/client";
import { useAuth } from "@/hooks/useAuth";
import { progressRepo } from "@/services/local";
import { isConnectivityAvailable } from "@/services/connectivity";

export type { ProgressLog } from "@/services/api";

export const useProgressLogs = (bookId?: string) => {
  const { user, loading: authLoading } = useAuth();
  const userId = authLoading ? undefined : user?.id;
  const identity = userId && bookId ? JSON.stringify([userId, bookId]) : undefined;
  const owner = useRef({ identity, generation: 0 });
  if (owner.current.identity !== identity) owner.current = { identity, generation: owner.current.generation + 1 };
  const generation = owner.current.generation;
  const requestId = useRef(0);
  const mounted = useRef(false);
  const [state, setState] = useState<{
    identity?: string;
    logs: ProgressLog[];
    hasLoaded: boolean;
    pending: boolean;
    error: string | null;
  }>({ logs: [], hasLoaded: false, pending: false, error: null });

  const refetchLogs = useCallback(async () => {
    // An old save may retain this callback after account, route or task removal.
    if (!identity || !userId || !bookId || !mounted.current || owner.current.generation !== generation) return;
    const request = ++requestId.current;
    const isCurrent = () => mounted.current && owner.current.generation === generation && requestId.current === request;
    const publish = (logs: ProgressLog[]) => {
      if (isCurrent()) setState({ identity, logs, hasLoaded: true, pending: true, error: null });
    };
    const readLocal = async () => (await progressRepo.listRecords(userId, { includeDeleted: true }))
      .filter(record => record.user_id === userId && record.data.book_id === bookId
        && (!record.data.user_id || record.data.user_id === userId)
        && record.status !== "deleted" && !record.deleted_at)
      .map(record => record.data as ProgressLog)
      .sort((left, right) => (right.logged_at || right.created_at || "").localeCompare(left.logged_at || left.created_at || ""));

    setState(previous => ({
      identity,
      logs: previous.identity === identity ? previous.logs : [],
      hasLoaded: previous.identity === identity && previous.hasLoaded,
      pending: true,
      error: null,
    }));
    try {
      const localLogs = await readLocal();
      if (!isCurrent()) return;
      if (localLogs.length > 0 || !isConnectivityAvailable()) publish(localLogs);
      if (!isConnectivityAvailable()) return;

      const remoteLogs = await fetchProgressLogs(bookId);
      if (!isCurrent()) return;
      // Preservation is checked atomically by the driver, so a local save or
      // tombstone committed during this request wins over its older response.
      await progressRepo.upsertRemoteManyPreservingLocal(userId, remoteLogs
        .filter(log => log.user_id === userId && log.book_id === bookId));
      if (!isCurrent()) return;
      // Read after hydration to include captures made while the request waited.
      // Keep omitted cached logs: a log may already be acknowledged by sync
      // while an earlier remote history response still does not contain it.
      publish(await readLocal());
    } catch (error) {
      if (!isCurrent()) return;
      const accessRejected = [401, 403, 404].includes(getApiErrorStatus(error) ?? 0);
      setState(previous => ({
        ...previous,
        logs: accessRejected ? [] : previous.logs,
        hasLoaded: !accessRejected && previous.hasLoaded,
        error: "Reading history could not be refreshed. Please try again.",
      }));
    } finally {
      if (isCurrent()) setState(previous => ({ ...previous, pending: false }));
    }
  }, [bookId, generation, identity, userId]);

  useEffect(() => {
    mounted.current = true;
    void refetchLogs();
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
  }, [refetchLogs]);

  const current = state.identity === identity;
  const pending = Boolean(identity && (!current || state.pending));
  return {
    logs: identity && current ? state.logs : [],
    loading: pending && (!current || !state.hasLoaded),
    refreshing: pending && current && state.hasLoaded,
    hasLoaded: Boolean(identity && current && state.hasLoaded),
    error: identity && current ? state.error : null,
    refetchLogs,
  };
};
