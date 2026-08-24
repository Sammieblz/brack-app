import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  ensureUserProfileMock,
  getCurrentAuthUserMock,
  handleAuthCallbackUrlMock,
  shouldEnterFirstRunOnboardingMock,
} = vi.hoisted(() => ({
  ensureUserProfileMock: vi.fn(),
  getCurrentAuthUserMock: vi.fn(),
  handleAuthCallbackUrlMock: vi.fn(),
  shouldEnterFirstRunOnboardingMock: vi.fn(),
}));

vi.mock("@/services/api/auth", () => ({
  getCurrentAuthUser: getCurrentAuthUserMock,
  handleAuthCallbackUrl: handleAuthCallbackUrlMock,
}));

vi.mock("@/services/onboarding", () => ({
  ensureUserProfile: ensureUserProfileMock,
  shouldEnterFirstRunOnboarding: shouldEnterFirstRunOnboardingMock,
}));

vi.mock("@/services/platform", () => ({
  isPasswordResetUrl: (url: string) => url.includes("reset-password"),
}));

import {
  AuthCallbackBootstrapError,
  AuthCallbackCredentialError,
  completeAuthCallback,
  consumePasswordRecoveryAuthorization,
  hasPasswordRecoveryAuthorization,
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
    shouldEnterFirstRunOnboardingMock.mockReset();

    handleAuthCallbackUrlMock.mockResolvedValue(callbackData());
    getCurrentAuthUserMock.mockResolvedValue({ id: "user-1" });
    ensureUserProfileMock.mockResolvedValue({});
    shouldEnterFirstRunOnboardingMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
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
      "https://brack.app/auth/reset-password?code=simultaneous-code";

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
      "https://brack.app/auth/reset-password?code=sequential-code";

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
      "https://brack.app/auth/reset-password?code=expired-replay-code";

    await completeAuthCallback(callbackUrl);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await completeAuthCallback(callbackUrl);

    expect(handleAuthCallbackUrlMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a bare callback instead of accepting an unrelated session", async () => {
    await expect(
      completeAuthCallback("https://brack.app/auth/callback?source=unrelated"),
    ).rejects.toBeInstanceOf(AuthCallbackCredentialError);

    expect(handleAuthCallbackUrlMock).not.toHaveBeenCalled();
    expect(getCurrentAuthUserMock).not.toHaveBeenCalled();
  });

  it("rejects an incomplete implicit token pair", async () => {
    await expect(
      completeAuthCallback(
        "https://brack.app/auth/callback#access_token=access-only",
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
      "https://brack.app/auth/callback?code=bootstrap-failure-code";

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
        "https://brack.app/auth/reset-password?code=recovery-marker-code",
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
      "https://brack.app/auth/reset-password?code=expiring-marker-code",
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
        "https://brack.app/auth/reset-password?code=missing-user-code",
      ),
    ).rejects.toBeInstanceOf(AuthCallbackCredentialError);

    expect(hasPasswordRecoveryAuthorization("user-1")).toBe(false);
  });
});
