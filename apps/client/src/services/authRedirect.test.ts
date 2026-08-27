import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  ensureUserProfileMock,
  getCurrentAuthUserMock,
  handleAuthCallbackUrlMock,
  clearOnboardingDraftMock,
  loadOnboardingDraftMock,
  saveOnboardingProfileMock,
  shouldEnterFirstRunOnboardingMock,
  skipOnboardingMock,
  arePostSignupPermissionsPendingMock,
  markPostSignupPermissionsPendingMock,
  isMobileNativeRuntimeMock,
} = vi.hoisted(() => ({
  ensureUserProfileMock: vi.fn(),
  getCurrentAuthUserMock: vi.fn(),
  handleAuthCallbackUrlMock: vi.fn(),
  clearOnboardingDraftMock: vi.fn(),
  loadOnboardingDraftMock: vi.fn(),
  saveOnboardingProfileMock: vi.fn(),
  shouldEnterFirstRunOnboardingMock: vi.fn(),
  skipOnboardingMock: vi.fn(),
  arePostSignupPermissionsPendingMock: vi.fn(),
  markPostSignupPermissionsPendingMock: vi.fn(),
  isMobileNativeRuntimeMock: vi.fn(),
}));

vi.mock("@/services/api/auth", () => ({
  getCurrentAuthUser: getCurrentAuthUserMock,
  handleAuthCallbackUrl: handleAuthCallbackUrlMock,
}));

vi.mock("@/services/onboarding", () => ({
  ensureUserProfile: ensureUserProfileMock,
  saveOnboardingProfile: saveOnboardingProfileMock,
  shouldEnterFirstRunOnboarding: shouldEnterFirstRunOnboardingMock,
  skipOnboarding: skipOnboardingMock,
}));

vi.mock("@/services/onboardingDraft", () => ({
  clearOnboardingDraft: clearOnboardingDraftMock,
  loadOnboardingDraft: loadOnboardingDraftMock,
}));

vi.mock("@/services/postSignupPermissions", () => ({
  arePostSignupPermissionsPending: arePostSignupPermissionsPendingMock,
  markPostSignupPermissionsPending: markPostSignupPermissionsPendingMock,
}));

vi.mock("@/services/platform", () => ({
  isMobileNativeRuntime: isMobileNativeRuntimeMock,
  isPasswordResetUrl: (url: string) => url.includes("reset-password"),
}));

import {
  authorizePasswordRecoverySession,
  AuthCallbackBootstrapError,
  AuthCallbackCredentialError,
  completeAuthCallback,
  consumePasswordRecoveryAuthorization,
  hasPasswordRecoveryAuthorization,
  resolvePostAuthPath,
} from "./authRedirect";

const callbackData = (userId = "user-1") => ({
  user: { id: userId },
  session: { user: { id: userId } },
});

