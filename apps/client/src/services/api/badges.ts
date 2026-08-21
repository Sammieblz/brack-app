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
  metrics: Record<string, number>;
}

export const fetchUserBadges = async (
  userId: string
): Promise<UserBadgesResult> => {
  const { data, error } = await supabase.rpc("get_user_badge_catalog", {
    p_user_id: userId,
  });
  if (error) throw error;
  const result = (data || {}) as {
    badges?: Badge[];
    earned_badges?: UserBadge[];
    metrics?: Record<string, number>;
  };

  return {
    badges: result.badges || [],
    earnedBadges: result.earned_badges || [],
    metrics: result.metrics || {},
  };
};
