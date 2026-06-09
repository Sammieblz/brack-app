import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { sanitizeString } from "../_shared/social.ts";
import {
  ACTIVE_CLUB_SELECT,
  getClubImageUrls,
  getClubRoles,
  getPendingInviteClubIds,
  getPendingRequestClubIds,
  getViewerContext,
  normalizeClubPreview,
  scoreClub,
  type ClubRow,
} from "../_shared/clubs.ts";

interface ClubsHomeBody {
  searchQuery?: unknown;
  limit?: unknown;
  maxDistance?: unknown;
}

const clampLimit = (value: unknown, fallback = 24, max = 50) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
};

const textMatches = (club: ClubRow, query: string) => {
  if (!query) return true;
  const haystack = [
    club.name,
    club.description,
    club.city,
    club.country,
    ...(club.genres || []),
    ...(club.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
};

const uniqueById = <T extends { id: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "clubs-home",
      identifier: authResult.user.id,
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<ClubsHomeBody>(req);
    const searchQuery = sanitizeString(body.searchQuery, 120);
    const limit = clampLimit(body.limit, 24, 50);
    const maxDistance = Number(body.maxDistance || 75);
    const viewer = await getViewerContext(supabaseClient, authResult.user.id);

    const { data: clubsData, error: clubsError } = await supabaseClient
      .from("book_clubs")
      .select(ACTIVE_CLUB_SELECT)
      .order("last_activity_at", { ascending: false })
      .limit(searchQuery ? 250 : 300);
    if (clubsError) throw clubsError;

    const clubs = ((clubsData || []) as ClubRow[]).filter(
      (club) => !viewer.blockedIds.has(club.created_by) && textMatches(club, searchQuery),
    );
    const clubIds = clubs.map((club) => club.id);
    const roles = await getClubRoles(supabaseClient, authResult.user.id, clubIds);
    const pendingRequestClubIds = await getPendingRequestClubIds(
      supabaseClient,
      authResult.user.id,
    );
    const pendingInviteClubIds = await getPendingInviteClubIds(
      supabaseClient,
      authResult.user.id,
    );
    const [requestRowsResult, inviteRowsResult] = await Promise.all([
      supabaseClient
        .from("book_club_join_requests")
        .select("id,club_id")
        .eq("user_id", authResult.user.id)
        .eq("status", "pending"),
      supabaseClient
        .from("book_club_invites")
        .select("id,club_id")
        .eq("invited_user_id", authResult.user.id)
        .eq("status", "pending"),
    ]);
    if (requestRowsResult.error) throw requestRowsResult.error;
    if (inviteRowsResult.error) throw inviteRowsResult.error;
    const requestIdByClub = new Map(
      (requestRowsResult.data || []).map((row) => [row.club_id as string, row.id as string]),
    );
    const inviteIdByClub = new Map(
      (inviteRowsResult.data || []).map((row) => [row.club_id as string, row.id as string]),
    );

    const bookIds = [
      ...new Set(
        clubs
          .filter((club) => !club.is_private || roles.has(club.id))
          .map((club) => club.current_book_id)
          .filter(Boolean)
          .map(String),
      ),
    ];
    const { data: booksData, error: booksError } = bookIds.length
      ? await supabaseClient
          .from("books")
          .select("id,title,author,cover_url")
          .in("id", bookIds)
      : { data: [], error: null };
    if (booksError) throw booksError;
    const bookMap = new Map((booksData || []).map((book) => [book.id, book]));

    const { data: memberRows, error: membersError } = clubIds.length
      ? await supabaseClient
          .from("book_club_members")
          .select("club_id,user_id")
          .in("club_id", clubIds)
      : { data: [], error: null };
    if (membersError) throw membersError;

    const sharedMembersByClub = new Map<string, number>();
    for (const row of memberRows || []) {
      if (viewer.followingIds.has(row.user_id)) {
        sharedMembersByClub.set(
          row.club_id,
          (sharedMembersByClub.get(row.club_id) || 0) + 1,
        );
      }
    }

    const previews = await Promise.all(clubs.map(async (club) => {
      const role = roles.get(club.id) ?? null;
      const sharedMemberCount = sharedMembersByClub.get(club.id) || 0;
      const recommendationScore = scoreClub(club, viewer, sharedMemberCount);
      const distance = normalizeClubPreview(club, viewer, role).distance_km;
      const imageUrls = await getClubImageUrls(supabaseClient, club);
      const reasons = [
        sharedMemberCount > 0 ? `${sharedMemberCount} connection${sharedMemberCount > 1 ? "s" : ""}` : "",
        typeof distance === "number" ? `${Math.round(distance)}km away` : "",
        (club.genres || []).some((genre) => viewer.userGenres.has(genre)) ? "matches your genres" : "",
        (club.member_count || 0) > 5 ? "popular club" : "",
      ].filter(Boolean);
      return normalizeClubPreview(club, viewer, role, {
        ...imageUrls,
        currentBook: club.current_book_id ? bookMap.get(club.current_book_id) ?? null : null,
        joinStatus: role
          ? "member"
          : pendingRequestClubIds.has(club.id)
            ? "requested"
            : pendingInviteClubIds.has(club.id)
              ? "invited"
              : "none",
        requestId: requestIdByClub.get(club.id) || null,
        inviteId: inviteIdByClub.get(club.id) || null,
        recommendationScore,
        recommendationReason: reasons.slice(0, 2).join(", ") || "Recommended club",
        sharedMemberCount,
      });
    }));

    const myClubs = previews
      .filter((club) => club.user_role)
      .sort((a, b) => String(b.last_activity_at || b.updated_at).localeCompare(String(a.last_activity_at || a.updated_at)));

    const invites = previews.filter((club) => club.join_status === "invited");
    const pendingRequests = previews.filter((club) => club.join_status === "requested");
    const searchResults = searchQuery
      ? previews
          .sort((a, b) => b.recommendation_score - a.recommendation_score)
          .slice(0, limit)
      : [];

    const discoverable = previews.filter((club) => !club.user_role);
    const suggested = !searchQuery
      ? uniqueById(discoverable)
          .sort((a, b) => b.recommendation_score - a.recommendation_score)
          .slice(0, limit)
      : [];
    const nearby = !searchQuery
      ? discoverable
          .filter((club) => typeof club.distance_km === "number" && club.distance_km <= maxDistance)
          .sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0))
          .slice(0, 18)
      : [];
    const popular = !searchQuery
      ? discoverable
          .sort((a, b) => b.member_count - a.member_count || b.recommendation_score - a.recommendation_score)
          .slice(0, 18)
      : [];
    const newest = !searchQuery
      ? discoverable
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
          .slice(0, 18)
      : [];

    return jsonResponse(
      {
        myClubs,
        suggested,
        nearby,
        popular,
        newest,
        invites,
        pendingRequests,
        searchResults,
        summary: {
          my_clubs: myClubs.length,
          suggested: suggested.length,
          nearby: nearby.length,
          invites: invites.length,
          pending_requests: pendingRequests.length,
        },
      },
      200,
      origin,
    );
  } catch (error) {
    console.error("clubs-home failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to load clubs" },
      500,
      origin,
    );
  }
});
