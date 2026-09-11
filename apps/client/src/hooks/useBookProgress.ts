import { useRetainedReaderResource } from "@/hooks/useRetainedReaderResource";
import { useCallback } from "react";
import { getBookProgress } from "@/services/api";

export const useBookProgress = (bookId?: string, userId?: string) => {
  const read = useCallback(() => getBookProgress(bookId!), [bookId]);
  const resource = useRetainedReaderResource(bookId ? `${userId ?? ""}:${bookId}` : undefined, read);

  return {
    ...resource,
    progress: resource.data ?? null,
    refetchProgress: resource.refetch,
  };
};
