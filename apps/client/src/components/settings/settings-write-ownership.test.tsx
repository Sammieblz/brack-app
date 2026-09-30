import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/types";

const mocks = vi.hoisted(() => ({
  collect: vi.fn(), encrypt: vi.fn(), exportFile: vi.fn(), parse: vi.fn(), preview: vi.fn(), commit: vi.fn(),
  fetchProfile: vi.fn(), signIn: vi.fn(), password: vi.fn(), notificationRead: vi.fn(), notificationSave: vi.fn(),
  register: vi.fn(), unregister: vi.fn(), registered: true,
  privacyRead: vi.fn(), privacyWrite: vi.fn(), blocks: vi.fn(), unblock: vi.fn(), presence: vi.fn(), gamification: vi.fn(),
  toast: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), task: vi.fn(),
  preferences: {
    push_enabled: true, messages_enabled: true, followers_enabled: true, book_clubs_enabled: true,
    goals_enabled: true, streaks_enabled: true, reading_reminders_enabled: false, badges_enabled: true,
    quests_enabled: true, rank_movement_enabled: true, weekly_results_enabled: true, gold_leaves_enabled: true,
    quiet_hours_start: "22:00", quiet_hours_end: "07:00",
  },
}));
vi.mock("@/services/dataPortability", () => ({
  collectReadingBackup: mocks.collect, encryptBackup: mocks.encrypt, saveExportFile: mocks.exportFile,
  parseReadingImport: mocks.parse, previewReadingImport: mocks.preview, commitReadingImport: mocks.commit,
}));
vi.mock("@/services/api", () => ({
  fetchProfile: mocks.fetchProfile, signInWithEmailPassword: mocks.signIn, updatePassword: mocks.password,
  DEFAULT_NOTIFICATION_PREFERENCES: mocks.preferences, fetchNotificationPreferences: mocks.notificationRead,
  saveNotificationPreferences: mocks.notificationSave, getBlockedUsers: mocks.blocks, unblockUser: mocks.unblock,
  updatePresence: mocks.presence, updateGamificationSettings: mocks.gamification,
}));
vi.mock("@/services/api/client", () => ({ getApiErrorStatus: (error: { status?: number }) => error?.status ?? null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: mocks.privacyRead }) }),
    update: (value: unknown) => ({ eq: (_key: string, id: string) => mocks.privacyWrite(value, id) }),
  }),
} }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error, info: mocks.info } }));
vi.mock("@/hooks/usePushNotifications", () => ({ usePushNotifications: () => ({ isRegistered: mocks.registered, register: mocks.register, unregister: mocks.unregister, error: null }) }));
vi.mock("@/hooks/useHapticFeedback", () => ({ useHapticFeedback: () => ({ triggerHaptic: vi.fn() }) }));
vi.mock("@/components/CurrencyIcon", () => ({ CurrencyIcon: () => null }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@/lib/dashboardQueries", () => ({ invalidateDashboardHomeQueries: vi.fn() }));
// Route confirmation is exercised by the Settings integration/browser fixture.
// Here the spy observes each real form's dirty/pending registration contract.
vi.mock("@/contexts/SettingsTaskContext", () => ({ useSettingsTask: mocks.task, useSettingsLeave: () => async (action: () => void) => action() }));
vi.mock("@/components/auth/AuthTurnstile", async () => {
  const React = await import("react");
  const AuthTurnstile = React.forwardRef<{ reset: () => void }, { onTokenChange: (token: string | null) => void }>(
    ({ onTokenChange }, ref) => {
      React.useImperativeHandle(ref, () => ({ reset: () => onTokenChange("fixture-token") }), [onTokenChange]);
      React.useEffect(() => onTokenChange("fixture-token"), [onTokenChange]);
      return null;
    },
  );
  AuthTurnstile.displayName = "TestTurnstile";
  return { AuthTurnstile };
});

import { AccountSettings } from "./AccountSettings";
import { DataBackupSettings } from "./DataBackupSettings";
import { NotificationSettings } from "./NotificationSettings";
import { PrivacySettings } from "./PrivacySettings";

const user: User = { id: "reader", email: "reader@example.test", app_metadata: { providers: ["email"] } };
const parsed = { payload: { books: [{ title: "A book" }] }, sourceFormat: "csv" };
const preview = { import_id: "import", valid: 1, mergeable: 0, skipped: 0, invalid: 0, books: [] };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const task = () => mocks.task.mock.calls.at(-1)?.[0];
const attach = () => {
  const file = new File(["Title\nA book"], "books.csv", { type: "text/csv" });
  fireEvent.change(screen.getByLabelText("Import backup file"), { target: { files: [file] } });
  return file;
};
const writePassword = () => {
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "CurrentPass1!" } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewStrongPass2!" } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "NewStrongPass2!" } });
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.registered = true;
  mocks.fetchProfile.mockResolvedValue(null);
  mocks.notificationRead.mockResolvedValue({ ...mocks.preferences });
  mocks.notificationSave.mockResolvedValue(undefined);
  mocks.register.mockResolvedValue(undefined); mocks.unregister.mockResolvedValue(undefined);
  mocks.parse.mockResolvedValue(parsed); mocks.preview.mockResolvedValue(preview);
  mocks.commit.mockResolvedValue({ created: 1, merged: 0, failed: 0 });
  mocks.collect.mockResolvedValue({ csv: "Title\nA book", archive: new Uint8Array([1]) });
  mocks.encrypt.mockResolvedValue(new Uint8Array([2])); mocks.exportFile.mockResolvedValue(undefined);
  mocks.privacyRead.mockResolvedValue({ data: { profile_visibility: "public", show_online_status: false }, error: null });
  mocks.privacyWrite.mockResolvedValue({ error: null }); mocks.blocks.mockResolvedValue([]);
  mocks.presence.mockResolvedValue(undefined); mocks.password.mockResolvedValue({ user }); mocks.signIn.mockResolvedValue({ user });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Settings write ownership", () => {
  it("serializes import preview, locks its source and preserves preview/file on rejected commit", async () => {
    const read = deferred<typeof parsed>();
    mocks.parse.mockReturnValueOnce(read.promise);
    mocks.commit.mockRejectedValueOnce(new Error("Import unavailable"));
    render(<DataBackupSettings user={user} />);
    const file = attach();
    const button = screen.getByRole("button", { name: "Preview import" });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    expect(mocks.parse).toHaveBeenCalledExactlyOnceWith(file, undefined);
    expect(screen.getByLabelText("Import backup file")).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /Include owned/ })).toBeDisabled();
    expect(task()).toEqual({ dirty: true, pending: true });
    await act(async () => read.resolve(parsed));
    fireEvent.click(await screen.findByRole("button", { name: "Import 1 records" }));
    expect(await screen.findByText("Import unavailable")).toHaveAttribute("role", "alert");
    expect(screen.getByRole("heading", { name: "Import preview" })).toBeInTheDocument();
    expect(task()).toEqual({ dirty: true, pending: false });
    fireEvent.click(screen.getByRole("button", { name: "Import 1 records" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Import preview" })).not.toBeInTheDocument());
    expect(mocks.commit).toHaveBeenCalledTimes(2);
    expect(mocks.commit.mock.calls[1]).toEqual([user.id, parsed, preview]);
    expect(task()).toEqual({ dirty: false, pending: false });
  });

  it("retains the selected import file after parsing fails and allows retry", async () => {
    mocks.parse.mockRejectedValueOnce(new Error("Invalid backup"));
    render(<DataBackupSettings user={user} />);
    const file = attach();
    fireEvent.click(screen.getByRole("button", { name: "Preview import" }));
    expect(await screen.findByText("Invalid backup")).toHaveAttribute("role", "alert");
    expect(screen.getByRole("button", { name: "Preview import" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Preview import" }));
    await screen.findByRole("heading", { name: "Import preview" });
    expect(mocks.parse).toHaveBeenLastCalledWith(file, undefined);
  });

  it("does not preview a previous reader's file after account replacement", async () => {
    const read = deferred<typeof parsed>(); mocks.parse.mockReturnValueOnce(read.promise);
    const view = render(<DataBackupSettings user={user} />);
    attach(); fireEvent.click(screen.getByRole("button", { name: "Preview import" }));
    view.rerender(<DataBackupSettings user={{ id: "other-reader" }} />);
    await act(async () => read.resolve(parsed));
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Preview import" })).toBeDisabled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("does not invoke a download after export collection outlives its task", async () => {
    const collect = deferred<{ csv: string; archive: Uint8Array }>(); mocks.collect.mockReturnValueOnce(collect.promise);
    const view = render(<DataBackupSettings user={user} />);
    const exportButton = screen.getByRole("button", { name: "Export library CSV" });
    act(() => { fireEvent.click(exportButton); fireEvent.click(exportButton); });
    expect(mocks.collect).toHaveBeenCalledTimes(1);
    view.unmount();
    await act(async () => collect.resolve({ csv: "Private reading", archive: new Uint8Array() }));
    expect(mocks.exportFile).not.toHaveBeenCalled(); expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("retains quiet-hour drafts through same-reader refresh and failed save, then marks confirmed save clean", async () => {
    const save = deferred<void>(); mocks.notificationSave.mockReturnValueOnce(save.promise);
    const view = render(<NotificationSettings user={user} />);
    const start = await screen.findByLabelText("Start");
    fireEvent.change(start, { target: { value: "21:15" } });
    view.rerender(<NotificationSettings user={{ ...user }} />);
    expect(mocks.notificationRead).toHaveBeenCalledTimes(1);
    expect(start).toHaveValue("21:15");
    const button = screen.getByRole("button", { name: "Save Notification Preferences" });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    expect(mocks.notificationSave).toHaveBeenCalledTimes(1); expect(start).toBeDisabled();
    expect(task()).toEqual({ dirty: true, pending: true });
    await act(async () => save.reject(new Error("Offline")));
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to save notification preferences");
    expect(start).toHaveValue("21:15"); expect(task()).toEqual({ dirty: true, pending: false });
    fireEvent.click(button);
    await waitFor(() => expect(task()).toEqual({ dirty: false, pending: false }));
    expect(mocks.notificationSave).toHaveBeenLastCalledWith(user.id, expect.objectContaining({ quiet_hours_start: "21:15" }));
  });

  it("keeps confirmed notification preferences clean when subsequent device registration rejects", async () => {
    mocks.registered = false; mocks.register.mockRejectedValueOnce(new Error("Device unavailable"));
    render(<NotificationSettings user={user} />);
    fireEvent.change(await screen.findByLabelText("End"), { target: { value: "08:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Notification Preferences" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Preferences saved, but device notifications could not be updated.");
    expect(task()).toEqual({ dirty: false, pending: false });
    expect(screen.getByLabelText("End")).toHaveValue("08:00");
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Success" }));
  });

  it("does not register the previous reader's device after a late preference save", async () => {
    mocks.registered = false;
    const save = deferred<void>(); mocks.notificationSave.mockReturnValueOnce(save.promise);
    const view = render(<NotificationSettings user={user} />);
    await screen.findByLabelText("Start");
    fireEvent.click(screen.getByRole("button", { name: "Save Notification Preferences" }));
    view.rerender(<NotificationSettings user={{ ...user, id: "other-reader" }} />);
    await act(async () => save.resolve());
    expect(mocks.register).not.toHaveBeenCalled(); expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("locks an immediate device push change and retains its unsaved preference after completion", async () => {
    const device = deferred<void>(); mocks.unregister.mockReturnValueOnce(device.promise);
    render(<NotificationSettings user={user} />);
    const enabled = await screen.findByRole("switch", { name: "Push Notifications" });
    fireEvent.click(enabled);
    expect(enabled).toBeDisabled(); expect(task()).toEqual({ dirty: true, pending: true });
    await act(async () => device.resolve());
    expect(task()).toEqual({ dirty: true, pending: false });
    expect(enabled).toHaveAttribute("aria-checked", "false");
  });

  it("preserves password fields on same-reader identity refresh and serializes reauthentication and update", async () => {
    const reauth = deferred<unknown>(); const update = deferred<unknown>();
    mocks.signIn.mockReturnValueOnce(reauth.promise); mocks.password.mockReturnValueOnce(update.promise);
    const view = render(<AccountSettings user={user} />);
    writePassword(); view.rerender(<AccountSettings user={{ ...user }} />);
    expect(screen.getByLabelText("Current password")).toHaveValue("CurrentPass1!");
    const form = screen.getByLabelText("Current password").closest("form")!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(mocks.signIn).toHaveBeenCalledTimes(1); expect(screen.getByLabelText("New password")).toBeDisabled();
    await act(async () => reauth.resolve({ user }));
    expect(mocks.password).toHaveBeenCalledExactlyOnceWith("NewStrongPass2!");
    expect(screen.getByLabelText("New password")).toBeDisabled();
    await act(async () => update.reject(new Error("Update unavailable")));
    expect(screen.getByRole("alert")).toHaveTextContent("could not save the new one");
    expect(screen.getByLabelText("New password")).toHaveValue("NewStrongPass2!");
    expect(task()).toEqual({ dirty: true, pending: false });
  });

  it("does not update a password after reauthentication outlives its reader", async () => {
    const reauth = deferred<unknown>(); mocks.signIn.mockReturnValueOnce(reauth.promise);
    const view = render(<AccountSettings user={user} />); writePassword();
    fireEvent.submit(screen.getByLabelText("Current password").closest("form")!);
    view.rerender(<AccountSettings user={{ ...user, id: "other-reader" }} />);
    await act(async () => reauth.resolve({ user }));
    expect(mocks.password).not.toHaveBeenCalled(); expect(mocks.toast).not.toHaveBeenCalled();
    expect(screen.getByLabelText("New password")).toHaveValue("");
  });

  it("names privacy controls, serializes optimistic writes and restores a rejected preference", async () => {
    const write = deferred<{ error: Error | null }>(); mocks.privacyWrite.mockReturnValueOnce(write.promise);
    render(<MemoryRouter><PrivacySettings user={user} /></MemoryRouter>);
    const publicProfile = await screen.findByRole("switch", { name: "Public Profile" });
    for (const label of ["Show Reading Activity", "Show Location", "Join Reader Leagues", "Show Journey on Profile", "Show Online Status"]) expect(screen.getByRole("switch", { name: label })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Reader Status Badge" })).toBeInTheDocument();
    act(() => { fireEvent.click(publicProfile); fireEvent.click(publicProfile); });
    expect(mocks.privacyWrite).toHaveBeenCalledTimes(1); expect(publicProfile).toBeDisabled();
    expect(publicProfile).toHaveAttribute("aria-checked", "false");
    expect(task()).toEqual({ dirty: false, pending: true });
    await act(async () => write.resolve({ error: new Error("Offline") }));
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to update profile visibility");
    expect(publicProfile).toHaveAttribute("aria-checked", "true");
    expect(task()).toEqual({ dirty: false, pending: false });
  });

  it("does not roll back confirmed online visibility when presence refresh fails", async () => {
    mocks.presence.mockRejectedValueOnce(new Error("Presence offline"));
    render(<MemoryRouter><PrivacySettings user={user} /></MemoryRouter>);
    const online = await screen.findByRole("switch", { name: "Show Online Status" });
    fireEvent.click(online);
    expect(await screen.findByRole("alert")).toHaveTextContent("Online status preference saved");
    expect(online).toHaveAttribute("aria-checked", "true");
    expect(online).toBeEnabled();
    expect(mocks.privacyWrite).toHaveBeenCalledTimes(1);
  });

  it("suppresses obsolete privacy feedback and downstream presence after reader replacement", async () => {
    const write = deferred<{ error: Error | null }>(); mocks.privacyWrite.mockReturnValueOnce(write.promise);
    const view = render(<MemoryRouter><PrivacySettings user={user} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("switch", { name: "Show Online Status" }));
    view.rerender(<MemoryRouter><PrivacySettings user={{ ...user, id: "other-reader" }} /></MemoryRouter>);
    await act(async () => write.resolve({ error: null }));
    expect(mocks.presence).not.toHaveBeenCalled(); expect(mocks.success).not.toHaveBeenCalled(); expect(mocks.error).not.toHaveBeenCalled();
    expect(screen.getByRole("switch", { name: "Show Online Status" })).toHaveAttribute("aria-checked", "false");
  });
});
