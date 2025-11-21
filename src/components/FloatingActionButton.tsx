import { useState } from "react";
import { Plus, BookPlus, Camera, Search, Timer, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useTimer } from "@/contexts/TimerContext";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FloatingQuickStatsWidget } from "./FloatingQuickStatsWidget";

interface FABAction {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}

export const FloatingActionButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showTimerSheet, setShowTimerSheet] = useState(false);
  const [showQuickStats, setShowQuickStats] = useState(false);
  const [pressedIndex, setPressedIndex] = useState<number | null>(null);
  const navigate = useNavigate();
  const { triggerHaptic } = useHapticFeedback();
  const { startTimer } = useTimer();
  const { user } = useAuth();
  const { books } = useBooks(user?.id);

  const readingBooks = books.filter(book => book.status === 'reading');

  const actions: FABAction[] = [
    {
      icon: TrendingUp,
      label: "Quick Stats",
      onClick: () => {
        triggerHaptic("light");
        setShowQuickStats(true);
        setIsOpen(false);
      },
    },
    {
      icon: Timer,
      label: "Start Reading Time",
      onClick: () => {
        triggerHaptic("light");
        setShowTimerSheet(true);
        setIsOpen(false);
      },
    },
    {
      icon: BookPlus,
      label: "Add Book",
      onClick: () => {
        triggerHaptic("light");
        navigate("/add-book");
        setIsOpen(false);
      },
    },
    {
      icon: Camera,
      label: "Scan Barcode",
      onClick: () => {
        triggerHaptic("light");
        navigate("/scan-barcode");
        setIsOpen(false);
      },
    },
    {
      icon: Search,
      label: "Search Books",
      onClick: () => {
        triggerHaptic("light");
        navigate("/add-book");
        setIsOpen(false);
      },
    },
  ];

  const handleStartTimer = (bookId: string, bookTitle: string) => {
    triggerHaptic("success");
    startTimer(bookId, bookTitle);
    setShowTimerSheet(false);
  };

  const handleToggle = () => {
    triggerHaptic(isOpen ? "light" : "medium");
    setIsOpen(!isOpen);
  };

  // Calculate arc positions for buttons
  const getArcPosition = (index: number, total: number) => {
    const radius = 120; // Distance from center
    const startAngle = 200; // Start angle in degrees
    const arcSpan = 80; // Total arc span in degrees
    const angle = startAngle + (index * arcSpan) / (total - 1);
    const radian = (angle * Math.PI) / 180;
    
    return {
      bottom: radius * Math.cos(radian),
      right: radius * Math.sin(radian),
    };
  };

  return (
    <div className="md:hidden fixed bottom-20 right-4 z-40">
      {/* Speed Dial Actions in Arc */}
      <div className={cn(
        "absolute inset-0 transition-all duration-300",
        !isOpen && "pointer-events-none"
      )}>
        {actions.map((action, index) => {
          const Icon = action.icon;
          const position = getArcPosition(index, actions.length);
          
          return (
            <div
              key={index}
              className={cn(
                "absolute transition-all duration-300 ease-out",
                isOpen ? "opacity-100 scale-100" : "opacity-0 scale-0"
              )}
              style={{
                bottom: `${position.bottom}px`,
                right: `${position.right}px`,
                transitionDelay: isOpen ? `${index * 50}ms` : "0ms",
              }}
            >
              <div className="flex items-center gap-2">
                <span 
                  className={cn(
                    "bg-popover text-popover-foreground px-3 py-1.5 rounded-lg text-sm font-medium shadow-lg border border-border whitespace-nowrap transition-all duration-200",
                    isOpen ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
                  )}
                  style={{ transitionDelay: isOpen ? `${index * 50 + 100}ms` : "0ms" }}
                >
                  {action.label}
                </span>
                <Button
                  size="icon"
                  onMouseDown={() => setPressedIndex(index)}
                  onMouseUp={() => setPressedIndex(null)}
                  onMouseLeave={() => setPressedIndex(null)}
                  onTouchStart={() => setPressedIndex(index)}
                  onTouchEnd={() => setPressedIndex(null)}
                  onClick={action.onClick}
                  className={cn(
                    "h-12 w-12 rounded-full shadow-lg transition-all duration-200 ease-out",
                    pressedIndex === index && "scale-125"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main FAB */}
      <Button
        size="icon"
        onClick={handleToggle}
        className={cn(
          "h-14 w-14 rounded-full shadow-lg transition-transform duration-300 ease-out",
          isOpen && "rotate-45"
        )}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Timer Book Selection Sheet */}
      <Sheet open={showTimerSheet} onOpenChange={setShowTimerSheet}>
        <SheetContent side="bottom" className="h-[85vh]">
          <SheetHeader>
            <SheetTitle>Start Reading Timer</SheetTitle>
            <SheetDescription>
              Select a book you're currently reading
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(85vh-100px)] mt-4">
            {readingBooks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Timer className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No books currently being read</p>
                <p className="text-sm mt-2">Add books and mark them as "Reading" to start tracking time</p>
              </div>
            ) : (
              <div className="space-y-2">
                {readingBooks.map((book) => (
                  <Button
                    key={book.id}
                    variant="outline"
                    className="w-full h-auto p-4 flex items-start gap-3 hover:bg-accent"
                    onClick={() => handleStartTimer(book.id, book.title)}
                  >
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        className="w-12 h-16 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-16 bg-muted rounded flex items-center justify-center">
                        <BookPlus className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <div className="font-semibold line-clamp-2">{book.title}</div>
                      {book.author && (
                        <div className="text-sm text-muted-foreground">{book.author}</div>
                      )}
                      {book.current_page && book.pages && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Page {book.current_page} of {book.pages}
                        </div>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Quick Stats Widget */}
      <FloatingQuickStatsWidget 
        isVisible={showQuickStats} 
        onClose={() => setShowQuickStats(false)} 
      />
    </div>
  );
};
