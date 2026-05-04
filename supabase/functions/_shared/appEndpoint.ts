import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { getCorsHeaders } from "./cors.ts";

type JsonBody = Record<string, unknown> | unknown[] | string | number | boolean | null;

export const createServiceClient = (): SupabaseClient => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase Edge Function environment variables");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export const jsonResponse = (
  body: JsonBody,
  status = 200,
  origin: string | null = null
): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(origin),
      "Content-Type": "application/json",
    },
  });
};

export const optionsResponse = (origin: string | null): Response => {
  return new Response(null, { headers: getCorsHeaders(origin) });
};

export const getAuthenticatedUser = async (
  req: Request,
  supabaseClient: SupabaseClient,
  origin: string | null
): Promise<{ user: User } | { response: Response }> => {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return {
      response: jsonResponse({ error: "No authorization header" }, 401, origin),
    };
  }

  const jwt = authHeader.replace("Bearer ", "").trim();
  if (!jwt) {
    return {
      response: jsonResponse({ error: "Invalid authorization header" }, 401, origin),
    };
  }

  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser(jwt);

  if (error || !user) {
    return {
      response: jsonResponse({ error: "Unauthorized" }, 401, origin),
    };
  }

  return { user };
};

export const parseJsonBody = async <T>(
  req: Request
): Promise<T> => {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
};
