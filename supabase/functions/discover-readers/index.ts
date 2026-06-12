import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { sanitizeString } from "../_shared/social.ts";

type Relationship = "none" | "following" | "follower" | "friend";

interface DiscoverReadersBody {
  searchQuery?: unknown;
  maxDistance?: unknown;
  limit?: unknown;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  current_streak: number | null;
  latitude: number | null;
  longitude: number | null;
  show_location: boolean | null;
  profile_visibility: string | null;
  show_online_status: boolean | null;
  reader_status: string | null;
  last_seen_at: string | null;
}

interface ReaderRecommendation {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  current_streak: number;
  books_read_count: number;
  distance_km?: number;
  mutual_follows?: number;
  mutual_friend_count: number;
  shared_club_count: number;
  genre_overlap?: number;
  recent_activity?: number;
  relationship: Relationship;
  status_badge: string;
  is_online: boolean;
  last_seen_at: string | null;
  badges: string[];
  recommendation_reason: string;
  recommendation_score: number;
}

const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

const clampLimit = (value: unknown, fallback = 24, max = 50) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
};

const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const radiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radiusKm * c;
};

const getRelationship = (
  profileId: string,
  followingIds: Set<string>,
  followerIds: Set<string>,
): Relationship => {
  const follows = followingIds.has(profileId);
  const followedBy = followerIds.has(profileId);
  if (follows && followedBy) return "friend";
  if (follows) return "following";
  if (followedBy) return "follower";
  return "none";
};

const canViewProfile = (
  profile: ProfileRow,
  followingIds: Set<string>,
): boolean => {
  const visibility = profile.profile_visibility || "public";
  if (visibility === "public") return true;
  if (visibility === "followers") return followingIds.has(profile.id);
  return false;
};

