import { Capacitor } from "@capacitor/core";
import type { BrackRuntimePlatform } from "@/types/desktop";

const hasDesktopBridge = () =>
  typeof window !== "undefined" && typeof window.brackDesktop !== "undefined";

export const isDesktopRuntime = () => hasDesktopBridge();

export const getRuntimePlatform = (): BrackRuntimePlatform => {
  if (isDesktopRuntime()) return "desktop";
  if (!Capacitor.isNativePlatform()) return "web";

  const platform = Capacitor.getPlatform();
  return platform === "ios" || platform === "android" ? platform : "web";
};

export const isMobileNativeRuntime = () => {
  const platform = getRuntimePlatform();
  return platform === "ios" || platform === "android";
};

export const isCustomSchemeAuthRuntime = () =>
  isDesktopRuntime() || isMobileNativeRuntime();

export const isAuthCallbackUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "brack:" &&
        parsed.hostname.toLowerCase() === "auth" &&
        parsed.pathname.startsWith("/callback")) ||
      (parsed.protocol.startsWith("http") && parsed.pathname === "/auth/callback")
    );
  } catch {
    return false;
  }
};

export const isPasswordResetUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "brack:" &&
        parsed.hostname.toLowerCase() === "auth" &&
        parsed.pathname === "/reset-password") ||
      (parsed.protocol.startsWith("http") && parsed.pathname === "/auth/reset-password")
    );
  } catch {
    return false;
  }
};

export const isAuthRouteUrl = (url: string) =>
  isAuthCallbackUrl(url) || isPasswordResetUrl(url);

export const getAuthRedirectUrl = () => {
  if (isCustomSchemeAuthRuntime()) return "brack://auth/callback";
  return `${window.location.origin}/auth/callback`;
};

export const getPasswordResetRedirectUrl = () => {
  if (isCustomSchemeAuthRuntime()) return "brack://auth/reset-password";
  return `${window.location.origin}/auth/reset-password`;
};

export const openExternalUrl = async (url: string) => {
  if (isDesktopRuntime()) {
    await window.brackDesktop?.auth.openExternal(url);
    return;
  }

  if (isMobileNativeRuntime()) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
    return;
  }

  window.location.assign(url);
};

export const closeExternalAuthSession = async () => {
  if (!isMobileNativeRuntime()) return;

  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.close();
  } catch {
    // Browser.close is best-effort and platform dependent.
  }
};

export const onDesktopAuthCallback = (handler: (url: string) => void) => {
  return window.brackDesktop?.auth.onCallback(handler) ?? (() => {});
};

export const onDesktopDeepLink = (handler: (url: string) => void) => {
  return window.brackDesktop?.deepLinks.onOpen(handler) ?? (() => {});
};

export const onDesktopForeground = (handler: () => void) => {
  return window.brackDesktop?.app.onForeground(handler) ?? (() => {});
};
