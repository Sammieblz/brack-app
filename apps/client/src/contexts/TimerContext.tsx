import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { TimerRecoveryDialog } from "@/components/reading-session/TimerRecoveryDialog";
import { useConfirmDialog } from "@/contexts/ConfirmDialogContext";
import { useAuth } from "@/hooks/useAuth";
import { emitBooksChanged } from "@/services/api";
import { booksRepo, createLocalId } from "@/services/local";
import { timerNativeService } from "@/services/timerNative";
import { readingCoreSync } from "@/services/sync/engine";
import { isConnectivityAvailable } from "@/services/connectivity";
import { todayDateOnly } from "@/lib/dateOnly";
import { createSessionCapture, DeletedSessionCapture, ObsoleteSessionCapture, persistSessionCapture, restoreSessionCapture, type SessionCaptureAttempt } from "@/lib/sessionCapture";
import { MAX_READING_SESSION_MINUTES, TIMER_PERSIST_INTERVAL_MS, TIMER_RECOVERY_STORAGE_KEY, TIMER_STORAGE_KEY,
  clampSessionMinutes, createStaleTimerSnapshot, emptyTimerState, getSessionEndFromDuration,
  isTimerBeyondSessionLimit, normalizePersistedTimerRecovery, normalizePersistedTimerState,
  refreshTimerState, type NormalizedTimerState, type StaleTimerSnapshot } from "@/services/timerSession";

