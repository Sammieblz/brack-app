import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => true),
  getPlatform: vi.fn(() => "android"),
  isSupported: vi.fn(),
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  getToken: vi.fn(),
  deleteToken: vi.fn(),
  addListener: vi.fn(),
  areEnabled: vi.fn(),
  savePushToken: vi.fn(),
  deletePushToken: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: mocks.isNativePlatform,
    getPlatform: mocks.getPlatform,
  },
}));

vi.mock("@capacitor-firebase/messaging", () => ({
  FirebaseMessaging: {
    isSupported: mocks.isSupported,
    checkPermissions: mocks.checkPermissions,
    requestPermissions: mocks.requestPermissions,
    getToken: mocks.getToken,
    deleteToken: mocks.deleteToken,
    addListener: mocks.addListener,
  },
}));

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    areEnabled: mocks.areEnabled,
  },
}));

vi.mock("@/services/api", () => ({
  savePushToken: mocks.savePushToken,
  deletePushToken: mocks.deletePushToken,
}));

import { pushNotificationsService } from "./pushNotifications";

describe("pushNotificationsService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.getPlatform.mockReturnValue("android");
    mocks.isSupported.mockResolvedValue({ isSupported: true });
    mocks.checkPermissions.mockResolvedValue({ receive: "prompt" });
    mocks.requestPermissions.mockResolvedValue({ receive: "granted" });
    mocks.areEnabled.mockResolvedValue({ value: true });
    mocks.getToken.mockResolvedValue({ token: "fcm-device-token" });
    mocks.savePushToken.mockResolvedValue(undefined);
    mocks.deletePushToken.mockResolvedValue(undefined);
    mocks.deleteToken.mockResolvedValue(undefined);
  });

  it("does nothing outside a native runtime", async () => {
    mocks.isNativePlatform.mockReturnValue(false);

    await expect(pushNotificationsService.getPermissionState()).resolves.toBe(
      "unavailable",
    );
    await expect(pushNotificationsService.registerWithResult()).resolves.toEqual({
      status: "unavailable",
      token: null,
    });
    expect(mocks.requestPermissions).not.toHaveBeenCalled();
    expect(mocks.getToken).not.toHaveBeenCalled();
  });

  it("stops when the reader declines the OS prompt", async () => {
    mocks.requestPermissions.mockResolvedValue({ receive: "denied" });

    await expect(pushNotificationsService.registerWithResult()).resolves.toEqual({
      status: "denied",
      token: null,
    });
    expect(mocks.getToken).not.toHaveBeenCalled();
    expect(mocks.savePushToken).not.toHaveBeenCalled();
  });

  it("stores only a server-confirmed FCM registration", async () => {
    await expect(pushNotificationsService.registerWithResult()).resolves.toEqual({
      status: "registered",
      token: "fcm-device-token",
    });
    expect(mocks.savePushToken).toHaveBeenCalledWith({
      token: "fcm-device-token",
      platform: "android",
    });
    expect(localStorage.getItem("brack:native-push-token:v1")).toBe(
      "fcm-device-token",
    );
  });

  it("does not claim registration success when the database write fails", async () => {
    mocks.savePushToken.mockRejectedValue(new Error("offline"));

    await expect(pushNotificationsService.registerWithResult()).resolves.toEqual({
      status: "failed",
      token: null,
    });
    expect(localStorage.getItem("brack:native-push-token:v1")).toBeNull();
  });

  it("reports a blocked device setting even when the permission API says granted", async () => {
    mocks.checkPermissions.mockResolvedValue({ receive: "granted" });
    mocks.areEnabled.mockResolvedValue({ value: false });

    await expect(pushNotificationsService.getPermissionState()).resolves.toBe(
      "denied",
    );
  });

  it("coalesces concurrent registration attempts", async () => {
    let resolveToken!: (value: { token: string }) => void;
    mocks.getToken.mockReturnValue(
      new Promise((resolve) => {
        resolveToken = resolve;
      }),
    );

    const first = pushNotificationsService.registerWithResult();
    const second = pushNotificationsService.registerWithResult();
    resolveToken({ token: "shared-token" });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { status: "registered", token: "shared-token" },
      { status: "registered", token: "shared-token" },
    ]);
    expect(mocks.getToken).toHaveBeenCalledTimes(1);
    expect(mocks.savePushToken).toHaveBeenCalledTimes(1);
  });

  it("releases this installation before deleting its native token", async () => {
    const events: string[] = [];
    localStorage.setItem("brack:native-push-token:v1", "owned-token");
    mocks.deletePushToken.mockImplementation(async () => {
      events.push("database");
    });
    mocks.deleteToken.mockImplementation(async () => {
      events.push("native");
    });

    await pushNotificationsService.unregister();

    expect(mocks.deletePushToken).toHaveBeenCalledWith("owned-token");
    expect(events).toEqual(["database", "native"]);
    expect(localStorage.getItem("brack:native-push-token:v1")).toBeNull();
  });
});
