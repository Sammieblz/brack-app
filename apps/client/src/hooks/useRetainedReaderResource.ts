import { useCallback, useEffect, useRef, useState } from "react";
import { getApiErrorStatus } from "@/services/api/client";

/** Keep successful reads (including empty results) visible during same-resource refreshes. */
export function useRetainedReaderResource<T>(
  resourceId: string | undefined,
  read: (id: string) => Promise<T>,
  enabled = true,
) {
  const [state, setState] = useState<{
    id?: string;
    data?: T;
    pending: boolean;
    error: Error | null;
  }>({ pending: false, error: null });
  const identity = useRef(resourceId);
  identity.current = resourceId;
  const request = useRef(0);
  const mounted = useRef(true);

  const refetch = useCallback(async () => {
    // A completed mutation can still hold the previous resource's callback.
    // Reject it before it can supersede the current resource's active request.
    if (!resourceId || !enabled || !mounted.current || identity.current !== resourceId) return;
    const currentRequest = ++request.current;
    setState((previous) => ({
      id: resourceId,
      data: previous.id === resourceId ? previous.data : undefined,
      pending: true,
      error: null,
    }));
    try {
      const data = await read(resourceId);
      if (identity.current !== resourceId || request.current !== currentRequest)
        return;
      setState({ id: resourceId, data, pending: false, error: null });
    } catch (error) {
      if (identity.current !== resourceId || request.current !== currentRequest)
        return;
      setState((previous) => ({
        ...previous,
        data: [401, 403, 404].includes(getApiErrorStatus(error) ?? 0)
          ? undefined
          : previous.data,
        pending: false,
        error:
          error instanceof Error
            ? error
            : new Error("Could not load this information"),
      }));
    }
  }, [enabled, read, resourceId]);

  useEffect(() => {
    mounted.current = true;
    void refetch();
    return () => {
      mounted.current = false;
      request.current += 1;
    };
  }, [refetch]);

  const current = state.id === resourceId;
  const data = current ? state.data : undefined;
  const pending = Boolean(resourceId && enabled && (!current || state.pending));
  return {
    data,
    loading: pending && data === undefined,
    refreshing: pending && data !== undefined,
    error: current ? state.error : null,
    refetch,
  };
}
