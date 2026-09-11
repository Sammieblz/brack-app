import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Book, Goal } from "@/types";
import { todayDateOnly } from "@/lib/dateOnly";

interface DateFieldContract {
  id: string;
  label: string;
  value?: string | null;
  minDate?: string | null;
  maxDate?: string | null;
  required?: boolean;
  showToday?: boolean;
  disabled?: boolean;
  onChange: (value: string | null, date?: Date) => void;
  onValidityChange: (valid: boolean) => void;
}

const mocks = vi.hoisted(() => ({
  dateFields: new Map<string, DateFieldContract>(),
  fetchProfile: vi.fn(),
  upsertPersonalInfo: vi.fn(),
  fetchBookById: vi.fn(),
  updateBook: vi.fn(),
  createGoal: vi.fn(),
  toast: vi.fn(),
  goals: [] as Goal[],
}));

// The shared picker has its own interaction tests. This adapter exposes the
// boundary so these tests can prove real consumers never save stale committed
// values while the picker holds an invalid or incomplete text draft.
vi.mock("@/components/ui/date-picker", () => ({
  DatePicker: (props: DateFieldContract) => {
    mocks.dateFields.set(props.id, props);
    return <label htmlFor={props.id}>{props.label}<input id={props.id} disabled={props.disabled} value={props.value ?? ""} onChange={(event) => props.onChange(event.target.value || null)} /></label>;
  },
}));
vi.mock("@/services/api", () => ({
  fetchProfile: mocks.fetchProfile,
  upsertPersonalInfo: mocks.upsertPersonalInfo,
  fetchBookById: mocks.fetchBookById,
  uploadPublicStorageFile: vi.fn(),
}));
vi.mock("@/utils/offlineOperation", () => ({ bookOperations: { update: mocks.updateBook } }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "reader" } }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/useImagePicker", () => ({ useImagePicker: () => ({ pickWithPrompt: vi.fn() }) }));
vi.mock("@/hooks/useGoals", () => ({ useGoals: () => ({
  goals: mocks.goals, activeGoals: mocks.goals, loading: false, error: null,
  createGoal: mocks.createGoal, deleteGoal: vi.fn(), completeGoal: vi.fn(),
}) }));
vi.mock("@/components/MobileLayout", () => ({ MobileLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/MobileHeader", () => ({ MobileHeader: () => null }));
vi.mock("@/components/AppBackButton", () => ({ AppBackButton: () => null }));
vi.mock("@/components/TagManager", () => ({ TagManager: () => null }));
vi.mock("@/components/ImagePickerDialog", () => ({ ImagePickerDialog: () => null }));
vi.mock("@/components/empty/PremiumEmptyState", () => ({ PremiumEmptyState: () => null }));
vi.mock("@/components/animations/Confetti", () => ({ Confetti: () => null }));
vi.mock("@/components/animations/TrophyReveal", () => ({ TrophyReveal: () => null }));
vi.mock("@/lib/animations/gsap-presets", () => ({ countUp: vi.fn() }));
// Select interactions are unrelated to this regression. In particular, the
// existing EditBook empty-rating option is not under test here.
vi.mock("@/components/ui/select", () => {
  const Group = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Select: Group, SelectContent: Group, SelectItem: Group, SelectTrigger: Group, SelectValue: () => null };
});

import { PersonalInfo } from "./settings/PersonalInfo";
import { GoalManager } from "./GoalManager";
import EditBook from "@/screens/EditBook";
import { formatBookDate } from "./library/libraryBookUtils";

const book: Book = {
  id: "book", user_id: "reader", title: "Historical reading", author: "A Reader", isbn: null,
  genre: null, pages: 100, chapters: null, cover_url: null, description: null, status: "completed",
  tags: [], metadata: null, current_page: 100, date_started: "1999-02-05", date_finished: "1999-02-10",
  rating: 3, notes: null, source_provider: null, source_id: null, shelf_position: null,
  created_at: "2026-09-10T13:00:00Z", updated_at: "2026-09-10T13:00:00Z", deleted_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.dateFields.clear();
  mocks.goals = [];
  mocks.fetchProfile.mockResolvedValue({ id: "reader", date_of_birth: "1999-02-05" });
  mocks.upsertPersonalInfo.mockResolvedValue(undefined);
  mocks.fetchBookById.mockResolvedValue({ ...book });
  mocks.updateBook.mockResolvedValue(undefined);
  mocks.createGoal.mockResolvedValue({ id: "goal" });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("date-field context contracts", () => {
  it("keeps birthdays optional and historical, caps them at today, and cannot save an invalid draft", async () => {
    render(<PersonalInfo user={{ id: "reader" }} />);
    await screen.findByLabelText("Date of Birth");
    expect(mocks.dateFields.get("date_of_birth")).toMatchObject({ maxDate: todayDateOnly(), showToday: false });
    expect(mocks.dateFields.get("date_of_birth")?.minDate).toBeUndefined();
    act(() => mocks.dateFields.get("date_of_birth")!.onValidityChange(false));
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Use Current Location" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(mocks.upsertPersonalInfo).not.toHaveBeenCalled();

    act(() => mocks.dateFields.get("date_of_birth")!.onValidityChange(true));
    fireEvent.change(screen.getByLabelText("Date of Birth"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(mocks.upsertPersonalInfo).toHaveBeenCalledWith("reader", expect.objectContaining({ date_of_birth: null })));
  });

  it("locks the birth date and Save action throughout pending location autosave", async () => {
    const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, "geolocation");
    let resolvePosition: PositionCallback | undefined;
    let resolveSave: (() => void) | undefined;
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: (success: PositionCallback) => { resolvePosition = success; } },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ address: { city: "Brooklyn", country: "United States" } }) }));
    mocks.upsertPersonalInfo.mockImplementation(() => new Promise<void>((resolve) => { resolveSave = resolve; }));
    try {
      const user = userEvent.setup();
      render(<PersonalInfo user={{ id: "reader" }} />);
      const birthDate = await screen.findByLabelText("Date of Birth");
      await user.click(screen.getByRole("button", { name: "Use Current Location" }));
      expect(resolvePosition).toBeDefined();
      expect(birthDate).toBeDisabled();
      expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
      await user.type(birthDate, "02/");
      expect(birthDate).toHaveValue("1999-02-05");
      expect(mocks.upsertPersonalInfo).not.toHaveBeenCalled();

      act(() => resolvePosition!({
        coords: { latitude: 40.67, longitude: -73.94, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null, toJSON: () => ({ latitude: 40.67, longitude: -73.94 }) },
        timestamp: Date.now(),
        toJSON: () => ({ coords: { latitude: 40.67, longitude: -73.94 } }),
      }));
      await waitFor(() => expect(mocks.upsertPersonalInfo).toHaveBeenCalledExactlyOnceWith("reader", expect.objectContaining({ date_of_birth: "1999-02-05", city: "Brooklyn" })));
      expect(birthDate).toBeDisabled();
      expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
      await act(async () => resolveSave!());
      await waitFor(() => expect(birthDate).toBeEnabled());
      expect(screen.getByRole("button", { name: "Save Changes" })).toBeEnabled();
    } finally {
      if (originalGeolocation) Object.defineProperty(navigator, "geolocation", originalGeolocation);
      else Reflect.deleteProperty(navigator, "geolocation");
    }
  });

  it.each(["1999-02-05", "2099-02-05"])("allows inclusive goal periods in %s and saves the canonical callback value", async (day) => {
    render(<GoalManager userId="reader" />);
    fireEvent.click(screen.getByRole("button", { name: "Create Goal" }));
    const dialog = screen.getByRole("dialog", { name: "Create New Goal" });
    fireEvent.change(within(dialog).getByRole("spinbutton"), { target: { value: "12" } });
    act(() => {
      mocks.dateFields.get("goal-start-date")!.onChange(day, undefined);
      mocks.dateFields.get("goal-end-date")!.onChange(day, undefined);
    });
    expect(mocks.dateFields.get("goal-start-date")).toMatchObject({ value: day, maxDate: day, required: true, showToday: true });
    expect(mocks.dateFields.get("goal-end-date")).toMatchObject({ value: day, minDate: day, required: true, showToday: true });
    expect(mocks.dateFields.get("goal-end-date")?.maxDate).toBeUndefined();
    act(() => mocks.dateFields.get("goal-end-date")!.onValidityChange(false));
    expect(within(dialog).getByRole("button", { name: "Create Goal" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Create Goal" }));
    expect(mocks.createGoal).not.toHaveBeenCalled();
    act(() => mocks.dateFields.get("goal-end-date")!.onValidityChange(true));
    fireEvent.click(within(dialog).getByRole("button", { name: "Create Goal" }));
    await waitFor(() => expect(mocks.createGoal).toHaveBeenCalledWith(expect.objectContaining({ start_date: day, end_date: day })));
  });

  it("bounds historical book dates independently and preserves empty optional values as null", async () => {
    render(<MemoryRouter initialEntries={["/edit-book/book"]}><Routes><Route path="/edit-book/:id" element={<EditBook />} /><Route path="/book/:id" element={<p>Saved book</p>} /></Routes></MemoryRouter>);
    await screen.findByLabelText("Date Started");
    expect(mocks.dateFields.get("date_started")).toMatchObject({ maxDate: "1999-02-10", showToday: true });
    expect(mocks.dateFields.get("date_finished")).toMatchObject({ minDate: "1999-02-05", maxDate: todayDateOnly(), showToday: true });
    act(() => mocks.dateFields.get("date_started")!.onValidityChange(false));
    const save = screen.getByRole("button", { name: "Save Changes" });
    expect(save).toBeDisabled();
    // Even an Enter/programmatic submit cannot bypass pending picker validity.
    fireEvent.submit(save.closest("form")!);
    expect(mocks.updateBook).not.toHaveBeenCalled();
    act(() => mocks.dateFields.get("date_started")!.onValidityChange(true));
    fireEvent.change(screen.getByLabelText("Date Started"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Date Finished"), { target: { value: "" } });
    expect(mocks.dateFields.get("date_started")?.maxDate).toBe(todayDateOnly());
    fireEvent.click(save);
    await waitFor(() => expect(mocks.updateBook).toHaveBeenCalledWith("book", expect.objectContaining({ date_started: null, date_finished: null })));
  });
});

describe("stored library calendar dates", () => {
  it("retains a date even when the local timezone skipped that entire civil day", () => {
    const local = new Date(2011, 11, 30, 12);
    const expected = local.getDate() === 30
      ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(local)
      : "2011-12-30";
    expect(formatBookDate("2011-12-30")).toBe(expected);
  });
  it.each(["1999-02-05", "1999-02-05T00:30:00+14:00", "1999-02-05T23:30:00-12:00"])("keeps the lexical day of %s", (value) => {
    const expected = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(1999, 1, 5, 12));
    expect(formatBookDate(value)).toBe(expected);
  });
  it.each([null, "", "1999-02-29", "not a date"])("does not display a rolled over or invalid value %s", (value) => {
    expect(formatBookDate(value)).toBeNull();
  });
});
