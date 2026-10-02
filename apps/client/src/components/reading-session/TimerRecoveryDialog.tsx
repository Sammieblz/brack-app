import { useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { AdaptiveDialogBody, AdaptiveDialogContent, AdaptiveDialogDescription, AdaptiveDialogFooter, AdaptiveDialogHeader, AdaptiveDialogTitle } from "@/components/ui/adaptive-dialog";
import { MobileAlertDialog } from "@/components/ui/mobile-dialog";
import type { StaleTimerSnapshot } from "@/services/timerSession";
import "./timer-recovery.css";

export interface TimerRecoveryDialogProps {
  recovery: StaleTimerSnapshot;
  minutes: string;
  onMinutesChange: (value: string) => void;
  onSave: () => void;
  onDiscard: () => void;
  isSaving: boolean;
  saveFrozen: boolean;
  saveError: string | null;
  storageWarning: string | null;
}

export function TimerRecoveryDialog({ recovery, minutes, onMinutesChange, onSave, onDiscard,
  isSaving, saveFrozen, saveError, storageWarning }: TimerRecoveryDialogProps) {
  const [discardOpen, setDiscardOpen] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const close = () => { if (!isSaving) setDiscardOpen(true); };
  return <>
    <Dialog open onOpenChange={next => { if (!next) close(); }}>
      <AdaptiveDialogContent size="compact" className="timer-recovery" showClose={!isSaving} aria-busy={isSaving}
        onOpenAutoFocus={event => {
          event.preventDefault();
          const target = !inputRef.current?.disabled ? inputRef.current : !saveRef.current?.disabled ? saveRef.current : titleRef.current;
          target?.focus();
        }}>
        <AdaptiveDialogHeader>
          <AdaptiveDialogTitle ref={titleRef} tabIndex={-1}>Review old timer</AdaptiveDialogTitle>
          <AdaptiveDialogDescription>This timer passed the 12-hour safety limit. Enter the time you actually read before saving.</AdaptiveDialogDescription>
        </AdaptiveDialogHeader>
        <form noValidate onSubmit={event => {
          event.preventDefault();
          if (isSaving) return;
          if (!/^\d+$/.test(minutes.trim()) || !Number.isSafeInteger(Number(minutes)) || Number(minutes) < 1 || Number(minutes) > 720) {
            setValidation("Enter a whole number of minutes from 1 to 720."); inputRef.current?.focus(); return;
          }
          setValidation(null); onSave();
        }}>
          <AdaptiveDialogBody>
            <p className="timer-recovery__book">{recovery.bookTitle || "Reading session"}</p>
            <p className="timer-recovery__hint">The timer recorded about {Math.round(recovery.elapsedSeconds / 3600).toLocaleString()} hours. Only the minutes you enter will be saved.</p>
            <label htmlFor="timer-recovery-minutes">Minutes actually read</label>
            <input ref={inputRef} id="timer-recovery-minutes" type="text" inputMode="numeric" autoComplete="off"
              disabled={isSaving || saveFrozen} value={minutes} aria-invalid={Boolean(validation)}
              aria-describedby={`timer-recovery-help${validation ? " timer-recovery-validation" : ""}`}
              onChange={event => { setValidation(null); onMinutesChange(event.target.value); }} />
            <p id="timer-recovery-help" className="timer-recovery__hint">1 to 720 minutes. This records reading time; your saved page stays unchanged.</p>
            {validation && <p id="timer-recovery-validation" role="alert" className="timer-recovery__error">{validation}</p>}
            {saveError && <p role="alert" className="timer-recovery__error">{saveError}</p>}
            {storageWarning && <p role="status" className="timer-recovery__error">{storageWarning}</p>}
            <p role="status" className="timer-recovery__hint">{isSaving ? "Saving reading session..." : "Saved sessions stay on this device until they sync."}</p>
          </AdaptiveDialogBody>
          <AdaptiveDialogFooter>
            <button type="button" className="timer-recovery__button" disabled={isSaving} onClick={close}>Discard timer</button>
            <button ref={saveRef} type="submit" className="timer-recovery__button timer-recovery__save" disabled={isSaving}>{isSaving ? "Saving..." : saveError ? "Retry save" : "Save reviewed time"}</button>
          </AdaptiveDialogFooter>
        </form>
      </AdaptiveDialogContent>
    </Dialog>
    <MobileAlertDialog open={discardOpen} onOpenChange={setDiscardOpen}
      title={saveFrozen ? "Close this session save?" : "Discard this timer?"}
      description={saveFrozen ? "Some reading time may already be saved on this device. Closing does not delete it. Keep reviewing to retry the same session safely." : "The reviewed minutes and this timer will be discarded. Your previously saved reading activity stays unchanged."}
      cancelText="Keep reviewing" confirmText={saveFrozen ? "Close timer" : "Discard timer"} variant="destructive" onConfirm={onDiscard} />
  </>;
}
