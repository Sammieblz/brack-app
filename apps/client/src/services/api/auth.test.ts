import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthApiError, AuthSessionMissingError } from "@supabase/supabase-js";

const {
  exchangeCodeForSessionMock,
  getSessionMock,
  getUserMock,
  isCustomSchemeAuthRuntimeMock,
  openExternalUrlMock,
  resetPasswordForEmailMock,
  resendMock,
  setSessionMock,
  signInWithOAuthMock,
  signInWithPasswordMock,
  signUpMock,
  verifyOtpMock,
} = vi.hoisted(() => ({
  exchangeCodeForSessionMock: vi.fn(),
  getSessionMock: vi.fn(),
  getUserMock: vi.fn(),
  isCustomSchemeAuthRuntimeMock: vi.fn(),
  openExternalUrlMock: vi.fn(),
  resetPasswordForEmailMock: vi.fn(),
  resendMock: vi.fn(),
  setSessionMock: vi.fn(),
  signInWithOAuthMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
  signUpMock: vi.fn(),
  verifyOtpMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: exchangeCodeForSessionMock,
      getSession: getSessionMock,
      getUser: getUserMock,
      resetPasswordForEmail: resetPasswordForEmailMock,
      resend: resendMock,
      setSession: setSessionMock,
      signInWithOAuth: signInWithOAuthMock,
      signInWithPassword: signInWithPasswordMock,
      signUp: signUpMock,
      verifyOtp: verifyOtpMock,
    },
  },
}));

vi.mock("@/services/platform", () => ({
  isCustomSchemeAuthRuntime: isCustomSchemeAuthRuntimeMock,
  openExternalUrl: openExternalUrlMock,
}));

import {
  AuthCallbackError,
  AuthProtocolError,
  clearVerifiedAuthUserCache,
  getCurrentAuthUser,
  getOptionalCurrentAuthUser,
  handleAuthCallbackUrl,
  resendSignUpEmail,
  sendPasswordResetEmail,
  signInWithEmailPassword,
  signInWithOAuth,
  signUpWithEmail,
  verifyEmailOtp,
} from "./auth";

const TEST_CAPTCHA_TOKEN = "test-turnstile-token";

