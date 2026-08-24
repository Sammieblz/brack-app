import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthApiError } from "@supabase/supabase-js";

const {
  getAuthSessionMock,
  resendSignUpEmailMock,
  sendPasswordResetEmailMock,
  signInWithEmailPasswordMock,
  signInWithOAuthMock,
  signUpWithEmailMock,
  toastMock,
} = vi.hoisted(() => ({
  getAuthSessionMock: vi.fn(),
  resendSignUpEmailMock: vi.fn(),
  sendPasswordResetEmailMock: vi.fn(),
  signInWithEmailPasswordMock: vi.fn(),
  signInWithOAuthMock: vi.fn(),
  signUpWithEmailMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  getAuthSession: getAuthSessionMock,
  onAuthStateChange: () => ({ unsubscribe: vi.fn() }),
  resendSignUpEmail: resendSignUpEmailMock,
  sendPasswordResetEmail: sendPasswordResetEmailMock,
  signInWithEmailPassword: signInWithEmailPasswordMock,
  signInWithOAuth: signInWithOAuthMock,
  signUpWithEmail: signUpWithEmailMock,
}));

vi.mock("@/services/authRedirect", () => ({
  resolvePostAuthPath: vi.fn().mockResolvedValue("/dashboard"),
}));

vi.mock("@/services/platform", () => ({
  getAuthRedirectUrl: () => "https://brack.app/auth/callback",
  getPasswordResetRedirectUrl: () =>
    "https://brack.app/auth/reset-password",
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ resetToDefaultTheme: vi.fn() }),
}));

vi.mock("@/components/ThemeAwareLogo", () => ({
  ThemeAwareLogo: () => <div aria-label="Brack" />,
}));

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => null,
}));

vi.mock("@/components/animations/BrandedRouteTransition", () => ({
  BrandedRouteTransition: () => <div>Opening Brack</div>,
}));

import Auth from "./Auth";

const renderAuth = (entry = "/auth?mode=signup") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Auth />
    </MemoryRouter>,
  );

