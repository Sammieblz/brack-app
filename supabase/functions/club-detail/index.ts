import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import {
  ACTIVE_CLUB_SELECT,
  DISCUSSION_SELECT,
  MEMBER_SELECT,
  canViewFullClub,
  getClubOr404,
  getClubImageUrls,
  getClubRoles,
  getPendingInviteClubIds,
  getPendingRequestClubIds,
  getViewerContext,
  normalizeClubPreview,
  signClubMediaItems,
  type ClubRole,
} from "../_shared/clubs.ts";

interface ClubDetailBody {
  clubId?: unknown;
}

const getProfiles = async (
  supabaseClient: ReturnType<typeof createServiceClient>,
  userIds: string[],
) => {
  if (userIds.length === 0) return new Map<string, Record<string, unknown>>();
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id,display_name,avatar_url,reader_status,last_seen_at,show_online_status")
    .in("id", [...new Set(userIds)]);
  if (error) throw error;
  return new Map((data || []).map((profile) => [profile.id as string, profile]));
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "club-detail",
      identifier: authResult.user.id,
      limit: 180,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<ClubDetailBody>(req);
    const clubId = typeof body.clubId === "string" ? body.clubId : "";
    if (!clubId) return jsonResponse({ error: "Club id is required" }, 400, origin);

    const viewer = await getViewerContext(supabaseClient, authResult.user.id);
    const club = await getClubOr404(supabaseClient, clubId);
    if (viewer.blockedIds.has(club.created_by)) {
      return jsonResponse({ error: "Club not found" }, 404, origin);
    }

    const roles = await getClubRoles(supabaseClient, authResult.user.id, [club.id]);
    const role = roles.get(club.id) ?? null;
    const fullAccess = canViewFullClub(club, authResult.user.id, role);
    const pendingRequests = await getPendingRequestClubIds(supabaseClient, authResult.user.id);
    const pendingInvites = await getPendingInviteClubIds(supabaseClient, authResult.user.id);

    const { data: currentBook, error: bookError } = club.current_book_id && fullAccess
      ? await supabaseClient
          .from("books")
          .select("id,title,author,cover_url,pages,genre,status,current_page")
          .eq("id", club.current_book_id)
          .maybeSingle()
      : { data: null, error: null };
    if (bookError) throw bookError;

    const imageUrls = await getClubImageUrls(supabaseClient, club);
    const preview = normalizeClubPreview(club, viewer, role, {
      ...imageUrls,
      currentBook,
      joinStatus: role
        ? "member"
        : pendingRequests.has(club.id)
          ? "requested"
          : pendingInvites.has(club.id)
            ? "invited"
            : "none",
    });

    if (!fullAccess) {
      return jsonResponse({ club: preview, members: [], discussions: [], announcements: [] }, 200, origin);
    }

    const [membersResult, discussionsResult, requestsResult, invitesResult] = await Promise.all([
      supabaseClient
        .from("book_club_members")
        .select(MEMBER_SELECT)
        .eq("club_id", club.id)
        .order("joined_at", { ascending: true }),
      supabaseClient
        .from("book_club_discussions")
        .select(DISCUSSION_SELECT)
        .eq("club_id", club.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(250),
      role === "admin"
        ? supabaseClient
            .from("book_club_join_requests")
            .select("id,club_id,user_id,message,status,reviewed_by,reviewed_at,created_at,updated_at")
            .eq("club_id", club.id)
            .eq("status", "pending")
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      role === "admin"
        ? supabaseClient
            .from("book_club_invites")
            .select("id,club_id,invited_user_id,invited_by,status,message,expires_at,responded_at,created_at,updated_at")
            .eq("club_id", club.id)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    for (const result of [membersResult, discussionsResult, requestsResult, invitesResult]) {
      if (result.error) throw result.error;
    }

    const userIds = [
      ...(membersResult.data || []).map((member) => member.user_id as string),
      ...(discussionsResult.data || []).map((discussion) => discussion.user_id as string),
      ...(requestsResult.data || []).map((request) => request.user_id as string),
      ...(invitesResult.data || []).map((invite) => invite.invited_user_id as string),
      ...(invitesResult.data || []).map((invite) => invite.invited_by as string),
    ];
    const profileMap = await getProfiles(supabaseClient, userIds);

    const discussionNodes = await Promise.all(
      (discussionsResult.data || []).map(async (discussion) => ({
        ...discussion,
        user: profileMap.get(discussion.user_id as string) ?? null,
        media: await signClubMediaItems(supabaseClient, discussion.media),
        replies: [] as Array<Record<string, unknown>>,
      })),
    );
    const discussionMap = new Map(
      discussionNodes.map((discussion) => [discussion.id as string, discussion]),
    );
    const roots: Array<Record<string, unknown>> = [];
    for (const discussion of discussionNodes) {
      const parentId = discussion.parent_id as string | null;
      if (parentId && discussionMap.has(parentId)) {
        const parent = discussionMap.get(parentId)!;
        (parent.replies as Array<Record<string, unknown>>).push(discussion);
      } else {
        roots.push(discussion);
      }
    }

    const sortThread = (items: Array<Record<string, unknown>>, root = false) => {
      items.sort((a, b) => {
        if (root) {
          const pinnedA = Boolean(a.is_pinned);
          const pinnedB = Boolean(b.is_pinned);
          if (pinnedA !== pinnedB) return pinnedA ? -1 : 1;
          return String(b.created_at).localeCompare(String(a.created_at));
        }
        return String(a.created_at).localeCompare(String(b.created_at));
      });
      for (const item of items) {
        const replies = item.replies as Array<Record<string, unknown>>;
        sortThread(replies);
      }
    };
    sortThread(roots, true);

    const discussions = roots;

    const announcements = discussions.filter(
      (discussion) => discussion.discussion_type === "announcement",
    );
    const conversationThreads = discussions.filter(
      (discussion) => discussion.discussion_type !== "announcement",
    );

    return jsonResponse(
      {
        club: preview,
        user_role: role as ClubRole | null,
        members: (membersResult.data || []).map((member) => ({
          ...member,
          user: profileMap.get(member.user_id as string) ?? null,
        })),
        discussions: conversationThreads,
        announcements,
        admin: role === "admin"
          ? {
              pending_requests: (requestsResult.data || []).map((request) => ({
                ...request,
                user: profileMap.get(request.user_id as string) ?? null,
              })),
              pending_invites: (invitesResult.data || []).map((invite) => ({
                ...invite,
                invited_user: profileMap.get(invite.invited_user_id as string) ?? null,
                invited_by_user: profileMap.get(invite.invited_by as string) ?? null,
              })),
            }
          : null,
      },
      200,
      origin,
    );
  } catch (error) {
    console.error("club-detail failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to load club" },
      500,
      origin,
    );
  }
});
