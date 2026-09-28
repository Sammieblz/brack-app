import type { RefObject } from "react";
import { Dialog } from "@/components/ui/dialog";
import {
  AdaptiveDialogBody, AdaptiveDialogContent, AdaptiveDialogDescription,
  AdaptiveDialogHeader, AdaptiveDialogTitle,
} from "@/components/ui/adaptive-dialog";
import { LoadingError, LoadingRegion } from "@/components/loading/LoadingRegion";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import { useStreaks } from "@/hooks/useStreaks";

interface FloatingQuickStatsWidgetProps {
  isVisible: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/** Kept as a compatibility export; stats now have one modal focus owner. */
export const FloatingQuickStatsWidget = ({ isVisible, onClose, returnFocusRef }: FloatingQuickStatsWidgetProps) => (
  <Dialog open={isVisible} onOpenChange={(open) => { if (!open) onClose(); }}>
    <AdaptiveDialogContent size="compact" openHaptic={false} onCloseAutoFocus={(event) => {
      if (!returnFocusRef?.current?.isConnected) return;
      event.preventDefault();
      const activeDialog = document.activeElement?.closest('[role="dialog"], [role="alertdialog"]');
      if (activeDialog && activeDialog !== event.target && activeDialog.getAttribute("data-state") !== "closed") return;
      returnFocusRef.current.focus();
    }}>
      <AdaptiveDialogHeader>
        <AdaptiveDialogTitle>Quick stats</AdaptiveDialogTitle>
        <AdaptiveDialogDescription>A snapshot of your reading progress.</AdaptiveDialogDescription>
      </AdaptiveDialogHeader>
      <AdaptiveDialogBody><QuickStatsContent /></AdaptiveDialogBody>
    </AdaptiveDialogContent>
  </Dialog>
);

const QuickStatsContent = () => {
  const { user } = useAuth();
  const { books, loading, refreshing, hasLoaded, error, refetchBooks } = useBooks(user?.id);
  const { streakData, loading: streakLoading } = useStreaks(user?.id);
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const booksReadThisMonth = books.filter((book) => {
    if (book.status !== "completed" || !book.date_finished) return false;
    const finishedDate = new Date(book.date_finished);
    return finishedDate.getMonth() === currentMonth && finishedDate.getFullYear() === currentYear;
  }).length;
  const totalPages = books.filter((book) => book.status === "completed").reduce((sum, book) => sum + (book.pages || 0), 0);
  const totalReadingTime = Math.floor(totalPages / 40) * 60;
  const readingHours = Math.floor(totalReadingTime / 60);
  const readingMinutes = totalReadingTime % 60;

  return <LoadingRegion loading={loading || streakLoading} refreshing={refreshing} label="Loading reading stats">
    {error && <LoadingError message="Reading stats could not be refreshed." onRetry={() => void refetchBooks()} />}
    {loading || streakLoading ? <div className="space-y-3" aria-hidden="true">
      {[0, 1, 2].map((index) => <Skeleton key={index} className="h-16 w-full" />)}
    </div> : error && !hasLoaded ? null : <>
      <dl className="divide-y divide-border">
        <div className="flex flex-wrap items-baseline justify-between gap-3 py-3">
          <dt className="font-sans text-sm text-muted-foreground">Books this month</dt>
          <dd className="font-sans text-2xl font-semibold tabular-nums">{booksReadThisMonth}</dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-3 py-3">
          <dt className="font-sans text-sm text-muted-foreground">Day streak</dt>
          <dd className="font-sans text-2xl font-semibold tabular-nums">{streakData.currentStreak}</dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-3 py-3">
          <dt className="font-sans text-sm text-muted-foreground">Estimated reading time</dt>
          <dd className="font-sans text-2xl font-semibold tabular-nums">{readingHours > 0 ? `${readingHours}h` : `${readingMinutes}m`}</dd>
        </div>
      </dl>
      <p className="mt-3 font-sans text-xs text-muted-foreground">Time estimate uses completed-book pages at 40 pages per hour.</p>
    </>}
  </LoadingRegion>;
};
