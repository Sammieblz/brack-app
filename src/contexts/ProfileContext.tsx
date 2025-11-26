import { createContext, useContext, ReactNode, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Profile } from "@/types";

interface ProfileContextValue {
  profile: Profile | null;
  isLoading: boolean;
  refetchProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

const fetchProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
};

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: profile,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => (user?.id ? fetchProfile(user.id) : null),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile: profile ?? null,
      isLoading,
      refetchProfile: async () => {
        await queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
        await refetch();
      },
    }),
    [profile, isLoading, refetch, queryClient, user?.id],
  );

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfileContext = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfileContext must be used within ProfileProvider");
  }
  return ctx;
};
