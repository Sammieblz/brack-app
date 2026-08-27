import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "reader-1" } as { id: string } | null,
  authLoading: false,
  isNative: true,
  getPermissionState: vi.fn(),
  hasStoredRegistration: vi.fn(),
  registerWithResult: vi.fn(),
  complete: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user, loading: mocks.authLoading }),
}));

vi.mock("@/services/platform", () => ({
  isMobileNativeRuntime: () => mocks.isNative,
}));

vi.mock("@/services/pushNotifications", () => ({
  pushNotificationsService: {
    getPermissionState: mocks.getPermissionState,
    hasStoredRegistration: mocks.hasStoredRegistration,
    registerWithResult: mocks.registerWithResult,
  },
}));

vi.mock("@/services/postSignupPermissions", () => ({
  completePostSignupPermissions: mocks.complete,
}));

vi.mock("@/components/ThemeAwareLogo", () => ({
  ThemeAwareLogo: () => <div data-testid="logo" />,
}));

import PostSignupPermissions from "./PostSignupPermissions";

const renderScreen = () =>
  render(
    <MemoryRouter initialEntries={["/app-permissions"]}>
      <Routes>
        <Route path="/app-permissions" element={<PostSignupPermissions />} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/auth" element={<div>Sign in</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("PostSignupPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: "reader-1" };
    mocks.authLoading = false;
    mocks.isNative = true;
    mocks.getPermissionState.mockResolvedValue("prompt");
    mocks.hasStoredRegistration.mockReturnValue(false);
    mocks.registerWithResult.mockResolvedValue({
      status: "registered",
      token: "fcm-token",
    });
  });

  it("educates without opening an OS prompt on mount", async () => {
    renderScreen();

    expect(await screen.findByText("Choose what Brack may use")).toBeInTheDocument();
    expect(screen.getByText("Camera and photos")).toBeInTheDocument();
    expect(screen.getByText("Nearby reader area")).toBeInTheDocument();
    expect(mocks.registerWithResult).not.toHaveBeenCalled();
  });

  it("requests notifications only after the reader presses the action", async () => {
    mocks.getPermissionState
      .mockResolvedValueOnce("prompt")
      .mockResolvedValueOnce("granted");
    renderScreen();

    fireEvent.click(
      await screen.findByRole("button", { name: "Enable useful notifications" }),
    );

    await waitFor(() => {
      expect(mocks.registerWithResult).toHaveBeenCalledOnce();
      expect(
        screen.getByText("This device is connected for reading notifications"),
      ).toBeInTheDocument();
    });
  });

  it("shows registration failure separately from granted authorization", async () => {
    mocks.getPermissionState.mockResolvedValue("granted");
    mocks.registerWithResult.mockResolvedValue({ status: "failed", token: null });
    renderScreen();

    fireEvent.click(
      await screen.findByRole("button", { name: "Finish notification setup" }),
    );

    expect(
      await screen.findByText(/Access is allowed, but this device could not connect/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry notification setup" })).toBeInTheDocument();
  });

  it("marks the device choice complete when continuing without notifications", async () => {
    mocks.getPermissionState.mockResolvedValue("denied");
    renderScreen();

    fireEvent.click(
      await screen.findByRole("button", { name: "Continue without notifications" }),
    );

    expect(mocks.complete).toHaveBeenCalledWith("reader-1");
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });

  it("bypasses the native screen on web and desktop", async () => {
    mocks.isNative = false;
    renderScreen();

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(mocks.getPermissionState).not.toHaveBeenCalled();
  });
});
