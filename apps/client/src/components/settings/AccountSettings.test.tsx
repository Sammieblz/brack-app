import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/types";

const {
  fetchProfileMock,
  getPasswordResetRedirectUrlMock,
  sendPasswordResetEmailMock,
  toastMock,
  updatePasswordMock,
} = vi.hoisted(() => ({
  fetchProfileMock: vi.fn(),
  getPasswordResetRedirectUrlMock: vi.fn(),
  sendPasswordResetEmailMock: vi.fn(),
  toastMock: vi.fn(),
  updatePasswordMock: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  fetchProfile: fetchProfileMock,
  sendPasswordResetEmail: sendPasswordResetEmailMock,
  updatePassword: updatePasswordMock,
}));

vi.mock("@/services/platform", () => ({
  getPasswordResetRedirectUrl: getPasswordResetRedirectUrlMock,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

import { AccountSettings } from "./AccountSettings";

const googleOnlyUser: User = {
  id: "google-reader",
  email: "reader@example.com",
  app_metadata: {
    provider: "google",
    providers: ["google"],
  },
  identities: [{ provider: "google" }],
};

const passwordUser: User = {
  id: "password-reader",
  email: "password@example.com",
  app_metadata: {
    provider: "google",
    providers: ["google", "email"],
  },
  identities: [{ provider: "google" }, { provider: "email" }],
};

describe("AccountSettings password identities", () => {
  beforeEach(() => {
    fetchProfileMock.mockReset();
    getPasswordResetRedirectUrlMock.mockReset();
    sendPasswordResetEmailMock.mockReset();
    toastMock.mockReset();
    updatePasswordMock.mockReset();

    fetchProfileMock.mockResolvedValue(null);
    getPasswordResetRedirectUrlMock.mockReturnValue(
      "https://brack.app/auth/reset-password",
    );
    sendPasswordResetEmailMock.mockResolvedValue({});
    updatePasswordMock.mockResolvedValue({ user: googleOnlyUser });
  });

  it("adds password sign-in to the authenticated Google account", async () => {
    render(<AccountSettings user={googleOnlyUser} />);

    expect(
      screen.getByRole("heading", { name: "Add a Brack password" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not create another account or profile/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send Password Reset Email" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Add password to this account" }),
    );

    await waitFor(() => {
      expect(updatePasswordMock).toHaveBeenCalledWith("StrongPass1!");
    });
    expect(toastMock).toHaveBeenCalledWith({
      title: "Brack password added",
      description:
        "You can now sign in with Google or your email and password. Your account and profile stay the same.",
    });
    expect(
      await screen.findByRole("button", { name: "Send Password Reset Email" }),
    ).toBeEnabled();
  });

  it("validates a new password before changing the authenticated account", () => {
    render(<AccountSettings user={googleOnlyUser} />);

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "weak" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "weak" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Add password to this account" }),
    );

    expect(updatePasswordMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith({
      variant: "destructive",
      title: "Invalid password",
      description: "Password must be at least 8 characters",
    });
  });

  it("keeps the password reset path when Google and email identities are linked", async () => {
    render(<AccountSettings user={passwordUser} />);

    expect(
      screen.queryByRole("heading", { name: "Add a Brack password" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Send Password Reset Email" }),
    );

    await waitFor(() => {
      expect(sendPasswordResetEmailMock).toHaveBeenCalledWith(
        "password@example.com",
        "https://brack.app/auth/reset-password",
      );
    });
    expect(updatePasswordMock).not.toHaveBeenCalled();
  });
});
