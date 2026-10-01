// A presentation destination, never an authorization decision or provider callback URL.
const RETURN_KEY = "brack:auth-return:v1";
const RETURN_TTL_MS = 15 * 60 * 1000;
const destinations = ["/lists", "/book-lists", "/goals-management"] as const;
type ReturnPath = typeof destinations[number];
type Intent = { path: ReturnPath; createdAt: number };
let memoryIntent: Intent | null = null;

const isReturnPath = (path: unknown): path is ReturnPath =>
  typeof path === "string" && destinations.some(destination => destination === path);

export function clearAuthReturnIntent() {
  memoryIntent = null;
  try { window.sessionStorage.removeItem(RETURN_KEY); } catch { /* Per-tab memory remains usable. */ }
}

export function rememberAuthReturnIntent(path: unknown) {
  if (!isReturnPath(path)) { clearAuthReturnIntent(); return; }
  memoryIntent = { path, createdAt: Date.now() };
  try { window.sessionStorage.setItem(RETURN_KEY, JSON.stringify(memoryIntent)); } catch { /* Storage may be disabled. */ }
}

export function getPostAuthDestination(): ReturnPath | "/dashboard" {
  let intent: unknown = memoryIntent;
  try {
    const stored = window.sessionStorage.getItem(RETURN_KEY);
    intent = null;
    if (stored) {
      try { intent = JSON.parse(stored); } catch { /* Malformed persisted state is not a return intent. */ }
    }
  } catch { /* Use memory only when storage is unavailable. */ }
  if (intent && typeof intent === "object" && "path" in intent && "createdAt" in intent &&
    isReturnPath(intent.path) && typeof intent.createdAt === "number" &&
    Number.isFinite(intent.createdAt) && Date.now() >= intent.createdAt && Date.now() - intent.createdAt < RETURN_TTL_MS) {
    return intent.path;
  }
  clearAuthReturnIntent();
  return "/dashboard";
}

// The resolver is also read by the global setup guard. Consume only on arrival,
// so that a guard check cannot steal the destination from Auth or its callback.
export function completeAuthReturnIntent(path: string) {
  if (getPostAuthDestination() === path) clearAuthReturnIntent();
}

export function getReaderSignInPath(path: string) {
  return isReturnPath(path) ? `/auth?mode=signin&returnTo=${encodeURIComponent(path)}` : "/auth?mode=signin";
}
