import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { isPairBlocked, otherParticipantId } from "../_shared/messaging.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const userId = authResult.user.id;
    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "conversations-home",
      identifier: userId,
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const { data: conversations, error } = await supabaseClient
      .from("conversations")
      .select("*")
      .or(`participant_one_id.eq.${userId},participant_two_id.eq.${userId}`)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const conversationIds = (conversations || []).map((conversation) => conversation.id);
    const otherIds = (conversations || [])
      .map((conversation) => otherParticipantId(conversation, userId))
      .filter(Boolean) as string[];

    const [settingsResult, readsResult, profilesResult] = await Promise.all([
      conversationIds.length
        ? supabaseClient
            .from("conversation_user_settings")
            .select("*")
            .eq("user_id", userId)
            .in("conversation_id", conversationIds)
        : Promise.resolve({ data: [], error: null }),
      conversationIds.length
        ? supabaseClient
            .from("conversation_reads")
            .select("*")
            .eq("user_id", userId)
            .in("conversation_id", conversationIds)
        : Promise.resolve({ data: [], error: null }),
      otherIds.length
        ? supabaseClient
            .from("profiles")
            .select("id,display_name,avatar_url,show_online_status,last_seen_at,reader_status")
            .in("id", otherIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    for (const result of [settingsResult, readsResult, profilesResult]) {
      if (result.error) throw result.error;
    }

    const settingsMap = new Map(
      (settingsResult.data || []).map((setting) => [setting.conversation_id, setting])
    );
    const readsMap = new Map((readsResult.data || []).map((read) => [read.conversation_id, read]));
    const profilesMap = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));

    const items = [];
    for (const conversation of conversations || []) {
      const setting = settingsMap.get(conversation.id) || null;
      if (setting?.hidden_at) continue;

      const otherUserId = otherParticipantId(conversation, userId);
      if (!otherUserId) continue;

      const [blocked, latestResult] = await Promise.all([
        isPairBlocked(supabaseClient, userId, otherUserId),
        supabaseClient
          .from("messages")
          .select("id,content,message_type,created_at,sender_id,deleted_at")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (latestResult.error) throw latestResult.error;

      const read = readsMap.get(conversation.id) || null;
      let unreadQuery = supabaseClient
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversation.id)
        .neq("sender_id", userId)
        .is("deleted_at", null);

      if (read?.read_at) {
        unreadQuery = unreadQuery.gt("created_at", read.read_at);
      } else {
        unreadQuery = unreadQuery.eq("is_read", false);
      }

      const { count, error: unreadError } = await unreadQuery;
      if (unreadError) throw unreadError;

      let mediaCount = 0;
      if (latestResult.data?.id) {
        const { count: latestMediaCount, error: mediaCountError } = await supabaseClient
          .from("message_media")
          .select("id", { count: "exact", head: true })
          .eq("message_id", latestResult.data.id);
        if (mediaCountError) throw mediaCountError;
        mediaCount = latestMediaCount || 0;
      }

      items.push({
        ...conversation,
        other_user: profilesMap.get(otherUserId) || null,
        last_message: latestResult.data
          ? {
              ...latestResult.data,
              media_count: mediaCount,
            }
          : null,
        unread_count: count || 0,
        settings: setting,
        is_blocked: blocked,
      });
    }

    items.sort((a, b) => {
      const pinnedA = a.settings?.is_pinned ? 1 : 0;
      const pinnedB = b.settings?.is_pinned ? 1 : 0;
      if (pinnedA !== pinnedB) return pinnedB - pinnedA;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return jsonResponse({ conversations: items }, 200, origin);
  } catch (error) {
    console.error("conversations-home failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to load conversations" },
      500,
      origin
    );
  }
});
