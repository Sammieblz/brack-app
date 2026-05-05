import { supabase } from "@/integrations/supabase/client";
import { createLocalId, goalsRepo } from "@/services/local";
import { getCurrentAuthUser } from "./auth";

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
  const localGoals = await goalsRepo.list(userId);
  if (!navigator.onLine) return localGoals as Goal[];

  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  await goalsRepo.upsertRemoteMany(userId, (data as Goal[]) || []);
  return (data as Goal[]) || [];
};

export const fetchLatestGoal = async (userId: string): Promise<Goal | null> => {
  if (!navigator.onLine) {
    const goals = await goalsRepo.list(userId);
    return (goals[0] as Goal | undefined) ?? null;
  }

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
  if (!navigator.onLine) {
    const timestamp = new Date().toISOString();
    const localGoal = {
      id: goal.id || createLocalId(),
      user_id: userId,
      target_books: goal.target_books ?? null,
      target_pages: goal.target_pages ?? null,
      target_minutes: goal.target_minutes ?? null,
      start_date: goal.start_date ?? null,
      end_date: goal.end_date ?? null,
      reminder_time: goal.reminder_time ?? null,
      created_at: timestamp,
      is_completed: goal.is_completed ?? false,
      goal_type: goal.goal_type ?? "books_count",
      period_type: goal.period_type ?? "yearly",
      is_active: goal.is_active ?? true,
      completed_at: goal.completed_at ?? null,
      updated_at: timestamp,
    } as Goal;
    await goalsRepo.upsertLocal(userId, localGoal, "create");
    return localGoal;
  }

  const { data, error } = await supabase
    .from("goals")
    .insert({ user_id: userId, ...goal })
    .select()
    .single();

  if (error) throw error;
  await goalsRepo.upsertRemote(userId, data as Goal);
  return data as Goal;
};

export const updateGoal = async (
  goalId: string,
  updates: Partial<Goal>
): Promise<void> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");

  if (!navigator.onLine) {
    const existing = await goalsRepo.get(goalId);
    if (!existing) throw new Error("This goal is not available offline yet");
    await goalsRepo.upsertLocal(user.id, { ...existing, ...updates } as Goal, "update");
    return;
  }

  const { error } = await supabase
    .from("goals")
    .update(updates)
    .eq("id", goalId);

  if (error) throw error;
};

export const deleteGoal = async (goalId: string): Promise<void> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");

  if (!navigator.onLine) {
    const existing = await goalsRepo.get(goalId);
    if (!existing) throw new Error("This goal is not available offline yet");
    await goalsRepo.softDeleteLocal(user.id, existing);
    return;
  }

  const { error } = await supabase.from("goals").delete().eq("id", goalId);
  if (error) throw error;
  await goalsRepo.remove(goalId);
};

export const completeGoal = async (goalId: string): Promise<void> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");
  const updates = {
    is_completed: true,
    completed_at: new Date().toISOString(),
    is_active: false,
    updated_at: new Date().toISOString(),
  };

  if (!navigator.onLine) {
    const existing = await goalsRepo.get(goalId);
    if (!existing) throw new Error("This goal is not available offline yet");
    await goalsRepo.upsertLocal(user.id, { ...existing, ...updates } as Goal, "update");
    return;
  }

  const { error } = await supabase
    .from("goals")
    .update(updates)
    .eq("id", goalId);

  if (error) throw error;
};
