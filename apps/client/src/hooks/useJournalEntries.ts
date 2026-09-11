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

  const fetchEntries = useCallback(async () => {
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

      if (!isConnectivityAvailable()) {
        publish(localEntries);
        return;
      }

      const remoteEntries = await fetchJournalEntries(bookId);
      if (!isCurrent()) return;
      publish(remoteEntries);
      for (const entry of remoteEntries) {
        await journalRepo.upsertRemote(entry.user_id, entry);
      }
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

  const addEntry = async (
    entry: Omit<JournalEntry, "id" | "user_id" | "created_at" | "updated_at">,
  ) => {
    try {
      const user = await getCurrentAuthUser();
      if (!user) throw new Error("No user found");

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
      console.error("Error adding journal entry:", error);
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
      console.error("Error updating journal entry:", error);
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
    refetchEntries: fetchEntries,
  };
};
