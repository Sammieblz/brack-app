import { useEffect, useRef, useState, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";

interface UseAutoSaveOptions<T> {
  data: T;
  onSave: (data: T) => Promise<void> | void;
  debounceMs?: number;
  enabled?: boolean;
  onSaveStart?: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
}

export const useAutoSave = <T,>({
  data,
  onSave,
  debounceMs = 2000,
  enabled = true,
  onSaveStart,
  onSaveSuccess,
  onSaveError,
}: UseAutoSaveOptions<T>) => {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const previousDataRef = useRef<T>(data);
  const isInitialMount = useRef(true);

  const debouncedData = useDebounce(data, debounceMs);

  const save = useCallback(async (dataToSave: T) => {
    if (!enabled) return;

    try {
      setStatus('saving');
      onSaveStart?.();
      await onSave(dataToSave);
      setStatus('saved');
      setLastSaved(new Date());
      onSaveSuccess?.();
      
      // Reset to idle after 2 seconds
      setTimeout(() => {
        setStatus('idle');
      }, 2000);
    } catch (error) {
      setStatus('error');
      onSaveError?.(error instanceof Error ? error : new Error('Save failed'));
      
      // Reset to idle after 3 seconds on error
      setTimeout(() => {
        setStatus('idle');
      }, 3000);
    }
  }, [enabled, onSave, onSaveStart, onSaveSuccess, onSaveError]);

  useEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousDataRef.current = data;
      return;
    }

    // Only save if data actually changed
    if (JSON.stringify(previousDataRef.current) !== JSON.stringify(debouncedData)) {
      previousDataRef.current = debouncedData;
      save(debouncedData);
    }
  }, [debouncedData, save]);

  return {
    status,
    lastSaved,
    isSaving: status === 'saving',
    isSaved: status === 'saved',
    hasError: status === 'error',
  };
};
