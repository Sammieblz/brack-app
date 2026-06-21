import { useEffect, useSyncExternalStore } from "react";
import {
  getFeatureFlags,
  loadFeatureFlags,
  subscribeFeatureFlags,
} from "@/services/featureFlags";

export const useFeatureFlags = () => {
  const flags = useSyncExternalStore(
    subscribeFeatureFlags,
    getFeatureFlags,
    getFeatureFlags,
  );

  useEffect(() => {
    void loadFeatureFlags();
  }, []);

  return flags;
};
