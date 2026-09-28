import { useEffect, useRef, useState } from "react";
import { Pause, Play, Square, Timer } from "iconoir-react";
import { useTimer } from "@/contexts/TimerContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  AdaptiveDialogBody,
  AdaptiveDialogContent,
  AdaptiveDialogDescription,
  AdaptiveDialogFooter,
  AdaptiveDialogHeader,
  AdaptiveDialogTitle,
} from "@/components/ui/adaptive-dialog";
import { formatTime } from "@/utils";

/** The historical export now renders inside the shell's measured utility area. */
export const FloatingTimerWidget = () => {
  const { time, isRunning, isVisible, bookTitle, pauseTimer, resumeTimer, finishTimer, cancelTimer } = useTimer();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finishing = useRef(false);
  useEffect(() => {
    if (!isVisible) {
      setOpen(false);
      setError(null);
    }
  }, [isVisible]);

  const handleFinish = async () => {
    if (finishing.current) return;
    finishing.current = true;
    setSaving(true);
    setError(null);
    try {
      // The provider owns local persistence, recovery, error feedback and the
      // journal prompt. A resolved promise is not proof that saving succeeded:
      // retain these controls until the provider clears the active session.
      await finishTimer();
    } catch {
      setError("The session could not be saved. Your timer is still available; try again.");
    } finally {
      finishing.current = false;
      setSaving(false);
    }
  };

  if (!isVisible) return null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!finishing.current) setOpen(nextOpen); }}>
      <section aria-label="Active reading session" className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
        <Timer className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-[1_1_8rem]">
          <p className="truncate font-serif text-sm font-semibold">{bookTitle || "Reading session"}</p>
          <p className="font-sans text-xs text-muted-foreground">{isRunning ? "Reading" : "Paused"}</p>
        </div>
        <span className="font-mono text-sm font-semibold tabular-nums" aria-label={`Elapsed time ${formatTime(time)}`}>
          {formatTime(time)}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button type="button" variant="ghost" size="icon" disabled={saving}
            onClick={isRunning ? pauseTimer : resumeTimer} aria-label={isRunning ? "Pause timer" : "Resume timer"}>
            {isRunning ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </Button>
          <DialogTrigger asChild>
            <Button type="button" variant="ghost" disableHaptic className="h-auto whitespace-normal" aria-label="Open timer details">Details</Button>
          </DialogTrigger>
        </div>
      </section>
      <AdaptiveDialogContent size="compact" showClose={!saving} aria-busy={saving}>
        <AdaptiveDialogHeader>
          <AdaptiveDialogTitle>Reading session</AdaptiveDialogTitle>
          <AdaptiveDialogDescription className="break-words">{bookTitle || "Your current reading session"}</AdaptiveDialogDescription>
        </AdaptiveDialogHeader>
        <AdaptiveDialogBody>
          <p className="font-mono text-4xl font-semibold tabular-nums">{formatTime(time)}</p>
          <p className="mt-2 font-sans text-sm text-muted-foreground">{isRunning ? "Reading in progress" : "Paused"}</p>
          <p role="status" className="mt-3 font-sans text-sm">{saving ? "Saving reading session…" : ""}</p>
          {error && <p role="alert" className="mt-3 font-sans text-sm">{error}</p>}
        </AdaptiveDialogBody>
        <AdaptiveDialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={isRunning ? pauseTimer : resumeTimer}>
            {isRunning ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}{isRunning ? "Pause" : "Resume"}
          </Button>
          <Button type="button" disabled={saving || time === 0} onClick={() => void handleFinish()}>
            <Square aria-hidden="true" />{saving ? "Saving…" : "Finish session"}
          </Button>
          <Button type="button" variant="ghost" disabled={saving} onClick={cancelTimer}>
            Cancel session
          </Button>
        </AdaptiveDialogFooter>
      </AdaptiveDialogContent>
    </Dialog>
  );
};
