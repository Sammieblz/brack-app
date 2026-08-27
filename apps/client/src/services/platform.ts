import { Capacitor } from "@capacitor/core";
import type { BrackRuntimePlatform } from "@/types/desktop";

export const BRACK_WEB_ORIGIN = "https://brack-app.com";

const hasDesktopBridge = () =>
  typeof window !== "undefined" && typeof window.brackDesktop !== "undefined";

const hasUrlCredentials = (url: URL) => Boolean(url.username || url.password);

const isHttpProtocol = (protocol: string) =>
  protocol === "http:" || protocol === "https:";

/**
 * Trust the canonical Brack origin and the HTTP(S) origin currently hosting the
 * web client. The latter keeps local and explicitly configured preview builds
 * working without accepting a callback for an unrelated host.
 */
export const isTrustedBrackWebUrl = (url: URL) => {
  if (!isHttpProtocol(url.protocol) || hasUrlCredentials(url)) return false;
  if (url.origin === BRACK_WEB_ORIGIN) return true;

  if (typeof window === "undefined") return false;

  try {
    const currentUrl = new URL(window.location.href);
    return (
      isHttpProtocol(currentUrl.protocol) &&
      !hasUrlCredentials(currentUrl) &&
      url.origin === currentUrl.origin
    );
  } catch {
    return false;
  }
};

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

export type AuthFlowSurface = BrackRuntimePlatform | "pwa";

/**
 * An installed PWA is still a web Auth context. It must keep HTTPS callbacks
 * on the current origin instead of being treated like the Capacitor app and
 * redirected through the `brack://` protocol.
 */
export const isStandalonePwaRuntime = () => {
  if (getRuntimePlatform() !== "web" || typeof window === "undefined") {
    return false;
  }

  const standaloneDisplay = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean })
    .standalone;
  return Boolean(standaloneDisplay || iosStandalone);
};

export const getAuthFlowSurface = (): AuthFlowSurface => {
  const platform = getRuntimePlatform();
  if (platform !== "web") return platform;
  return isStandalonePwaRuntime() ? "pwa" : "web";
};

export const shouldRegisterPwaServiceWorker = () =>
  getRuntimePlatform() === "web";

export const isCustomSchemeAuthRuntime = () =>
  ["desktop", "ios", "android"].includes(getAuthFlowSurface());

export const isAuthCallbackUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "brack:" &&
        !hasUrlCredentials(parsed) &&
        parsed.hostname.toLowerCase() === "auth" &&
        parsed.pathname === "/callback") ||
      (isTrustedBrackWebUrl(parsed) && parsed.pathname === "/auth/callback")
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
        !hasUrlCredentials(parsed) &&
        parsed.hostname.toLowerCase() === "auth" &&
        parsed.pathname === "/reset-password") ||
      (isTrustedBrackWebUrl(parsed) && parsed.pathname === "/auth/reset-password")
    );
  } catch {
    return false;
  }
};

export const isAuthRouteUrl = (url: string) =>
  isAuthCallbackUrl(url) || isPasswordResetUrl(url);

export const getAuthRedirectUrl = () => {
  if (isCustomSchemeAuthRuntime()) return "brack://auth/callback";
  // Browser tabs and standalone PWAs intentionally keep their own same-origin
  // session context. Do not replace this with the canonical origin.
  return `${window.location.origin}/auth/callback`;
};

export const getPasswordResetRedirectUrl = () => {
  if (isCustomSchemeAuthRuntime()) return "brack://auth/reset-password";
  // The OTP path completes in this runtime. This HTTPS link is only the
  // fallback for readers who choose to leave the requesting surface.
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
