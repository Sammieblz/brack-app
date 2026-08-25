import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getOptionalCurrentAuthUserMock,
  getStatusMock,
  syncUserMock,
} = vi.hoisted(() => ({
  getOptionalCurrentAuthUserMock: vi.fn(),
  getStatusMock: vi.fn(),
  syncUserMock: vi.fn(),
}));

vi.mock("@/services/api/auth", () => ({
  getOptionalCurrentAuthUser: getOptionalCurrentAuthUserMock,
}));

vi.mock("@/services/sync/engine", () => ({
  readingCoreSync: {
    getStatus: getStatusMock,
    syncUser: syncUserMock,
  },
}));

vi.mock("@/services/platform", () => ({
  isDesktopRuntime: () => false,
  onDesktopForeground: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));

vi.mock("@capacitor/app", () => ({
  App: { addListener: vi.fn() },
}));

import { syncService } from "./syncService";

const emptyStatus = {
  userId: "user-1",
  pending: 0,
  failed: 0,
  syncing: 0,
};

describe("SyncService authentication lifecycle", () => {
  beforeEach(() => {
    getOptionalCurrentAuthUserMock.mockReset();
    getStatusMock.mockReset();
    syncUserMock.mockReset();
    getOptionalCurrentAuthUserMock.mockResolvedValue(null);
    getStatusMock.mockResolvedValue(emptyStatus);
    syncUserMock.mockResolvedValue(emptyStatus);
  });

  it("does not inspect or sync queues without an authenticated user", async () => {
    await syncService.manualSync();

    expect(getStatusMock).not.toHaveBeenCalled();
    expect(syncUserMock).not.toHaveBeenCalled();
  });

  it("uses one verified account identity for status and synchronization", async () => {
    getOptionalCurrentAuthUserMock.mockResolvedValue({ id: "user-1" });

    await syncService.manualSync();

    expect(getStatusMock).toHaveBeenCalledOnce();
    expect(getStatusMock).toHaveBeenCalledWith("user-1");
    expect(syncUserMock).toHaveBeenCalledOnce();
    expect(syncUserMock).toHaveBeenCalledWith("user-1");
  });

  it("does not spend the foreground cooldown on a signed-out no-op", async () => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    getOptionalCurrentAuthUserMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "user-1" });

    document.dispatchEvent(new Event("visibilitychange"));
    await vi.waitFor(() => expect(getOptionalCurrentAuthUserMock).toHaveBeenCalledTimes(1));
    document.dispatchEvent(new Event("visibilitychange"));

    await vi.waitFor(() => expect(syncUserMock).toHaveBeenCalledWith("user-1"));
  });
});
