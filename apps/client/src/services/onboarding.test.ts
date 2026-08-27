import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createOnboardingBookGoalMock,
  deactivateActiveBookCountGoalsMock,
  updateOnboardingCompletedMock,
  upsertOnboardingLearningProfileMock,
  upsertOnboardingNotificationPreferencesMock,
  upsertOnboardingReadingHabitsMock,
  upsertThemePreferencesMock,
} = vi.hoisted(() => ({
  createOnboardingBookGoalMock: vi.fn(),
  deactivateActiveBookCountGoalsMock: vi.fn(),
  updateOnboardingCompletedMock: vi.fn(),
  upsertOnboardingLearningProfileMock: vi.fn(),
  upsertOnboardingNotificationPreferencesMock: vi.fn(),
  upsertOnboardingReadingHabitsMock: vi.fn(),
  upsertThemePreferencesMock: vi.fn(),
}));

vi.mock("@/services/api/onboarding", () => ({
  createOnboardingBookGoal: createOnboardingBookGoalMock,
  createOnboardingProfile: vi.fn(),
  deactivateActiveBookCountGoals: deactivateActiveBookCountGoalsMock,
  fetchOnboardingStatusRecord: vi.fn(),
  updateOnboardingCompleted: updateOnboardingCompletedMock,
  updateOnboardingInProgress: vi.fn(),
  updateOnboardingSkipped: vi.fn(),
  upsertOnboardingLearningProfile: upsertOnboardingLearningProfileMock,
  upsertOnboardingNotificationPreferences:
    upsertOnboardingNotificationPreferencesMock,
  upsertOnboardingReadingHabits: upsertOnboardingReadingHabitsMock,
}));

vi.mock("@/services/api/profiles", () => ({
  upsertThemePreferences: upsertThemePreferencesMock,
}));

import {
  DEFAULT_ONBOARDING_FORM,
  saveOnboardingProfile,
} from "./onboarding";

describe("saveOnboardingProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createOnboardingBookGoalMock.mockResolvedValue(undefined);
    deactivateActiveBookCountGoalsMock.mockResolvedValue(undefined);
    updateOnboardingCompletedMock.mockResolvedValue(undefined);
    upsertOnboardingLearningProfileMock.mockResolvedValue(undefined);
    upsertOnboardingNotificationPreferencesMock.mockResolvedValue(undefined);
    upsertOnboardingReadingHabitsMock.mockResolvedValue(undefined);
    upsertThemePreferencesMock.mockResolvedValue(undefined);
  });

  it("uses one account-scoped goal row across restarted flow retries", async () => {
    const userId = "76000000-0000-0000-0000-000000000099";
    const formData = {
      ...DEFAULT_ONBOARDING_FORM,
      favoriteGenres: ["Fantasy"],
      colorTheme: "violet",
    };

    await saveOnboardingProfile(userId, formData, {
      goalId: "76000000-0000-0000-0000-000000000001",
    });
    await saveOnboardingProfile(userId, formData, {
      goalId: "76000000-0000-0000-0000-000000000002",
    });

    expect(createOnboardingBookGoalMock).toHaveBeenCalledTimes(2);
    expect(createOnboardingBookGoalMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: userId, user_id: userId }),
    );
    expect(createOnboardingBookGoalMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: userId, user_id: userId }),
    );
  });
});
