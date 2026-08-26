import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthApiError } from "@supabase/supabase-js";

const {
  authorizePasswordRecoverySessionMock,
  getAuthSessionMock,
  resendSignUpEmailMock,
  resolvePostAuthPathMock,
  sendPasswordResetEmailMock,
  signInWithEmailPasswordMock,
  signInWithOAuthMock,
  signUpWithEmailMock,
  toastMock,
  verifyEmailOtpMock,
} = vi.hoisted(() => ({
  authorizePasswordRecoverySessionMock: vi.fn(),
  getAuthSessionMock: vi.fn(),
  resendSignUpEmailMock: vi.fn(),
  resolvePostAuthPathMock: vi.fn(),
  sendPasswordResetEmailMock: vi.fn(),
  signInWithEmailPasswordMock: vi.fn(),
  signInWithOAuthMock: vi.fn(),
  signUpWithEmailMock: vi.fn(),
  toastMock: vi.fn(),
  verifyEmailOtpMock: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  getAuthSession: getAuthSessionMock,
  onAuthStateChange: () => ({ unsubscribe: vi.fn() }),
  resendSignUpEmail: resendSignUpEmailMock,
  sendPasswordResetEmail: sendPasswordResetEmailMock,
  signInWithEmailPassword: signInWithEmailPasswordMock,
  signInWithOAuth: signInWithOAuthMock,
  signUpWithEmail: signUpWithEmailMock,
  verifyEmailOtp: verifyEmailOtpMock,
}));

vi.mock("@/services/authRedirect", () => ({
  authorizePasswordRecoverySession: authorizePasswordRecoverySessionMock,
  resolvePostAuthPath: resolvePostAuthPathMock,
}));

vi.mock("@/services/platform", () => ({
  getAuthRedirectUrl: () => "https://brack-app.com/auth/callback",
  getPasswordResetRedirectUrl: () =>
    "https://brack-app.com/auth/reset-password",
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ resetToDefaultTheme: vi.fn() }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, loading: false, signOut: vi.fn() }),
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
  await screen.findByRole("heading", { name: "Confirm in this window" });
};

describe("Auth email flows", () => {
  beforeEach(() => {
    authorizePasswordRecoverySessionMock.mockReset();
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
    resolvePostAuthPathMock.mockReset();
    resolvePostAuthPathMock.mockResolvedValue("/dashboard");
    toastMock.mockReset();
    verifyEmailOtpMock.mockReset();
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
        redirectTo: "https://brack-app.com/auth/callback",
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
      screen.queryByRole("heading", { name: "Confirm in this window" }),
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
      screen.queryByRole("heading", { name: "Confirm in this window" }),
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
      screen.getByText(/If a Brack message can be delivered for/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Six-digit email code")).toBeInTheDocument();
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
        "Check your inbox and enter the six-digit confirmation code here. You can also use the email link as a fallback.",
    });
  });

  it("confirms signup in the requesting window with the emailed OTP", async () => {
    verifyEmailOtpMock.mockResolvedValue({
      user: { id: "signup-reader" },
      session: { user: { id: "signup-reader" } },
    });
    await enterConfirmationPending();

    fireEvent.change(screen.getByLabelText("Six-digit email code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm and continue" }));

    await waitFor(() => {
      expect(verifyEmailOtpMock).toHaveBeenCalledWith({
        email: "ada@example.com",
        token: "123456",
        type: "signup",
      });
    });
    expect(authorizePasswordRecoverySessionMock).not.toHaveBeenCalled();
    expect(await screen.findByText("Opening Brack")).toBeInTheDocument();
  });

  it("lets an existing Google reader return to the original identity safely", async () => {
    await enterConfirmationPending();

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        provider: "google",
        redirectTo: "https://brack-app.com/auth/callback",
      });
    });
  });

  it("moves from confirmation-pending state to neutral reset-password state", async () => {
    await enterConfirmationPending();

    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    expect(screen.getByRole("heading", { name: "Reset Password" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
    expect(
      screen.getByText(/the email includes a six-digit code so you can remain in this window/i),
    ).toBeInTheDocument();
  });

  it("uses conditional password-reset success messaging", async () => {
    renderAuth("/auth?mode=reset");
    await screen.findByRole("heading", { name: "Reset Password" });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Send Reset Code" }));

    await waitFor(() => {
      expect(sendPasswordResetEmailMock).toHaveBeenCalledOnce();
    });
    expect(toastMock).toHaveBeenCalledWith({
      title: "Reset request received",
      description:
        "If this address is connected to Brack, enter the six-digit code from the newest email here.",
    });
    expect(
      screen.getByRole("heading", { name: "Enter your reset code" }),
    ).toBeInTheDocument();
    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringMatching(/^We sent/i) }),
    );
  });

  it("authorizes a password reset from an OTP in the requesting window", async () => {
    verifyEmailOtpMock.mockResolvedValue({
      user: { id: "recovery-reader" },
      session: { user: { id: "recovery-reader" } },
    });
    renderAuth("/auth?mode=reset");
    await screen.findByRole("heading", { name: "Reset Password" });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Reset Code" }));
    await screen.findByRole("heading", { name: "Enter your reset code" });

    fireEvent.change(screen.getByLabelText("Six-digit email code"), {
      target: { value: "654321" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Continue password reset" }),
    );

    await waitFor(() => {
      expect(verifyEmailOtpMock).toHaveBeenCalledWith({
        email: "ada@example.com",
        token: "654321",
        type: "recovery",
      });
      expect(authorizePasswordRecoverySessionMock).toHaveBeenCalledWith(
        "recovery-reader",
      );
    });
    expect(await screen.findByText("Opening Brack")).toBeInTheDocument();
  });

  it("keeps an incomplete email code local and out of Supabase", async () => {
    await enterConfirmationPending();

    fireEvent.change(screen.getByLabelText("Six-digit email code"), {
      target: { value: "12345" },
    });

    expect(
      screen.getByRole("button", { name: "Confirm and continue" }),
    ).toBeDisabled();
    expect(verifyEmailOtpMock).not.toHaveBeenCalled();
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
      fireEvent.click(screen.getByRole("button", { name: "Resend confirmation code" }));
      await Promise.resolve();
    });

    expect(resendSignUpEmailMock).toHaveBeenCalledOnce();
    expect(toastMock).toHaveBeenLastCalledWith({
      title: "Confirmation request received",
      description:
        "If a message can be delivered for this address, use the newest six-digit code that arrives.",
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
      await screen.findByRole("heading", { name: "Confirm in this window" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Email confirmation needed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resend confirmation code" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Sign in instead" })).toBeEnabled();
  });
});
