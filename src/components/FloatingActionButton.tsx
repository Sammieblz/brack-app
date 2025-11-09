import { useState } from "react";
import { Plus, BookPlus, Camera, Search, Timer } from "lucide-react";
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

interface FABAction {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}

export const FloatingActionButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showTimerSheet, setShowTimerSheet] = useState(false);
  const navigate = useNavigate();
  const { triggerHaptic } = useHapticFeedback();
  const { startTimer } = useTimer();
  const { user } = useAuth();
  const { books } = useBooks(user?.id);

  const readingBooks = books.filter(book => book.status === 'reading');

  const actions: FABAction[] = [
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

  return (
    <div className="md:hidden fixed bottom-20 right-4 z-40">
      {/* Speed Dial Actions */}
      <div className={cn(
        "flex flex-col-reverse gap-3 mb-3 transition-all duration-200",
        isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}>
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <div
              key={index}
              className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span className="bg-popover text-popover-foreground px-3 py-1.5 rounded-lg text-sm font-medium shadow-lg border border-border whitespace-nowrap">
                {action.label}
              </span>
              <Button
                size="icon"
                onClick={action.onClick}
                className="h-12 w-12 rounded-full shadow-lg"
              >
                <Icon className="h-5 w-5" />
              </Button>
            </div>
          );
        })}
      </div>

      {/* Main FAB */}
      <Button
        size="icon"
        onClick={handleToggle}
        className={cn(
          "h-14 w-14 rounded-full shadow-lg transition-transform",
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
    </div>
  );
};
