import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OnboardingFormData } from "@/types";

const mocks = vi.hoisted(() => ({
  loadDraft: vi.fn(),
  saveDraft: vi.fn(),
  markReady: vi.fn(),
  clearDraft: vi.fn(),
  normalize: vi.fn(),
  saveProfile: vi.fn(),
  markInProgress: vi.fn(),
  skip: vi.fn(),
  previewTheme: vi.fn(),
  resetTheme: vi.fn(),
  setTheme: vi.fn(),
  toast: vi.fn(),
  refetch: vi.fn(),
  permissionPending: vi.fn(),
}));

// Keep persistence and authentication completely outside these interaction tests.
vi.mock("@/services/onboarding", () => ({
  ONBOARDING_STEPS: ["welcome", "palette", "taste", "pace", "goal", "review"],
  DEFAULT_ONBOARDING_FORM: {
    favoriteGenres: [], colorTheme: "default", slowestGenre: "", preferredBookLength: "",
    booksReadSixMonths: null, booksReadYear: null, averageDaysPerBook: null,
    preferredSessionMinutes: 20, preferredReadingTime: "", readingFrequency: "",
    motivation: "", preferredBookFormat: "", goalTargetBooks: 12,
    goalStartDate: null, goalEndDate: null, reminderEnabled: false, reminderTime: "19:00",
  },
  normalizeOnboardingFormData: mocks.normalize,
  getOnboardingErrorMessage: (_error: unknown, fallback: string) => fallback,
  markOnboardingInProgress: mocks.markInProgress,
  saveOnboardingProfile: mocks.saveProfile,
  skipOnboarding: mocks.skip,
}));
vi.mock("@/services/onboardingDraft", () => ({
  loadOnboardingDraft: mocks.loadDraft,
  saveOnboardingDraftCollection: mocks.saveDraft,
  markOnboardingDraftReady: mocks.markReady,
  clearOnboardingDraft: mocks.clearDraft,
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/hooks/useOnboardingStatus", () => ({
  useOnboardingStatus: () => ({ status: null, loading: false, refetch: mocks.refetch }),
}));
vi.mock("@/hooks/useReadingProfile", () => ({
  useReadingProfile: () => ({ habits: null, loading: false, refetch: mocks.refetch }),
}));
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    currentTheme: "default", resolvedTheme: "light", previewTheme: mocks.previewTheme,
    resetToDefaultTheme: mocks.resetTheme, setTheme: mocks.setTheme,
  }),
}));
vi.mock("@/services/postSignupPermissions", () => ({ markPostSignupPermissionsPending: mocks.permissionPending }));
vi.mock("@/services/platform", () => ({ isMobileNativeRuntime: () => false }));
vi.mock("@/components/ThemeAwareLogo", () => ({ ThemeAwareLogo: () => <span>Brack</span> }));
vi.mock("@/components/ThemePaletteCarousel", () => ({
  ThemePaletteCarousel: () => <div aria-label="Onboarding theme palette options">Palette preview</div>,
}));
vi.mock("@/components/onboarding/OnboardingLoadingState", () => ({
  OnboardingLoadingState: () => <p>Preparing onboarding</p>,
  OnboardingRouteTransition: ({ to }: { to: string }) => <output aria-label="Next route">{to}</output>,
}));
// The date/time picker components have their own interaction tests. Here these
// adapters exercise the screen's value propagation and validation boundaries.
vi.mock("@/components/ui/date-picker", () => ({
  DatePicker: ({ id, label, value, onChange }: {
    id: string; label: string; value: string | null; onChange: (value: string | null) => void;
  }) => (
    <label htmlFor={id}>{label}<input id={id} type="date" value={value ?? ""} onChange={(event) => onChange(event.target.value || null)} /></label>
  ),
}));
vi.mock("@/components/ui/time-picker", () => ({
  TimePicker: ({ id, label, value, onChange }: {
    id: string; label: string; value: string; onChange: (value: string) => void;
  }) => (
    <label htmlFor={id}>{label}<input id={id} type="time" value={value} onChange={(event) => onChange(event.target.value)} /></label>
  ),
}));

import Onboarding from "./Onboarding";
import { GENRES } from "@/constants";
import { DEFAULT_ONBOARDING_FORM } from "@/services/onboarding";

