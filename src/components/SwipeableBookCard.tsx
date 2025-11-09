import { useState } from "react";
import { useSwipeable } from "react-swipeable";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { Trash2, Edit, Eye } from "lucide-react";
import { BookCard } from "./BookCard";

interface SwipeableBookCardProps {
  book: any;
  onDelete?: (bookId: string) => void;
  onEdit?: (bookId: string) => void;
  onView?: (bookId: string) => void;
  children?: React.ReactNode;
}

export const SwipeableBookCard = ({ 
  book, 
  onDelete, 
  onEdit, 
  onView,
  children 
}: SwipeableBookCardProps) => {
  const { triggerHaptic } = useHapticFeedback();
  const [swipedId, setSwipedId] = useState<string | null>(null);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      triggerHaptic('light');
      setSwipedId(book.id);
    },
    onSwipedRight: () => {
      triggerHaptic('light');
      setSwipedId(null);
    },
    trackMouse: false,
  });

  const isSwiped = swipedId === book.id;

  const handleAction = (action: () => void, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('medium');
    action();
    setSwipedId(null);
  };

  return (
    <div {...swipeHandlers} className="relative">
      <div
        className={`${isSwiped ? 'translate-x-[-120px]' : ''} transition-transform duration-300`}
      >
        {children || <BookCard book={book} />}
      </div>
      
      {/* Swipe Actions */}
      {isSwiped && (
        <div className="absolute right-0 top-0 h-full flex items-center gap-2 pr-2">
          {onView && (
            <button
              onClick={(e) => handleAction(() => onView(book.id), e)}
              className="bg-blue-500 text-white p-3 rounded-lg"
            >
              <Eye className="h-5 w-5" />
            </button>
          )}
          {onEdit && (
            <button
              onClick={(e) => handleAction(() => onEdit(book.id), e)}
              className="bg-primary text-primary-foreground p-3 rounded-lg"
            >
              <Edit className="h-5 w-5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => handleAction(() => onDelete(book.id), e)}
              className="bg-destructive text-destructive-foreground p-3 rounded-lg"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
