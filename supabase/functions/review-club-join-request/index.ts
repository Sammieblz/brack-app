import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { requireClubRole } from "../_shared/clubs.ts";

interface ReviewRequestBody {
  requestId?: unknown;
  decision?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "review-club-join-request",
      identifier: authResult.user.id,
      limit: 80,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<ReviewRequestBody>(req);
    const requestId = typeof body.requestId === "string" ? body.requestId : "";
    const decision = body.decision === "approve" ? "approved" : body.decision === "decline" ? "declined" : "";
    if (!requestId || !decision) {
      return jsonResponse({ error: "Request id and decision are required" }, 400, origin);
    }

    const { data: request, error: requestError } = await supabaseClient
      .from("book_club_join_requests")
      .select("id,club_id,user_id,status")
      .eq("id", requestId)
      .maybeSingle();
    if (requestError) throw requestError;
    if (!request) return jsonResponse({ error: "Join request not found" }, 404, origin);
    await requireClubRole(supabaseClient, request.club_id, authResult.user.id, ["admin"]);

    if (request.status !== "pending") {
      return jsonResponse({ error: "This request has already been reviewed" }, 409, origin);
    }

    const { error: updateError } = await supabaseClient
      .from("book_club_join_requests")
      .update({
        status: decision,
        reviewed_by: authResult.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    if (updateError) throw updateError;

    if (decision === "approved") {
      const { error: memberError } = await supabaseClient.from("book_club_members").upsert(
        {
          club_id: request.club_id,
          user_id: request.user_id,
          role: "member",
        },
        { onConflict: "club_id,user_id" },
      );
      if (memberError) throw memberError;
    }

    return jsonResponse({ ok: true, status: decision }, 200, origin);
  } catch (error) {
    console.error("review-club-join-request failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to review request" },
      500,
      origin,
    );
  }
});

