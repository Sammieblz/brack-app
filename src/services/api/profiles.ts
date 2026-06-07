import { supabase } from "@/integrations/supabase/client";
import type { LibraryViewMode, Profile } from "@/types";
import { getCurrentAuthUser } from "./auth";
import { profilePreferencesRepo } from "@/services/local";

export interface FollowStats {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
}

export interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  profile_visibility: string;
  show_reading_activity: boolean;
  show_currently_reading: boolean;
  show_online_status: boolean;
  reader_status: string;
  last_seen_at: string | null;
  current_streak: number;
  longest_streak: number;
}

export interface UserStats {
  totalBooks: number;
  booksRead: number;
  currentlyReading: number;
  badges: number;
}

export interface UserProfileWithStats {
  profile: UserProfile;
  stats: UserStats;
}

export const fetchFollowStats = async (userId: string): Promise<FollowStats> => {
  const currentUser = await getCurrentAuthUser();

  if (currentUser && currentUser.id !== userId) {
    const { data: block } = await supabase
      .from("user_blocks")
      .select("id")
      .or(
        `and(blocker_id.eq.${currentUser.id},blocked_id.eq.${userId}),and(blocker_id.eq.${userId},blocked_id.eq.${currentUser.id})`
      )
      .maybeSingle();

    if (block) {
      return { followersCount: 0, followingCount: 0, isFollowing: false };
    }
  }

  const [{ count: followersCount }, { count: followingCount }] =
    await Promise.all([
      supabase
        .from("user_follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", userId),
      supabase
        .from("user_follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", userId),
    ]);

  let isFollowing = false;
  if (currentUser) {
    const { data } = await supabase
      .from("user_follows")
      .select("id")
      .eq("follower_id", currentUser.id)
      .eq("following_id", userId)
      .maybeSingle();

    isFollowing = !!data;
  }

  return {
    followersCount: followersCount || 0,
    followingCount: followingCount || 0,
    isFollowing,
  };
};

export const followUser = async (userId: string): Promise<void> => {
  const currentUser = await getCurrentAuthUser();
  if (!currentUser) throw new Error("Not authenticated");

  const { error } = await supabase.from("user_follows").insert({
    follower_id: currentUser.id,
    following_id: userId,
  });

  if (error) throw error;
};

export const unfollowUser = async (userId: string): Promise<void> => {
  const currentUser = await getCurrentAuthUser();
  if (!currentUser) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("user_follows")
    .delete()
    .eq("follower_id", currentUser.id)
    .eq("following_id", userId);

  if (error) throw error;
};

export const fetchUserProfileWithStats = async (
  userId: string
): Promise<UserProfileWithStats> => {
  const currentUser = await getCurrentAuthUser();

  if (currentUser && currentUser.id !== userId) {
    const { data: block } = await supabase
      .from("user_blocks")
      .select("id")
      .or(
        `and(blocker_id.eq.${currentUser.id},blocked_id.eq.${userId}),and(blocker_id.eq.${userId},blocked_id.eq.${currentUser.id})`
      )
      .maybeSingle();

    if (block) {
      throw new Error("Profile unavailable");
    }
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError) throw profileError;

  const emptyStats = {
    totalBooks: 0,
    booksRead: 0,
    currentlyReading: 0,
    badges: 0,
  };

  if (
    profileData.profile_visibility !== "public" &&
    profileData.id !== currentUser?.id
  ) {
    return { profile: profileData as UserProfile, stats: emptyStats };
  }

  const [
    { count: totalBooks },
    { count: booksRead },
    { count: currentlyReading },
    { count: badges },
  ] = await Promise.all([
    supabase
      .from("books")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null),
    supabase
      .from("books")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed")
      .is("deleted_at", null),
    supabase
      .from("books")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "reading")
      .is("deleted_at", null),
    supabase
      .from("user_badges")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  return {
    profile: profileData as UserProfile,
    stats: {
      totalBooks: totalBooks || 0,
      booksRead: booksRead || 0,
      currentlyReading: currentlyReading || 0,
      badges: badges || 0,
    },
  };
};

export const fetchProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;
  return (data as Profile | null) ?? null;
};

