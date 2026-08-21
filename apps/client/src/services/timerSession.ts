export const TIMER_STORAGE_KEY = "readingTimer";
export const TIMER_RECOVERY_STORAGE_KEY = "readingTimerRecovery";
export const MAX_READING_SESSION_MINUTES = 12 * 60;
export const MAX_READING_SESSION_SECONDS = MAX_READING_SESSION_MINUTES * 60;
export const TIMER_PERSIST_INTERVAL_MS = 30_000;

export type TimerStaleReason = "duration_limit" | "invalid_state";

export interface PersistedTimerState {
  time?: number;
  isRunning?: boolean;
  startTime?: string | Date | null;
  runningSince?: string | Date | null;
  accumulatedSeconds?: number | null;
  bookId?: string | null;
  bookTitle?: string | null;
  clientSessionId?: string | null;
  isVisible?: boolean;
  isMinimized?: boolean;
}

export interface NormalizedTimerState {
  time: number;
  isRunning: boolean;
  startTime: Date | null;
  runningSince: Date | null;
  accumulatedSeconds: number;
  bookId: string | null;
  bookTitle: string | null;
  clientSessionId: string | null;
  isVisible: boolean;
  isMinimized: boolean;
}

export interface StaleTimerSnapshot {
  reason: TimerStaleReason;
  bookId: string;
  bookTitle: string | null;
  clientSessionId: string | null;
  startTime: Date;
  elapsedSeconds: number;
  suggestedMinutes: number;
}

export interface PersistedStaleTimerSnapshot {
  reason?: TimerStaleReason;
  bookId?: string | null;
  bookTitle?: string | null;
  clientSessionId?: string | null;
  startTime?: string | Date | null;
  elapsedSeconds?: number | null;
  suggestedMinutes?: number | null;
}

export type TimerRestoreResult =
  | { kind: "empty" }
  | { kind: "active"; state: NormalizedTimerState }
  | { kind: "stale"; recovery: StaleTimerSnapshot };

export const emptyTimerState = (): NormalizedTimerState => ({
  time: 0,
  isRunning: false,
  startTime: null,
  runningSince: null,
  accumulatedSeconds: 0,
  bookId: null,
  bookTitle: null,
  clientSessionId: null,
  isVisible: false,
  isMinimized: true,
});

const toDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

const toNonNegativeSeconds = (value: unknown): number => {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  return Math.floor(seconds);
};

export const clampSessionMinutes = (minutes: number) => {
  if (!Number.isFinite(minutes)) return 1;
  return Math.min(MAX_READING_SESSION_MINUTES, Math.max(1, Math.round(minutes)));
};

export const getTimerElapsedSeconds = (
  state: Pick<NormalizedTimerState, "isRunning" | "runningSince" | "accumulatedSeconds" | "time">,
  now = new Date(),
) => {
  const accumulated = toNonNegativeSeconds(state.accumulatedSeconds ?? state.time);
  if (!state.isRunning || !state.runningSince) return accumulated;

  const runningSeconds = Math.max(
    0,
    Math.floor((now.getTime() - state.runningSince.getTime()) / 1000),
  );
  return accumulated + runningSeconds;
};

export const refreshTimerState = (
  state: NormalizedTimerState,
  now = new Date(),
): NormalizedTimerState => ({
  ...state,
  time: getTimerElapsedSeconds(state, now),
});

export const isTimerBeyondSessionLimit = (seconds: number) =>
  seconds > MAX_READING_SESSION_SECONDS;

export const createStaleTimerSnapshot = (
  state: NormalizedTimerState,
  now = new Date(),
  reason: TimerStaleReason = "duration_limit",
): StaleTimerSnapshot | null => {
  if (!state.bookId || !state.startTime) return null;

  const elapsedSeconds = getTimerElapsedSeconds(state, now);
  return {
    reason,
    bookId: state.bookId,
    bookTitle: state.bookTitle,
    clientSessionId: state.clientSessionId,
    startTime: state.startTime,
    elapsedSeconds,
    suggestedMinutes: clampSessionMinutes(Math.round(elapsedSeconds / 60)),
  };
};

export const normalizePersistedTimerRecovery = (
  parsed: PersistedStaleTimerSnapshot | null | undefined,
): StaleTimerSnapshot | null => {
  if (!parsed || typeof parsed !== "object") return null;

  const bookId = typeof parsed.bookId === "string" ? parsed.bookId.trim() : "";
  const startTime = toDate(parsed.startTime);
  if (!bookId || !startTime) return null;

  const elapsedSeconds = toNonNegativeSeconds(parsed.elapsedSeconds);
  const suggestedMinutes = clampSessionMinutes(
    Number.isFinite(Number(parsed.suggestedMinutes))
      ? Number(parsed.suggestedMinutes)
      : Math.round(elapsedSeconds / 60),
  );

  return {
    reason: parsed.reason === "invalid_state" ? "invalid_state" : "duration_limit",
    bookId,
    bookTitle: typeof parsed.bookTitle === "string" ? parsed.bookTitle : null,
    clientSessionId:
      typeof parsed.clientSessionId === "string" && parsed.clientSessionId.trim()
        ? parsed.clientSessionId
        : null,
    startTime,
    elapsedSeconds,
    suggestedMinutes,
  };
};

export const normalizePersistedTimerState = (
  parsed: PersistedTimerState,
  now = new Date(),
): TimerRestoreResult => {
  if (!parsed?.isVisible) return { kind: "empty" };

  const startTime = toDate(parsed.startTime);
  const runningSince = toDate(parsed.runningSince);
  const legacyTime = toNonNegativeSeconds(parsed.time);
  const accumulatedSeconds =
    parsed.accumulatedSeconds === null || typeof parsed.accumulatedSeconds === "undefined"
      ? (parsed.isRunning ? 0 : legacyTime)
      : toNonNegativeSeconds(parsed.accumulatedSeconds);

  const state: NormalizedTimerState = {
    time: legacyTime,
    isRunning: Boolean(parsed.isRunning),
    startTime,
    runningSince: parsed.isRunning ? runningSince ?? startTime : null,
    accumulatedSeconds,
    bookId: typeof parsed.bookId === "string" ? parsed.bookId : null,
    bookTitle: typeof parsed.bookTitle === "string" ? parsed.bookTitle : null,
    clientSessionId:
      typeof parsed.clientSessionId === "string" && parsed.clientSessionId.trim()
        ? parsed.clientSessionId
        : null,
    isVisible: Boolean(parsed.isVisible),
    isMinimized: parsed.isMinimized !== false,
  };

  const refreshed = refreshTimerState(state, now);
  if (!refreshed.bookId || !refreshed.startTime) {
    const recovery = createStaleTimerSnapshot(refreshed, now, "invalid_state");
    return recovery ? { kind: "stale", recovery } : { kind: "empty" };
  }

  if (isTimerBeyondSessionLimit(refreshed.time)) {
    return {
      kind: "stale",
      recovery: createStaleTimerSnapshot(refreshed, now, "duration_limit")!,
    };
  }

  return { kind: "active", state: refreshed };
};

export const getSessionEndFromDuration = (startTime: Date, durationMinutes: number) =>
  new Date(startTime.getTime() + clampSessionMinutes(durationMinutes) * 60_000);
