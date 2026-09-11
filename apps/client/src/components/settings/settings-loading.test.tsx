vi.mock("@/services/api/client", () => ({ getApiErrorStatus: (error: { status?: number }) => error?.status ?? null }));
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchProfile: vi.fn(),
  fetchReadingProfile: vi.fn(),
  fetchNotificationPreferences: vi.fn(),
  getBlockedUsers: vi.fn(),
  maybeSingle: vi.fn(),
}));
vi.mock("@/services/api", () => ({
  fetchProfile: mocks.fetchProfile,
  fetchReadingProfile: mocks.fetchReadingProfile,
  fetchNotificationPreferences: mocks.fetchNotificationPreferences,
  getBlockedUsers: mocks.getBlockedUsers,
  DEFAULT_NOTIFICATION_PREFERENCES: {},
  removeStorageFiles: vi.fn(), updateProfileAvatar: vi.fn(), uploadPublicStorageFile: vi.fn(), upsertProfileBasics: vi.fn(),
  upsertPersonalInfo: vi.fn(), upsertReadingHabits: vi.fn(), saveNotificationPreferences: vi.fn(),
  unblockUser: vi.fn(), updatePresence: vi.fn(), updateGamificationSettings: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }) } }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@/hooks/useFollowing", () => ({ useFollowing: () => ({ followersCount: 0, followingCount: 0 }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/usePushNotifications", () => ({ usePushNotifications: () => ({ isRegistered: false, register: vi.fn(), unregister: vi.fn() }) }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
vi.mock("@/components/ImagePickerDialog", () => ({ ImagePickerDialog: () => null }));
vi.mock("@/components/ui/date-picker", () => ({ DatePicker: () => <div>Date of Birth</div> }));
vi.mock("@/components/CurrencyIcon", () => ({ CurrencyIcon: () => null }));
vi.mock("@/lib/dashboardQueries", () => ({ invalidateDashboardHomeQueries: vi.fn() }));

import { ProfileSettings } from "./ProfileSettings";
import { PersonalInfo } from "./PersonalInfo";
import { NotificationSettings } from "./NotificationSettings";
import { PrivacySettings } from "./PrivacySettings";
import { ReadingHabitsSection } from "@/components/ReadingHabitsSection";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const user = { id: "reader-1" };

describe("settings loading contracts", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("reserves the four profile cards without mounting editable controls", async () => {
    const request = deferred<Record<string, unknown>>();
    mocks.fetchProfile.mockReturnValueOnce(request.promise);
    const { container } = render(<MemoryRouter><ProfileSettings user={user} /></MemoryRouter>);
    expect(container.querySelector('[data-skeleton="profile-form"]')).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await act(async () => { request.resolve({ id: user.id, display_name: "A reader", bio: "I like books" }); });
    expect(await screen.findByLabelText("Display Name")).toHaveValue("A reader");
    expect(container.querySelector('[data-skeleton="profile-form"]')).toBeNull();
  });

  it("uses a retry state, not editable defaults, for a failed personal-info request", async () => {
    const request = deferred<null>();
    mocks.fetchProfile.mockReturnValueOnce(request.promise);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(<PersonalInfo user={user} />);
    expect(container.querySelector('[data-skeleton="personal-info"]')).toBeInTheDocument();
    await act(async () => { request.reject(new Error("offline")); });
    expect(screen.getByRole("alert")).toHaveTextContent("couldn't load your personal information");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(container.querySelector('[data-skeleton="personal-info"]')).toBeNull();
    log.mockRestore();
  });

  it("does not display a prior reader's form after an identity change", async () => {
    mocks.fetchProfile.mockResolvedValueOnce({ id: user.id, display_name: "First reader" });
    const { rerender } = render(<MemoryRouter><ProfileSettings user={user} /></MemoryRouter>);
    expect(await screen.findByLabelText("Display Name")).toHaveValue("First reader");
    const pending = deferred<Record<string, unknown>>();
    mocks.fetchProfile.mockReturnValueOnce(pending.promise);
    rerender(<MemoryRouter><ProfileSettings user={{ id: "reader-2" }} /></MemoryRouter>);
    expect(screen.queryByDisplayValue("First reader")).not.toBeInTheDocument();
    await act(async () => { pending.resolve({ id: "reader-2", display_name: "Second reader" }); });
    expect(await screen.findByLabelText("Display Name")).toHaveValue("Second reader");
  });

  it("keeps notification labels but does not expose unknown switches", async () => {
    const request = deferred<Record<string, unknown>>();
    mocks.fetchNotificationPreferences.mockReturnValueOnce(request.promise);
    render(<NotificationSettings user={user} />);
    expect(screen.getByText("Daily reminders to read")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    await act(async () => { request.resolve({ push_enabled: true }); });
    expect(screen.getAllByRole("switch")).toHaveLength(12);
    expect(screen.getByRole("button", { name: "Save Notification Preferences" })).toBeInTheDocument();
  });

  it("does not claim the blocked-reader list is empty before it loads", async () => {
    const request = deferred<never[]>();
    mocks.maybeSingle.mockResolvedValue({ data: {}, error: null });
    mocks.getBlockedUsers.mockReturnValueOnce(request.promise);
    render(<PrivacySettings user={user} />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByText("You have not blocked anyone.")).not.toBeInTheDocument();
    await act(async () => { request.resolve([]); });
    expect(screen.getByText("You have not blocked anyone.")).toBeInTheDocument();
    expect(screen.getAllByRole("switch")).toHaveLength(6);
  });

  it("keeps known empty reading habits during a cancel-triggered refresh", async () => {
    mocks.fetchReadingProfile.mockResolvedValueOnce({ habits: null });
    const { container } = render(<ReadingHabitsSection userId={user.id} />);
    await screen.findByText("No reading habits recorded yet");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const request = deferred<{ habits: null }>();
    mocks.fetchReadingProfile.mockReturnValueOnce(request.promise);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("No reading habits recorded yet")).toBeInTheDocument();
    expect(container.querySelector('[data-skeleton="reading-habits"]')).toBeNull();
    await act(async () => { request.resolve({ habits: null }); });
    await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull());
  });
});
