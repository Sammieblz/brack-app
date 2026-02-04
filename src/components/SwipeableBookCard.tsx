import { useState, ReactNode } from "react";
import { useSwipeable } from "react-swipeable";
import { Trash2, CheckCircle2, Edit } from "lucide-react";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useConfirmDialog } from "@/contexts/ConfirmDialogContext";
import type { Book } from "@/types";

interface SwipeableBookCardProps {
  book: Book;
  children: ReactNode;
  onView?: (bookId: string) => void;
  onEdit?: (bookId: string) => void;
  onDelete?: (bookId: string) => void;
  onStatusChange?: (bookId: string, status: string) => void;
}

export const SwipeableBookCard = ({
  book,
  children,
  onView,
  onEdit,
  onDelete,
  onStatusChange,
}: SwipeableBookCardProps) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const { triggerHaptic } = useHapticFeedback();
  const confirmDialog = useConfirmDialog();

  const SWIPE_THRESHOLD = 100;
  const MAX_SWIPE = 200;

  const handlers = useSwipeable({
    onSwiping: (e) => {
      setIsSwiping(true);
      // Only allow left swipe (for actions)
      if (e.deltaX < 0) {
        const offset = Math.max(-MAX_SWIPE, e.deltaX);
        setSwipeOffset(offset);
      } else if (e.deltaX > 0) {
        // Allow right swipe to reset
        const offset = Math.min(MAX_SWIPE / 2, e.deltaX);
        setSwipeOffset(offset);
      }
    },
    onSwipedLeft: (e) => {
      setIsSwiping(false);
      if (Math.abs(e.deltaX) >= SWIPE_THRESHOLD) {
        triggerHaptic('medium');
        // Keep swipe open to show actions
      } else {
        setSwipeOffset(0);
      }
    },
    onSwipedRight: () => {
      setIsSwiping(false);
      setSwipeOffset(0);
    },
    trackMouse: false,
    preventScrollOnSwipe: true,
  });

  const showActions = Math.abs(swipeOffset) >= SWIPE_THRESHOLD / 2;
  const isCompleted = book.status === 'completed';

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('medium');
    const confirmed = await confirmDialog({
      title: "Delete Book?",
      description: `Are you sure you want to delete "${book.title}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: 'destructive',
    });
    if (confirmed) {
      onDelete?.(book.id);
      setSwipeOffset(0);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    onEdit?.(book.id);
    setSwipeOffset(0);
  };

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('success');
    if (isCompleted) {
      onStatusChange?.(book.id, 'reading');
    } else {
      onStatusChange?.(book.id, 'completed');
    }
    setSwipeOffset(0);
  };

  return (
    <div className="relative overflow-hidden" {...handlers}>
      {/* Action Buttons (revealed on swipe) */}
      <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-2 z-10">
        {showActions && (
          <>
            {onEdit && (
              <button
                onClick={handleEdit}
                className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform"
                aria-label="Edit book"
              >
                <Edit className="h-5 w-5" />
              </button>
            )}
            {onStatusChange && (
              <button
                onClick={handleComplete}
                className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform"
                aria-label={isCompleted ? "Mark as reading" : "Mark as complete"}
              >
                <CheckCircle2 className="h-5 w-5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete}
                className="w-12 h-12 rounded-full bg-destructive flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform"
                aria-label="Delete book"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Book Card (slides on swipe) */}
      <div
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
        }}
        className="relative z-20 bg-background"
        onClick={() => onView?.(book.id)}
      >
        {children}
      </div>
    </div>
  );
};
