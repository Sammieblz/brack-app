import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthApiError, AuthSessionMissingError } from "@supabase/supabase-js";

const {
  exchangeCodeForSessionMock,
  getSessionMock,
  getUserMock,
  invokeFunctionMock,
  resendMock,
  setSessionMock,
  signUpMock,
} = vi.hoisted(() => ({
  exchangeCodeForSessionMock: vi.fn(),
  getSessionMock: vi.fn(),
  getUserMock: vi.fn(),
  invokeFunctionMock: vi.fn(),
  resendMock: vi.fn(),
  setSessionMock: vi.fn(),
  signUpMock: vi.fn(),
}));

vi.mock("./client", () => ({
  getApiErrorStatus: (error: { status?: number; statusCode?: number }) =>
    error?.status ?? error?.statusCode ?? null,
  invokeFunction: invokeFunctionMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: exchangeCodeForSessionMock,
      getSession: getSessionMock,
      getUser: getUserMock,
      resend: resendMock,
      setSession: setSessionMock,
      signUp: signUpMock,
    },
  },
}));

vi.mock("@/services/platform", () => ({
  isCustomSchemeAuthRuntime: () => false,
  openExternalUrl: vi.fn(),
}));

import {
  AuthCallbackError,
  AuthProtocolError,
  getOptionalCurrentAuthUser,
  handleAuthCallbackUrl,
  resendSignUpEmail,
  signUpWithEmail,
} from "./auth";