const fillSignUpForm = async () => {
  await screen.findByRole("heading", { name: "Join BRACK" });
  fireEvent.change(screen.getByLabelText("First Name"), {
    target: { value: "Ada" },
  });
  fireEvent.change(screen.getByLabelText("Last Name"), {
    target: { value: "Reader" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "ada@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "StrongPass1!" },
  });
};

const enterConfirmationPending = async () => {
  signUpWithEmailMock.mockResolvedValue({
    kind: "confirmation_pending",
    email: "ada@example.com",
  });
  renderAuth();
  await fillSignUpForm();
  fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
  await screen.findByRole("heading", { name: "Check your sign-in options" });
};

describe("Auth email flows", () => {
  beforeEach(() => {
    getAuthSessionMock.mockReset();
    getAuthSessionMock.mockResolvedValue(null);
    resendSignUpEmailMock.mockReset();
    resendSignUpEmailMock.mockResolvedValue({});
    sendPasswordResetEmailMock.mockReset();
    sendPasswordResetEmailMock.mockResolvedValue({});
    signInWithEmailPasswordMock.mockReset();
    signInWithEmailPasswordMock.mockResolvedValue(undefined);
    signInWithOAuthMock.mockReset();
    signInWithOAuthMock.mockResolvedValue({});
    signUpWithEmailMock.mockReset();
    toastMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("single-flights rapid duplicate signup submissions", async () => {
    signUpWithEmailMock.mockImplementation(() => new Promise(() => undefined));
    renderAuth();
    await fillSignUpForm();
    const form = screen.getByRole("button", { name: "Create Account" }).closest("form");
    expect(form).not.toBeNull();

    fireEvent.submit(form!);
    fireEvent.submit(form!);

    expect(signUpWithEmailMock).toHaveBeenCalledOnce();
  });

  it("normalizes signup profile metadata before the Auth request", async () => {
    signUpWithEmailMock.mockResolvedValue({
      kind: "confirmation_pending",
      email: "ada@example.com",
    });
    renderAuth();
    await screen.findByRole("heading", { name: "Join BRACK" });
    fireEvent.change(screen.getByLabelText("First Name"), {
      target: { value: "  Ada " },
    });
    fireEvent.change(screen.getByLabelText("Last Name"), {
      target: { value: " Reader  " },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: " ada@example.com " },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "StrongPass1!" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(signUpWithEmailMock).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "StrongPass1!",
        redirectTo: "https://brack.app/auth/callback",
        metadata: {
          first_name: "Ada",
          last_name: "Reader",
          full_name: "Ada Reader",
        },
      });
    });
  });

  it("rejects whitespace-only profile names before calling Auth", async () => {
    renderAuth();
    await screen.findByRole("heading", { name: "Join BRACK" });
    fireEvent.change(screen.getByLabelText("First Name"), {
      target: { value: "   " },
    });
    fireEvent.change(screen.getByLabelText("Last Name"), {
      target: { value: "Reader" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "StrongPass1!" },
    });

    fireEvent.submit(screen.getByRole("button", { name: "Create Account" }).closest("form")!);

    expect(signUpWithEmailMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith({
      variant: "destructive",
      title: "Enter your name",
      description: "First and last name cannot be blank.",
    });
  });

  it("handles the signed-in signup outcome without showing pending email UI", async () => {
    signUpWithEmailMock.mockResolvedValue({ kind: "signed_in", session: {} });
    renderAuth();
    await fillSignUpForm();

    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect(await screen.findByText("Opening Brack")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Check your sign-in options" }),
    ).not.toBeInTheDocument();
  });

  it("rejects an existing email with a visible reader-facing error", async () => {
    signUpWithEmailMock.mockResolvedValue({
      kind: "email_exists",
      email: "ada@example.com",
    });
    renderAuth();
    await fillSignUpForm();

    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect(await screen.findByText("Email already exists")).toBeInTheDocument();
    expect(
      screen.getByText(/This email is already used by another reader/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(
      screen.queryByRole("heading", { name: "Check your sign-in options" }),
    ).not.toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledWith({
      variant: "destructive",
      title: "Email already exists",
      description:
        "This email is already used by another reader. Sign in instead, or continue with Google if you originally joined with Google.",
    });
  });

  it("keeps confirmation-pending copy neutral and offers every safe recovery path", async () => {
    await enterConfirmationPending();

    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(
      screen.getByText(/If a confirmation message can be delivered for/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not confirm that a new account was created/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/names and password entered in this request were ignored/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/we sent/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Resend available in 60s/i }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sign in instead" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reset password" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Use a different email" })).toBeEnabled();
    expect(toastMock).toHaveBeenCalledWith({
      title: "Account request received",
      description:
        "This does not mean a second account was created. Check your inbox, sign in, or use your original provider.",
    });
  });

  it("lets an existing Google reader return to the original identity safely", async () => {
    await enterConfirmationPending();

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        provider: "google",
        redirectTo: "https://brack.app/auth/callback",
      });
    });
  });

  it("moves from confirmation-pending state to neutral reset-password state", async () => {
    await enterConfirmationPending();

    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    expect(screen.getByRole("heading", { name: "Reset Password" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
    expect(
      screen.getByText(/If this address is connected to Brack, a reset link may arrive shortly/i),
    ).toBeInTheDocument();
  });

  it("uses conditional password-reset success messaging", async () => {
    renderAuth("/auth?mode=reset");
    await screen.findByRole("heading", { name: "Reset Password" });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Send Reset Link" }));

    await waitFor(() => {
      expect(sendPasswordResetEmailMock).toHaveBeenCalledOnce();
    });
    expect(toastMock).toHaveBeenCalledWith({
      title: "Reset request received",
      description:
        "If this address is connected to a Brack account, a reset link may arrive shortly.",
    });
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringMatching(/^We sent/i) }),
    );
  });

  it("uses conditional resend messaging after an accepted request", async () => {
    vi.useFakeTimers();
    signUpWithEmailMock.mockResolvedValue({
      kind: "confirmation_pending",
      email: "ada@example.com",
    });
    renderAuth();
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.change(screen.getByLabelText("First Name"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByLabelText("Last Name"), {
      target: { value: "Reader" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "StrongPass1!" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create Account" }));
      await Promise.resolve();
    });

    for (let second = 0; second < 60; second += 1) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Resend confirmation" }));
      await Promise.resolve();
    });

    expect(resendSignUpEmailMock).toHaveBeenCalledOnce();
    expect(toastMock).toHaveBeenLastCalledWith({
      title: "Confirmation request received",
      description:
        "If a confirmation message can be delivered for this address, use the newest Brack link that arrives.",
    });
  });

  it("blocks repeated email delivery attempts without inventing a recovery countdown", async () => {
    signUpWithEmailMock.mockRejectedValue(
      new AuthApiError(
        "429: email rate limit exceeded",
        429,
        "over_email_send_rate_limit",
      ),
    );
    renderAuth();
    await fillSignUpForm();

    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect(await screen.findByText("Email limit reached")).toBeInTheDocument();
    expect(screen.getByText(/try again later/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Try again in 60s/i })).not.toBeInTheDocument();
    const submit = screen.getByRole("button", {
      name: /Email unavailable.*try later/i,
    });
    expect(submit).toBeDisabled();

    fireEvent.click(submit);
    expect(signUpWithEmailMock).toHaveBeenCalledOnce();
  });

  it("offers confirmation recovery when sign-in reports an unconfirmed email", async () => {
    signInWithEmailPasswordMock.mockRejectedValue(
      new AuthApiError(
        "Email not confirmed",
        400,
        "email_not_confirmed",
      ),
    );
    renderAuth("/auth?mode=signin");
    await screen.findByRole("heading", { name: "Welcome Back" });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "StrongPass1!" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(
      await screen.findByRole("heading", { name: "Check your sign-in options" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Email confirmation needed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resend confirmation" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Sign in instead" })).toBeEnabled();
  });
});
