import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { Json } from "@/integrations/supabase/types";
import {
  createOnboardingBookGoal,
  createOnboardingProfile,
  deactivateActiveBookCountGoals,
  fetchOnboardingStatusRecord,
  updateOnboardingCompleted,
  updateOnboardingInProgress,
  updateOnboardingSkipped,
  upsertOnboardingLearningProfile,
  upsertOnboardingNotificationPreferences,
  upsertOnboardingReadingHabits,
  type OnboardingStatusRecord,
} from "@/services/api/onboarding";
import type { OnboardingFormData, OnboardingStatus } from "@/types";

export const ONBOARDING_VERSION = 1;
const FIRST_RUN_ONBOARDING_CUTOFF_ISO = "2026-05-01T00:00:00.000Z";

export interface OnboardingAuthUser {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: unknown;
    name?: unknown;
    first_name?: unknown;
    last_name?: unknown;
    avatar_url?: unknown;
    picture?: unknown;
  } | null;
}

export const ONBOARDING_STEPS = [
  "welcome",
  "palette",
  "taste",
  "pace",
  "goal",
  "review",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

export const DEFAULT_ONBOARDING_FORM: OnboardingFormData = {
  favoriteGenres: [],
  colorTheme: "default",
  slowestGenre: "",
  preferredBookLength: "",
  booksReadSixMonths: null,
  booksReadYear: null,
  averageDaysPerBook: null,
  preferredSessionMinutes: 20,
  preferredReadingTime: "",
  readingFrequency: "",
  motivation: "",
  preferredBookFormat: "",
  goalTargetBooks: 12,
  goalStartDate: null,
  goalEndDate: null,
  reminderEnabled: false,
  reminderTime: "19:00",
};

export type { OnboardingStatusRecord };

export const isIncompleteOnboardingStatus = (status?: OnboardingStatus | null) =>
  status === "not_started" || status === "in_progress";

export const needsSetupPrompt = (status?: OnboardingStatus | null) =>
  status === "not_started" || status === "in_progress" || status === "skipped";

const getTime = (date: string | null | undefined) => {
  if (!date) return null;
  const time = new Date(date).getTime();
  return Number.isFinite(time) ? time : null;
};

export const isFirstRunOnboardingAccount = (
  user: OnboardingAuthUser | SupabaseUser,
  statusRecord?: OnboardingStatusRecord | null,
) => {
  const cutoff = getTime(FIRST_RUN_ONBOARDING_CUTOFF_ISO) ?? 0;
  const authCreatedAt = getTime("created_at" in user ? user.created_at : null);
  const profileCreatedAt = getTime(statusRecord?.profile_created_at);
  const createdAt = authCreatedAt ?? profileCreatedAt;

  return createdAt !== null && createdAt >= cutoff;
};

export const shouldEnterFirstRunOnboarding = (
  user: OnboardingAuthUser | SupabaseUser,
  statusRecord?: OnboardingStatusRecord | null,
) => {
  return (
    isIncompleteOnboardingStatus(statusRecord?.onboarding_status) &&
    isFirstRunOnboardingAccount(user, statusRecord)
  );
};

const todayDate = () => new Date().toISOString().split("T")[0];

const defaultGoalEndDate = () => {
  const date = new Date();
  date.setMonth(date.getMonth() + 12);
  return date.toISOString().split("T")[0];
};

const clampNumber = (value: number | null | undefined, min: number, max: number) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.min(max, Math.max(min, Math.round(value)));
};

export const getOnboardingErrorMessage = (
  error: unknown,
  fallback = "Unable to update onboarding.",
) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
};

export const isOnboardingBackendUnavailable = (error: unknown) => {
  if (typeof error !== "object" || error === null) return false;

  const { code, message } = error as { code?: unknown; message?: unknown };
  const errorCode = typeof code === "string" ? code : "";
  const errorMessage = typeof message === "string" ? message.toLowerCase() : "";

  return (
    errorCode === "PGRST204" ||
    errorCode === "PGRST205" ||
    errorCode === "42703" ||
    errorCode === "42P01" ||
    errorMessage.includes("schema cache") ||
    errorMessage.includes("could not find") ||
    errorMessage.includes("does not exist")
  );
};

const readMetadataString = (
  metadata: OnboardingAuthUser["user_metadata"],
  key: keyof NonNullable<OnboardingAuthUser["user_metadata"]>,
) => {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : null;
};

export const ensureUserProfile = async (user: OnboardingAuthUser | SupabaseUser) => {
  const existing = await fetchOnboardingStatusRecord(user.id);
  if (existing) {
    return existing;
  }

  const metadata = user.user_metadata ?? {};
  const firstName = readMetadataString(metadata, "first_name");
  const lastName = readMetadataString(metadata, "last_name");
  const fullName =
    readMetadataString(metadata, "full_name") ??
    readMetadataString(metadata, "name") ??
    ([firstName, lastName].filter(Boolean).join(" ") || user.email?.split("@")[0] || null);
  const avatarUrl =
    readMetadataString(metadata, "avatar_url") ??
    readMetadataString(metadata, "picture");

  const created = await createOnboardingProfile({
    id: user.id,
    display_name: fullName,
    avatar_url: avatarUrl,
    first_name: firstName,
    last_name: lastName,
    onboarding_status: "not_started",
    onboarding_version: ONBOARDING_VERSION,
  });

  if (!created) {
    const fallback = await getOnboardingStatus(user.id);
    if (fallback) return fallback;
    throw new Error("Unable to create onboarding profile.");
  }

  return created;
};

