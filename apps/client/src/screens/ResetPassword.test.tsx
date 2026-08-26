import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  completeAuthCallbackMock,
  consumePasswordRecoveryAuthorizationMock,
  getAuthSessionMock,
  hasPasswordRecoveryAuthorizationMock,
  resolvePostAuthPathMock,
  toastMock,
  updatePasswordMock,
} = vi.hoisted(() => ({
  completeAuthCallbackMock: vi.fn(),
  consumePasswordRecoveryAuthorizationMock: vi.fn(),
  getAuthSessionMock: vi.fn(),
  hasPasswordRecoveryAuthorizationMock: vi.fn(),
  resolvePostAuthPathMock: vi.fn(),
  toastMock: vi.fn(),
  updatePasswordMock: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  getAuthSession: getAuthSessionMock,
  updatePassword: updatePasswordMock,
}));

vi.mock("@/services/authRedirect", () => ({
  completeAuthCallback: completeAuthCallbackMock,
  consumePasswordRecoveryAuthorization:
    consumePasswordRecoveryAuthorizationMock,
  hasPasswordRecoveryAuthorization: hasPasswordRecoveryAuthorizationMock,
  resolvePostAuthPath: resolvePostAuthPathMock,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/components/LoadingSpinner", () => ({
  default: () => <div>Opening reset link</div>,
}));

vi.mock("@/components/ThemeAwareLogo", () => ({
  ThemeAwareLogo: () => <div aria-label="Brack" />,
}));

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => null,
}));

vi.mock("@/components/animations/BrandedRouteTransition", () => ({
  BrandedRouteTransition: ({ to }: { to: string }) => (
    <div>Transition to {to}</div>
  ),
}));

import ResetPassword from "./ResetPassword";

const renderReset = () =>
  render(
    <MemoryRouter initialEntries={["/auth/reset-password"]}>
      <ResetPassword />
    </MemoryRouter>,
  );

describe("ResetPassword", () => {
  beforeEach(() => {
    completeAuthCallbackMock.mockReset();
    consumePasswordRecoveryAuthorizationMock.mockReset();
    getAuthSessionMock.mockReset();
    hasPasswordRecoveryAuthorizationMock.mockReset();
    resolvePostAuthPathMock.mockReset();
    toastMock.mockReset();
    updatePasswordMock.mockReset();

    completeAuthCallbackMock.mockResolvedValue("/auth/reset-password");
    consumePasswordRecoveryAuthorizationMock.mockReturnValue(true);
    getAuthSessionMock.mockResolvedValue({ user: { id: "recovery-user" } });
    hasPasswordRecoveryAuthorizationMock.mockReturnValue(true);
    resolvePostAuthPathMock.mockResolvedValue("/dashboard");
    updatePasswordMock.mockResolvedValue({ user: { id: "recovery-user" } });
    window.history.replaceState({}, "", "/auth/reset-password");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not let an ordinary signed-in session authorize a password reset", async () => {
    hasPasswordRecoveryAuthorizationMock.mockReturnValue(false);

    renderReset();

    expect(
      await screen.findByText(/password-reset authorization is invalid or has expired/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request New Code" })).toBeEnabled();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    expect(updatePasswordMock).not.toHaveBeenCalled();
  });

  it("removes reset credentials from the URL even when callback exchange fails", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/reset-password?code=secret-code#access_token=secret-token",
    );
    completeAuthCallbackMock.mockRejectedValue(new Error("expired reset link"));

    renderReset();

    expect(
      await screen.findByText(/password-reset authorization is invalid or has expired/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("expired reset link")).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/auth/reset-password");
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
    expect(getAuthSessionMock).not.toHaveBeenCalled();
  });

  it("consumes recovery authorization after updating and survives bootstrap failure", async () => {
    resolvePostAuthPathMock.mockRejectedValue(new Error("profile unavailable"));
    renderReset();

    await screen.findByRole("heading", { name: "Choose New Password" });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(await screen.findByText("Transition to /dashboard")).toBeInTheDocument();
    expect(updatePasswordMock).toHaveBeenCalledWith("StrongPass1!");
    expect(consumePasswordRecoveryAuthorizationMock).toHaveBeenCalledWith(
      "recovery-user",
    );
    expect(
      updatePasswordMock.mock.invocationCallOrder[0],
    ).toBeLessThan(
      consumePasswordRecoveryAuthorizationMock.mock.invocationCallOrder[0],
    );
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        title: "Password updated",
        description: "Your Brack password has been changed.",
      });
    });
  });
});
