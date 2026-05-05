import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { OnboardingStatus, ReadingHabits } from "@/types";

export interface OnboardingStatusRecord {
  onboarding_status: OnboardingStatus;
  onboarding_version: number;
  onboarding_last_step: string | null;
  onboarding_completed_at: string | null;
  onboarding_skipped_at: string | null;
  profile_created_at: string | null;
}

export interface OnboardingProfilePayload {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  first_name: string | null;
  last_name: string | null;
  onboarding_status: OnboardingStatus;
  onboarding_version: number;
}

export interface OnboardingGoalPayload {
  user_id: string;
  target_books: number;
  start_date: string;
  end_date: string;
  reminder_time: string | null;
  goal_type: "books_count";
  period_type: "yearly";
  is_active: boolean;
  is_completed: boolean;
}

export interface LearningProfilePayload {
  user_id: string;
  onboarding_answers: Json;
  derived_preferences: Json;
  signal_version: number;
}

const onboardingStatusColumns =
  "onboarding_status,onboarding_version,onboarding_last_step,onboarding_completed_at,onboarding_skipped_at,created_at";

const normalizeStatus = (status: string | null | undefined): OnboardingStatus =>
  status === "in_progress" || status === "completed" || status === "skipped"
    ? status
    : "not_started";

const normalizeStatusRecord = (record: {
  onboarding_status: string | null;
  onboarding_version: number | null;
  onboarding_last_step: string | null;
  onboarding_completed_at: string | null;
  onboarding_skipped_at: string | null;
  created_at?: string | null;
}): OnboardingStatusRecord => ({
  onboarding_status: normalizeStatus(record.onboarding_status),
  onboarding_version: record.onboarding_version ?? 1,
  onboarding_last_step: record.onboarding_last_step,
  onboarding_completed_at: record.onboarding_completed_at,
  onboarding_skipped_at: record.onboarding_skipped_at,
  profile_created_at: record.created_at ?? null,
});

export const fetchOnboardingStatusRecord = async (
  userId: string,
): Promise<OnboardingStatusRecord | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select(onboardingStatusColumns)
    .eq("id", userId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;
  if (!data) return null;

  return normalizeStatusRecord(data);
};

export const createOnboardingProfile = async (
  payload: OnboardingProfilePayload,
): Promise<OnboardingStatusRecord | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id", ignoreDuplicates: true })
    .select(onboardingStatusColumns)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return normalizeStatusRecord(data);
};

export const updateOnboardingInProgress = async (
  userId: string,
  lastStep: string,
): Promise<void> => {
  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_status: "in_progress",
      onboarding_last_step: lastStep,
      onboarding_skipped_at: null,
    })
    .eq("id", userId)
    .in("onboarding_status", ["not_started", "in_progress"]);

  if (error) throw error;
};

export const updateOnboardingSkipped = async (
  userId: string,
  onboardingVersion: number,
  lastStep: string,
  skippedAt: string,
): Promise<void> => {
  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_status: "skipped",
      onboarding_version: onboardingVersion,
      onboarding_last_step: lastStep,
      onboarding_skipped_at: skippedAt,
      onboarding_completed_at: null,
    })
    .eq("id", userId);

  if (error) throw error;
};

export const updateOnboardingCompleted = async (
  userId: string,
  onboardingVersion: number,
  completedAt: string,
): Promise<void> => {
  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_status: "completed",
      onboarding_version: onboardingVersion,
      onboarding_last_step: "review",
      onboarding_completed_at: completedAt,
      onboarding_skipped_at: null,
    })
    .eq("id", userId);

  if (error) throw error;
};

export const upsertOnboardingLearningProfile = async (
  payload: LearningProfilePayload,
): Promise<void> => {
  const { error } = await supabase
    .from("user_learning_profiles")
    .upsert(payload, { onConflict: "user_id" });

  if (error) throw error;
};

export const upsertOnboardingReadingHabits = async (
  habits: Partial<ReadingHabits> & { user_id: string },
): Promise<void> => {
  const { error } = await supabase
    .from("reading_habits")
    .upsert(habits, { onConflict: "user_id" });

  if (error) throw error;
};

export const deactivateActiveBookCountGoals = async (
  userId: string,
): Promise<void> => {
  const { error } = await supabase
    .from("goals")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("goal_type", "books_count")
    .eq("is_active", true)
    .is("deleted_at", null);

  if (error) throw error;
};

export const createOnboardingBookGoal = async (
  payload: OnboardingGoalPayload,
): Promise<void> => {
  const { error } = await supabase.from("goals").insert(payload);

  if (error) throw error;
};

export const upsertOnboardingNotificationPreferences = async (
  userId: string,
  readingRemindersEnabled: boolean,
): Promise<void> => {
  const { error } = await supabase
    .from("notification_preferences")
    .upsert(
      {
        user_id: userId,
        reading_reminders_enabled: readingRemindersEnabled,
      },
      { onConflict: "user_id" },
    );

  if (error) throw error;
};
