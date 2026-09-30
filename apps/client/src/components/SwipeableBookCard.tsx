import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSwipeable } from "react-swipeable";
import { Trash, CheckCircle, EditPencil } from "iconoir-react";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { LibraryRemoveDialog } from "@/components/library/LibraryRemoveDialog";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { Book } from "@/types";
import { getLocalGestureTouch, observeTouchCancellation } from "@/utils/touchGesture";

interface SwipeableBookCardProps {
  book: Book;
  children: ReactNode;
  onView?: (bookId: string) => void;
  onEdit?: (bookId: string) => void;
  onDelete?: (bookId: string) => Promise<void> | void;
  onStatusChange?: (bookId: string, status: string) => void;
  enabled?: boolean;
}

export const SwipeableBookCard = ({
  book,
  children,
  onView,
  onEdit,
  onDelete,
  onStatusChange,
  enabled = true,
}: SwipeableBookCardProps) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const swipeDirection = useRef<"horizontal" | "vertical" | null>(null);
  const swipeStartOffset = useRef(0);
  const suppressNextClick = useRef(false);
  const contact = useRef<number | null>(null);
  const removeContactListeners = useRef<() => void>();
  const prefersReducedMotion = useReducedMotion();
  const { triggerHaptic } = useHapticFeedback();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const container = useRef<HTMLDivElement | null>(null);
  const returnFocus = useMemo(() => ({ get current() {
    return deleteTrigger.current?.isConnected ? deleteTrigger.current : container.current?.querySelector<HTMLElement>(".library-book-primary") ?? null;
  } }), []);

  const SWIPE_THRESHOLD = 100;
  const MAX_SWIPE = 200;

  const endContact = useCallback(() => {
    contact.current = null;
    removeContactListeners.current?.();
    removeContactListeners.current = undefined;
  }, []);

  const cancelSwipe = useCallback(() => {
    if (contact.current === null) return;
    endContact();
    swipeDirection.current = null;
    suppressNextClick.current = true;
    setIsSwiping(false);
    setSwipeOffset(swipeStartOffset.current);
  }, [endContact]);

  useEffect(() => () => endContact(), [endContact, book.id]);
  useEffect(() => {
    if (!enabled) { endContact(); suppressNextClick.current = false; setSwipeOffset(0); setIsSwiping(false); }
  }, [enabled, endContact]);

  const handlers = useSwipeable({
    onTouchStartOrOnMouseDown: ({ event }) => {
      endContact();
      if (!enabled) return;
      swipeDirection.current = null;
      swipeStartOffset.current = swipeOffset;
      suppressNextClick.current = false;
      if (!('touches' in event)) return;
      const touch = getLocalGestureTouch(event, '.library-book-primary');
      if (!touch) return;
      contact.current = touch.identifier;
      removeContactListeners.current = observeTouchCancellation(touch.identifier, cancelSwipe);
    },
    onSwiping: (e) => {
      // Even a rejected edge/scroll contact must not become a synthesized card tap.
      suppressNextClick.current = true;
      if (contact.current === null) return;
      // Lock direction once the gesture passes the library's movement threshold.
      // A vertical page scroll must never become a book action or block scrolling.
      swipeDirection.current ??= e.absX > e.absY ? "horizontal" : "vertical";
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
      if (contact.current === null) return;
      setIsSwiping(false);
      if (swipeDirection.current !== "horizontal") return;
      if (swipeStartOffset.current + e.deltaX <= -SWIPE_THRESHOLD && e.deltaX < 0) {
        triggerHaptic('medium');
        setSwipeOffset(-MAX_SWIPE);
      } else {
        setSwipeOffset(0);
      }
    },
    onTouchEndOrOnMouseUp: endContact,
    trackMouse: false,
    // Only horizontal gestures call preventDefault above. The built-in option
    // would also cancel vertical scrolling whenever onSwiping is registered.
    preventScrollOnSwipe: false,
    touchEventOptions: { passive: false },
  });

  const swipeRef = handlers.ref;
  const setContainer = useCallback((element: HTMLDivElement | null) => {
    container.current = element;
    swipeRef(element);
  }, [swipeRef]);

  const showActions = enabled && swipeOffset <= -SWIPE_THRESHOLD / 2;
  const isCompleted = book.status === 'completed';

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    triggerHaptic('medium');
    setDeleteOpen(true);
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
    if (!enabled) return;
    const target = event.target as HTMLElement | null;
    if (!target || !event.currentTarget.contains(target) || event.defaultPrevented || target.closest(
      ".library-book-surface,button,a,input,select,textarea,[role='button'],[role='checkbox'],[contenteditable]"
    )) return;
    onView?.(book.id);
  };

  return (
    <>
    <div
      className="relative overflow-hidden"
      {...handlers}
      ref={setContainer}
      onPointerDownCapture={(event) => {
        if (!event.currentTarget.contains(event.target as Node)) return;
        if (event.isPrimary !== false) suppressNextClick.current = false;
      }}
      onTouchCancel={cancelSwipe}
      onClickCapture={(event) => {
        if (!event.currentTarget.contains(event.target as Node)) return;
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
                ref={deleteTrigger}
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
    <LibraryRemoveDialog open={deleteOpen} onOpenChange={setDeleteOpen} returnFocusRef={returnFocus}
      title="Delete this book?" description={`This removes "${book.title}" from your library. You can re-add it later.`}
      onConfirm={async () => { await onDelete?.(book.id); setSwipeOffset(0); }} />
    </>
  );
};
