import { useSyncExternalStore } from "react";
import {
  getServerUIEnvironmentSnapshot,
  getUIEnvironmentSnapshot,
  subscribeUIEnvironment,
} from "@/services/uiEnvironment";
import type { UIEnvironment } from "@/services/uiEnvironment";

export const useUIEnvironment = () => useSyncExternalStore(
  subscribeUIEnvironment, getUIEnvironmentSnapshot, getServerUIEnvironmentSnapshot,
);

/** Keep geometry events from re-rendering consumers that only need runtime. */
export const useUIEnvironmentValue = <Value extends string | number | boolean>(
  select: (environment: UIEnvironment) => Value,
) => useSyncExternalStore(
  subscribeUIEnvironment,
  () => select(getUIEnvironmentSnapshot()),
  () => select(getServerUIEnvironmentSnapshot()),
);