describe("completeAuthCallback", () => {
  beforeEach(() => {
    vi.useRealTimers();
    consumePasswordRecoveryAuthorization("user-1");
    consumePasswordRecoveryAuthorization("recovery-user");
    consumePasswordRecoveryAuthorization("expiring-recovery-user");
    window.sessionStorage.clear();
    handleAuthCallbackUrlMock.mockReset();
    getCurrentAuthUserMock.mockReset();
    ensureUserProfileMock.mockReset();
    clearOnboardingDraftMock.mockReset();
    loadOnboardingDraftMock.mockReset();
    loadOnboardingDraftMock.mockReturnValue(null);
    saveOnboardingProfileMock.mockReset();
    saveOnboardingProfileMock.mockResolvedValue(undefined);
    shouldEnterFirstRunOnboardingMock.mockReset();
    skipOnboardingMock.mockReset();
    skipOnboardingMock.mockResolvedValue(undefined);
    arePostSignupPermissionsPendingMock.mockReset();
    arePostSignupPermissionsPendingMock.mockReturnValue(false);
    markPostSignupPermissionsPendingMock.mockReset();
    isMobileNativeRuntimeMock.mockReset();
    isMobileNativeRuntimeMock.mockReturnValue(false);

    handleAuthCallbackUrlMock.mockResolvedValue(callbackData());
    getCurrentAuthUserMock.mockResolvedValue({ id: "user-1" });
    ensureUserProfileMock.mockResolvedValue({});
    shouldEnterFirstRunOnboardingMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("records recovery authorization for a Supabase-verified user", () => {
    authorizePasswordRecoverySession("verified-recovery-user");

    expect(hasPasswordRecoveryAuthorization("verified-recovery-user")).toBe(
      true,
    );
    expect(hasPasswordRecoveryAuthorization("different-user")).toBe(false);
    expect(consumePasswordRecoveryAuthorization("verified-recovery-user")).toBe(
      true,
    );
  });

  it("refuses to authorize recovery without a verified user id", () => {
    expect(() => authorizePasswordRecoverySession("")).toThrow(
      AuthCallbackCredentialError,
    );
  });

  it("coalesces simultaneous processing of the same one-time callback", async () => {
    let finishExchange: ((value: ReturnType<typeof callbackData>) => void) | undefined;
    handleAuthCallbackUrlMock.mockImplementation(
      () =>
        new Promise<ReturnType<typeof callbackData>>((resolve) => {
          finishExchange = resolve;
        }),
    );
    const callbackUrl =
      "https://brack-app.com/auth/reset-password?code=simultaneous-code";

    const first = completeAuthCallback(callbackUrl);
    const second = completeAuthCallback(callbackUrl);
    await vi.waitFor(() => expect(finishExchange).toBeTypeOf("function"));
    finishExchange?.(callbackData());

    await expect(Promise.all([first, second])).resolves.toEqual([
      "/auth/reset-password",
      "/auth/reset-password",
    ]);
    expect(handleAuthCallbackUrlMock).toHaveBeenCalledOnce();
  });

  it("replays a settled callback result without exchanging its code again", async () => {
    const callbackUrl =
      "https://brack-app.com/auth/reset-password?code=sequential-code";

    await expect(completeAuthCallback(callbackUrl)).resolves.toBe(
      "/auth/reset-password",
    );
    await expect(completeAuthCallback(callbackUrl)).resolves.toBe(
      "/auth/reset-password",
    );

    expect(handleAuthCallbackUrlMock).toHaveBeenCalledOnce();
  });

  it("expires replay entries after the bounded callback TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T00:00:00Z"));
    const callbackUrl =
      "https://brack-app.com/auth/reset-password?code=expired-replay-code";

    await completeAuthCallback(callbackUrl);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await completeAuthCallback(callbackUrl);

    expect(handleAuthCallbackUrlMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a bare callback instead of accepting an unrelated session", async () => {
    await expect(
      completeAuthCallback("https://brack-app.com/auth/callback?source=unrelated"),
    ).rejects.toBeInstanceOf(AuthCallbackCredentialError);

    expect(handleAuthCallbackUrlMock).not.toHaveBeenCalled();
    expect(getCurrentAuthUserMock).not.toHaveBeenCalled();
  });

  it("rejects an incomplete implicit token pair", async () => {
    await expect(
      completeAuthCallback(
        "https://brack-app.com/auth/callback#access_token=access-only",
      ),
    ).rejects.toMatchObject({
      name: "AuthCallbackCredentialError",
      message: expect.stringContaining("incomplete"),
    });

    expect(handleAuthCallbackUrlMock).not.toHaveBeenCalled();
  });

  it("distinguishes post-auth profile bootstrap failures from bad credentials", async () => {
    getCurrentAuthUserMock.mockRejectedValue(new Error("profile service unavailable"));
    const callbackUrl =
      "https://brack-app.com/auth/callback?code=bootstrap-failure-code";

    await expect(completeAuthCallback(callbackUrl)).rejects.toMatchObject({
      name: "AuthCallbackBootstrapError",
      fallbackPath: "/dashboard",
    });
    await expect(completeAuthCallback(callbackUrl)).rejects.toBeInstanceOf(
      AuthCallbackBootstrapError,
    );

    expect(handleAuthCallbackUrlMock).toHaveBeenCalledOnce();
  });

  it("authorizes password recovery only for the user established by the callback", async () => {
    handleAuthCallbackUrlMock.mockResolvedValue(callbackData("recovery-user"));

    await expect(
      completeAuthCallback(
        "https://brack-app.com/auth/reset-password?code=recovery-marker-code",
      ),
    ).resolves.toBe("/auth/reset-password");

    expect(hasPasswordRecoveryAuthorization("recovery-user")).toBe(true);
    expect(hasPasswordRecoveryAuthorization("ordinary-session-user")).toBe(false);
    expect(consumePasswordRecoveryAuthorization("ordinary-session-user")).toBe(
      false,
    );
    expect(consumePasswordRecoveryAuthorization("recovery-user")).toBe(true);
    expect(hasPasswordRecoveryAuthorization("recovery-user")).toBe(false);
  });

  it("expires a password recovery authorization after its short TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T00:00:00Z"));
    handleAuthCallbackUrlMock.mockResolvedValue(
      callbackData("expiring-recovery-user"),
    );

    await completeAuthCallback(
      "https://brack-app.com/auth/reset-password?code=expiring-marker-code",
    );
    expect(hasPasswordRecoveryAuthorization("expiring-recovery-user")).toBe(
      true,
    );

    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(hasPasswordRecoveryAuthorization("expiring-recovery-user")).toBe(
      false,
    );
  });

  it("does not authorize recovery when the callback returns no user", async () => {
    handleAuthCallbackUrlMock.mockResolvedValue({ user: null, session: null });

    await expect(
      completeAuthCallback(
        "https://brack-app.com/auth/reset-password?code=missing-user-code",
      ),
    ).rejects.toBeInstanceOf(AuthCallbackCredentialError);

    expect(hasPasswordRecoveryAuthorization("user-1")).toBe(false);
  });

  it("applies a bound new-reader draft once before native permissions", async () => {
    getCurrentAuthUserMock.mockResolvedValue({
      id: "new-reader",
      email: "new-reader@example.com",
      created_at: "2026-08-26T16:00:10.000Z",
      app_metadata: { provider: "email", providers: ["email"] },
      identities: [],
    });
    ensureUserProfileMock.mockResolvedValue({ onboarding_status: "not_started" });
    shouldEnterFirstRunOnboardingMock.mockReturnValue(true);
    loadOnboardingDraftMock.mockReturnValue({
      version: 1,
      flowId: "76000000-0000-0000-0000-000000000001",
      formData: {},
      stage: "auth_started",
      outcome: "skipped",
      lastStep: 3,
      createdAt: "2026-08-26T15:55:00.000Z",
      updatedAt: "2026-08-26T16:00:00.000Z",
      expiresAt: "2026-09-02T16:00:00.000Z",
      authAttempt: {
        kind: "email",
        email: "new-reader@example.com",
        startedAt: "2026-08-26T16:00:00.000Z",
      },
    });
    isMobileNativeRuntimeMock.mockReturnValue(true);

    await expect(resolvePostAuthPath()).resolves.toBe("/app-permissions");

    expect(skipOnboardingMock).toHaveBeenCalledWith("new-reader", 3);
    expect(markPostSignupPermissionsPendingMock).toHaveBeenCalledWith(
      "new-reader",
    );
    expect(clearOnboardingDraftMock).toHaveBeenCalledOnce();
  });

  it("does not apply an OAuth draft to a user verified with another provider", async () => {
    getCurrentAuthUserMock.mockResolvedValue({
      id: "email-reader",
      email: "email-reader@example.com",
      created_at: "2026-08-26T16:00:10.000Z",
      app_metadata: { provider: "email", providers: ["email"] },
      identities: [{ provider: "email" }],
    });
    ensureUserProfileMock.mockResolvedValue({ onboarding_status: "not_started" });
    shouldEnterFirstRunOnboardingMock.mockReturnValue(true);
    loadOnboardingDraftMock.mockReturnValue({
      version: 1,
      flowId: "76000000-0000-0000-0000-000000000002",
      formData: {},
      stage: "auth_started",
      outcome: "completed",
      lastStep: 6,
      createdAt: "2026-08-26T15:55:00.000Z",
      updatedAt: "2026-08-26T16:00:00.000Z",
      expiresAt: "2026-09-02T16:00:00.000Z",
      authAttempt: {
        kind: "oauth",
        provider: "google",
        startedAt: "2026-08-26T16:00:00.000Z",
      },
    });

    await expect(resolvePostAuthPath()).resolves.toBe("/onboarding");

    expect(saveOnboardingProfileMock).not.toHaveBeenCalled();
    expect(skipOnboardingMock).not.toHaveBeenCalled();
    expect(clearOnboardingDraftMock).toHaveBeenCalledOnce();
  });
});