const chapter = (name: string) => screen.getByRole("region", { name: `${name} onboarding chapter` });
const goToChapter = (name: string) => fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}, chapter `) }));
const continueSignup = () => fireEvent.click(screen.getByRole("button", { name: /^Continue to sign up/ }));
const setGoalDates = (start: string, end: string) => {
  fireEvent.change(screen.getByLabelText("Start date"), { target: { value: start } });
  fireEvent.change(screen.getByLabelText("End date"), { target: { value: end } });
};

const renderOnboarding = async () => {
  render(<MemoryRouter initialEntries={["/onboarding"]}><Onboarding /></MemoryRouter>);
  await screen.findByRole("region", { name: /onboarding chapter$/ });
};

const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  mocks.loadDraft.mockReturnValue(null);
  mocks.markReady.mockImplementation((value) => ({ ...value, flowId: "unit-test-flow" }));
  mocks.normalize.mockImplementation((formData: OnboardingFormData) => ({ normalized: { ...formData } }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScrollIntoView);
  else delete HTMLElement.prototype.scrollIntoView;
});

describe("Onboarding substance and safe handoff", () => {
  it("keeps taste validation inline and caps the genre selection at twelve", async () => {
    await renderOnboarding();
    goToChapter("Taste");
    fireEvent.click(screen.getByRole("button", { name: "Find your rhythm" }));
    expect(chapter("Taste")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Choose at least one genre");
    expect(mocks.toast).not.toHaveBeenCalled();

    const genres = screen.getByRole("group", { name: "Favorite genres" });
    for (const genre of GENRES.slice(0, 12)) fireEvent.click(within(genres).getByRole("button", { name: genre }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(within(genres).getAllByRole("button", { pressed: true })).toHaveLength(12);
    fireEvent.click(screen.getByRole("button", { name: /^Show \d+ more$/ }));
    const thirteenth = within(genres).getByRole("button", { name: GENRES[12] });
    expect(thirteenth).toBeDisabled();
    fireEvent.click(thirteenth);
    expect(within(genres).getAllByRole("button", { pressed: true })).toHaveLength(12);
    expect(screen.getByText(/Deselect one to choose another/)).toBeInTheDocument();

    fireEvent.click(within(genres).getByRole("button", { name: GENRES[0] }));
    expect(thirteenth).toBeEnabled();
    fireEvent.click(thirteenth);
    fireEvent.click(screen.getByRole("button", { name: "Find your rhythm" }));
    expect(chapter("Pace")).toBeInTheDocument();
  });

  it.each(["4", "301", "12.5"])("preserves invalid session input %s rather than silently clamping it", async (value) => {
    await renderOnboarding();
    goToChapter("Pace");
    const input = screen.getByRole("spinbutton", { name: "Minutes per reading session" });
    fireEvent.change(input, { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Set your first goal" }));
    expect(chapter("Pace")).toBeInTheDocument();
    expect(input).toHaveValue(Number(value));
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Choose a whole number from 5 to 300 minutes, or leave it blank.");
    await waitFor(() => expect(input).toHaveFocus());
    expect(input.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "instant" });
    expect(mocks.normalize).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Set your first goal" }));
    expect(chapter("Goal")).toBeInTheDocument();
  });

  it("stays on the goal chapter with useful inline date-range validation", async () => {
    await renderOnboarding();
    goToChapter("Goal");
    setGoalDates("2027-12-31", "2027-01-01");
    fireEvent.click(screen.getByRole("button", { name: "Review your plan" }));
    expect(chapter("Goal")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Choose an end date on or after your start date.");
    expect(screen.getByLabelText("Start date")).toHaveValue("2027-12-31");
    expect(screen.getByLabelText("End date")).toHaveValue("2027-01-01");
    expect(mocks.normalize).not.toHaveBeenCalled();

    setGoalDates("2027-01-01", "2027-12-31");
    fireEvent.click(screen.getByRole("button", { name: "Review your plan" }));
    expect(chapter("Review")).toBeInTheDocument();
  });

  it("returns straight to review after editing and retains the selected answers", async () => {
    await renderOnboarding();
    goToChapter("Review");
    fireEvent.click(screen.getByRole("button", { name: "Edit pace" }));
    expect(chapter("Pace")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "30 minutes" }));
    fireEvent.click(screen.getByRole("button", { name: "Evening" }));
    fireEvent.click(screen.getByRole("button", { name: "A few times weekly" }));
    fireEvent.click(screen.getByRole("button", { name: "Print" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to review" }));
    expect(chapter("Review")).toBeInTheDocument();
    expect(screen.getByText("30 minutes in the evening, a few times a week.")).toBeInTheDocument();
    expect(screen.getByText("Print books")).toBeInTheDocument();
    expect(chapter("Review")).not.toHaveTextContent("few_weekly");
    fireEvent.click(screen.getByRole("button", { name: "Edit pace" }));
    expect(screen.getByRole("button", { name: "Evening" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("spinbutton", { name: "Minutes per reading session" })).toHaveValue(30);
  });

  it("checks the earliest missing chapter when completion is reached by direct navigation", async () => {
    await renderOnboarding();
    goToChapter("Pace");
    fireEvent.change(screen.getByLabelText("Minutes per reading session"), { target: { value: "301" } });
    goToChapter("Goal");
    setGoalDates("2027-12-31", "2027-01-01");
    goToChapter("Review");
    continueSignup();
    expect(chapter("Taste")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Choose at least one genre");

    fireEvent.click(within(screen.getByRole("group", { name: "Favorite genres" })).getByRole("button", { name: "Fantasy" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to review" }));
    continueSignup();
    expect(chapter("Pace")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a whole number from 5 to 300 minutes");
    fireEvent.click(screen.getByRole("button", { name: "20 minutes" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to review" }));
    continueSignup();
    expect(chapter("Goal")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Choose an end date on or after your start date.");
    expect(mocks.normalize).not.toHaveBeenCalled();
    expect(mocks.markReady).not.toHaveBeenCalled();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });

  it("walks all six chapters and hands off only the existing profile schema, never the practice activity", async () => {
    const storageWrite = vi.spyOn(Storage.prototype, "setItem");
    await renderOnboarding();
    expect(chapter("Welcome")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton", { name: "Page you reached" }), { target: { value: "47" } });
    fireEvent.click(screen.getByRole("button", { name: "Log practice pages" }));
    expect(screen.getByText("15 pages read.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Make Brack yours" }));
    expect(chapter("Palette")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Choose reading taste" }));
    expect(chapter("Taste")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "Favorite genres" })).getByRole("button", { name: "Fantasy" }));
    fireEvent.click(screen.getByRole("button", { name: /^Varied Depends on the book$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Find your rhythm" }));
    expect(chapter("Pace")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "30 minutes" }));
    fireEvent.click(screen.getByRole("button", { name: "Evening" }));
    fireEvent.click(screen.getByRole("button", { name: "A few times weekly" }));
    fireEvent.click(screen.getByRole("button", { name: "Ebook" }));
    fireEvent.change(screen.getByLabelText("What would you like reading to bring you? (optional)"), { target: { value: "A quieter evening" } });
    fireEvent.click(screen.getByRole("button", { name: "Set your first goal" }));
    expect(chapter("Goal")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton", { name: "Target books" }), { target: { value: "8" } });
    setGoalDates("2027-01-01", "2027-12-31");
    fireEvent.click(screen.getByRole("button", { name: "Review your plan" }));
    expect(chapter("Review")).toBeInTheDocument();
    expect(screen.getByText("Your reason to read: A quieter evening")).toBeInTheDocument();
    continueSignup();

    await waitFor(() => expect(screen.getByLabelText("Next route")).toHaveTextContent("/auth?mode=signup&from=onboarding"));
    const expectedForm: OnboardingFormData = {
      ...DEFAULT_ONBOARDING_FORM,
      favoriteGenres: ["Fantasy"], preferredBookLength: "varied", preferredSessionMinutes: 30,
      preferredReadingTime: "evening", readingFrequency: "few_weekly", preferredBookFormat: "ebook",
      motivation: "A quieter evening", goalTargetBooks: 8, goalStartDate: "2027-01-01", goalEndDate: "2027-12-31",
    };
    expect(mocks.normalize).toHaveBeenCalledExactlyOnceWith(expectedForm);
    expect(mocks.saveDraft).toHaveBeenLastCalledWith({ formData: expectedForm, lastStep: "review" });
    expect(mocks.markReady).toHaveBeenCalledExactlyOnceWith({ outcome: "completed", lastStep: "review" });
    expect(Object.keys(mocks.normalize.mock.calls[0][0]).sort()).toEqual(Object.keys(DEFAULT_ONBOARDING_FORM).sort());
    expect(mocks.saveProfile).not.toHaveBeenCalled();
    expect(mocks.markInProgress).not.toHaveBeenCalled();
    expect(mocks.skip).not.toHaveBeenCalled();
    expect(mocks.permissionPending).not.toHaveBeenCalled();
    expect(mocks.setTheme).not.toHaveBeenCalled();
    expect(storageWrite).not.toHaveBeenCalled();
  });

  it("allows guests to skip without genres or practice and preserves only the existing draft shape", async () => {
    await renderOnboarding();
    expect(screen.getByRole("button", { name: "Log practice pages" })).toBeEnabled();
    expect(screen.getByRole("spinbutton", { name: "Page you reached" })).toHaveValue(44);
    fireEvent.click(screen.getByRole("button", { name: /Skip to sign up/ }));
    await waitFor(() => expect(screen.getByLabelText("Next route")).toHaveTextContent("/auth?mode=signup&from=onboarding"));
    expect(mocks.markReady).toHaveBeenCalledExactlyOnceWith({ outcome: "skipped", lastStep: "welcome" });
    const handoff = mocks.saveDraft.mock.lastCall?.[0];
    expect(handoff.lastStep).toBe("welcome");
    expect(handoff.formData.favoriteGenres).toEqual([]);
    expect(Object.keys(handoff.formData).sort()).toEqual(Object.keys(DEFAULT_ONBOARDING_FORM).sort());
    expect(mocks.normalize).not.toHaveBeenCalled();
    expect(mocks.saveProfile).not.toHaveBeenCalled();
    expect(mocks.skip).not.toHaveBeenCalled();
  });
});
