export type AppHistoryAction = "POP" | "PUSH" | "REPLACE";

export interface AppHistoryPosition {
  key: string;
  index: number | null;
  /** null is a resolved anonymous session; defer observation while auth is loading. */
  scope: string | null;
}

export interface AppHistoryObservation extends AppHistoryPosition {
  action: AppHistoryAction;
  boundary: boolean;
}

export interface AppHistoryTracker {
  observe(position: AppHistoryObservation): boolean;
  canGoBack(position: AppHistoryPosition): boolean;
  reset(): void;
}

type HistoryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
interface HistoryEntry {
  key: string;
  index: number;
  predecessor: string | null;
}
interface HistoryLedger {
  version: 1;
  scope: string | null;
  entries: HistoryEntry[];
}

export const APP_HISTORY_STORAGE_KEY = "brack.navigation.ancestry.v1";
export const APP_HISTORY_MAX_ENTRIES = 128;
const MAX_IDENTIFIER_LENGTH = 256;
const MAX_SERIALIZED_LENGTH = 100_000;

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_IDENTIFIER_LENGTH;
}

function validScope(value: unknown): value is string | null {
  return value === null || validIdentifier(value);
}

function validIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function sessionStorageIfAvailable(): HistoryStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

function readLedger(raw: string): HistoryLedger | null {
  if (raw.length > MAX_SERIALIZED_LENGTH) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const ledger = value as Partial<HistoryLedger>;
    if (ledger.version !== 1 || !validScope(ledger.scope) || !Array.isArray(ledger.entries)
      || ledger.entries.length === 0 || ledger.entries.length > APP_HISTORY_MAX_ENTRIES) return null;

    const entries: HistoryEntry[] = [];
    const keys = new Set<string>();
    for (const candidate of ledger.entries) {
      if (!candidate || typeof candidate !== "object" || !validIdentifier(candidate.key)
        || !validIndex(candidate.index) || keys.has(candidate.key)) return null;
      const previous = entries.at(-1);
      // Our stored branch is contiguous. Never infer a missing or corrupted link.
      if (previous
        ? candidate.predecessor !== previous.key || candidate.index !== previous.index + 1
        : candidate.predecessor !== null) return null;
      entries.push({ key: candidate.key, index: candidate.index, predecessor: candidate.predecessor });
      keys.add(candidate.key);
    }
    return { version: 1, scope: ledger.scope, entries };
  } catch {
    return null;
  }
}

/**
 * Tracks only entries this app observed in one tab and account scope. Router idx
 * alone does not establish app ancestry. The caller must also match the live
 * browser history key to React Router's location key before observing/activating.
 * No history state, URL, search string, form value, or token is persisted.
 */
export function createAppHistoryTracker(storage: HistoryStorage | undefined = sessionStorageIfAvailable()): AppHistoryTracker {
  let entries: HistoryEntry[] = [];
  let scope: string | null = null;
  let initialized = false;
  let current: HistoryEntry | null = null;

  const forgetStorage = () => {
    try {
      storage?.removeItem(APP_HISTORY_STORAGE_KEY);
    } catch {
      // Storage can be disabled independently of navigation. Keep memory usable.
    }
  };

  const reset = () => {
    entries = [];
    current = null;
    scope = null;
    initialized = false;
    forgetStorage();
  };

  const persist = () => {
    try {
      storage?.setItem(APP_HISTORY_STORAGE_KEY, JSON.stringify({ version: 1, scope, entries } satisfies HistoryLedger));
    } catch {
      // Best effort removal prevents restoring an older branch after a failed write.
      forgetStorage();
    }
  };

  try {
    const raw = storage?.getItem(APP_HISTORY_STORAGE_KEY);
    if (raw !== null && raw !== undefined) {
      const ledger = readLedger(raw);
      if (ledger) {
        entries = ledger.entries;
        scope = ledger.scope;
        initialized = true;
      } else {
        forgetStorage();
      }
    }
  } catch {
    // A denied read is equivalent to a fresh in-memory session.
  }

  const canGoBack = (position: AppHistoryPosition): boolean => {
    if (!initialized || !current || position.scope !== scope || position.key !== current.key
      || position.index !== current.index || current.predecessor === null) return false;
    return entries.some(entry => entry.key === current.predecessor && entry.index === current.index - 1);
  };

  const observe = (position: AppHistoryObservation): boolean => {
    if (position.boundary || !validIdentifier(position.key) || !validIndex(position.index)
      || !validScope(position.scope) || !["POP", "PUSH", "REPLACE"].includes(position.action)) {
      reset();
      return false;
    }

    if (initialized && scope !== position.scope) reset();
    scope = position.scope;
    initialized = true;

    // StrictMode, rerenders, and repeated route observations must not change a branch.
    if (current?.key === position.key && current.index === position.index) return canGoBack(position);

    const known = entries.find(entry => entry.key === position.key && entry.index === position.index);
    if ((!current || position.action === "POP") && known) {
      current = known;
      return canGoBack(position);
    }

    const previous = current;
    const keyCollision = entries.some(entry => entry.key === position.key);
    if (position.action === "PUSH" && previous && position.index === previous.index + 1 && !keyCollision) {
      entries = entries.filter(entry => entry.index <= previous.index);
      current = { key: position.key, index: position.index, predecessor: previous.key };
      entries.push(current);
      if (entries.length > APP_HISTORY_MAX_ENTRIES) {
        entries = entries.slice(-APP_HISTORY_MAX_ENTRIES);
        entries[0] = { ...entries[0], predecessor: null };
      }
    } else if (position.action === "REPLACE" && previous && position.index === previous.index && !keyCollision) {
      current = { key: position.key, index: position.index, predecessor: previous.predecessor };
      const replacement = current;
      // Replacing a previous entry does not remove the browser's forward branch.
      entries = entries.map(entry => entry.key === previous.key
        ? replacement
        : entry.predecessor === previous.key ? { ...entry, predecessor: replacement.key } : entry);
    } else {
      // Direct links, unknown POPs, and index gaps start a new observed branch.
      current = { key: position.key, index: position.index, predecessor: null };
      entries = [current];
    }
    persist();
    return canGoBack(position);
  };

  return { observe, canGoBack, reset };
}
