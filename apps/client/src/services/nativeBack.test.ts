import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  platform: "android",
  addListener: vi.fn(),
  minimizeApp: vi.fn(),
  removeAllListeners: vi.fn(),
}));
vi.mock("@capacitor/app", () => ({ App: native }));
vi.mock("@/services/platform", () => ({ getRuntimePlatform: () => native.platform }));
import { minimizeNativeApp, subscribeNativeBack } from "./nativeBack";

const flush = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };

beforeEach(() => {
  vi.clearAllMocks();
  native.platform = "android";
  native.minimizeApp.mockResolvedValue(undefined);
});
afterEach(() => { vi.restoreAllMocks(); });

describe("native Back owner", () => {
  it.each(["web", "ios", "desktop"])("does not install Android behavior on %s", async platform => {
    native.platform = platform;
    const stop = subscribeNativeBack(vi.fn());
    minimizeNativeApp();
    stop();
    await flush();
    expect(native.addListener).not.toHaveBeenCalled();
    expect(native.minimizeApp).not.toHaveBeenCalled();
  });

  it("subscribes only to the plugin event and removes its own handle exactly once", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    native.addListener.mockResolvedValue({ remove });
    const onBack = vi.fn();
    const stop = subscribeNativeBack(onBack);
    await flush();
    expect(native.addListener).toHaveBeenCalledExactlyOnceWith("backButton", expect.any(Function));
    const listener = native.addListener.mock.calls[0][1];
    listener({ canGoBack: true });
    document.dispatchEvent(new Event("backbutton"));
    expect(onBack).toHaveBeenCalledTimes(1);
    stop();
    stop();
    listener({ canGoBack: false });
    await flush();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(native.removeAllListeners).not.toHaveBeenCalled();
  });

  it("removes a registration that resolves after unmount without dispatching stale events", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    let resolve!: (handle: { remove: typeof remove }) => void;
    native.addListener.mockImplementation(() => new Promise(done => { resolve = done; }));
    const onBack = vi.fn();
    const stop = subscribeNativeBack(onBack);
    await flush();
    stop();
    resolve({ remove });
    await flush();
    native.addListener.mock.calls[0][1]({ canGoBack: true });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
  });

  it("contains a rejected registration without removing unrelated plugin listeners", async () => {
    const error = new Error("unavailable");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    native.addListener.mockRejectedValue(error);
    const stop = subscribeNativeBack(vi.fn());
    await flush();
    stop();
    expect(log).toHaveBeenCalledWith("Could not register native Back", error);
    expect(native.removeAllListeners).not.toHaveBeenCalled();
  });

  it.each([false, true])("contains rejected handle cleanup (late registration: %s)", async late => {
    const error = new Error("bridge gone");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const remove = vi.fn().mockRejectedValue(error);
    native.addListener.mockResolvedValue({ remove });
    const stop = subscribeNativeBack(vi.fn());
    if (!late) await flush();
    stop();
    await flush();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("Could not remove native Back listener", error);
  });

  it("backgrounds Android and contains a failed native request", async () => {
    const error = new Error("activity unavailable");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    native.minimizeApp.mockRejectedValue(error);
    minimizeNativeApp();
    await flush();
    expect(native.minimizeApp).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("Could not background the app", error);
  });
});
