import { useCallback, useLayoutEffect, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { createAppHistoryTracker } from "@/lib/appHistory";
import { requestOverlayBack } from "@/lib/backLayers";
import { getRouteBackPolicy } from "@/config/routeBack";
import { minimizeNativeApp, subscribeNativeBack } from "@/services/nativeBack";
import { AppNavigationContext, type AppBackAction } from "./appNavigation";

type Guard = { check: () => boolean | Promise<boolean>; priority: number; routeKey: string };
type Control = { element: HTMLButtonElement; action: () => AppBackAction; routeKey: string };
const historyIdentity = () => ({
  key: typeof window.history.state?.key === "string" ? window.history.state.key : "default",
  index: Number.isInteger(window.history.state?.idx) ? window.history.state.idx as number : null,
});

/** A single application Back owner. Browser POP itself is observed, never intercepted. */
export function AppNavigationProvider({ children, accountScope }: {
  children: ReactNode;
  /** undefined while auth resolves, null for a resolved anonymous reader. */
  accountScope: string | null | undefined;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const action = useNavigationType();
  const [tracker] = useState(() => createAppHistoryTracker());
  const [canGoBack, setCanGoBack] = useState(false);
  const guards = useRef(new Set<Guard>());
  const controls = useRef(new Set<Control>());
  const busy = useRef(false);
  const requestGeneration = useRef(0);
  const transition = useRef<string | null>(null);
  const mounted = useRef(true);
  // Account/route changes invalidate asynchronous confirmations and old controls.
  const routeKey = JSON.stringify([accountScope === undefined, accountScope, location.key, location.pathname, location.search, location.hash]);
  const current = useRef({ location, accountScope, routeKey });
  current.current = { location, accountScope, routeKey };
  const invalidateRequest = useCallback(() => {
    requestGeneration.current++;
    busy.current = false;
  }, []);

  useLayoutEffect(() => {
    invalidateRequest();
    if (transition.current !== routeKey) transition.current = null;
    const policy = getRouteBackPolicy(location.pathname, accountScope !== null && accountScope !== undefined);
    if (accountScope === undefined) {
      // Normal reload preserves its ledger until scope resolves; auth routes
      // are boundaries even before the auth provider knows the new account.
      if (policy.kind === "boundary") tracker.reset();
      setCanGoBack(false);
      return;
    }
    const identity = historyIdentity();
    if (identity.key !== location.key) { tracker.reset(); setCanGoBack(false); return; }
    setCanGoBack(tracker.observe({ ...identity, action, scope: accountScope, boundary: policy.kind === "boundary" }));
  }, [tracker, accountScope, routeKey, action, location.key, location.pathname, invalidateRequest]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; invalidateRequest(); };
  }, [invalidateRequest]);

  const registerGuard = useCallback((check: Guard["check"], priority: number, ownerKey: string) => {
    const guard = { check, priority, routeKey: ownerKey };
    guards.current.add(guard);
    return () => { guards.current.delete(guard); };
  }, []);
  const registerControl = useCallback((element: HTMLButtonElement, getAction: Control["action"], ownerKey: string) => {
    const control = { element, action: getAction, routeKey: ownerKey };
    controls.current.add(control);
    return () => { controls.current.delete(control); };
  }, []);

  const requestBack = useCallback((requested?: AppBackAction, source: "ui" | "native" = "ui") => {
    // A refusal by the surface is still a consumed Back. Never pop beneath it.
    if (requestOverlayBack()) return;
    if (busy.current || transition.current) return;
    const start = current.current;
    if (start.accountScope === undefined) return;
    const visibleControl = source === "native" && [...controls.current].reverse().find((control) =>
      control.routeKey === start.routeKey && control.element.isConnected && !control.element.disabled
      && control.element.getClientRects().length > 0 && getComputedStyle(control.element).visibility !== "hidden");
    const config = requested ?? (visibleControl ? visibleControl.action() : {});
    const perform = () => {
      if (!mounted.current || current.current.routeKey !== start.routeKey) return;
      if (config.onBack) { config.onBack(); return; }
      const policy = getRouteBackPolicy(start.location.pathname, start.accountScope !== null);
      const identity = historyIdentity();
      const hasHistory = identity.key === start.location.key && tracker.canGoBack({ ...identity, scope: start.accountScope! });
      if (source === "native" && !config.to && !visibleControl && (policy.kind === "root" || policy.kind === "boundary")) {
        minimizeNativeApp();
        return;
      }
      if (!config.to && hasHistory) {
        transition.current = start.routeKey;
        navigate(-1);
        return;
      }
      const target = config.to ?? config.fallbackPath ?? policy.fallbackPath;
      if (target === `${start.location.pathname}${start.location.search}${start.location.hash}`) return;
      transition.current = start.routeKey;
      // A recovery fallback replaces the unowned entry, preventing a Back loop.
      navigate(target, { replace: !config.to });
    };
    const guard = [...guards.current].reverse().filter((entry) => entry.routeKey === start.routeKey)
      .sort((a, b) => b.priority - a.priority)[0];
    if (!guard) { perform(); return; }
    busy.current = true;
    const generation = ++requestGeneration.current;
    void Promise.resolve().then(() => generation === requestGeneration.current && guard.check()).then((allowed) => {
      if (generation !== requestGeneration.current) return;
      busy.current = false;
      if (allowed) perform();
    }).catch((error: unknown) => {
      if (generation !== requestGeneration.current) return;
      busy.current = false;
      console.error("Could not resolve app Back; current task retained", error);
    });
  }, [navigate, tracker]);

  const latestRequest = useRef(requestBack);
  latestRequest.current = requestBack;
  useEffect(() => subscribeNativeBack(() => latestRequest.current(undefined, "native")), []);
  const value = useMemo(() => ({ routeKey, canGoBack, requestBack, registerGuard, registerControl }),
    [routeKey, canGoBack, requestBack, registerGuard, registerControl]);
  return <AppNavigationContext.Provider value={value}>{children}</AppNavigationContext.Provider>;
}
