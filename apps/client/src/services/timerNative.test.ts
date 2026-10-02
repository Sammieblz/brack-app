import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ isNative: vi.fn(), appListener: vi.fn(), notificationListener: vi.fn(),
  checkPermissions: vi.fn(), requestPermissions: vi.fn(), areEnabled: vi.fn(), registerActionTypes: vi.fn(),
  schedule: vi.fn(), cancel: vi.fn(), getDeliveredNotifications: vi.fn(), removeDeliveredNotifications: vi.fn() }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: native.isNative } }));
vi.mock("@capacitor/app", () => ({ App: { addListener: native.appListener } }));
vi.mock("@capacitor/local-notifications", () => ({ LocalNotifications: { addListener: native.notificationListener,
  checkPermissions: native.checkPermissions, requestPermissions: native.requestPermissions, areEnabled: native.areEnabled,
  registerActionTypes: native.registerActionTypes, schedule: native.schedule, cancel: native.cancel,
  getDeliveredNotifications: native.getDeliveredNotifications, removeDeliveredNotifications: native.removeDeliveredNotifications } }));
const snapshot = { isRunning: true, isVisible: true, elapsedSeconds: 60, bookId: "book", bookTitle: "A book", userId: "reader", clientSessionId: "session" };
beforeEach(() => {
  vi.resetModules(); Object.values(native).forEach(mock => mock.mockReset());
  native.isNative.mockReturnValue(true); native.areEnabled.mockResolvedValue({ value: true });
  native.checkPermissions.mockResolvedValue({ display: "granted" });
  native.requestPermissions.mockResolvedValue({ display: "granted" });
  native.registerActionTypes.mockResolvedValue(undefined); native.schedule.mockResolvedValue(undefined);
  native.cancel.mockResolvedValue(undefined); native.getDeliveredNotifications.mockResolvedValue({ notifications: [] });
  native.removeDeliveredNotifications.mockResolvedValue(undefined);
  native.appListener.mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) });
  native.notificationListener.mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) });
});
describe("timer native boundaries", () => {
  it("does not request native permission or schedule on the web", async () => {
    native.isNative.mockReturnValue(false);
    const { timerNativeService } = await import("./timerNative");
    expect(await timerNativeService.requestNotificationPermissions()).toBe(false);
    await timerNativeService.syncTimerNotification(snapshot);
    expect(native.checkPermissions).not.toHaveBeenCalled(); expect(native.schedule).not.toHaveBeenCalled();
  });
  it("registers an explicit finish action and includes the owned session identity", async () => {
    const { timerNativeService } = await import("./timerNative");
    await timerNativeService.syncTimerNotification(snapshot);
    expect(native.registerActionTypes).toHaveBeenCalledExactlyOnceWith({ types: [{ id: "TIMER_ACTION", actions: [{ id: "stop", title: "Finish reading", foreground: true }] }] });
    expect(native.schedule).toHaveBeenCalledWith(expect.objectContaining({ notifications: [expect.objectContaining({ extra: { bookId: "book", userId: "reader", clientSessionId: "session" } })] }));
  });
  it("ignores ordinary taps and unrelated/stale unowned notification payloads", async () => {
    const { timerNativeService } = await import("./timerNative");
    const callback = vi.fn(); timerNativeService.onTimerAction(callback);
    await vi.waitFor(() => expect(native.notificationListener).toHaveBeenCalled());
    const listener = native.notificationListener.mock.calls[0][1];
    listener({ actionId: "tap", notification: { id: 1, extra: { action: "stop", userId: "reader", clientSessionId: "session" } } });
    listener({ actionId: "stop", notification: { id: 2, extra: { userId: "reader", clientSessionId: "session" } } });
    listener({ actionId: "stop", notification: { id: 1, extra: { action: "stop" } } });
    expect(callback).not.toHaveBeenCalled();
    listener({ actionId: "stop", notification: { id: 1, extra: { userId: "reader", clientSessionId: "session" } } });
    expect(callback).toHaveBeenCalledExactlyOnceWith("stop", { userId: "reader", clientSessionId: "session" });
  });
  it("clears delivered timer notices while retaining unrelated notifications", async () => {
    native.getDeliveredNotifications.mockResolvedValue({ notifications: [{ id: 1, title: "Timer" }, { id: 2, title: "Other" }] });
    const { timerNativeService } = await import("./timerNative");
    await timerNativeService.clearTimerNotification();
    expect(native.cancel).toHaveBeenCalledWith({ notifications: [{ id: 1 }] });
    expect(native.removeDeliveredNotifications).toHaveBeenCalledExactlyOnceWith({ notifications: [{ id: 1, title: "Timer" }] });
  });
  it("does not schedule after a newer pause arrives during permission lookup", async () => {
    let release!: (value: { value: boolean }) => void;
    native.areEnabled.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const { timerNativeService } = await import("./timerNative");
    const running = timerNativeService.syncTimerNotification(snapshot);
    await vi.waitFor(() => expect(native.areEnabled).toHaveBeenCalled());
    const paused = timerNativeService.syncTimerNotification({ ...snapshot, isRunning: false });
    release({ value: true }); await Promise.all([running, paused]);
    expect(native.schedule).not.toHaveBeenCalled(); expect(native.cancel).toHaveBeenCalled();
  });
  it("clears after a schedule already in flight, leaving the final native state paused", async () => {
    let release!: () => void;
    native.schedule.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
    const { timerNativeService } = await import("./timerNative");
    const running = timerNativeService.syncTimerNotification(snapshot);
    await vi.waitFor(() => expect(native.schedule).toHaveBeenCalled());
    const paused = timerNativeService.syncTimerNotification({ ...snapshot, isRunning: false });
    release(); await Promise.all([running, paused]);
    expect(native.cancel.mock.invocationCallOrder[0]).toBeGreaterThan(native.schedule.mock.invocationCallOrder[0]);
  });
  it("removes a listener that resolves after cleanup and suppresses callbacks", async () => {
    let release!: (handle: { remove: () => Promise<void> }) => void;
    native.appListener.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const { timerNativeService } = await import("./timerNative");
    const callback = vi.fn(); const stop = timerNativeService.onAppStateChange(callback); stop();
    await vi.waitFor(() => expect(native.appListener).toHaveBeenCalled());
    native.appListener.mock.calls[0][1]({ isActive: true });
    const remove = vi.fn().mockResolvedValue(undefined); release({ remove });
    await vi.waitFor(() => expect(remove).toHaveBeenCalledOnce()); expect(callback).not.toHaveBeenCalled();
  });
  it("handles rejected native listener registration without unhandled work", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    native.appListener.mockRejectedValueOnce(new Error("Native bridge unavailable"));
    native.notificationListener.mockRejectedValueOnce(new Error("Native bridge unavailable"));
    const { timerNativeService } = await import("./timerNative");
    timerNativeService.onAppStateChange(vi.fn()); timerNativeService.onTimerAction(vi.fn());
    await vi.waitFor(() => expect(error).toHaveBeenCalledTimes(2)); error.mockRestore();
  });
  it("recovers the notification queue after a failed native schedule", async () => {
    native.schedule.mockRejectedValueOnce(new Error("Schedule failed"));
    const { timerNativeService } = await import("./timerNative");
    await expect(timerNativeService.syncTimerNotification(snapshot)).rejects.toThrow("Schedule failed");
    await timerNativeService.syncTimerNotification({ ...snapshot, isRunning: false });
    expect(native.cancel).toHaveBeenCalledOnce();
  });
});
