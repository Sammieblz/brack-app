interface LevelCursorStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

const AUTHENTICATED_APP_ROUTE_PREFIXES = [
  "/dashboard",
  "/my-books",
  "/books",
  "/analytics",
  "/add-book",
  "/book",
  "/edit-book",
  "/scan-barcode",
  "/scan",
  "/scan-cover",
  "/history",
  "/profile",
  "/settings",
  "/achievements",
  "/book-lists",
  "/lists",
  "/goals-management",
  "/users",
  "/reviews",
  "/feed",
  "/posts",
  "/clubs",
  "/readers",
  "/messages",
] as const;

export const isJourneyLevelObserverRoute = (pathname: string) =>
  AUTHENTICATED_APP_ROUTE_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`));

export const advanceJourneyLevelCursor = (
  userId: string,
  currentLevel: number,
  storage?: LevelCursorStorage,
) => {
  try {
    const durableStorage = storage
      ?? (typeof window !== "undefined" ? window.localStorage : null);
    if (!durableStorage) return null;

    const key = `brack:journey-level:${userId}`;
    const storedLevel = Number(durableStorage.getItem(key) || 0);
    durableStorage.setItem(key, String(currentLevel));
    return Number.isFinite(storedLevel) ? storedLevel : 0;
  } catch {
    // Without a durable cursor, celebrating could replay on every app load.
    return null;
  }
};
