import { supabase } from "@/integrations/supabase/client";
import { getCurrentAuthUser } from "./auth";

export interface BookClub {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  current_book_id?: string;
  cover_image_url?: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  member_count?: number;
  user_role?: string | null;
  current_book?: {
    id: string;
    title: string;
    author?: string | null;
    cover_url?: string | null;
  } | null;
}

export interface ClubMember {
  id: string;
  club_id: string;
  user_id: string;
  role: "admin" | "moderator" | "member";
  joined_at: string;
  user?: {
    id: string;
    display_name: string | null;
    avatar_url?: string | null;
  };
}

export interface ClubDiscussion {
  id: string;
  club_id: string;
  user_id: string;
  title?: string | null;
  content: string;
  parent_id?: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    display_name: string | null;
    avatar_url?: string | null;
  };
  replies?: ClubDiscussion[];
}

export interface CreateBookClubRequest {
  name: string;
  description?: string;
  is_private?: boolean;
}

export interface CreateClubDiscussionRequest {
  title?: string;
  content: string;
  parent_id?: string;
}

export const fetchBookClubs = async (): Promise<BookClub[]> => {
  const currentUser = await getCurrentAuthUser();
  const { data: clubsData, error: clubsError } = await supabase
    .from("book_clubs")
    .select("*")
    .order("created_at", { ascending: false });

  if (clubsError) throw clubsError;

  return Promise.all(
    (clubsData || []).map(async (club) => {
      const { count } = await supabase
        .from("book_club_members")
        .select("*", { count: "exact", head: true })
        .eq("club_id", club.id);

      let userRole = null;
      if (currentUser) {
        const { data: memberData } = await supabase
          .from("book_club_members")
          .select("role")
          .eq("club_id", club.id)
          .eq("user_id", currentUser.id)
          .single();

        userRole = memberData?.role ?? null;
      }

      let currentBook = null;
      if (club.current_book_id) {
        const { data: bookData } = await supabase
          .from("books")
          .select("id, title, author, cover_url")
          .eq("id", club.current_book_id)
          .single();

        currentBook = bookData;
      }

      return {
        ...club,
        description: club.description ?? undefined,
        current_book_id: club.current_book_id ?? undefined,
        cover_image_url: club.cover_image_url ?? undefined,
        member_count: count || 0,
        user_role: userRole,
        current_book: currentBook,
      };
    })
  );
};

export const createBookClub = async (
  clubData: CreateBookClubRequest
): Promise<BookClub> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("book_clubs")
    .insert({
      ...clubData,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as BookClub;
};

export const joinBookClub = async (clubId: string): Promise<void> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("book_club_members").insert({
    club_id: clubId,
    user_id: user.id,
    role: "member",
  });

  if (error) throw error;
};

export const leaveBookClub = async (clubId: string): Promise<void> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("book_club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", user.id);

  if (error) throw error;
};

export const updateBookClub = async (
  clubId: string,
  updates: Partial<BookClub>
): Promise<void> => {
  const { error } = await supabase
    .from("book_clubs")
    .update(updates)
    .eq("id", clubId);

  if (error) throw error;
};

export const deleteBookClub = async (clubId: string): Promise<void> => {
  const { error } = await supabase.from("book_clubs").delete().eq("id", clubId);
  if (error) throw error;
};

export const fetchBookClubDetails = async (
  clubId: string
): Promise<BookClub | null> => {
  const { data, error } = await supabase
    .from("book_clubs")
    .select("*")
    .eq("id", clubId)
    .single();

  if (error) throw error;

  if (!data.current_book_id) return data as BookClub;

  const { data: bookData } = await supabase
    .from("books")
    .select("id, title, author, cover_url")
    .eq("id", data.current_book_id)
    .single();

  return { ...data, current_book: bookData } as BookClub;
};

export const fetchBookClubMembers = async (
  clubId: string
): Promise<ClubMember[]> => {
  const { data, error } = await supabase
    .from("book_club_members")
    .select("*")
    .eq("club_id", clubId)
    .order("joined_at", { ascending: true });

  if (error) throw error;

  const userIds = data?.map((member) => member.user_id) || [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);

  const profileMap = new Map(profiles?.map((profile) => [profile.id, profile]) || []);

  return (data?.map((member) => ({
    ...member,
    role: member.role as "admin" | "moderator" | "member",
    user: profileMap.get(member.user_id),
  })) || []) as ClubMember[];
};

export const fetchClubDiscussions = async (
  clubId: string
): Promise<ClubDiscussion[]> => {
  const { data, error } = await supabase
    .from("book_club_discussions")
    .select("*")
    .eq("club_id", clubId)
    .is("parent_id", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const userIds = [...new Set(data?.map((discussion) => discussion.user_id) || [])];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);

  const profileMap = new Map(profiles?.map((profile) => [profile.id, profile]) || []);

  return Promise.all(
    (data || []).map(async (discussion) => {
      const { data: replies } = await supabase
        .from("book_club_discussions")
        .select("*")
        .eq("parent_id", discussion.id)
        .order("created_at", { ascending: true });

      const replyUserIds = [...new Set(replies?.map((reply) => reply.user_id) || [])];
      const { data: replyProfiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", replyUserIds);

      const replyProfileMap = new Map(
        replyProfiles?.map((profile) => [profile.id, profile]) || []
      );

      return {
        ...discussion,
        user: profileMap.get(discussion.user_id),
        replies:
          replies?.map((reply) => ({
            ...reply,
            user: replyProfileMap.get(reply.user_id),
          })) || [],
      } as ClubDiscussion;
    })
  );
};

export const createClubDiscussion = async (
  clubId: string,
  data: CreateClubDiscussionRequest
): Promise<void> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("book_club_discussions").insert({
    club_id: clubId,
    user_id: user.id,
    ...data,
  });

  if (error) throw error;
};

export const deleteClubDiscussion = async (
  discussionId: string
): Promise<void> => {
  const { error } = await supabase
    .from("book_club_discussions")
    .delete()
    .eq("id", discussionId);

  if (error) throw error;
};

export const subscribeToClubDiscussions = (
  clubId: string,
  onChange: () => void
): (() => void) => {
  const channel = supabase
    .channel(`discussions-${clubId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "book_club_discussions",
        filter: `club_id=eq.${clubId}`,
      },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