export const getOnboardingStatus = async (userId: string) => {
  return fetchOnboardingStatusRecord(userId);
};

export const markOnboardingInProgress = async (
  userId: string,
  lastStep: OnboardingStepId,
) => {
  await updateOnboardingInProgress(userId, lastStep);
};

export const skipOnboarding = async (
  userId: string,
  lastStep: OnboardingStepId = "welcome",
) => {
  const skippedAt = new Date().toISOString();

  await updateOnboardingSkipped(userId, ONBOARDING_VERSION, lastStep, skippedAt);

  try {
    await upsertOnboardingLearningProfile({
      user_id: userId,
      onboarding_answers: {
        skipped: true,
        skippedAt,
        lastStep,
      } as Json,
      derived_preferences: {
        setupConfidence: "low",
        shouldPromptForSetup: true,
      } as Json,
      signal_version: ONBOARDING_VERSION,
    });
  } catch (error) {
    console.warn("Skipped onboarding status was saved, but learning-profile metadata was not saved:", error);
  }
};

export const saveOnboardingProfile = async (
  userId: string,
  formData: OnboardingFormData,
) => {
  const favoriteGenres = formData.favoriteGenres.slice(0, 12);
  const goalTargetBooks = clampNumber(formData.goalTargetBooks, 1, 365);
  const averageDaysPerBook = clampNumber(formData.averageDaysPerBook, 1, 365);
  const avgLength = (() => {
    switch (formData.preferredBookLength) {
      case "short":
        return 180;
      case "medium":
        return 320;
      case "long":
        return 520;
      default:
        return null;
    }
  })();

  if (favoriteGenres.length === 0) {
    throw new Error("Choose at least one genre so Brack can personalize your experience.");
  }

  if (!goalTargetBooks) {
    throw new Error("Add a positive book target before completing onboarding.");
  }

  const normalized: OnboardingFormData = {
    ...formData,
    favoriteGenres,
    colorTheme: formData.colorTheme || "default",
    slowestGenre: formData.slowestGenre || "",
    booksReadSixMonths: clampNumber(formData.booksReadSixMonths, 0, 500),
    booksReadYear: clampNumber(formData.booksReadYear, 0, 1000),
    averageDaysPerBook,
    preferredSessionMinutes: clampNumber(formData.preferredSessionMinutes, 5, 300),
    motivation: formData.motivation.trim().slice(0, 240),
    goalTargetBooks,
    goalStartDate: formData.goalStartDate || todayDate(),
    goalEndDate: formData.goalEndDate || defaultGoalEndDate(),
    reminderTime: formData.reminderEnabled ? formData.reminderTime || "19:00" : null,
  };

  const derivedPreferences = {
    favoriteGenres,
    colorTheme: normalized.colorTheme,
    slowestGenre: normalized.slowestGenre || null,
    preferredBookLength: normalized.preferredBookLength || null,
    preferredSessionMinutes: normalized.preferredSessionMinutes,
    preferredReadingTime: normalized.preferredReadingTime || null,
    readingFrequency: normalized.readingFrequency || null,
    preferredBookFormat: normalized.preferredBookFormat || null,
    goalTargetBooks,
    estimatedMonthlyGoal: Math.max(1, Math.ceil(goalTargetBooks / 12)),
    setupConfidence: "high",
  };

  await upsertOnboardingReadingHabits({
    user_id: userId,
    avg_time_per_book: normalized.averageDaysPerBook,
    genres: favoriteGenres,
    avg_length: avgLength,
    books_6mo: normalized.booksReadSixMonths,
    books_1yr: normalized.booksReadYear,
    longest_genre: normalized.slowestGenre || null,
    preferred_session_minutes: normalized.preferredSessionMinutes,
    preferred_reading_time: normalized.preferredReadingTime || null,
    reading_frequency: normalized.readingFrequency || null,
    motivation: normalized.motivation || null,
    book_format: normalized.preferredBookFormat || null,
  });

  await deactivateActiveBookCountGoals(userId);

  await createOnboardingBookGoal({
    user_id: userId,
    target_books: goalTargetBooks,
    start_date: normalized.goalStartDate,
    end_date: normalized.goalEndDate,
    reminder_time: normalized.reminderTime,
    goal_type: "books_count",
    period_type: "yearly",
    is_active: true,
    is_completed: false,
  });

  await upsertOnboardingNotificationPreferences(userId, normalized.reminderEnabled);

  const completedAt = new Date().toISOString();

  await upsertOnboardingLearningProfile({
    user_id: userId,
    onboarding_answers: normalized as unknown as Json,
    derived_preferences: derivedPreferences as Json,
    signal_version: ONBOARDING_VERSION,
  });

  await updateOnboardingCompleted(userId, ONBOARDING_VERSION, completedAt);

  return {
    normalized,
    derivedPreferences,
  };
};
