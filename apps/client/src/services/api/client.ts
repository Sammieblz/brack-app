import { supabase } from "@/integrations/supabase/client";
import {
  isRetryableConnectivityError,
  markAuthenticationRequired,
  markConnectivityFailure,
  markConnectivitySuccess,
} from "@/services/connectivity";

export type FunctionInvokeOptions = Parameters<typeof supabase.functions.invoke>[1];

const functionCooldowns = new Map<string, number>();

export class ApiRateLimitError extends Error {
  status = 429;
  statusCode = 429;
  retryAfterSeconds: number;
  functionName: string;

  constructor(functionName: string, retryAfterSeconds: number) {
    super(`${functionName} is rate limited. Retry after ${retryAfterSeconds} seconds.`);
    this.name = "ApiRateLimitError";
    this.functionName = functionName;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const getApiErrorStatus = (error: unknown) => {
  const candidate = error as {
    status?: number;
    statusCode?: number;
    context?: Response | { status?: number; headers?: Headers };
  };
  return candidate.context?.status ?? candidate.status ?? candidate.statusCode ?? null;
};

export const getApiRetryAfterMs = (error: unknown) => {
  const candidate = error as {
    retryAfterSeconds?: number;
    context?: Response | { headers?: Headers };
  };

  if (typeof candidate.retryAfterSeconds === "number") {
    return Math.max(0, candidate.retryAfterSeconds * 1000);
  }

  const retryAfter = candidate.context?.headers?.get?.("Retry-After");
  if (!retryAfter) return null;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const retryAt = Date.parse(retryAfter);
  if (Number.isFinite(retryAt)) return Math.max(0, retryAt - Date.now());

  return null;
};

export const invokeFunction = async <T>(
  functionName: string,
  options?: FunctionInvokeOptions
): Promise<T> => {
  const cooldownUntil = functionCooldowns.get(functionName) ?? 0;
  if (cooldownUntil > Date.now()) {
    throw new ApiRateLimitError(
      functionName,
      Math.ceil((cooldownUntil - Date.now()) / 1000)
    );
  }

  const { data, error } = await supabase.functions.invoke<T>(functionName, options);

  if (error) {
    const status = getApiErrorStatus(error);
    if (status === 401 || status === 403) {
      markAuthenticationRequired();
    } else if (status === 429) {
      const retryAfterMs = getApiRetryAfterMs(error) ?? 60_000;
      functionCooldowns.set(functionName, Date.now() + retryAfterMs);
    } else if (isRetryableConnectivityError(error)) {
      markConnectivityFailure();
    }
    throw error;
  }

  markConnectivitySuccess();
  return data as T;
};
