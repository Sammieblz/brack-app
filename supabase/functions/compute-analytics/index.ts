import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/errorHandler.ts";

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req.headers.get("origin")) });
  }

  try {
    const origin = req.headers.get("origin");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse(
        new Error("Missing authorization header"),
        401,
        origin
      );
    }

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return createErrorResponse(
        new Error("Invalid or expired token"),
        401,
        origin
      );
    }

    // Parse request body
    const { date, userId } = await req.json();

    // Use provided userId or default to authenticated user
    const targetUserId = userId || user.id;

    // Validate date (default to today if not provided)
    const snapshotDate = date ? new Date(date) : new Date();
    snapshotDate.setHours(0, 0, 0, 0);

    // Call the database function to compute analytics
    const { data, error } = await supabaseClient.rpc("compute_daily_analytics", {
      p_user_id: targetUserId,
      p_date: snapshotDate.toISOString().split("T")[0],
    });

    if (error) {
      console.error("Error computing analytics:", error);
      return createErrorResponse(
        new Error("Failed to compute analytics"),
        500,
        origin,
        { error: error.message }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        snapshot: data,
      }),
      {
        headers: {
          ...getCorsHeaders(origin),
          "Content-Type": "application/json",
        },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Unexpected error:", error);
    return createErrorResponse(
      error instanceof Error ? error : new Error("Unknown error"),
      500,
      req.headers.get("origin")
    );
  }
});
