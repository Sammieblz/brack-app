import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PickedImage } from "@/hooks/useImagePicker";
import { SettingsTaskProvider } from "@/contexts/SettingsTaskProvider";

const mocks = vi.hoisted(() => ({
  fetchProfile: vi.fn(), fetchReadingProfile: vi.fn(), upsertProfileBasics: vi.fn(), upsertPersonalInfo: vi.fn(), upsertReadingHabits: vi.fn(),
  updateProfileAvatar: vi.fn(), uploadPublicStorageFile: vi.fn(), removeStorageFiles: vi.fn(), toast: vi.fn(),
  native: false, checkPermissions: vi.fn(), requestPermissions: vi.fn(), getPosition: vi.fn(),
}));
vi.mock("@capacitor/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@capacitor/core")>();
  return { ...actual, Capacitor: { ...actual.Capacitor, isNativePlatform: () => mocks.native } };
});
vi.mock("@capacitor/geolocation", () => ({ Geolocation: {
  checkPermissions: mocks.checkPermissions, requestPermissions: mocks.requestPermissions, getCurrentPosition: mocks.getPosition,
} }));
vi.mock("@/services/api", () => mocks);
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/hooks/useFollowing", () => ({ useFollowing: () => ({ followersCount: 0, followingCount: 0 }) }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
// The real picker/native return lifecycle is covered by its own tests and the
// Settings browser fixture; this boundary controls the confirmed photo value.
vi.mock("@/components/ImagePickerDialog", () => ({ ImagePickerDialog: ({ open, onOpenChange, onImagePicked }: {
  open: boolean; onOpenChange: (open: boolean) => void; onImagePicked: (image: PickedImage) => void;
}) => open ? <button onClick={() => {
  onImagePicked({ dataUrl: "data:image/png;base64,Ym9vaw==", base64: "Ym9vaw==", format: "png" }); onOpenChange(false);
}}>Return selected photo</button> : null }));

import { ProfileSettings } from "./ProfileSettings";
import { PersonalInfo } from "./PersonalInfo";
import { ReadingHabitsSection } from "@/components/ReadingHabitsSection";

const user = { id: "reader" };
const oldAvatar = "https://example.test/storage/v1/object/public/avatars/reader/old.png";
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const position = { coords: { latitude: 40.67, longitude: -73.94, accuracy: 10 }, timestamp: 0 } as GeolocationPosition;
const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, "geolocation");
const withSettings = (node: React.ReactNode) => <MemoryRouter><SettingsTaskProvider>{node}</SettingsTaskProvider></MemoryRouter>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.native = false;
  mocks.checkPermissions.mockReset().mockResolvedValue({ location: "prompt" });
  mocks.requestPermissions.mockReset().mockResolvedValue({ location: "granted" });
  mocks.fetchProfile.mockReset().mockResolvedValue({ id: user.id, display_name: "Reader", bio: "My books", avatar_url: oldAvatar, first_name: "Sam", date_of_birth: "1999-02-05", city: "Previous city", country: "Country" });
  mocks.fetchReadingProfile.mockReset().mockResolvedValue({ habits: { user_id: user.id, motivation: "Learn", genres: ["Fiction"], books_1yr: 8 } });
  for (const mock of [mocks.upsertProfileBasics, mocks.upsertPersonalInfo, mocks.upsertReadingHabits, mocks.updateProfileAvatar, mocks.removeStorageFiles]) mock.mockReset().mockResolvedValue(undefined);
  mocks.uploadPublicStorageFile.mockReset().mockResolvedValue("https://example.test/new.png");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  if (originalGeolocation) Object.defineProperty(navigator, "geolocation", originalGeolocation);
  else Reflect.deleteProperty(navigator, "geolocation");
});