describe("optional authentication and callback handling", () => {
  beforeEach(() => {
    exchangeCodeForSessionMock.mockReset();
    getSessionMock.mockReset();
    getUserMock.mockReset();
    isCustomSchemeAuthRuntimeMock.mockReset();
    isCustomSchemeAuthRuntimeMock.mockReturnValue(false);
    openExternalUrlMock.mockReset();
    resetPasswordForEmailMock.mockReset();
    resendMock.mockReset();
    setSessionMock.mockReset();
    signInWithOAuthMock.mockReset();
    signInWithPasswordMock.mockReset();
    signUpMock.mockReset();
    verifyOtpMock.mockReset();
    clearVerifiedAuthUserCache();
  });

  it("requests an OAuth URL without replacing the current web document", async () => {
    const oauthData = {
      provider: "google",
      url: "https://accounts.google.com/o/oauth2/auth",
    };
    signInWithOAuthMock.mockResolvedValue({ data: oauthData, error: null });

    await expect(
      signInWithOAuth({
        provider: "google",
        redirectTo: "https://brack-app.com/auth/callback",
        preserveCurrentDocument: true,
      }),
    ).resolves.toEqual(oauthData);

    expect(signInWithOAuthMock).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://brack-app.com/auth/callback",
        skipBrowserRedirect: true,
      },
    });
    expect(openExternalUrlMock).not.toHaveBeenCalled();
  });

  it("leaves ordinary browser OAuth navigation under Supabase control", async () => {
    const oauthData = {
      provider: "google",
      url: "https://accounts.google.com/o/oauth2/auth",
    };
    signInWithOAuthMock.mockResolvedValue({ data: oauthData, error: null });

    await signInWithOAuth({ provider: "google" });

    expect(signInWithOAuthMock).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: undefined,
        skipBrowserRedirect: false,
      },
    });
    expect(openExternalUrlMock).not.toHaveBeenCalled();
  });

  it.each(["signup", "recovery"] as const)(
    "verifies a six-digit %s code and primes the verified-user cache",
    async (type) => {
      const user = { id: `${type}-user`, email: "reader@example.com" };
      const session = { access_token: `${type}-access`, user };
      verifyOtpMock.mockResolvedValue({
        data: { session, user },
        error: null,
      });
      getSessionMock.mockResolvedValue({ data: { session }, error: null });

      await expect(
        verifyEmailOtp({
          email: " Reader@Example.com ",
          token: " 123 456 ",
          type,
        }),
      ).resolves.toEqual({ session, user });

      expect(verifyOtpMock).toHaveBeenCalledWith({
        email: "Reader@Example.com",
        token: "123456",
        type,
      });
      await expect(getCurrentAuthUser()).resolves.toEqual(user);
      expect(getUserMock).not.toHaveBeenCalled();
    },
  );

  it("rejects an incomplete email code before calling Supabase", async () => {
    await expect(
      verifyEmailOtp({
        email: "reader@example.com",
        token: "12345",
        type: "signup",
      }),
    ).rejects.toMatchObject({
      name: "AuthProtocolError",
      message: "Enter the complete six-digit email code.",
    });

    expect(verifyOtpMock).not.toHaveBeenCalled();
  });

  it("keeps an invalid or expired email-code error observable", async () => {
    const error = new AuthApiError(
      "Token has expired or is invalid",
      403,
      "otp_expired",
    );
    verifyOtpMock.mockResolvedValue({
      data: { session: null, user: null },
      error,
    });

    await expect(
      verifyEmailOtp({
        email: "reader@example.com",
        token: "123456",
        type: "recovery",
      }),
    ).rejects.toBe(error);
  });

  it("rejects an email-code success response without a session", async () => {
    verifyOtpMock.mockResolvedValue({
      data: { session: null, user: { id: "user-1" } },
      error: null,
    });

    await expect(
      verifyEmailOtp({
        email: "reader@example.com",
        token: "123456",
        type: "signup",
      }),
    ).rejects.toMatchObject({
      name: "AuthProtocolError",
      message:
        "Email verification completed without an authenticated session.",
    });
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
        captchaToken: TEST_CAPTCHA_TOKEN,
        redirectTo: "https://brack-app.com/auth/callback",
        metadata: { full_name: "Reader One" },
      }),
    ).resolves.toEqual({ kind: "signed_in", session });

    expect(signUpMock).toHaveBeenCalledWith({
      email: "reader@example.com",
      password: "strong-password",
      options: {
        captchaToken: TEST_CAPTCHA_TOKEN,
        emailRedirectTo: "https://brack-app.com/auth/callback",
        data: { full_name: "Reader One" },
      },
    });
  });

  it("rejects malformed challenge tokens before calling Supabase Auth", async () => {
    await expect(
      signUpWithEmail({
        email: "reader@example.com",
        password: "strong-password",
        captchaToken: " ",
      }),
    ).rejects.toMatchObject({
      name: "AuthProtocolError",
      message: "Complete a fresh security check before submitting this request.",
    });

    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("passes a fresh challenge token to password sign-in", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });

    await signInWithEmailPassword({
      email: " reader@example.com ",
      password: "strong-password",
      captchaToken: TEST_CAPTCHA_TOKEN,
    });

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "reader@example.com",
      password: "strong-password",
      options: { captchaToken: TEST_CAPTCHA_TOKEN },
    });
  });

  it("passes a fresh challenge token to password recovery", async () => {
    resetPasswordForEmailMock.mockResolvedValue({ data: {}, error: null });

    await sendPasswordResetEmail({
      email: " reader@example.com ",
      redirectTo: "https://brack-app.com/auth/reset-password",
      captchaToken: TEST_CAPTCHA_TOKEN,
    });

    expect(resetPasswordForEmailMock).toHaveBeenCalledWith(
      "reader@example.com",
      {
        redirectTo: "https://brack-app.com/auth/reset-password",
        captchaToken: TEST_CAPTCHA_TOKEN,
      },
    );
  });

  it("uses Supabase Auth as the single duplicate-email authority", async () => {
    signUpMock.mockResolvedValue({
      data: {
        session: null,
        user: { id: "obfuscated-user", identities: [] },
      },
      error: null,
    });

    await expect(
      signUpWithEmail({
        email: " Reader@Example.com ",
        password: "strong-password",
        captchaToken: TEST_CAPTCHA_TOKEN,
      }),
    ).resolves.toEqual({
      kind: "email_exists",
      email: "Reader@Example.com",
    });

    expect(signUpMock).toHaveBeenCalledOnce();
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
        captchaToken: TEST_CAPTCHA_TOKEN,
      }),
    ).resolves.toEqual({
      kind: "confirmation_pending",
      email: "reader@example.com",
    });

    expect(signUpMock).toHaveBeenCalledWith({
      email: "reader@example.com",
      password: "strong-password",
      options: {
        captchaToken: TEST_CAPTCHA_TOKEN,
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
        captchaToken: TEST_CAPTCHA_TOKEN,
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
          captchaToken: TEST_CAPTCHA_TOKEN,
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
        captchaToken: TEST_CAPTCHA_TOKEN,
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
        captchaToken: TEST_CAPTCHA_TOKEN,
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

  it("single-flights and briefly reuses verified-user lookups for one token", async () => {
    const session = {
      access_token: "token-one",
      user: { id: "user-1" },
    };
    const verifiedUser = { id: "user-1", email: "reader@example.com" };
    getSessionMock.mockResolvedValue({ data: { session }, error: null });
    getUserMock.mockResolvedValue({ data: { user: verifiedUser }, error: null });

    const [first, second] = await Promise.all([
      getCurrentAuthUser(),
      getCurrentAuthUser(),
    ]);
    const third = await getCurrentAuthUser();

    expect(first).toEqual(verifiedUser);
    expect(second).toEqual(verifiedUser);
    expect(third).toEqual(verifiedUser);
    expect(getUserMock).toHaveBeenCalledOnce();
    expect(getUserMock).toHaveBeenCalledWith("token-one");
  });

  it("drops the verified-user cache when the optional session disappears", async () => {
    const session = {
      access_token: "token-one",
      user: { id: "user-1" },
    };
    getSessionMock
      .mockResolvedValueOnce({ data: { session }, error: null })
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({ data: { session }, error: null });
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "reader@example.com" } },
      error: null,
    });

    await getCurrentAuthUser();
    await expect(getOptionalCurrentAuthUser()).resolves.toBeNull();
    await getCurrentAuthUser();

    expect(getUserMock).toHaveBeenCalledTimes(2);
  });

  it("does not let an invalidated lookup clear its replacement single-flight", async () => {
    type LookupResult = {
      data: { user: { id: string } };
      error: null;
    };
    const session = {
      access_token: "same-token",
      user: { id: "user-1" },
    };
    let resolveFirst: ((value: LookupResult) => void) | undefined;
    let resolveSecond: ((value: LookupResult) => void) | undefined;
    getSessionMock.mockResolvedValue({ data: { session }, error: null });
    getUserMock
      .mockImplementationOnce(() => new Promise<LookupResult>((resolve) => {
        resolveFirst = resolve;
      }))
      .mockImplementationOnce(() => new Promise<LookupResult>((resolve) => {
        resolveSecond = resolve;
      }));

    const first = getCurrentAuthUser();
    await vi.waitFor(() => expect(getUserMock).toHaveBeenCalledTimes(1));
    clearVerifiedAuthUserCache();
    const second = getCurrentAuthUser();
    await vi.waitFor(() => expect(getUserMock).toHaveBeenCalledTimes(2));

    resolveFirst?.({ data: { user: { id: "stale-user" } }, error: null });
    await first;
    const third = getCurrentAuthUser();
    expect(getUserMock).toHaveBeenCalledTimes(2);

    resolveSecond?.({ data: { user: { id: "user-1" } }, error: null });
    await expect(Promise.all([second, third])).resolves.toEqual([
      { id: "user-1" },
      { id: "user-1" },
    ]);
  });

  it("does not reuse a verified user after the access token changes", async () => {
    getSessionMock
      .mockResolvedValueOnce({
        data: { session: { access_token: "token-one", user: { id: "user-1" } } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { session: { access_token: "token-two", user: { id: "user-1" } } },
        error: null,
      });
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    await getCurrentAuthUser();
    await getCurrentAuthUser();

    expect(getUserMock).toHaveBeenNthCalledWith(1, "token-one");
    expect(getUserMock).toHaveBeenNthCalledWith(2, "token-two");
  });

  it("exchanges an authorization code once through the manual callback owner", async () => {
    const callbackData = { session: { access_token: "token" }, user: { id: "user-1" } };
    exchangeCodeForSessionMock.mockResolvedValue({ data: callbackData, error: null });

    await expect(
      handleAuthCallbackUrl("https://brack-app.com/auth/callback?code=one-time-code"),
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
        "https://brack-app.com/auth/callback#access_token=access&refresh_token=refresh",
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
      handleAuthCallbackUrl("https://brack-app.com/auth/callback"),
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
      handleAuthCallbackUrl("https://brack-app.com/auth/callback"),
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
        redirectTo: "https://brack-app.com/auth/callback",
        captchaToken: TEST_CAPTCHA_TOKEN,
      }),
    ).resolves.toBeUndefined();

    expect(resendMock).toHaveBeenCalledWith({
      type: "signup",
      email: "reader@example.com",
      options: {
        captchaToken: TEST_CAPTCHA_TOKEN,
        emailRedirectTo: "https://brack-app.com/auth/callback",
      },
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
      resendSignUpEmail({
        email: "reader@example.com",
        captchaToken: TEST_CAPTCHA_TOKEN,
      }),
    ).rejects.toBe(error);
  });
});
