import { useState, useEffect } from "react";
import {
  fetchUserProfileWithStats,
  type UserProfile,
  type UserStats,
} from "@/services/api";

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

        const data = await fetchUserProfileWithStats(userId);
        setProfile(data.profile);
        setStats(data.stats);
      } catch (err: unknown) {
        console.error("Error fetching user profile:", err);
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId]);

  return { profile, stats, loading, error };
};