type TimerState = NormalizedTimerState;
interface TimerContextType extends TimerState {
  startTimer: (bookId: string, bookTitle: string) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  finishTimer: (showJournalPrompt?: boolean) => Promise<void>;
  cancelTimer: () => void;
  toggleMinimized: () => void;
  hideWidget: () => void;
  isSaving: boolean;
  isStarting: boolean;
  saveError: string | null;
  storageWarning: string | null;
  saveFrozen: boolean;
}
const TimerContext = createContext<TimerContextType | undefined>(undefined);
const pausedState = (state: TimerState): TimerState => {
  const refreshed = refreshTimerState(state);
  return { ...refreshed, isRunning: false, runningSince: null, accumulatedSeconds: refreshed.time };
};
const routeIdentity = () => `${window.location.pathname}${window.location.search}`;
const durationSummary = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}` : `${minutes}m`;

export const TimerProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const authScope = authLoading ? undefined : userId;
  const confirmDialog = useConfirmDialog();
  const [state, setState] = useState<TimerState>(emptyTimerState);
  const [recovery, setRecovery] = useState<StaleTimerSnapshot | null>(null);
  const [recoveryMinutes, setRecoveryMinutes] = useState("30");
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const stateRef = useRef(state);
  const recoveryRef = useRef(recovery);
  const ownerRef = useRef<string | null>(null);
  const scopeRef = useRef(authScope);
  const generationRef = useRef(0);
  const readyRef = useRef(false);
  const operationRef = useRef<"start" | "cancel" | "save" | null>(null);
  const attemptRef = useRef<SessionCaptureAttempt | null>(null);
  const lastPersistedAtRef = useRef(0);
  if (scopeRef.current !== authScope) { scopeRef.current = authScope; generationRef.current += 1; readyRef.current = false; }

  const publishState = useCallback((next: TimerState) => { stateRef.current = next; setState(next); }, []);
  const publishRecovery = useCallback((next: StaleTimerSnapshot | null) => { recoveryRef.current = next; setRecovery(next); }, []);
  const writeStorage = useCallback((key: string, value: unknown | null): boolean => {
    try {
      if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      setStorageWarning("This timer cannot be restored after closing the app because device storage is unavailable. Keep Brack open until you save the session.");
      return false;
    }
  }, []);
  const persistState = useCallback((next: TimerState, owner = ownerRef.current) => {
    if (!owner) return false;
    const completion = attemptRef.current?.userId === owner ? attemptRef.current : undefined;
    const result = writeStorage(`${TIMER_STORAGE_KEY}:${owner}`, next.isVisible ? { ...next, userId: owner, completion } : null);
    lastPersistedAtRef.current = Date.now();
    return result;
  }, [writeStorage]);
  const persistRecovery = useCallback((next: StaleTimerSnapshot | null, owner = ownerRef.current) => {
    if (!owner) return false;
    const completion = attemptRef.current?.userId === owner ? attemptRef.current : undefined;
    return writeStorage(`${TIMER_RECOVERY_STORAGE_KEY}:${owner}`, next ? { ...next, userId: owner, completion } : null);
  }, [writeStorage]);
  const clearActive = useCallback(() => { const empty = emptyTimerState(); publishState(empty); persistState(empty); }, [persistState, publishState]);
  const clearRecovery = useCallback(() => { publishRecovery(null); persistRecovery(null); }, [persistRecovery, publishRecovery]);
  const openRecovery = useCallback((snapshot: StaleTimerSnapshot) => {
    publishRecovery(snapshot); setRecoveryMinutes(String(snapshot.suggestedMinutes)); persistRecovery(snapshot); clearActive();
    toast.warning("Reading timer paused for review", { description: "Review the time you actually read before saving this session." });
  }, [clearActive, persistRecovery, publishRecovery]);

  useLayoutEffect(() => {
    const generation = generationRef.current;
    const departingOwner = ownerRef.current;
    if (departingOwner) {
      if (stateRef.current.isVisible) persistState(pausedState(stateRef.current), departingOwner);
      if (recoveryRef.current) persistRecovery(recoveryRef.current, departingOwner);
    }
    ownerRef.current = null; readyRef.current = false; operationRef.current = null; attemptRef.current = null;
    publishState(emptyTimerState()); publishRecovery(null); setSaveError(null); setStorageWarning(null);
    setIsSaving(false); setIsStarting(false); setRestoring(Boolean(authScope));
    if (!authScope) return;
    const current = () => generationRef.current === generation && scopeRef.current === authScope;
    const restore = async () => {
      // Account-scoped records take precedence. Legacy records are adopted only
      // after resolving their book identity and validating local ownership.
      const candidates = [
        { key: `${TIMER_RECOVERY_STORAGE_KEY}:${authScope}`, recovery: true, scoped: true },
        { key: `${TIMER_STORAGE_KEY}:${authScope}`, recovery: false, scoped: true },
        { key: TIMER_RECOVERY_STORAGE_KEY, recovery: true, scoped: false },
        { key: TIMER_STORAGE_KEY, recovery: false, scoped: false },
      ];
      for (const candidate of candidates) {
        let raw: string | null;
        try { raw = localStorage.getItem(candidate.key); } catch {
          if (current()) setStorageWarning("Device storage is unavailable. Keep Brack open until your reading session is saved.");
          break;
        }
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed.userId && parsed.userId !== authScope) continue;
          const review = candidate.recovery ? normalizePersistedTimerRecovery(parsed) : null;
          const active = candidate.recovery ? null : normalizePersistedTimerState(parsed);
          const snapshot = review || (active?.kind === "stale" ? active.recovery : active?.kind === "active" ? active.state : null);
          if (!snapshot?.bookId) continue;
          const resolvedId = await booksRepo.resolveIdentity(authScope, snapshot.bookId);
          if (!current()) return;
          const localBook = await booksRepo.get(resolvedId);
          if (!current()) return;
          if (!localBook || localBook.user_id !== authScope || localBook.deleted_at) continue;
          ownerRef.current = authScope;
          const clientSessionId = snapshot.clientSessionId || createLocalId();
          const completion = restoreSessionCapture(parsed.completion, authScope);
          attemptRef.current = completion?.session.id === snapshot.clientSessionId ? completion : null;
          if (attemptRef.current) setSaveError("This session was interrupted while saving. Retry to verify and finish the same save.");
          let persisted = false;
          if (review || active?.kind === "stale") {
            const restored = { ...(review || (active as { kind: "stale"; recovery: StaleTimerSnapshot }).recovery), bookId: resolvedId, clientSessionId };
            publishRecovery(restored); setRecoveryMinutes(String(attemptRef.current?.session.duration ?? restored.suggestedMinutes));
            persisted = persistRecovery(restored, authScope);
            persistState(emptyTimerState(), authScope);
          } else if (active?.kind === "active") {
            const restored = { ...(attemptRef.current ? pausedState(active.state) : active.state), bookId: resolvedId, clientSessionId };
            publishState(restored); persisted = persistState(restored, authScope);
          }
          if (!candidate.scoped && persisted) writeStorage(candidate.key, null);
          break;
        } catch (error) {
          if (!current()) return;
          console.error("Unable to restore reading timer:", error);
          setStorageWarning("A saved timer could not be restored. Its stored record has been kept on this device.");
          // Preserve an unreadable owner record; do not silently adopt legacy data over it.
          if (candidate.scoped) break;
        }
      }
      if (!current()) return;
      ownerRef.current = authScope; readyRef.current = true; setRestoring(false);
    };
    void restore();
    return () => { generationRef.current += 1; readyRef.current = false; };
  }, [authScope, persistRecovery, persistState, publishRecovery, publishState, writeStorage]);

  const ownsTask = useCallback(() => Boolean(readyRef.current && ownerRef.current && scopeRef.current === ownerRef.current), []);
  useEffect(() => {
    const refresh = () => {
      if (!ownsTask() || !stateRef.current.isVisible) return;
      const next = refreshTimerState(stateRef.current); publishState(next); persistState(next);
    };
    const cleanupNative = timerNativeService.onAppStateChange(refresh);
    const beforeUnload = () => { if (ownsTask()) { persistState(refreshTimerState(stateRef.current)); persistRecovery(recoveryRef.current); } };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", refresh);
    return () => { cleanupNative(); window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("visibilitychange", refresh); };
  }, [ownsTask, persistRecovery, persistState, publishState]);
  useEffect(() => {
    if (!state.isRunning || !state.isVisible) return;
    const interval = setInterval(() => {
      if (!ownsTask()) return;
      const next = refreshTimerState(stateRef.current); publishState(next);
      if (Date.now() - lastPersistedAtRef.current >= TIMER_PERSIST_INTERVAL_MS) persistState(next);
    }, 1000);
    return () => clearInterval(interval);
  }, [state.isRunning, state.isVisible, ownsTask, persistState, publishState]);
  useEffect(() => {
    if (!ownsTask() || !state.isVisible || recovery || attemptRef.current || operationRef.current === "save" || !isTimerBeyondSessionLimit(state.time)) return;
    const snapshot = createStaleTimerSnapshot(state);
    if (snapshot) openRecovery(snapshot);
  }, [state, recovery, openRecovery, ownsTask]);

  const exposed = !authLoading && ownerRef.current === userId && !restoring ? state : emptyTimerState();
  const notificationMinute = Math.floor(exposed.time / 60);
  useEffect(() => {
    void timerNativeService.syncTimerNotification({ isRunning: exposed.isRunning, isVisible: exposed.isVisible,
      elapsedSeconds: notificationMinute * 60, bookId: exposed.bookId, bookTitle: exposed.bookTitle,
      userId: !authLoading ? userId : null, clientSessionId: exposed.clientSessionId }).catch(error => console.error("Unable to update timer notification:", error));
  }, [exposed.isRunning, exposed.isVisible, exposed.bookId, exposed.bookTitle, exposed.clientSessionId, notificationMinute, authLoading, userId]);

  const pauseTimer = () => {
    if (!ownsTask() || operationRef.current || attemptRef.current || !stateRef.current.isVisible) return;
    const next = pausedState(stateRef.current); publishState(next); persistState(next);
  };
  const resumeTimer = () => {
    if (!ownsTask() || operationRef.current || attemptRef.current || !stateRef.current.isVisible || stateRef.current.isRunning) return;
    const current = refreshTimerState(stateRef.current);
    if (isTimerBeyondSessionLimit(current.time)) { const snapshot = createStaleTimerSnapshot(current); if (snapshot) openRecovery(snapshot); return; }
    const next = { ...current, isRunning: true, runningSince: new Date(), accumulatedSeconds: current.time };
    publishState(next); persistState(next);
  };
  const startTimer = (bookId: string, bookTitle: string) => {
    if (!ownsTask() || operationRef.current || attemptRef.current) return;
    if (recoveryRef.current) { toast.info("Review or discard the old timer before starting another."); return; }
    if (stateRef.current.isVisible && stateRef.current.bookId === bookId) { if (!stateRef.current.isRunning) resumeTimer(); return; }
    const owner = ownerRef.current!; const generation = generationRef.current; const route = routeIdentity();
    const previousSession = stateRef.current.clientSessionId;
    const current = () => generation === generationRef.current && ownsTask() && ownerRef.current === owner && routeIdentity() === route && stateRef.current.clientSessionId === previousSession;
    operationRef.current = "start"; setIsStarting(true);
    void (async () => {
      try {
        const resolvedId = await booksRepo.resolveIdentity(owner, bookId);
        if (!current()) return;
        const localBook = await booksRepo.get(resolvedId);
        if (!current()) return;
        if (!localBook || localBook.user_id !== owner || localBook.deleted_at) { toast.error("Open this book from your library before starting its timer."); return; }
        if (stateRef.current.isVisible) {
          const confirmed = await confirmDialog({ title: "Replace this reading timer?", description: "Starting another timer discards the current unsaved reading time.", confirmText: "Start new timer", cancelText: "Keep current", variant: "destructive" });
          if (!current() || !confirmed) return;
        }
        await timerNativeService.requestNotificationPermissions().catch(error => console.error("Unable to request timer notifications:", error));
        if (!current()) return;
        const now = new Date();
        const next: TimerState = { ...emptyTimerState(), isVisible: true, isRunning: true, startTime: now,
          runningSince: now, bookId: resolvedId, bookTitle: localBook.title || bookTitle, clientSessionId: createLocalId() };
        setSaveError(null); publishState(next); persistState(next);
        toast.success(`Timer started for "${next.bookTitle}"`);
      } catch (error) {
        if (current()) toast.error(error instanceof Error ? error.message : "The timer could not be started. Try again.");
      } finally {
        if (generation === generationRef.current) { operationRef.current = null; setIsStarting(false); }
      }
    })();
  };

  const runSave = useCallback(async (attempt: SessionCaptureAttempt, kind: "active" | "recovery") => {
    if (!ownsTask() || operationRef.current) return;
    const generation = generationRef.current;
    const current = () => generationRef.current === generation && ownsTask() && ownerRef.current === attempt.userId && attemptRef.current === attempt;
    operationRef.current = "save"; setIsSaving(true); setSaveError(null);
    if (kind === "active") persistState(stateRef.current); else persistRecovery(recoveryRef.current);
    try {
      const updatedBook = await persistSessionCapture(attempt, current);
      if (!current()) return;
      attemptRef.current = null;
      if (kind === "active") clearActive(); else clearRecovery();
      // Presentation/event failures must never turn a committed session into a create retry.
      try { emitBooksChanged({ type: "upsert", userId: attempt.userId, book: updatedBook }); } catch (error) { console.error(error); }
      if (isConnectivityAvailable()) void readingCoreSync.syncUser(attempt.userId).catch(console.error);
      toast.success(`Reading session saved on this device: ${durationSummary(attempt.session.duration!)}`);
      window.dispatchEvent(new CustomEvent("readingSessionSaved", { detail: { userId: attempt.userId, bookId: attempt.bookId,
        sessionId: attempt.savedSessionId || attempt.session.id, durationMinutes: attempt.session.duration, activityDate: todayDateOnly(new Date(attempt.session.start_time!)), pendingSync: true } }));
      if (attempt.showJournalPrompt && attempt.session.duration! >= 5) window.dispatchEvent(new CustomEvent("showJournalPrompt", { detail: {
        userId: attempt.userId, bookId: attempt.bookId, bookTitle: attempt.bookTitle, durationMinutes: attempt.session.duration } }));
    } catch (error) {
      if (!current() || error instanceof ObsoleteSessionCapture) return;
      if (kind === "active") persistState(stateRef.current); else persistRecovery(recoveryRef.current);
      setSaveError(error instanceof DeletedSessionCapture ? error.message : attempt.sessionCommitted ? "Your reading time is saved on this device. The book update failed. Retry to finish this same session without adding another."
        : attempt.sessionAttempted ? "This save could not be confirmed. Retry to check this same session before creating anything else."
          : error instanceof Error ? error.message : "The session could not be saved. Your paused timer is retained; try again.");
    } finally {
      if (generation === generationRef.current) { operationRef.current = null; setIsSaving(false); }
    }
  }, [clearActive, clearRecovery, ownsTask, persistRecovery, persistState]);

  const finishTimer = useCallback(async (showJournalPrompt = true) => {
    if (!ownsTask() || operationRef.current || recoveryRef.current) return;
    if (attemptRef.current) { await runSave(attemptRef.current, "active"); return; }
    const current = refreshTimerState(stateRef.current);
    if (!current.isVisible || !current.bookId || !current.startTime) return;
    if (current.time === 0) { setSaveError("Read for a moment before finishing this session."); return; }
    if (isTimerBeyondSessionLimit(current.time)) { const snapshot = createStaleTimerSnapshot(current); if (snapshot) openRecovery(snapshot); return; }
    const paused = pausedState(current); publishState(paused);
    attemptRef.current = createSessionCapture({ userId: ownerRef.current!, bookId: current.bookId, bookTitle: current.bookTitle,
      startTime: current.startTime, endTime: new Date(), durationMinutes: clampSessionMinutes(current.time / 60),
      clientSessionId: current.clientSessionId, showJournalPrompt });
    // Retain the generated identity even for legacy state without clientSessionId.
    const frozen = { ...paused, clientSessionId: attemptRef.current.session.id }; publishState(frozen);
    await runSave(attemptRef.current, "active");
  }, [openRecovery, ownsTask, publishState, runSave]);
  useEffect(() => timerNativeService.onTimerAction((action, identity) => {
    if (action === "stop" && identity?.userId === ownerRef.current && identity?.clientSessionId === stateRef.current.clientSessionId) void finishTimer(false);
  }), [finishTimer]);

  const cancelTimer = () => {
    if (!ownsTask() || operationRef.current || !stateRef.current.isVisible) return;
    const generation = generationRef.current; const session = stateRef.current.clientSessionId; const route = routeIdentity();
    operationRef.current = "cancel";
    void (async () => {
      try {
        const confirmed = await confirmDialog({ title: attemptRef.current ? "Close this session save?" : "Discard this reading session?",
          description: attemptRef.current ? "Some reading time may already be saved. Closing does not delete it. Keep the timer to retry this same save." : "The time recorded by this timer has not been saved and will be discarded.",
          confirmText: attemptRef.current ? "Close timer" : "Discard session", cancelText: "Keep timer", variant: "destructive" });
        if (!confirmed || generation !== generationRef.current || !ownsTask() || stateRef.current.clientSessionId !== session || routeIdentity() !== route) return;
        attemptRef.current = null; setSaveError(null); clearActive(); toast.info("Timer closed");
      } finally { if (generation === generationRef.current) operationRef.current = null; }
    })();
  };
  const saveRecovery = () => {
    if (!ownsTask() || operationRef.current || !recoveryRef.current) return;
    if (attemptRef.current) { void runSave(attemptRef.current, "recovery"); return; }
    const minutes = Number(recoveryMinutes);
    if (!/^\d+$/.test(recoveryMinutes.trim()) || !Number.isSafeInteger(minutes) || minutes < 1 || minutes > MAX_READING_SESSION_MINUTES) { setSaveError("Enter a whole number of minutes from 1 to 720."); return; }
    const snapshot = recoveryRef.current;
    attemptRef.current = createSessionCapture({ userId: ownerRef.current!, bookId: snapshot.bookId, bookTitle: snapshot.bookTitle,
      startTime: snapshot.startTime, endTime: getSessionEndFromDuration(snapshot.startTime, minutes), durationMinutes: minutes,
      clientSessionId: snapshot.clientSessionId, showJournalPrompt: minutes >= 5 });
    publishRecovery({ ...snapshot, clientSessionId: attemptRef.current.session.id });
    void runSave(attemptRef.current, "recovery");
  };
  const discardRecovery = () => {
    if (!ownsTask() || operationRef.current) return;
    attemptRef.current = null; setSaveError(null); clearRecovery(); toast.info("Old timer closed");
  };
  return <TimerContext.Provider value={{ ...exposed, startTimer, pauseTimer, resumeTimer, finishTimer, cancelTimer,
    toggleMinimized: () => { if (ownsTask() && !operationRef.current) { const next = { ...stateRef.current, isMinimized: !stateRef.current.isMinimized }; publishState(next); persistState(next); } },
    // A hidden widget used to silently discard restoration. Retain the session and minimize it instead.
    hideWidget: () => { if (ownsTask() && !operationRef.current) { const next = { ...pausedState(stateRef.current), isMinimized: true }; publishState(next); persistState(next); } },
    isSaving: Boolean(!authLoading && ownerRef.current === userId && isSaving), isStarting: isStarting || restoring,
    saveError: !authLoading && ownerRef.current === userId ? saveError : null,
    storageWarning: !authLoading && ownerRef.current === userId ? storageWarning : null, saveFrozen: Boolean(!authLoading && ownerRef.current === userId && attemptRef.current) }}>
    {children}
    {!authLoading && ownerRef.current === userId && !restoring && recovery && <TimerRecoveryDialog key={`${userId}:${recovery.clientSessionId || recovery.bookId}`}
      recovery={recovery} minutes={recoveryMinutes} onMinutesChange={setRecoveryMinutes} onSave={saveRecovery} onDiscard={discardRecovery}
      isSaving={isSaving} saveFrozen={Boolean(attemptRef.current)} saveError={saveError} storageWarning={storageWarning} />}
  </TimerContext.Provider>;
};
export const useTimer = () => { const context = useContext(TimerContext); if (!context) throw new Error("useTimer must be used within TimerProvider"); return context; };
