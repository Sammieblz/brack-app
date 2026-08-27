import { isMobileNativeRuntime } from "@/services/platform";

const PERMISSION_INTRO_KEY_PREFIX = "brack:post-signup-permissions:v1:";

const getStorage = () => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

const getKey = (userId: string) => `${PERMISSION_INTRO_KEY_PREFIX}${userId}`;

export const markPostSignupPermissionsPending = (userId: string) => {
  if (!isMobileNativeRuntime()) return;

  try {
    getStorage()?.setItem(getKey(userId), "pending");
  } catch {
    // The permissions screen remains reachable directly when storage is unavailable.
  }
};

export const completePostSignupPermissions = (userId: string) => {
  try {
    getStorage()?.setItem(getKey(userId), "complete");
  } catch {
    // OS permission state remains authoritative even if this convenience flag cannot persist.
  }
};

export const arePostSignupPermissionsPending = (userId: string) => {
  if (!isMobileNativeRuntime()) return false;

  try {
    return getStorage()?.getItem(getKey(userId)) === "pending";
  } catch {
    return false;
  }
};

