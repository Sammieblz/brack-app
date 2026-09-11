import { useRef, useState, type ReactNode } from "react";
import { useSwipeable } from "react-swipeable";
import { Trash, CheckCircle, EditPencil } from "iconoir-react";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useConfirmDialog } from "@/contexts/ConfirmDialogContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
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
  const swipeDirection = useRef<"horizontal" | "vertical" | null>(null);
  const swipeStartOffset = useRef(0);
  const suppressNextClick = useRef(false);
  const prefersReducedMotion = useReducedMotion();
  const { triggerHaptic } = useHapticFeedback();
  const confirmDialog = useConfirmDialog();

  const SWIPE_THRESHOLD = 100;
  const MAX_SWIPE = 200;

  const handlers = useSwipeable({
    onTouchStartOrOnMouseDown: () => {
      swipeDirection.current = null;
      swipeStartOffset.current = swipeOffset;
      suppressNextClick.current = false;
    },
    onSwiping: (e) => {
      // Lock direction once the gesture passes the library's movement threshold.
      // A vertical page scroll must never become a book action or block scrolling.
      swipeDirection.current ??= e.absX > e.absY ? "horizontal" : "vertical";
      suppressNextClick.current = true;
      if (swipeDirection.current !== "horizontal") return;
      if (e.event.cancelable) e.event.preventDefault();
      setIsSwiping(true);
      const offset = swipeStartOffset.current + e.deltaX;
      // Follow the finger directly inside the action tray; damp overscroll.
      setSwipeOffset(offset < -MAX_SWIPE
        ? -MAX_SWIPE + (offset + MAX_SWIPE) * 0.2
        : offset > 0 ? offset * 0.2 : offset);
    },
    onSwiped: (e) => {
      setIsSwiping(false);
      if (swipeDirection.current !== "horizontal") return;
      if (swipeStartOffset.current + e.deltaX <= -SWIPE_THRESHOLD && e.deltaX < 0) {
        triggerHaptic('medium');
        setSwipeOffset(-MAX_SWIPE);
      } else {
        setSwipeOffset(0);
      }
    },
    trackMouse: false,
    // Only horizontal gestures call preventDefault above. The built-in option
    // would also cancel vertical scrolling whenever onSwiping is registered.
    preventScrollOnSwipe: false,
    touchEventOptions: { passive: false },
  });

  const showActions = swipeOffset <= -SWIPE_THRESHOLD / 2;
  const isCompleted = book.status === 'completed';

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('medium');
    const confirmed = await confirmDialog({
      title: "Delete Book?",
      description: `Are you sure you want to delete "${book.title}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
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

  const handleCardClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (event.defaultPrevented || target?.closest(
      ".library-book-surface,button,a,input,select,textarea,[role='button'],[role='checkbox'],[contenteditable]"
    )) return;
    onView?.(book.id);
  };

  return (
    <div
      className="relative overflow-hidden"
      {...handlers}
      onPointerDownCapture={() => { suppressNextClick.current = false; }}
      onTouchCancel={() => {
        setIsSwiping(false);
        setSwipeOffset(swipeStartOffset.current);
        suppressNextClick.current = true;
      }}
      onClickCapture={(event) => {
        // Capture runs before the card's native primary button. A completed or
        // cancelled swipe must not also open/select the book underneath it.
        // Keyboard activation has detail=0 and remains independent of touch.
        if (!suppressNextClick.current || event.detail === 0) return;
        event.preventDefault();
        event.stopPropagation();
        suppressNextClick.current = false;
      }}
    >
      {/* Action Buttons (revealed on swipe) */}
      <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-2 z-10">
        {showActions && (
          <>
            {onEdit && (
              <button
                type="button"
                onClick={handleEdit}
                className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform"
                aria-label="Edit book"
              >
                <EditPencil className="h-5 w-5" />
              </button>
            )}
            {onStatusChange && (
              <button
                type="button"
                onClick={handleComplete}
                className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform"
                aria-label={isCompleted ? "Mark as reading" : "Mark as complete"}
              >
                <CheckCircle className="h-5 w-5" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="w-12 h-12 rounded-full bg-destructive flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform"
                aria-label="Delete book"
              >
                <Trash className="h-5 w-5" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Book Card (slides on swipe) */}
      <div
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping || prefersReducedMotion ? 'none' : 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
        }}
        className="relative z-20 bg-background"
        onClick={handleCardClick}
      >
        {children}
      </div>
    </div>
  );
};
