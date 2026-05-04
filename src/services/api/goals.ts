import { supabase } from "@/integrations/supabase/client";

export interface Goal {
  id: string;
  user_id: string;
  target_books: number | null;
  target_pages: number | null;
  target_minutes: number | null;
  start_date: string | null;
  end_date: string | null;
  reminder_time: string | null;
  created_at: string;
  is_completed: boolean;
  goal_type: "books_count" | "pages_count" | "reading_time";
  period_type: "monthly" | "quarterly" | "yearly" | "custom";
  is_active: boolean;
  completed_at: string | null;
  updated_at: string | null;
}

export const fetchGoals = async (userId: string): Promise<Goal[]> => {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as Goal[]) || [];
};

export const fetchLatestGoal = async (userId: string): Promise<Goal | null> => {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;
  return (data as Goal | null) ?? null;
};

export const createGoal = async (
  userId: string,
  goal: Partial<Goal>
): Promise<Goal> => {
  const { data, error } = await supabase
    .from("goals")
    .insert({ user_id: userId, ...goal })
    .select()
    .single();

  if (error) throw error;
  return data as Goal;
};

export const updateGoal = async (
  goalId: string,
  updates: Partial<Goal>
): Promise<void> => {
  const { error } = await supabase
    .from("goals")
    .update(updates)
    .eq("id", goalId);

  if (error) throw error;
};

export const deleteGoal = async (goalId: string): Promise<void> => {
  const { error } = await supabase.from("goals").delete().eq("id", goalId);
  if (error) throw error;
};

export const completeGoal = async (goalId: string): Promise<void> => {
  const { error } = await supabase
    .from("goals")
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
      is_active: false,
    })
    .eq("id", goalId);

  if (error) throw error;
};