export const upsertProfileBasics = async (
  userId: string,
  data: { display_name?: string | null; bio?: string | null }
): Promise<void> => {
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    display_name: data.display_name || null,
    bio: data.bio || null,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
};

export interface PersonalInfoUpdate {
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
  date_of_birth?: string | null;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export const upsertPersonalInfo = async (
  userId: string,
  data: PersonalInfoUpdate
): Promise<void> => {
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    ...data,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
};

export const updateProfileAvatar = async (
  userId: string,
  avatarUrl: string | null
): Promise<void> => {
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId);

  if (error) throw error;
};

export interface ThemePreferences {
  color_theme: string | null;
  theme_mode: string | null;
  library_view_mode: LibraryViewMode | null;
}

export const fetchThemePreferences = async (
  userId: string
): Promise<ThemePreferences | null> => {
  if (!navigator.onLine) {
    const local = await profilePreferencesRepo.get(userId);
    return local
      ? {
          color_theme: local.color_theme ?? null,
          theme_mode: local.theme_mode ?? null,
          library_view_mode: local.library_view_mode ?? "flat",
        }
      : null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("color_theme, theme_mode, library_view_mode, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;
  if (data) {
    await profilePreferencesRepo.upsertRemote(userId, {
      id: userId,
      color_theme: data.color_theme ?? null,
      theme_mode: data.theme_mode ?? null,
      library_view_mode: (data.library_view_mode as LibraryViewMode | null) ?? "flat",
      updated_at: data.updated_at ?? null,
    });
  }
  return data
    ? {
        color_theme: data.color_theme ?? null,
        theme_mode: data.theme_mode ?? null,
        library_view_mode: (data.library_view_mode as LibraryViewMode | null) ?? "flat",
      }
    : null;
};

export const upsertThemePreferences = async (
  userId: string,
  preferences: Partial<ThemePreferences>
): Promise<void> => {
  const updatedAt = new Date().toISOString();

  if (!navigator.onLine) {
    const existing = await profilePreferencesRepo.get(userId);

    await profilePreferencesRepo.upsertLocal(userId, {
      id: userId,
      color_theme:
        preferences.color_theme !== undefined
          ? preferences.color_theme
          : existing?.color_theme ?? null,
      theme_mode:
        preferences.theme_mode !== undefined
          ? preferences.theme_mode
          : existing?.theme_mode ?? null,
      library_view_mode:
        preferences.library_view_mode !== undefined
          ? preferences.library_view_mode
          : existing?.library_view_mode ?? "flat",
      updated_at: updatedAt,
    });
    return;
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        ...preferences,
        updated_at: updatedAt,
      },
      { onConflict: "id" }
    )
    .select("id, color_theme, theme_mode, library_view_mode, updated_at")
    .single();

  if (error) throw error;
  if (data) {
    await profilePreferencesRepo.upsertRemote(userId, {
      id: userId,
      color_theme: data.color_theme ?? null,
      theme_mode: data.theme_mode ?? null,
      library_view_mode: (data.library_view_mode as LibraryViewMode | null) ?? "flat",
      updated_at: data.updated_at ?? updatedAt,
    });
  }
};

export interface UserProfileTabData {
  books: import("@/types").Book[];
  posts: import("./social").Post[];
  clubs: import("./clubs").BookClub[];
}

export const fetchUserProfileTabData = async (
  userId: string
): Promise<UserProfileTabData> => {
  const { data: books } = await supabase
    .from("books")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: posts } = await supabase
    .from("posts")
    .select(
      `
      *,
      profiles:user_id (
        id,
        display_name,
        avatar_url
      ),
      books:book_id (
        id,
        title,
        author,
        cover_url
      )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: clubs } = await supabase
    .from("book_club_members")
    .select(
      `
      book_clubs (
        id,
        name,
        description,
        cover_image_url,
        is_private
      )
    `
    )
    .eq("user_id", userId);

  return {
    books: (books || []) as import("@/types").Book[],
    posts: (posts || []) as import("./social").Post[],
    clubs: (clubs?.map((club) => club.book_clubs).filter(Boolean) ||
      []) as import("./clubs").BookClub[],
  };
};
