import { supabase } from "@/integrations/supabase/client";

export interface FeatureFlags {
  socialEnabled: boolean;
  loaded: boolean;
}

const STORAGE_KEY = "brack:feature-flags";
const FALLBACK_SOCIAL_ENABLED =
  import.meta.env.VITE_SOCIAL_FEATURES_ENABLED !== "false";

let state: FeatureFlags = {
  socialEnabled: FALLBACK_SOCIAL_ENABLED,
  loaded: false,
};
let loadPromise: Promise<FeatureFlags> | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

const readCachedFlags = (): FeatureFlags | null => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as {
      socialEnabled?: unknown;
      savedAt?: unknown;
    };
    if (typeof parsed.socialEnabled !== "boolean") return null;
    return { socialEnabled: parsed.socialEnabled, loaded: true };
  } catch {
    return null;
  }
};

const writeCachedFlags = (flags: FeatureFlags) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        socialEnabled: flags.socialEnabled,
        savedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Storage can be unavailable in private browsing or constrained webviews.
  }
};

export const loadFeatureFlags = async (): Promise<FeatureFlags> => {
  if (loadPromise) return loadPromise;

  const cached = readCachedFlags();
  if (cached) {
    state = cached;
    notify();
  }

  loadPromise = (async () => {
    const { data, error } = await supabase.functions.invoke<{
      social_enabled?: boolean;
    }>("feature-flags", { method: "GET" });

    if (error) {
      state = cached ?? {
        socialEnabled: FALLBACK_SOCIAL_ENABLED,
        loaded: true,
      };
      notify();
      return state;
    }

    state = {
      socialEnabled:
        typeof data?.social_enabled === "boolean"
          ? data.social_enabled
          : FALLBACK_SOCIAL_ENABLED,
      loaded: true,
    };
    writeCachedFlags(state);
    notify();
    return state;
  })().finally(() => {
    loadPromise = null;
  });

  return loadPromise;
};

export const getFeatureFlags = () => state;

export const subscribeFeatureFlags = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
