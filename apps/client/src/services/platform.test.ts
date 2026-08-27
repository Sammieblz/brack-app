import { Capacitor } from "@capacitor/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BRACK_WEB_ORIGIN,
  getAuthFlowSurface,
  getAuthRedirectUrl,
  getPasswordResetRedirectUrl,
  isAuthCallbackUrl,
  isPasswordResetUrl,
  isStandalonePwaRuntime,
  isTrustedBrackWebUrl,
  shouldRegisterPwaServiceWorker,
} from "./platform";

const originalMatchMedia = window.matchMedia;

const setStandaloneDisplayMode = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches }),
  });
};

afterEach(() => {
  vi.restoreAllMocks();
  delete window.brackDesktop;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  });
});

describe("Brack URL trust boundaries", () => {
  it("accepts canonical and current web origins", () => {
    expect(
      isTrustedBrackWebUrl(new URL(`${BRACK_WEB_ORIGIN}/book/reader-copy`)),
    ).toBe(true);
    expect(
      isTrustedBrackWebUrl(new URL(`${window.location.origin}/book/local-copy`)),
    ).toBe(true);
  });

  it.each([
    "https://brack-app.com.evil.example/auth/callback",
    "https://brack-app.com@evil.example/auth/callback",
    "http://brack-app.com/auth/callback",
    "httpx://brack-app.com/auth/callback",
    "https://www.brack-app.com/auth/callback",
  ])("rejects an untrusted web URL: %s", (url) => {
    expect(isTrustedBrackWebUrl(new URL(url))).toBe(false);
    expect(isAuthCallbackUrl(url)).toBe(false);
  });

  it("accepts only the exact canonical auth routes", () => {
    expect(isAuthCallbackUrl(`${BRACK_WEB_ORIGIN}/auth/callback?code=one`)).toBe(true);
    expect(
      isPasswordResetUrl(`${BRACK_WEB_ORIGIN}/auth/reset-password?code=two`),
    ).toBe(true);
    expect(isAuthCallbackUrl(`${BRACK_WEB_ORIGIN}/auth/callback/extra`)).toBe(false);
    expect(
      isPasswordResetUrl(`${BRACK_WEB_ORIGIN}/auth/reset-password/extra`),
    ).toBe(false);
  });

  it("accepts exact native callbacks and rejects scheme-confusion variants", () => {
    expect(isAuthCallbackUrl("brack://auth/callback?code=one")).toBe(true);
    expect(isPasswordResetUrl("brack://auth/reset-password?code=two")).toBe(true);
    expect(isAuthCallbackUrl("brack://auth/callback/extra")).toBe(false);
    expect(isAuthCallbackUrl("brack://reader@auth/callback")).toBe(false);
    expect(isAuthCallbackUrl("brack-auth://auth/callback")).toBe(false);
  });

  it("keeps ordinary browser Auth in the current HTTPS origin", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    setStandaloneDisplayMode(false);

    expect(getAuthFlowSurface()).toBe("web");
    expect(isStandalonePwaRuntime()).toBe(false);
    expect(getAuthRedirectUrl()).toBe(`${window.location.origin}/auth/callback`);
    expect(getPasswordResetRedirectUrl()).toBe(
      `${window.location.origin}/auth/reset-password`,
    );
    expect(shouldRegisterPwaServiceWorker()).toBe(true);
  });

  it("treats a standalone PWA as web without switching to brack://", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    setStandaloneDisplayMode(true);

    expect(getAuthFlowSurface()).toBe("pwa");
    expect(isStandalonePwaRuntime()).toBe(true);
    expect(getAuthRedirectUrl()).toBe(`${window.location.origin}/auth/callback`);
    expect(getPasswordResetRedirectUrl()).toBe(
      `${window.location.origin}/auth/reset-password`,
    );
    expect(shouldRegisterPwaServiceWorker()).toBe(true);
  });

  it("uses the custom scheme and disables the PWA worker in Capacitor", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("android");

    expect(getAuthFlowSurface()).toBe("android");
    expect(getAuthRedirectUrl()).toBe("brack://auth/callback");
    expect(getPasswordResetRedirectUrl()).toBe(
      "brack://auth/reset-password",
    );
    expect(shouldRegisterPwaServiceWorker()).toBe(false);
  });

  it("uses the custom scheme and disables the PWA worker in Electron", () => {
    window.brackDesktop = {} as Window["brackDesktop"];

    expect(getAuthFlowSurface()).toBe("desktop");
    expect(getAuthRedirectUrl()).toBe("brack://auth/callback");
    expect(getPasswordResetRedirectUrl()).toBe(
      "brack://auth/reset-password",
    );
    expect(shouldRegisterPwaServiceWorker()).toBe(false);
  });
});
