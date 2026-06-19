import { supabase } from "@/integrations/supabase/client";
import {
  isRetryableConnectivityError,
  markAuthenticationRequired,
  markConnectivityFailure,
  markConnectivitySuccess,
} from "@/services/connectivity";

export type FunctionInvokeOptions = Parameters<typeof supabase.functions.invoke>[1];

export const invokeFunction = async <T>(
  functionName: string,
  options?: FunctionInvokeOptions
): Promise<T> => {
  const { data, error } = await supabase.functions.invoke<T>(functionName, options);

  if (error) {
    const status = (error as { context?: Response }).context?.status;
    if (status === 401 || status === 403) {
      markAuthenticationRequired();
    } else if (isRetryableConnectivityError(error)) {
      markConnectivityFailure();
    }
    throw error;
  }

  markConnectivitySuccess();
  return data as T;
};
