import { supabase } from "@/integrations/supabase/client";
import type { Badge, UserBadge } from "@/types";
import { invokeFunction } from "./client";

export type AwardedBadge = Badge & {
  earned_at?: string | null;
};

export interface AwardBadgesResponse {
  success: boolean;
  event?: string | null;
  awarded_badges: AwardedBadge[];
  awarded_count: number;
}

export const awardBadges = async (event?: string): Promise<AwardBadgesResponse> => {
  return invokeFunction<AwardBadgesResponse>("award-badges", {
    body: { event: event ?? null },
  });
};

export interface UserBadgesResult {
  badges: Badge[];
  earnedBadges: UserBadge[];
}

export const fetchUserBadges = async (
  userId: string
): Promise<UserBadgesResult> => {
  const [allBadgesRes, earnedBadgesRes] = await Promise.all([
    supabase.from("badges").select("*"),
    supabase.from("user_badges").select("*").eq("user_id", userId),
  ]);

  if (allBadgesRes.error) throw allBadgesRes.error;
  if (earnedBadgesRes.error) throw earnedBadgesRes.error;

  return {
    badges: allBadgesRes.data || [],
    earnedBadges: earnedBadgesRes.data || [],
  };
};
