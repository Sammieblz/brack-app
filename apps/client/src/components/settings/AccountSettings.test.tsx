import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/types";

const {
  fetchProfileMock,
  signInWithEmailPasswordMock,
  toastMock,
  updatePasswordMock,
} = vi.hoisted(() => ({
  fetchProfileMock: vi.fn(),
  signInWithEmailPasswordMock: vi.fn(),
  toastMock: vi.fn(),
  updatePasswordMock: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  fetchProfile: fetchProfileMock,
  signInWithEmailPassword: signInWithEmailPasswordMock,
  updatePassword: updatePasswordMock,
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
    signInWithEmailPasswordMock.mockReset();
    toastMock.mockReset();
    updatePasswordMock.mockReset();

    fetchProfileMock.mockResolvedValue(null);
    signInWithEmailPasswordMock.mockResolvedValue(undefined);
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
      screen.queryByLabelText("Current password"),
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
      await screen.findByLabelText("Current password"),
    ).toBeInTheDocument();
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

  it("reauthenticates and changes a linked password in the current context", async () => {
    render(<AccountSettings user={passwordUser} />);

    expect(
      screen.queryByRole("heading", { name: "Add a Brack password" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "CurrentPass1!" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "NewStrongPass2!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "NewStrongPass2!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(signInWithEmailPasswordMock).toHaveBeenCalledWith({
        email: "password@example.com",
        password: "CurrentPass1!",
      });
      expect(updatePasswordMock).toHaveBeenCalledWith("NewStrongPass2!");
    });
    expect(signInWithEmailPasswordMock.mock.invocationCallOrder[0]).toBeLessThan(
      updatePasswordMock.mock.invocationCallOrder[0],
    );
    expect(toastMock).toHaveBeenCalledWith({
      title: "Password updated",
      description: "Your new password is ready to use on this account.",
    });
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm new password")).toHaveValue("");
  });

  it("does not update when the current password cannot be verified", async () => {
    signInWithEmailPasswordMock.mockRejectedValue(new Error("Invalid login credentials"));
    render(<AccountSettings user={passwordUser} />);

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "WrongPass1!" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "NewStrongPass2!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "NewStrongPass2!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({
        variant: "destructive",
        title: "Current password not accepted",
        description:
          "Check your current password and try again. If you have forgotten it, use the reset option below.",
      });
    });
    expect(updatePasswordMock).not.toHaveBeenCalled();
  });

  it("offers forgotten-password recovery without sending mail from settings", () => {
    render(<AccountSettings user={passwordUser} />);

    expect(
      screen.getByRole("link", { name: "Forgot current password?" }),
    ).toHaveAttribute("href", "/auth?mode=reset");
    expect(signInWithEmailPasswordMock).not.toHaveBeenCalled();
    expect(updatePasswordMock).not.toHaveBeenCalled();
  });
});
