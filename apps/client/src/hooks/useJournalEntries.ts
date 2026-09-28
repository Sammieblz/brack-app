import { useCallback, useState, useEffect, useRef } from "react";
import { getCurrentAuthUser } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { updateBookStatusIfNeeded } from "@/utils/bookStatus";
import { journalOperations } from "@/utils/offlineOperation";
import { fetchJournalEntries, type JournalEntry } from "@/services/api";
import { journalRepo } from "@/services/local";
import { isConnectivityAvailable } from "@/services/connectivity";
import { getApiErrorStatus } from "@/services/api/client";

export type { JournalEntry } from "@/services/api";

/** A durable local repository/outbox commit; remote sync may still be pending. */
export interface JournalSaveResult {
  entryId: string;
  savedLocally: true;
}

export const useJournalEntries = (bookId: string, userId?: string) => {
  const identity = `${userId ?? ""}:${bookId}`;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const requestId = useRef(0);
  const [state, setState] = useState<{
    identity: string;
    entries: JournalEntry[];
    hasLoaded: boolean;
    pending: boolean;
    error: string | null;
  }>({ identity, entries: [], hasLoaded: false, pending: true, error: null });
  const { toast } = useToast();

  const fetchEntries = useCallback(async (localOnly = false) => {
    const request = ++requestId.current;
    const isCurrent = () =>
      currentIdentity.current === identity && requestId.current === request;
    const publish = (entries: JournalEntry[]) => {
      if (!isCurrent()) return;
      setState({
        identity,
        entries,
        hasLoaded: true,
        pending: true,
        error: null,
      });
    };
    setState((previous) => ({
      identity,
      entries: previous.identity === identity ? previous.entries : [],
      hasLoaded: previous.identity === identity && previous.hasLoaded,
      pending: true,
      error: null,
    }));
    try {
      const user = await getCurrentAuthUser();
      if (!isCurrent()) return;
      if (userId && user?.id !== userId) {
        throw Object.assign(new Error("Reader identity changed"), { status: 401 });
      }
      const localEntries = user
        ? (await journalRepo.listRecords(user.id, { includeDeleted: false }))
            .filter((record) => record.data.book_id === bookId)
            .map((record) => record.data)
        : [];

      if (!isCurrent()) return;

      if (localEntries.length > 0) {
        publish(localEntries);
      }

      if (localOnly || !user || !isConnectivityAvailable()) {
        publish(localEntries);
        return;
      }

      const remoteEntries = await fetchJournalEntries(bookId);
      if (!isCurrent()) return;
      // A read can race background synchronization. Preserve unsynced words and
      // tombstones instead of replacing a durable local commit with an old pull.
      await journalRepo.upsertRemoteManyPreservingLocal(user.id, remoteEntries);
      if (!isCurrent()) return;
      const refreshedRecords = await journalRepo.listRecords(user.id, { includeDeleted: true });
      const remoteIds = new Set(remoteEntries.map((entry) => entry.id));
      publish(refreshedRecords
        .filter((record) => record.data.book_id === bookId
          && record.status !== "deleted" && !record.deleted_at && !record.data.deleted_at
          && (remoteIds.has(record.data.id) || record.status !== "synced"))
        .map((record) => record.data));
    } catch (error) {
      if (!isCurrent()) return;
      console.error("Error fetching journal entries:", error);
      const accessRejected = [401, 403, 404].includes(
        getApiErrorStatus(error) ?? 0,
      );
      setState((previous) => ({
        ...previous,
        entries: accessRejected ? [] : previous.entries,
        hasLoaded: !accessRejected && previous.hasLoaded,
        error: "Journal entries could not be refreshed.",
      }));
    } finally {
      if (isCurrent())
        setState((previous) => ({ ...previous, pending: false }));
    }
  }, [bookId, identity, userId]);

  const refetchEntries = useCallback(() => fetchEntries(), [fetchEntries]);

  const addEntry = async (
    entry: Omit<JournalEntry, "id" | "user_id" | "created_at" | "updated_at">,
  ): Promise<JournalSaveResult> => {
    const user = await getCurrentAuthUser();
    if (!user) throw new Error("No user found");
    if (currentIdentity.current !== identity || (userId && user.id !== userId)) {
      throw new Error("Reader identity changed. Reopen your journal to save.");
    }

    // Only the durable write determines save success. Editors own its feedback.
    const savedEntry = await journalOperations.create({
      ...entry,
      user_id: user.id,
    });

    if (currentIdentity.current === identity) {
      setState((previous) => ({
        identity,
        entries: [
          savedEntry,
          ...(previous.identity === identity
            ? previous.entries.filter((item) => item.id !== savedEntry.id)
            : []),
        ],
        hasLoaded: true,
        pending: false,
        error: null,
      }));
      // A stale remote snapshot must not erase a just-committed local entry.
      // Refresh/status failure cannot turn that commit into a retryable create.
      void fetchEntries(true);
      void updateBookStatusIfNeeded(bookId).catch((error) => {
        console.error("Journal saved, but book status could not refresh:", error);
      });
    }

    return { entryId: savedEntry.id, savedLocally: true };
  };

  const updateEntry = async (
    id: string,
    updates: Partial<JournalEntry>,
  ): Promise<JournalSaveResult> => {
    await journalOperations.update(id, updates);

    if (currentIdentity.current === identity) {
      setState((previous) => previous.identity === identity ? {
        ...previous,
        entries: previous.entries.map((entry) =>
          entry.id === id ? { ...entry, ...updates } : entry,
        ),
        error: null,
      } : previous);
      void fetchEntries(true);
    }

    return { entryId: id, savedLocally: true };
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
      console.error("Error deleting journal entry:", error);
      toast({
        title: "Error",
        description: "Failed to delete journal entry",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    void fetchEntries();
    return () => {
      requestId.current += 1;
    };
  }, [fetchEntries]);

  return {
    entries: state.identity === identity ? state.entries : [],
    loading: state.identity !== identity || (state.pending && !state.hasLoaded),
    refreshing: state.identity === identity && state.pending && state.hasLoaded,
    hasLoaded: state.identity === identity && state.hasLoaded,
    error: state.identity === identity ? state.error : null,
    addEntry,
    updateEntry,
    deleteEntry,
    refetchEntries,
  };
};
