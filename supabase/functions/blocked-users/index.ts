import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "blocked-users",
      identifier: authResult.user.id,
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const { data: blocks, error } = await supabaseClient
      .from("user_blocks")
      .select("id, blocked_id, created_at")
      .eq("blocker_id", authResult.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const ids = (blocks || []).map((block) => block.blocked_id as string);
    const { data: profiles, error: profilesError } = ids.length
      ? await supabaseClient
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", ids)
      : { data: [], error: null };
    if (profilesError) throw profilesError;

    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));

    return jsonResponse(
      {
        users: (blocks || []).map((block) => ({
          id: block.id,
          user_id: block.blocked_id,
          created_at: block.created_at,
          user: profileMap.get(block.blocked_id) ?? null,
        })),
      },
      200,
      origin
    );
  } catch (error) {
    console.error("blocked-users failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to load blocked users" },
      500,
      origin
    );
  }
});