const uniqueById = (items: ReaderRecommendation[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const top = (items: ReaderRecommendation[], limit: number) =>
  uniqueById(items)
    .sort((a, b) => b.recommendation_score - a.recommendation_score)
    .slice(0, limit);

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return optionsResponse(origin);
  }

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "discover-readers",
      identifier: authResult.user.id,
      limit: 90,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<DiscoverReadersBody>(req);
    const searchQuery = sanitizeString(body.searchQuery, 200);
    const maxDistance = Number(body.maxDistance || 50);
    const limit = clampLimit(body.limit, 24, 50);
    const userId = authResult.user.id;

    const [
      currentProfileResult,
      userHabitsResult,
      userBooksResult,
      followsResult,
      blocksResult,
      myClubsResult,
    ] = await Promise.all([
      supabaseClient
        .from("profiles")
        .select("id, latitude, longitude, show_location")
        .eq("id", userId)
        .maybeSingle(),
      supabaseClient
        .from("reading_habits")
        .select("genres, longest_genre, avg_time_per_book, avg_length")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseClient
        .from("books")
        .select("genre")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .not("genre", "is", null),
      supabaseClient
        .from("user_follows")
        .select("follower_id, following_id")
        .or(`follower_id.eq.${userId},following_id.eq.${userId}`),
      supabaseClient
        .from("user_blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
      supabaseClient
        .from("book_club_members")
        .select("club_id")
        .eq("user_id", userId),
    ]);

    for (const result of [
      currentProfileResult,
      userHabitsResult,
      userBooksResult,
      followsResult,
      blocksResult,
      myClubsResult,
    ]) {
      if (result.error) throw result.error;
    }

    const followingIds = new Set<string>();
    const followerIds = new Set<string>();
    for (const follow of followsResult.data || []) {
      if (follow.follower_id === userId) followingIds.add(follow.following_id);
      if (follow.following_id === userId) followerIds.add(follow.follower_id);
    }

    const friendIds = new Set(
      [...followingIds].filter((id) => followerIds.has(id)),
    );
    const directConnectionIds = new Set([...followingIds, ...followerIds]);
    const blockedIds = new Set<string>();
    for (const block of blocksResult.data || []) {
      if (block.blocker_id === userId) blockedIds.add(block.blocked_id);
      if (block.blocked_id === userId) blockedIds.add(block.blocker_id);
    }

    const userGenres = new Set<string>();
    if (Array.isArray(userHabitsResult.data?.genres)) {
      for (const genre of userHabitsResult.data.genres) userGenres.add(String(genre));
    }
    for (const book of userBooksResult.data || []) {
      if (book.genre) userGenres.add(book.genre);
    }

    const friendOfFriendCounts = new Map<string, number>();
    if (friendIds.size > 0) {
      const { data, error } = await supabaseClient
        .from("user_follows")
        .select("follower_id, following_id")
        .in("follower_id", [...friendIds]);
      if (error) throw error;

      for (const follow of data || []) {
        const candidateId = follow.following_id as string;
        if (
          candidateId !== userId &&
          !directConnectionIds.has(candidateId) &&
          !blockedIds.has(candidateId)
        ) {
          friendOfFriendCounts.set(
            candidateId,
            (friendOfFriendCounts.get(candidateId) || 0) + 1,
          );
        }
      }
    }

    let profilesQuery = supabaseClient
      .from("profiles")
      .select(
        "id, display_name, avatar_url, bio, current_streak, latitude, longitude, show_location, profile_visibility, show_online_status, reader_status, last_seen_at",
      )
      .neq("id", userId)
      .limit(searchQuery ? 80 : 250);

    if (searchQuery) {
      profilesQuery = profilesQuery.ilike("display_name", `%${searchQuery}%`);
    }

    const { data: rawProfiles, error: profilesError } = await profilesQuery;
    if (profilesError) throw profilesError;

    const profiles = ((rawProfiles || []) as ProfileRow[]).filter(
      (profile) => !blockedIds.has(profile.id) && canViewProfile(profile, followingIds),
    );

    if (profiles.length === 0) {
      return jsonResponse(
        {
          suggestions: [],
          nearby: [],
          connections: [],
          friendsOfFriends: [],
          activeFriends: [],
          searchResults: [],
        },
        200,
        origin,
      );
    }

    const profileIds = profiles.map((profile) => profile.id);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      booksResult,
      habitsResult,
      sessionsResult,
      completedResult,
      clubMembersResult,
    ] = await Promise.all([
      supabaseClient
        .from("books")
        .select("user_id, genre")
        .in("user_id", profileIds)
        .is("deleted_at", null)
        .not("genre", "is", null),
      supabaseClient
        .from("reading_habits")
        .select("user_id, genres, longest_genre, avg_time_per_book, avg_length")
        .in("user_id", profileIds),
      supabaseClient
        .from("reading_sessions")
        .select("user_id, created_at")
        .in("user_id", profileIds)
        .gte("created_at", thirtyDaysAgo.toISOString()),
      supabaseClient
        .from("books")
        .select("user_id")
        .in("user_id", profileIds)
        .eq("status", "completed")
        .is("deleted_at", null),
      myClubsResult.data && myClubsResult.data.length > 0
        ? supabaseClient
            .from("book_club_members")
            .select("user_id, club_id")
            .in(
              "club_id",
              myClubsResult.data.map((club) => club.club_id),
            )
            .in("user_id", profileIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    for (const result of [
      booksResult,
      habitsResult,
      sessionsResult,
      completedResult,
      clubMembersResult,
    ]) {
      if (result.error) throw result.error;
    }

    const genresByUser = new Map<string, Set<string>>();
    for (const habit of habitsResult.data || []) {
      if (Array.isArray(habit.genres) && habit.genres.length > 0) {
        genresByUser.set(habit.user_id, new Set(habit.genres.map(String)));
      }
    }
    for (const book of booksResult.data || []) {
      if (!book.genre || !book.user_id) continue;
      if (!genresByUser.has(book.user_id)) genresByUser.set(book.user_id, new Set());
      genresByUser.get(book.user_id)!.add(book.genre);
    }

    const sessionsByUser = new Map<string, number>();
    for (const session of sessionsResult.data || []) {
      sessionsByUser.set(
        session.user_id,
        (sessionsByUser.get(session.user_id) || 0) + 1,
      );
    }

    const completedBooksByUser = new Map<string, number>();
    for (const book of completedResult.data || []) {
      completedBooksByUser.set(
        book.user_id,
        (completedBooksByUser.get(book.user_id) || 0) + 1,
      );
    }

    const sharedClubsByUser = new Map<string, number>();
    for (const member of clubMembersResult.data || []) {
      sharedClubsByUser.set(
        member.user_id,
        (sharedClubsByUser.get(member.user_id) || 0) + 1,
      );
    }

    const currentLocationEnabled = currentProfileResult.data?.show_location !== false;
    const currentLat = currentLocationEnabled ? currentProfileResult.data?.latitude : null;
    const currentLon = currentLocationEnabled ? currentProfileResult.data?.longitude : null;
    const now = Date.now();

    const recommendations: ReaderRecommendation[] = profiles
      .map((profile) => {
        let score = 0;
        const badges = new Set<string>();
        const reasons: string[] = [];
        const relationship = getRelationship(profile.id, followingIds, followerIds);

        if (relationship === "friend") {
          score += 90;
          badges.add("Friend");
          reasons.push("friend");
        } else if (relationship === "following") {
          score += 55;
          badges.add("Following");
          reasons.push("you follow them");
        } else if (relationship === "follower") {
          score += 45;
          badges.add("Follows you");
          reasons.push("follows you");
        }

        const mutual_friend_count = friendOfFriendCounts.get(profile.id) || 0;
        if (mutual_friend_count > 0) {
          score += mutual_friend_count * 35;
          badges.add("Friend of friend");
          reasons.push(`${mutual_friend_count} mutual friend${mutual_friend_count > 1 ? "s" : ""}`);
        }

        let distance_km: number | undefined;
        if (
          typeof currentLat === "number" &&
          typeof currentLon === "number" &&
          profile.show_location !== false &&
          typeof profile.latitude === "number" &&
          typeof profile.longitude === "number"
        ) {
          distance_km = calculateDistance(
            currentLat,
            currentLon,
            profile.latitude,
            profile.longitude,
          );
          if (distance_km <= maxDistance) {
            score += Math.max(4, 35 - distance_km * 0.6);
            badges.add("Nearby");
            reasons.push(`${Math.round(distance_km)}km away`);
          }
        }

        const theirGenres = genresByUser.get(profile.id) || new Set<string>();
        const genre_overlap = [...userGenres].filter((genre) => theirGenres.has(genre)).length;
        if (genre_overlap > 0) {
          score += genre_overlap * 22;
          badges.add("Similar taste");
          reasons.push(`${genre_overlap} shared genre${genre_overlap > 1 ? "s" : ""}`);
        }

        const shared_club_count = sharedClubsByUser.get(profile.id) || 0;
        if (shared_club_count > 0) {
          score += shared_club_count * 26;
          badges.add("Club mate");
          reasons.push(`${shared_club_count} shared club${shared_club_count > 1 ? "s" : ""}`);
        }

        const recent_activity = sessionsByUser.get(profile.id) || 0;
        if (recent_activity > 0) {
          score += Math.min(recent_activity * 4, 32);
        }

        const is_online =
          Boolean(profile.show_online_status) &&
          Boolean(profile.last_seen_at) &&
          now - new Date(profile.last_seen_at!).getTime() <= ACTIVE_WINDOW_MS;
        if (is_online) {
          score += 30;
          badges.add("Active now");
          reasons.push("active now");
        }

        const books_read_count = completedBooksByUser.get(profile.id) || 0;
        if (books_read_count > 0) score += Math.min(books_read_count, 20);
        if ((profile.current_streak || 0) > 3) score += Math.min(profile.current_streak || 0, 20);

        return {
          id: profile.id,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          bio: profile.bio,
          current_streak: profile.current_streak || 0,
          books_read_count,
          distance_km,
          mutual_follows: mutual_friend_count,
          mutual_friend_count,
          shared_club_count,
          genre_overlap,
          recent_activity,
          relationship,
          status_badge: profile.reader_status || "available",
          is_online,
          last_seen_at: profile.show_online_status ? profile.last_seen_at : null,
          badges: [...badges],
          recommendation_reason: reasons.length > 0 ? reasons.slice(0, 2).join(", ") : "Recommended reader",
          recommendation_score: score,
        };
      })
      .filter((reader) => searchQuery || reader.recommendation_score > 0);

    const searchResults = searchQuery
      ? top(recommendations, limit)
      : [];

    const suggestions = !searchQuery
      ? top(
          recommendations.filter(
            (reader) =>
              reader.relationship !== "friend" || reader.genre_overlap || reader.shared_club_count || reader.is_online,
          ),
          limit,
        )
      : [];

    const nearby = !searchQuery
      ? top(
          recommendations.filter(
            (reader) =>
              typeof reader.distance_km === "number" &&
              reader.distance_km <= maxDistance,
          ),
          12,
        )
      : [];

    const connections = !searchQuery
      ? top(
          recommendations.filter((reader) => reader.relationship !== "none"),
          18,
        )
      : [];

    const friendsOfFriends = !searchQuery
      ? top(
          recommendations.filter((reader) => reader.mutual_friend_count > 0),
          18,
        )
      : [];

    const activeFriends = !searchQuery
      ? top(
          recommendations.filter(
            (reader) => reader.relationship === "friend" && reader.is_online,
          ),
          12,
        )
      : [];

    return jsonResponse(
      {
        suggestions,
        nearby,
        connections,
        friendsOfFriends,
        activeFriends,
        searchResults,
      },
      200,
      origin,
    );
  } catch (error) {
    console.error("discover-readers failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to discover readers" },
      500,
      origin,
    );
  }
});
