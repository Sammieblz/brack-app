import { useCallback } from "react";
import { toast } from "sonner";

const DEFAULT_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 300;

type RequestFn<T> = () => Promise<T>;

interface RetryOptions {
  retries?: number;
  backoffMs?: number;
  onError?: (error: unknown) => void;
  toastOnError?: boolean;
  toastMessage?: string;
}

export const useSupabaseRequest = () => {
  const withRetry = useCallback(
    async <T>(fn: RequestFn<T>, options?: RetryOptions): Promise<T> => {
      const {
        retries = DEFAULT_RETRIES,
        backoffMs = DEFAULT_BACKOFF_MS,
        onError,
        toastOnError = true,
        toastMessage = "Something went wrong. Please try again.",
      } = options || {};

      let attempt = 0;
      let lastError: unknown;

      while (attempt <= retries) {
        try {
          return await fn();
        } catch (error) {
          lastError = error;
          onError?.(error);

          if (attempt === retries) break;

          const delay = backoffMs * Math.pow(2, attempt);
          await new Promise((res) => setTimeout(res, delay));
          attempt += 1;
        }
      }

      if (toastOnError) {
        toast.error(toastMessage);
      }

      throw lastError ?? new Error("Request failed");
    },
    [],
  );

  return { withRetry };
};
