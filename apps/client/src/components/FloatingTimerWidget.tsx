import { useLayoutEffect, useRef, useState } from "react";
import { Pause, Play } from "iconoir-react";
import { useTimer } from "@/contexts/TimerContext";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { AdaptiveDialogBody, AdaptiveDialogContent, AdaptiveDialogDescription, AdaptiveDialogFooter, AdaptiveDialogHeader, AdaptiveDialogTitle } from "@/components/ui/adaptive-dialog";
import { formatTime } from "@/utils";
import "./reading-session/reading-session.css";

/** Historical name: this now lives in the measured shell utility slot. */
export const FloatingTimerWidget = () => {
  const { time, isRunning, isVisible, bookTitle, clientSessionId, pauseTimer, resumeTimer, finishTimer, cancelTimer,
    isSaving = false, saveFrozen = false, saveError, storageWarning } = useTimer();
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState(false);
  const [localSaving, setLocalSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const finishing = useRef(false);
  const operation = useRef(0);
  const currentSession = useRef(clientSessionId);
  currentSession.current = clientSessionId;
  const saving = isSaving || localSaving;
  const reviewing = review || saveFrozen;
  useLayoutEffect(() => {
    operation.current += 1; finishing.current = false;
    setOpen(false); setReview(false); setLocalError(null); setLocalSaving(false);
    return () => { operation.current += 1; finishing.current = false; };
  }, [isVisible, clientSessionId]);

  const handleFinish = async () => {
    if (finishing.current || isSaving) return;
    const session = clientSessionId;
    const token = ++operation.current;
    finishing.current = true; setLocalSaving(true); setLocalError(null);
    try { await finishTimer(); }
    catch { if (operation.current === token && currentSession.current === session) setLocalError("The session could not be saved. Your timer is still available; try again."); }
    finally { if (operation.current === token) { finishing.current = false; setLocalSaving(false); } }
  };
  if (!isVisible) return null;
  const error = saveError || localError;
  const state = saving ? "Saving session" : saveFrozen ? "Finish saving" : isRunning ? "Reading" : "Paused";
  return <Dialog open={open} onOpenChange={next => { if (!finishing.current && !isSaving) setOpen(next); }}>
    <section aria-label="Active reading session" className="reading-session-strip">
      <div className="reading-session-strip__book">
        <p>{bookTitle || "Reading session"}</p><span className="reading-session-strip__state">{state}</span>
      </div>
      <span className="reading-session-strip__time" aria-label={`Elapsed time ${formatTime(time)}`}>{formatTime(time)}</span>
      <div className="reading-session-strip__controls">
        {!saveFrozen && <button type="button" className="reading-session__button reading-session__quiet reading-session__icon" disabled={saving}
          onClick={isRunning ? pauseTimer : resumeTimer} aria-label={isRunning ? "Pause timer" : "Resume timer"}>
          {isRunning ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </button>}
        <DialogTrigger asChild><button type="button" className="reading-session__button reading-session__quiet" aria-label="Open timer details">
          {saveFrozen ? "Review" : "Details"}
        </button></DialogTrigger>
      </div>
    </section>
    <AdaptiveDialogContent size="compact" className="reading-session" showClose={!saving} aria-busy={saving}
      onCloseAutoFocus={event => {
        if (document.querySelector('[aria-label="Open timer details"]')) return;
        event.preventDefault();
        const active = document.activeElement?.closest('[role="dialog"], [role="alertdialog"]');
        if (active && active !== event.target && active.getAttribute("data-state") !== "closed") return;
        const target = document.querySelector<HTMLElement>('[data-start-reading-timer], [data-app-scroll-container] h1');
        if (target) { if (!target.hasAttribute("tabindex")) target.tabIndex = -1; target.focus(); }
      }}>
      <AdaptiveDialogHeader>
        <AdaptiveDialogTitle>{reviewing ? "Finish reading" : "Reading session"}</AdaptiveDialogTitle>
        <AdaptiveDialogDescription className="break-words">{bookTitle || "Your current reading session"}</AdaptiveDialogDescription>
      </AdaptiveDialogHeader>
      <AdaptiveDialogBody>
        {reviewing ? <div className="reading-session__summary">
          <p className="reading-session__hint">Reading time to save</p>
          <strong>{Math.max(1, Math.round(time / 60))} {Math.max(1, Math.round(time / 60)) === 1 ? "minute" : "minutes"}</strong>
          <p className="reading-session__hint">Measured {formatTime(time)}, rounded to the nearest minute. Your saved page stays unchanged.</p>
        </div> : <div className="reading-session__clock">
          <p className="reading-session__time" aria-label={`Elapsed time ${formatTime(time)}`}>{formatTime(time)}</p>
          <p className="reading-session__hint">{isRunning ? "Reading in progress" : "Paused — take your time"}</p>
        </div>}
        <p role="status" className="reading-session__hint">{saving ? "Saving reading session..." : reviewing ? "Saved on this device first, then synced when you are online." : "Keep reading at your own pace. You can leave this screen while the timer runs."}</p>
        {error && <p role="alert" className="reading-session__error">{error}</p>}
        {storageWarning && <p role="status" className="reading-session__error">{storageWarning}</p>}
      </AdaptiveDialogBody>
      <AdaptiveDialogFooter className="reading-session__footer">
        <div className="reading-session__actions">
          {reviewing ? <>
            {!saveFrozen && <button type="button" className="reading-session__button" disabled={saving} onClick={() => setReview(false)}>Back to session</button>}
            <button type="button" className="reading-session__button reading-session__primary" disabled={saving || time === 0} onClick={() => void handleFinish()}>{saving ? "Saving..." : error ? "Retry save" : "Save session"}</button>
          </> : <>
            <button type="button" className="reading-session__button" disabled={saving} onClick={isRunning ? pauseTimer : resumeTimer}>{isRunning ? "Pause" : "Resume"}</button>
            <button type="button" className="reading-session__button reading-session__primary" disabled={saving || time === 0}
              onClick={() => { if (isRunning) pauseTimer(); setReview(true); }}>Finish session</button>
          </>}
        </div>
        <button type="button" className="reading-session__button reading-session__quiet" disabled={saving} onClick={cancelTimer}>{saveFrozen ? "Close timer" : "Cancel session"}</button>
      </AdaptiveDialogFooter>
    </AdaptiveDialogContent>
  </Dialog>;
};
