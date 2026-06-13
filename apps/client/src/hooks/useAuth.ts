import { useState, useEffect } from "react";
import { getAuthSession, onAuthStateChange, signOut as signOutUser } from "@/services/api";
import type { User } from "@/types";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const session = await getAuthSession();
      setUser(session?.user || null);
      setLoading(false);
    };

    getSession();

    // Listen for auth changes
    const subscription = onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user || null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // Clear cached color theme so auth/landing pages show defaults
    localStorage.removeItem('color_theme');
    localStorage.removeItem('theme-mode');
    localStorage.removeItem('brack_public_theme_mode_touched');
    await signOutUser();
  };

  return {
    user,
    loading,
    signOut
  };
};
