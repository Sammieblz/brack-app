import { useState } from "react";
import { Plus, BookPlus, Camera, Search, Timer, TrendingUp, Clock, ListPlus, Scan } from "lucide-react";
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
      icon: Scan,
      label: "Scan Cover",
      onClick: () => {
        triggerHaptic("light");
        navigate("/scan-cover");
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
    {
      icon: Clock,
      label: "Reading History",
      onClick: () => {
        triggerHaptic("light");
        navigate("/history");
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

  const dockOffset = "calc(max(env(safe-area-inset-bottom), 24px) + 92px)";

  return (
    <div
      className="md:hidden fixed inset-x-0 z-[60] pointer-events-none flex justify-center"
      style={{ bottom: dockOffset }}
    >
      {/* Speed Dial Actions */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex flex-col items-end gap-3 mb-4 transition-all duration-200 pointer-events-auto",
            isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          )}
        >
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <div
                key={index}
                className="flex items-center gap-3 justify-end animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="bg-popover/95 text-popover-foreground px-3.5 py-2 rounded-xl text-sm font-semibold shadow-[0_14px_32px_rgba(0,0,0,0.35)] border border-border/80 whitespace-nowrap supports-[backdrop-filter]:backdrop-blur-md">
                  {action.label}
                </span>
                <Button
                  size="icon"
                  onClick={action.onClick}
                  className="h-12 w-12 rounded-full shadow-[0_18px_38px_rgba(0,0,0,0.45)] bg-primary text-primary-foreground hover:bg-primary/90 border border-white/12"
                >
                  <Icon className="h-5 w-5" />
                </Button>
              </div>
            );
          })}
        </div>

        {/* Main FAB */}
        <div className="pointer-events-auto">
          <Button
            size="icon"
            onClick={handleToggle}
            className={cn(
              "h-16 w-16 rounded-full shadow-[0_22px_50px_rgba(0,0,0,0.48)] bg-primary text-primary-foreground transition-transform supports-[backdrop-filter]:backdrop-blur-xl border border-white/12",
              isOpen && "rotate-45"
            )}
          >
            <Plus className="h-7 w-7" />
          </Button>
        </div>
      </div>

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
                <p className="font-sans">No books currently being read</p>
                <p className="font-sans text-sm mt-2">Add books and mark them as "Reading" to start tracking time</p>
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
                      <div className="font-serif font-semibold line-clamp-2">{book.title}</div>
                      {book.author && (
                        <div className="font-serif text-sm text-muted-foreground">{book.author}</div>
                      )}
                      {book.current_page && book.pages && (
                        <div className="font-sans text-xs text-muted-foreground mt-1">
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
