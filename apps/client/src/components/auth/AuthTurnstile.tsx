import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Turnstile,
  type TurnstileInstance,
  type WidgetSize,
} from "@marsidev/react-turnstile";
import { CheckCircle, WarningTriangle } from "iconoir-react";

import { useTheme } from "@/contexts/ThemeContext";
import { BRACK_WEB_ORIGIN, isCustomSchemeAuthRuntime } from "@/services/platform";
import { cn } from "@/lib/utils";
import {
  TURNSTILE_BRIDGE_EVENT,
  TURNSTILE_BRIDGE_INIT,
  TURNSTILE_BRIDGE_PATH,
  getTurnstileSiteKey,
  isTurnstileBridgeEvent,
  isValidTurnstileToken,
  shouldUseHostedTurnstileBridge,
  type TurnstileAction,
  type TurnstileTheme,
} from "@/utils/turnstile";

type TurnstileStatus =
  | "checking"
  | "ready"
  | "expired"
  | "error"
  | "unsupported"
  | "configuration_error";

export interface AuthTurnstileHandle {
  reset: () => void;
}

interface AuthTurnstileProps {
  action: TurnstileAction;
  onTokenChange: (token: string | null) => void;
  disabled?: boolean;
  className?: string;
}

const createBridgeChannel = () => {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
};

const needsHostedBridge = () => {
  if (typeof window === "undefined") return false;

  // Packaged apps use the canonical HTTPS bridge so the production widget
  // does not need to trust a localhost hostname. Desktop live development is
  // the sole exception and uses the local HTTP(S) Vite surface directly.
  return shouldUseHostedTurnstileBridge({
    customSchemeRuntime: isCustomSchemeAuthRuntime(),
    protocol: window.location.protocol,
    development: import.meta.env.DEV,
  });
};

const statusCopy: Record<TurnstileStatus, string> = {
  checking: "Protecting this request…",
  ready: "Security check ready",
  expired: "Refreshing the security check…",
  error: "Security check could not load. Check your connection and retry.",
  unsupported: "This browser cannot complete the security check.",
  configuration_error: "Security check is unavailable in this build.",
};

export const AuthTurnstile = forwardRef<
  AuthTurnstileHandle,
  AuthTurnstileProps
