import { supabase } from "@/integrations/supabase/client";

export interface FeatureFlags {
  socialEnabled: boolean;
  gamificationEnabled: boolean;
  leaderboardsEnabled: boolean;
  loaded: boolean;
}

const STORAGE_KEY = "brack:feature-flags";
const FALLBACK_SOCIAL_ENABLED =
  import.meta.env.VITE_SOCIAL_FEATURES_ENABLED !== "false";
const FALLBACK_GAMIFICATION_ENABLED =
  import.meta.env.VITE_GAMIFICATION_ENABLED !== "false";
const FALLBACK_LEADERBOARDS_ENABLED =
  import.meta.env.VITE_LEADERBOARDS_ENABLED !== "false";

let state: FeatureFlags = {
  socialEnabled: FALLBACK_SOCIAL_ENABLED,
  gamificationEnabled: FALLBACK_GAMIFICATION_ENABLED,
  leaderboardsEnabled: FALLBACK_LEADERBOARDS_ENABLED,
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
      gamificationEnabled?: unknown;
      leaderboardsEnabled?: unknown;
      savedAt?: unknown;
    };
    if (typeof parsed.socialEnabled !== "boolean") return null;
    return {
      socialEnabled: parsed.socialEnabled,
      gamificationEnabled:
        typeof parsed.gamificationEnabled === "boolean"
          ? parsed.gamificationEnabled
          : FALLBACK_GAMIFICATION_ENABLED,
      leaderboardsEnabled:
        typeof parsed.leaderboardsEnabled === "boolean"
          ? parsed.leaderboardsEnabled
          : FALLBACK_LEADERBOARDS_ENABLED,
      loaded: true,
    };
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
        gamificationEnabled: flags.gamificationEnabled,
        leaderboardsEnabled: flags.leaderboardsEnabled,
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
      flags?: Record<string, { enabled?: boolean }>;
    }>("feature-flags", { method: "GET" });

    if (error) {
      state = cached ?? {
        socialEnabled: FALLBACK_SOCIAL_ENABLED,
        gamificationEnabled: FALLBACK_GAMIFICATION_ENABLED,
        leaderboardsEnabled: FALLBACK_LEADERBOARDS_ENABLED,
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
      gamificationEnabled:
        typeof data?.flags?.gamification?.enabled === "boolean"
          ? data.flags.gamification.enabled
          : FALLBACK_GAMIFICATION_ENABLED,
      leaderboardsEnabled:
        typeof data?.flags?.leaderboards?.enabled === "boolean"
          ? data.flags.leaderboards.enabled
          : FALLBACK_LEADERBOARDS_ENABLED,
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
