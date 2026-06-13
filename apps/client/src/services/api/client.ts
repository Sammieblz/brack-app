import { supabase } from "@/integrations/supabase/client";

export type FunctionInvokeOptions = Parameters<typeof supabase.functions.invoke>[1];

export const invokeFunction = async <T>(
  functionName: string,
  options?: FunctionInvokeOptions
): Promise<T> => {
  const { data, error } = await supabase.functions.invoke<T>(functionName, options);

  if (error) {
    throw error;
  }

  return data as T;
};