>(({ action, onTokenChange, disabled = false, className }, forwardedRef) => {
  const { resolvedTheme } = useTheme();
  const turnstileRef = useRef<TurnstileInstance>();
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const siteKey = getTurnstileSiteKey();
  const useBridge = needsHostedBridge();
  const turnstileTheme: TurnstileTheme =
    resolvedTheme === "dark" ? "dark" : "light";
  const [status, setStatus] = useState<TurnstileStatus>(() =>
    siteKey ? "checking" : "configuration_error",
  );
  const [widgetSize, setWidgetSize] = useState<WidgetSize | null>(null);
  const [bridgeChannel, setBridgeChannel] = useState(createBridgeChannel);
  const [bridgeHeight, setBridgeHeight] = useState(150);

  onTokenChangeRef.current = onTokenChange;

  const clearToken = useCallback(() => {
    onTokenChangeRef.current(null);
  }, []);

  const reset = useCallback(() => {
    clearToken();

    if (!siteKey) {
      setStatus("configuration_error");
      return;
    }

    setStatus("checking");
    if (useBridge) {
      setBridgeHeight(150);
      setBridgeChannel(createBridgeChannel());
      return;
    }

    turnstileRef.current?.reset();
  }, [clearToken, siteKey, useBridge]);

  useImperativeHandle(forwardedRef, () => ({ reset }), [reset]);

  useLayoutEffect(() => {
    if (useBridge || !siteKey) return;

    const element = containerRef.current;
    if (!element) return;

    const selectSize = (width: number) => {
      const nextSize: WidgetSize = width >= 300 ? "flexible" : "compact";
      setWidgetSize((current) => {
        if (current && current !== nextSize) {
          clearToken();
          setStatus("checking");
        }
        return nextSize;
      });
    };

    selectSize(element.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (typeof width === "number") selectSize(width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [clearToken, siteKey, useBridge]);

  const previousThemeRef = useRef(turnstileTheme);
  useLayoutEffect(() => {
    if (previousThemeRef.current === turnstileTheme) return;
    previousThemeRef.current = turnstileTheme;
    clearToken();
    setStatus(siteKey ? "checking" : "configuration_error");
    if (siteKey && useBridge) {
      setBridgeHeight(150);
      setBridgeChannel(createBridgeChannel());
    }
  }, [clearToken, siteKey, turnstileTheme, useBridge]);

  const acceptToken = useCallback((token: string) => {
    if (!isValidTurnstileToken(token)) {
      clearToken();
      setStatus("error");
      return;
    }

    onTokenChangeRef.current(token);
    setStatus("ready");
  }, [clearToken]);

  const handleExpired = useCallback(() => {
    clearToken();
    setStatus("expired");
  }, [clearToken]);

  const handleError = useCallback(() => {
    clearToken();
    setStatus("error");
  }, [clearToken]);

  const handleTimeout = useCallback(() => {
    clearToken();
    setStatus("checking");
  }, [clearToken]);

  const handleUnsupported = useCallback(() => {
    clearToken();
    setStatus("unsupported");
  }, [clearToken]);

  const initializeBridge = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: TURNSTILE_BRIDGE_INIT,
        channel: bridgeChannel,
        action,
        theme: turnstileTheme,
      },
      BRACK_WEB_ORIGIN,
    );
  }, [action, bridgeChannel, turnstileTheme]);

  useLayoutEffect(() => {
    if (!useBridge || !siteKey) return;

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== BRACK_WEB_ORIGIN ||
        event.source !== iframeRef.current?.contentWindow ||
        !isTurnstileBridgeEvent(event.data) ||
        event.data.channel !== bridgeChannel
      ) {
        return;
      }

      switch (event.data.event) {
        case "ready":
          clearToken();
          setStatus("checking");
          return;
        case "token":
          acceptToken(event.data.token);
          return;
        case "expired":
          handleExpired();
          return;
        case "timeout":
          handleTimeout();
          return;
        case "error":
          handleError();
          return;
        case "layout":
          setBridgeHeight(event.data.height);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    acceptToken,
    bridgeChannel,
    clearToken,
    handleError,
    handleExpired,
    handleTimeout,
    siteKey,
    useBridge,
  ]);

  const showRetry = status === "error" || status === "unsupported";

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full rounded-xl bg-muted/45 p-2.5 text-foreground transition-colors",
        disabled && "pointer-events-none opacity-75",
        className,
      )}
      aria-disabled={disabled || undefined}
    >
      <div className="flex min-h-8 items-center justify-between gap-3 px-1">
        <span
          className={cn(
            "flex items-center gap-2 text-xs font-medium text-muted-foreground",
            (status === "error" || status === "unsupported" || status === "configuration_error") &&
              "text-destructive",
          )}
          role={status === "ready" || status === "checking" ? "status" : "alert"}
          aria-live="polite"
        >
          {status === "ready" ? (
            <CheckCircle className="h-4 w-4 text-primary" aria-hidden="true" />
          ) : status === "error" || status === "unsupported" || status === "configuration_error" ? (
            <WarningTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-full bg-primary/70 motion-safe:animate-pulse"
              aria-hidden="true"
            />
          )}
          {statusCopy[status]}
        </span>

        {showRetry && (
          <button
            type="button"
            onClick={reset}
            className="min-h-11 shrink-0 rounded-lg px-3 text-xs font-semibold text-primary outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retry
          </button>
        )}
      </div>

      {siteKey && useBridge && (
        <iframe
          key={bridgeChannel}
          ref={iframeRef}
          src={`${BRACK_WEB_ORIGIN}${TURNSTILE_BRIDGE_PATH}`}
          title="Brack security check"
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
          className="block w-full border-0 bg-transparent transition-[height] duration-200 motion-reduce:transition-none"
          style={{ height: `${bridgeHeight}px` }}
          onLoad={initializeBridge}
          onError={handleError}
        />
      )}

      {siteKey && !useBridge && widgetSize && (
        <Turnstile
          key={`${turnstileTheme}-${widgetSize}`}
          ref={turnstileRef}
          siteKey={siteKey}
          className="flex w-full justify-center overflow-hidden rounded-lg"
          options={{
            action,
            appearance: "interaction-only",
            execution: "render",
            feedbackEnabled: true,
            language: "auto",
            refreshExpired: "auto",
            refreshTimeout: "auto",
            responseField: false,
            retry: "auto",
            size: widgetSize,
            theme: turnstileTheme,
          }}
          scriptOptions={{
            appendTo: "head",
            async: true,
            defer: true,
            onError: handleError,
          }}
          onSuccess={acceptToken}
          onExpire={handleExpired}
          onError={handleError}
          onTimeout={handleTimeout}
          onUnsupported={handleUnsupported}
        />
      )}
    </div>
  );
});

AuthTurnstile.displayName = "AuthTurnstile";