describe("optional authentication and callback handling", () => {
  beforeEach(() => {
    exchangeCodeForSessionMock.mockReset();
    getSessionMock.mockReset();
    getUserMock.mockReset();
    invokeFunctionMock.mockReset();
    invokeFunctionMock.mockResolvedValue({ exists: false });
    resendMock.mockReset();
    setSessionMock.mockReset();
    signUpMock.mockReset();
  });

  it("returns a signed-in outcome when signup creates a session", async () => {
    const session = { access_token: "access", user: { id: "user-1" } };
    signUpMock.mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    });

    await expect(
      signUpWithEmail({
        email: "reader@example.com",
        password: "strong-password",
        redirectTo: "https://brack.app/auth/callback",
        metadata: { full_name: "Reader One" },
      }),
    ).resolves.toEqual({ kind: "signed_in", session });

    expect(signUpMock).toHaveBeenCalledWith({
      email: "reader@example.com",
      password: "strong-password",
      options: {
        emailRedirectTo: "https://brack.app/auth/callback",
        data: { full_name: "Reader One" },
      },
    });
    expect(invokeFunctionMock).toHaveBeenCalledWith(
      "auth-email-availability",
      { body: { email: "reader@example.com" } },
    );
  });

  it("does not call Auth signup when the preflight finds an existing email", async () => {
    invokeFunctionMock.mockResolvedValue({ exists: true });

    await expect(
      signUpWithEmail({
        email: " Reader@Example.com ",
        password: "strong-password",
      }),
    ).resolves.toEqual({
      kind: "email_exists",
      email: "Reader@Example.com",
    });

    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("fails closed when the availability service is unavailable", async () => {
    invokeFunctionMock.mockRejectedValue({ status: 503 });

    await expect(
      signUpWithEmail({
        email: "reader@example.com",
        password: "strong-password",
      }),
    ).rejects.toMatchObject({
      code: "email_availability_unavailable",
      status: 503,
    });

    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("preserves availability rate limits and never calls Auth signup", async () => {
    const rateLimitError = { status: 429, retryAfterSeconds: 60 };
    invokeFunctionMock.mockRejectedValue(rateLimitError);

    await expect(
      signUpWithEmail({
        email: "reader@example.com",
        password: "strong-password",
      }),
    ).rejects.toBe(rateLimitError);

    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("fails closed on a malformed availability response", async () => {
    invokeFunctionMock.mockResolvedValue({ available: true });

    await expect(
      signUpWithEmail({
        email: "reader@example.com",
        password: "strong-password",
      }),
    ).rejects.toMatchObject({
      code: "email_availability_unavailable",
      status: 503,
    });

    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("returns a neutral pending outcome for a normal no-session signup", async () => {
    signUpMock.mockResolvedValue({
      data: {
        session: null,
        user: { id: "user-1", identities: [{ id: "identity-1" }] },
      },
      error: null,
    });

    await expect(
      signUpWithEmail({
        email: " reader@example.com ",
        password: "strong-password",
      }),
    ).resolves.toEqual({
      kind: "confirmation_pending",
      email: "reader@example.com",
    });

    expect(signUpMock).toHaveBeenCalledWith({
      email: "reader@example.com",
      password: "strong-password",
      options: {
        emailRedirectTo: undefined,
        data: undefined,
      },
    });
  });

  it("returns an email-exists outcome for Supabase's obfuscated user response", async () => {
    signUpMock.mockResolvedValue({
      data: {
        session: null,
        user: { id: "obfuscated-user", identities: [] },
      },
      error: null,
    });

    await expect(
      signUpWithEmail({
        email: "reader@example.com",
        password: "strong-password",
      }),
    ).resolves.toEqual({
      kind: "email_exists",
      email: "reader@example.com",
    });
  });

  it.each([
    ["user_already_exists", 400],
    ["user_already_exists", 422],
    ["email_exists", 400],
  ])(
    "normalizes %s at status %i to the same email-exists outcome",
    async (code, status) => {
      signUpMock.mockResolvedValue({
        data: { session: null, user: null },
        error: new AuthApiError("Sensitive existence message", status, code),
      });

      await expect(
        signUpWithEmail({
          email: "reader@example.com",
          password: "strong-password",
        }),
      ).resolves.toEqual({
        kind: "email_exists",
        email: "reader@example.com",
      });
    },
  );

  it("does not mistake an unrelated signup 400 for an existing account", async () => {
    const error = new AuthApiError(
      "Backend validation details",
      400,
      "validation_failed",
    );
    signUpMock.mockResolvedValue({
      data: { session: null, user: null },
      error,
    });

    await expect(
      signUpWithEmail({
        email: "reader@example.com",
        password: "strong-password",
      }),
    ).rejects.toBe(error);
  });

  it("rejects a malformed success response instead of implying confirmation", async () => {
    signUpMock.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });

    await expect(
      signUpWithEmail({
        email: "reader@example.com",
        password: "strong-password",
      }),
    ).rejects.toBeInstanceOf(AuthProtocolError);
  });

  it("returns null only for the normal missing-session state", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: new AuthSessionMissingError(),
    });

    await expect(getOptionalCurrentAuthUser()).resolves.toBeNull();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("treats an explicit missing-session error as signed out", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: null },
      error: new AuthSessionMissingError(),
    });

    await expect(getOptionalCurrentAuthUser()).resolves.toBeNull();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("handles a session disappearing between the local and verified checks", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "stale" } },
      error: null,
    });
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: new AuthSessionMissingError(),
    });

    await expect(getOptionalCurrentAuthUser()).resolves.toBeNull();
  });

  it("keeps unexpected Auth failures observable", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "token" } },
      error: null,
    });
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError("Auth unavailable", 503, "unexpected_failure"),
    });

    await expect(getOptionalCurrentAuthUser()).rejects.toMatchObject({
      status: 503,
      code: "unexpected_failure",
    });
  });

  it("exchanges an authorization code once through the manual callback owner", async () => {
    const callbackData = { session: { access_token: "token" }, user: { id: "user-1" } };
    exchangeCodeForSessionMock.mockResolvedValue({ data: callbackData, error: null });

    await expect(
      handleAuthCallbackUrl("https://brack.app/auth/callback?code=one-time-code"),
    ).resolves.toEqual(callbackData);
    expect(exchangeCodeForSessionMock).toHaveBeenCalledOnce();
    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("one-time-code");
    expect(setSessionMock).not.toHaveBeenCalled();
  });

  it("sets a session from an implicit callback fragment", async () => {
    const callbackData = { session: { access_token: "access" }, user: { id: "user-1" } };
    setSessionMock.mockResolvedValue({ data: callbackData, error: null });

    await expect(
      handleAuthCallbackUrl(
        "https://brack.app/auth/callback#access_token=access&refresh_token=refresh",
      ),
    ).resolves.toEqual(callbackData);
    expect(setSessionMock).toHaveBeenCalledWith({
      access_token: "access",
      refresh_token: "refresh",
    });
  });

  it("rejects a callback with no credentials and no existing session", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });

    await expect(
      handleAuthCallbackUrl("https://brack.app/auth/callback"),
    ).rejects.toBeInstanceOf(AuthCallbackError);
  });

  it("rejects a bare callback even when an unrelated session exists", async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: { access_token: "unrelated", user: { id: "user-1" } },
      },
      error: null,
    });
    await expect(
      handleAuthCallbackUrl("https://brack.app/auth/callback"),
    ).rejects.toMatchObject({ reason: "missing_credentials" });
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it("uses the explicit signup resend endpoint and redirect", async () => {
    resendMock.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    await expect(
      resendSignUpEmail({
        email: "reader@example.com",
        redirectTo: "https://brack.app/auth/callback",
      }),
    ).resolves.toBeUndefined();

    expect(resendMock).toHaveBeenCalledWith({
      type: "signup",
      email: "reader@example.com",
      options: { emailRedirectTo: "https://brack.app/auth/callback" },
    });
  });

  it("keeps resend failures observable", async () => {
    const error = new AuthApiError(
      "Email rate limit exceeded",
      429,
      "over_email_send_rate_limit",
    );
    resendMock.mockResolvedValue({
      data: { user: null, session: null },
      error,
    });

    await expect(
      resendSignUpEmail({ email: "reader@example.com" }),
    ).rejects.toBe(error);
  });
});
