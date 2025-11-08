import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  profile_visibility: string;
  show_reading_activity: boolean;
  show_currently_reading: boolean;
  current_streak: number;
  longest_streak: number;
}

interface UserStats {
  totalBooks: number;
  booksRead: number;
  currentlyReading: number;
  badges: number;
}

export const useUserProfile = (userId: string | null) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats>({
    totalBooks: 0,
    booksRead: 0,
    currentlyReading: 0,
    badges: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (profileError) throw profileError;

        setProfile(profileData);

        // Fetch user stats if profile is visible
        if (profileData.profile_visibility === "public" || profileData.id === (await supabase.auth.getUser()).data.user?.id) {
          // Total books
          const { count: totalBooks } = await supabase
            .from("books")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .is("deleted_at", null);

          // Books read
          const { count: booksRead } = await supabase
            .from("books")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("status", "completed")
            .is("deleted_at", null);

          // Currently reading
          const { count: currentlyReading } = await supabase
            .from("books")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("status", "reading")
            .is("deleted_at", null);

          // Badges
          const { count: badges } = await supabase
            .from("user_badges")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);

          setStats({
            totalBooks: totalBooks || 0,
            booksRead: booksRead || 0,
            currentlyReading: currentlyReading || 0,
            badges: badges || 0,
          });
        }
      } catch (err: any) {
        console.error("Error fetching user profile:", err);
        setError(err.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId]);

  return { profile, stats, loading, error };
};
