import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { completeAuthReturnIntent } from "@/services/authReturnIntent";

export function useAuthReturnArrival(ready: boolean) {
  const { pathname } = useLocation();
  useEffect(() => { if (ready) completeAuthReturnIntent(pathname); }, [pathname, ready]);
  return pathname;
}