describe("Settings forms retain one current task", () => {
  it("does not reload or replace profile drafts for a same-reader auth object refresh", async () => {
    const view = render(withSettings(<ProfileSettings user={user} />));
    const name = await screen.findByRole("textbox", { name: "Display Name" });
    fireEvent.change(name, { target: { value: "Unsaved display name" } });
    view.rerender(withSettings(<ProfileSettings user={{ id: user.id, email: "updated@example.test" }} />));
    expect(name).toHaveValue("Unsaved display name");
    expect(mocks.fetchProfile).toHaveBeenCalledTimes(1);
  });

  it("serializes profile save, preserves rejection and saves without a destructive refresh", async () => {
    const save = deferred<void>();
    mocks.upsertProfileBasics.mockReturnValueOnce(save.promise);
    render(withSettings(<ProfileSettings user={user} />));
    const name = await screen.findByRole("textbox", { name: "Display Name" });
    fireEvent.change(name, { target: { value: "Edited name" } });
    const submit = screen.getByRole("button", { name: "Save Changes" });
    act(() => { fireEvent.click(submit); fireEvent.click(submit); });
    expect(mocks.upsertProfileBasics).toHaveBeenCalledTimes(1);
    expect(name).toBeDisabled();
    expect(screen.getByRole("button", { name: "Choose Photo" })).toBeDisabled();
    await act(async () => save.reject(new Error("Profile unavailable")));
    expect(await screen.findByRole("alert")).toHaveTextContent("Profile unavailable");
    expect(submit).toHaveAccessibleDescription("Profile unavailable");
    expect(name).toHaveValue("Edited name");
    fireEvent.click(submit);
    await waitFor(() => expect(submit).toBeEnabled());
    expect(mocks.fetchProfile).toHaveBeenCalledTimes(1);
    fireEvent.change(name, { target: { value: "A later draft" } });
    expect(name).toHaveValue("A later draft");
  });

  it("renders confirmed profile basics when the initial profile record was empty", async () => {
    mocks.fetchProfile.mockResolvedValueOnce(null);
    render(withSettings(<ProfileSettings user={user} />));
    const name = await screen.findByRole("textbox", { name: "Display Name" });
    fireEvent.change(name, { target: { value: "New profile name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByRole("heading", { name: "New profile name" })).toBeInTheDocument();
    expect(mocks.fetchProfile).toHaveBeenCalledTimes(1);
  });

  it("keeps the previous avatar and unrelated basics until profile URL commit, then cleans storage only after success", async () => {
    const update = deferred<void>();
    mocks.updateProfileAvatar.mockReturnValueOnce(update.promise);
    render(withSettings(<ProfileSettings user={user} />));
    const name = await screen.findByRole("textbox", { name: "Display Name" });
    fireEvent.change(name, { target: { value: "Unsaved basics" } });
    fireEvent.click(screen.getByRole("button", { name: "Choose Photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Return selected photo" }));
    await waitFor(() => expect(mocks.updateProfileAvatar).toHaveBeenCalledTimes(1));
    expect(mocks.removeStorageFiles).not.toHaveBeenCalled();
    expect(name).toBeDisabled();
    await act(async () => update.reject(new Error("Avatar update unavailable")));
    expect(await screen.findByRole("alert")).toHaveTextContent("Avatar update unavailable");
    expect(mocks.removeStorageFiles).not.toHaveBeenCalled();
    expect(name).toHaveValue("Unsaved basics");
    fireEvent.click(screen.getByRole("button", { name: "Retry photo upload" }));
    await waitFor(() => expect(mocks.removeStorageFiles).toHaveBeenCalledWith("avatars", ["reader/old.png"]));
    expect(mocks.uploadPublicStorageFile).toHaveBeenCalledTimes(1);
    expect(mocks.updateProfileAvatar).toHaveBeenCalledTimes(2);
    expect(mocks.fetchProfile).toHaveBeenCalledTimes(1);
    expect(name).toHaveValue("Unsaved basics");
    expect(screen.queryByRole("button", { name: "Retry photo upload" })).not.toBeInTheDocument();
  });

  it("does not delete old storage when avatar removal fails", async () => {
    mocks.updateProfileAvatar.mockRejectedValueOnce(new Error("Removal unavailable"));
    render(withSettings(<ProfileSettings user={user} />));
    fireEvent.click(await screen.findByRole("button", { name: "Remove profile photo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Removal unavailable");
    expect(mocks.removeStorageFiles).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Remove profile photo" })).toBeEnabled();
  });

  it("ignores an abandoned upload before any avatar update or cleanup", async () => {
    const upload = deferred<string>();
    mocks.uploadPublicStorageFile.mockReturnValueOnce(upload.promise);
    const view = render(withSettings(<ProfileSettings user={user} />));
    fireEvent.click(await screen.findByRole("button", { name: "Choose Photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Return selected photo" }));
    view.unmount();
    await act(async () => upload.resolve("https://example.test/new.png"));
    expect(mocks.updateProfileAvatar).not.toHaveBeenCalled();
    expect(mocks.removeStorageFiles).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("locks every personal field across location and autosave, preserving its submitted details", async () => {
    let resolvePosition!: PositionCallback;
    const getCurrentPosition = vi.fn((yes: PositionCallback) => { resolvePosition = yes; });
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ address: { city: "Brooklyn", country: "United States" } }) }));
    const save = deferred<void>();
    mocks.upsertPersonalInfo.mockReturnValueOnce(save.promise);
    render(withSettings(<PersonalInfo user={user} />));
    const firstName = await screen.findByRole("textbox", { name: "First Name" });
    fireEvent.change(firstName, { target: { value: "Typed before locating" } });
    const locate = screen.getByRole("button", { name: "Use Current Location" });
    act(() => { fireEvent.click(locate); fireEvent.click(locate); });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(firstName).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "City" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Date of Birth" })).toBeDisabled();
    act(() => resolvePosition(position));
    await waitFor(() => expect(mocks.upsertPersonalInfo).toHaveBeenCalledTimes(1));
    expect(mocks.upsertPersonalInfo).toHaveBeenCalledWith(user.id, expect.objectContaining({ first_name: "Typed before locating", city: "Brooklyn", latitude: 40.67 }));
    expect(firstName).toBeDisabled();
    await act(async () => save.resolve());
    expect(firstName).toBeEnabled();
    expect(firstName).toHaveValue("Typed before locating");
    expect(screen.getByRole("textbox", { name: "City" })).toHaveValue("Brooklyn");
    expect(mocks.fetchProfile).toHaveBeenCalledTimes(1);
  });

  it("ignores abandoned geolocation before geocode or autosave", async () => {
    let resolvePosition!: PositionCallback;
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (yes: PositionCallback) => { resolvePosition = yes; } } });
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const view = render(withSettings(<PersonalInfo user={user} />));
    fireEvent.click(await screen.findByRole("button", { name: "Use Current Location" }));
    view.unmount();
    await act(async () => resolvePosition(position));
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.upsertPersonalInfo).not.toHaveBeenCalled();
  });

  it("retains personal save rejection as an associated inline retry without refetching", async () => {
    mocks.upsertPersonalInfo.mockRejectedValueOnce(new Error("Personal save unavailable"));
    render(withSettings(<PersonalInfo user={user} />));
    const city = await screen.findByRole("textbox", { name: "City" });
    fireEvent.change(city, { target: { value: "My city draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Personal save unavailable");
    expect(screen.getByRole("button", { name: "Save Changes" })).toHaveAccessibleDescription("Personal save unavailable");
    expect(city).toHaveValue("My city draft");
    expect(city).not.toHaveAttribute("aria-invalid", "true");
    expect(mocks.fetchProfile).toHaveBeenCalledTimes(1);
  });

  it.each(["permission lookup", "permission prompt"])("does not advance an abandoned native location task after %s", async (stage) => {
    mocks.native = true;
    const permission = deferred<{ location: string }>();
    if (stage === "permission lookup") mocks.checkPermissions.mockReturnValueOnce(permission.promise);
    else mocks.requestPermissions.mockReturnValueOnce(permission.promise);
    const view = render(withSettings(<PersonalInfo user={user} />));
    fireEvent.click(await screen.findByRole("button", { name: "Use Current Location" }));
    await waitFor(() => expect(stage === "permission lookup" ? mocks.checkPermissions : mocks.requestPermissions).toHaveBeenCalledTimes(1));
    view.unmount();
    await act(async () => permission.resolve({ location: stage === "permission lookup" ? "prompt" : "granted" }));
    if (stage === "permission lookup") expect(mocks.requestPermissions).not.toHaveBeenCalled();
    expect(mocks.getPosition).not.toHaveBeenCalled();
    expect(mocks.upsertPersonalInfo).not.toHaveBeenCalled();
  });

  it("provides keyboard genre selection, named selects, pending Cancel protection and truthful retry", async () => {
    const save = deferred<void>();
    mocks.upsertReadingHabits.mockReturnValueOnce(save.promise);
    render(withSettings(<ReadingHabitsSection userId={user.id} />));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const mystery = screen.getByRole("button", { name: "Mystery" });
    mystery.focus(); await userEvent.keyboard(" ");
    expect(mystery).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("combobox", { name: "Which genre takes longest to read?" })).toBeInTheDocument();
    const motivation = screen.getByRole("textbox", { name: "Reading motivation" });
    fireEvent.change(motivation, { target: { value: "An edited motivation" } });
    const submit = screen.getByRole("button", { name: "Save" });
    act(() => { fireEvent.click(submit); fireEvent.click(submit); });
    expect(mocks.upsertReadingHabits).toHaveBeenCalledTimes(1);
    expect(motivation).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Preferred reading time" })).toBeDisabled();
    await act(async () => save.reject(new Error("Habits unavailable")));
    expect(await screen.findByRole("alert")).toHaveTextContent("Habits unavailable");
    expect(submit).toHaveAccessibleDescription("Habits unavailable");
    expect(motivation).toHaveValue("An edited motivation");
    fireEvent.click(submit);
    const edit = await screen.findByRole("button", { name: "Edit" });
    await waitFor(() => expect(edit).toHaveFocus());
    expect(mocks.fetchReadingProfile).toHaveBeenCalledTimes(1);
    expect(screen.getByText("An edited motivation")).toBeInTheDocument();
  });

  it("restores the saved habits baseline only after explicit discard, without a reload", async () => {
    render(withSettings(<ReadingHabitsSection userId={user.id} />));
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const motivation = screen.getByRole("textbox", { name: "Reading motivation" });
    fireEvent.change(motivation, { target: { value: "Keep this unsaved draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await act(async () => fireEvent.click(await screen.findByRole("button", { name: "Keep editing" })));
    expect(motivation).toHaveValue("Keep this unsaved draft");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard changes" }));
    const edit = await screen.findByRole("button", { name: "Edit" });
    await waitFor(() => expect(edit).toHaveFocus());
    fireEvent.click(edit);
    expect(screen.getByRole("textbox", { name: "Reading motivation" })).toHaveValue("Learn");
    expect(mocks.fetchReadingProfile).toHaveBeenCalledTimes(1);
  });

  it.each(["profile", "personal", "habits"])("ignores a late %s save result after account replacement", async (kind) => {
    const save = deferred<void>();
    const service = kind === "profile" ? mocks.upsertProfileBasics : kind === "personal" ? mocks.upsertPersonalInfo : mocks.upsertReadingHabits;
    service.mockReturnValueOnce(save.promise);
    const form = (readerId: string) => withSettings(kind === "profile" ? <ProfileSettings user={{ id: readerId }} />
      : kind === "personal" ? <PersonalInfo user={{ id: readerId }} /> : <ReadingHabitsSection userId={readerId} />);
    const view = render(form("reader"));
    if (kind === "habits") fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const fieldName = kind === "profile" ? "Display Name" : kind === "personal" ? "First Name" : "Reading motivation";
    fireEvent.change(await screen.findByRole("textbox", { name: fieldName }), { target: { value: "Old account submission" } });
    fireEvent.click(screen.getByRole("button", { name: kind === "habits" ? "Save" : "Save Changes" }));
    expect(service).toHaveBeenCalledTimes(1);
    view.rerender(form("next-reader"));
    if (kind === "habits") fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const nextField = await screen.findByRole("textbox", { name: fieldName });
    fireEvent.change(nextField, { target: { value: "Next account draft" } });
    await act(async () => save.resolve());
    expect(nextField).toHaveValue("Next account draft");
    expect(nextField).toBeEnabled();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
