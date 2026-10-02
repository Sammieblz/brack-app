import { Timer } from "iconoir-react";
import { useTimer } from "@/contexts/TimerContext";
import { useReadingSessionTasks } from "@/components/reading-session/ReadingSessionTasks";
export { TimerPickerContent } from "@/components/reading-session/ReadingSessionTasks";

export const HeaderTimerWidget = () => {
  const { isVisible, isStarting = false } = useTimer();
  const openPicker = useReadingSessionTasks();
  if (isVisible) return null;
  return <button type="button" className="reading-session__button reading-session__icon" data-start-reading-timer
    aria-label="Start reading timer" aria-haspopup="dialog" disabled={isStarting} onClick={event => openPicker(event.currentTarget)}>
    <Timer aria-hidden="true" /><span className="hidden lg:inline ml-2">Start timer</span>
  </button>;
};
