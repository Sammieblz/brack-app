import { Capacitor } from "@capacitor/core";
import type { BrackRuntimePlatform } from "@/types/desktop";

export const BRACK_WEB_ORIGIN = "https://brack-app.com";
const SUPPORT_SITE_ORIGINS = new Set([BRACK_WEB_ORIGIN, "https://staging.brack-app.com"]);

export type SupportPageSection = "faqs" | "known-issues" | "contact" | "terms" | "privacy";

export const getSupportPageUrl = (section?: SupportPageSection): string | null => {
  const configuredOrigin = import.meta.env.VITE_SUPPORT_SITE_ORIGIN?.trim() || BRACK_WEB_ORIGIN;
  try {
    const origin = new URL(configuredOrigin);
    if (
      !SUPPORT_SITE_ORIGINS.has(origin.origin) ||
      origin.href !== `${origin.origin}/` ||
      hasUrlCredentials(origin)
    ) return null;
    return `${origin.origin}/support${section ? `#${section}` : ""}`;
  } catch {
    return null;
  }
};

const hasDesktopBridge = () =>
  typeof window !== "undefined" && typeof window.brackDesktop !== "undefined";

const hasUrlCredentials = (url: URL) => Boolean(url.username || url.password);

const isHttpProtocol = (protocol: string) =>
  protocol === "http:" || protocol === "https:";

const hasControlCharacters = (value: string) =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });

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

/** Open the public support page outside an installed app. Web/PWA use the local route. */
export const openSupportPage = async (section?: SupportPageSection): Promise<boolean> => {
  if (!isDesktopRuntime() && !isMobileNativeRuntime()) return false;
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;

  const url = getSupportPageUrl(section);
  if (!url || (isDesktopRuntime() && !window.brackDesktop?.auth?.openExternal)) return false;

  try {
    if (isMobileNativeRuntime()) {
      // AppLauncher hands HTTPS links to the OS browser instead of presenting
      // Capacitor's browser view on top of the app.
      const { AppLauncher } = await import("@capacitor/app-launcher");
      const result = await AppLauncher.openUrl({ url });
      return result.completed;
    }
    await openExternalUrl(url);
    return true;
  } catch {
    return false;
  }
};

export const openSupportEmail = async (subject: string): Promise<boolean> => {
  const safeSubject = subject.trim();
  if (!safeSubject || safeSubject.length > 120 || hasControlCharacters(safeSubject)) {
    return false;
  }

  if (isDesktopRuntime()) {
    try {
      return await window.brackDesktop?.support.openEmail(safeSubject) ?? false;
    } catch {
      return false;
    }
  }

  if (isMobileNativeRuntime()) {
    try {
      const { AppLauncher } = await import("@capacitor/app-launcher");
      const url = `mailto:support@brack-app.com?subject=${encodeURIComponent(safeSubject)}`;
      const available = await AppLauncher.canOpenUrl({ url });
      if (!available.value) return false;
      await AppLauncher.openUrl({ url });
      return true;
    } catch {
      return false;
    }
  }

  return false;
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
