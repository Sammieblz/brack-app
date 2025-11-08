import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserSearchResult {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  current_streak: number;
  books_read_count?: number;
}

export const useUserSearch = (searchQuery: string = "") => {
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const searchUsers = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { user: currentUser } } = await supabase.auth.getUser();

        let query = supabase
          .from("profiles")
          .select("id, display_name, avatar_url, bio, current_streak")
          .eq("profile_visibility", "public")
          .neq("id", currentUser?.id || "");

        if (searchQuery.trim()) {
          query = query.ilike("display_name", `%${searchQuery}%`);
        }

        const { data: profilesData, error: profilesError } = await query
          .order("current_streak", { ascending: false })
          .limit(50);

        if (profilesError) throw profilesError;

        // Fetch books read count for each user
        const enrichedUsers = await Promise.all(
          (profilesData || []).map(async (profile) => {
            const { count } = await supabase
              .from("books")
              .select("*", { count: "exact", head: true })
              .eq("user_id", profile.id)
              .eq("status", "completed")
              .is("deleted_at", null);

            return {
              ...profile,
              books_read_count: count || 0,
            };
          })
        );

        setUsers(enrichedUsers);
      } catch (err: any) {
        console.error("Error searching users:", err);
        setError(err.message || "Failed to search users");
      } finally {
        setLoading(false);
      }
    };

    searchUsers();
  }, [searchQuery]);

  return { users, loading, error };
};
