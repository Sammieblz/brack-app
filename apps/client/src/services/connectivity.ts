import type { ConnectivityState } from "@/types";

export const CONNECTIVITY_STATE_EVENT = "brack:connectivity-state";

const getInitialState = (): ConnectivityState => {
  if (typeof navigator === "undefined") return "online";
  return navigator.onLine ? "online" : "offline";
};

let currentState = getInitialState();
let lastSuccessfulProbeAt = 0;
let successfulConnectivityVersion = 0;
let probeInFlight: Promise<ConnectivityState> | null = null;
let monitoringReferences = 0;
let monitoringCleanup: (() => void) | null = null;

const emitState = (state: ConnectivityState) => {
  if (state === currentState) return;

  currentState = state;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<ConnectivityState>(CONNECTIVITY_STATE_EVENT, { detail: state })
    );
  }
};

const withTimeout = async (input: RequestInfo | URL, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timeout);
  }
};

const markConfirmedConnectivityFailure = (successfulVersionAtProbeStart?: number) => {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    emitState("offline");
    return;
  }

  // A request that completed after this probe began is stronger evidence than
  // the stale probe result. Do not let the older failure overwrite it.
  if (
    successfulVersionAtProbeStart !== undefined &&
    successfulConnectivityVersion > successfulVersionAtProbeStart
  ) {
    return;
  }

  emitState("degraded");
};

export const getConnectivityState = () => currentState;

export const isConnectivityAvailable = () =>
  currentState === "online" || currentState === "degraded";

export const markAuthenticationRequired = () => emitState("authentication_required");

export const markConnectivitySuccess = () => {
  lastSuccessfulProbeAt = Date.now();
  successfulConnectivityVersion += 1;
  emitState("online");
};

export const markConnectivityFailure = () => {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    emitState("offline");
    return;
  }

  // An individual API request can fail for application, rate-limit, or server
  // reasons while the connection itself is healthy. Confirm reachability before
  // changing the global connectivity state.
  void probeConnectivity();
};

export const isRetryableConnectivityError = (error: unknown) => {
  if (error instanceof DOMException && error.name === "AbortError") return true;

  const candidate = error as {
    status?: number;
    statusCode?: number;
    context?: { status?: number };
    message?: string;
  };
  const status = candidate.context?.status ?? candidate.status ?? candidate.statusCode;
  if (status === 408 || status === 425 || status === 429 || (status && status >= 500)) {
    return true;
  }

  const message = String(candidate.message ?? error).toLowerCase();
  return [
    "failed to fetch",
    "network",
    "timeout",
    "load failed",
    "connection",
    "offline",
    "temporarily unavailable",
  ].some((part) => message.includes(part));
};

export const probeConnectivity = async (force = false): Promise<ConnectivityState> => {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    emitState("offline");
    return "offline";
  }

  if (!force && Date.now() - lastSuccessfulProbeAt < 15_000) {
    return currentState;
  }

  if (probeInFlight) return probeInFlight;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!supabaseUrl) {
    // A missing build-time setting is a configuration problem, not evidence of
    // a lost network connection.
    return currentState;
  }

  const successfulVersionAtProbeStart = successfulConnectivityVersion;
  const probe = (async () => {
    try {
      const response = await withTimeout(
        `${supabaseUrl}/auth/v1/health`,
        {
          method: "GET",
          headers: publishableKey ? { apikey: publishableKey } : undefined,
          cache: "no-store",
        },
        5_000
      );

      if (response.ok || (response.status >= 400 && response.status < 500)) {
        // Any non-server HTTP response confirms that the service is reachable.
        // Authentication state is determined by authenticated API calls, not by
        // this public health endpoint.
        markConnectivitySuccess();
      } else {
        markConfirmedConnectivityFailure(successfulVersionAtProbeStart);
      }
    } catch {
      markConfirmedConnectivityFailure(successfulVersionAtProbeStart);
    }

    return currentState;
  })();

  probeInFlight = probe;
  try {
    return await probe;
  } finally {
    if (probeInFlight === probe) probeInFlight = null;
  }
};

export const initializeConnectivityMonitoring = () => {
  if (typeof window === "undefined") return () => undefined;
  monitoringReferences += 1;
  if (monitoringCleanup) {
    return () => {
      monitoringReferences = Math.max(0, monitoringReferences - 1);
      if (monitoringReferences === 0) {
        monitoringCleanup?.();
        monitoringCleanup = null;
      }
    };
  }

  const handleOnline = () => void probeConnectivity(true);
  const handleOffline = () => emitState("offline");
  const handleVisibility = () => {
    if (document.visibilityState === "visible") void probeConnectivity();
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  document.addEventListener("visibilitychange", handleVisibility);
  void probeConnectivity();

  monitoringCleanup = () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
    document.removeEventListener("visibilitychange", handleVisibility);
  };

  return () => {
    monitoringReferences = Math.max(0, monitoringReferences - 1);
    if (monitoringReferences === 0) {
      monitoringCleanup?.();
      monitoringCleanup = null;
    }
  };
};
