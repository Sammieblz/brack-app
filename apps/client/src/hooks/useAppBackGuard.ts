import { useContext, useLayoutEffect, useRef } from "react";
import { AppNavigationContext } from "@/contexts/appNavigation";

/** Return true to continue this app Back, false to consume it in the current task. */
export function useAppBackGuard(enabled: boolean, check: () => boolean | Promise<boolean>, priority = 0): void {
  const navigation = useContext(AppNavigationContext);
  const latest = useRef(check);
  latest.current = check;
  const register = navigation?.registerGuard;
  const routeKey = navigation?.routeKey;
  useLayoutEffect(() => {
    if (enabled && register && routeKey) return register(() => latest.current(), priority, routeKey);
  }, [enabled, register, routeKey, priority]);
}
