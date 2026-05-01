import { useRef, useState } from "react";
import { Xmark } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_ICONS } from "@/config/iconography";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useStreaks } from "@/hooks/useStreaks";

interface FloatingQuickStatsWidgetProps {
  isVisible: boolean;
  onClose: () => void;
}

export const FloatingQuickStatsWidget = ({ isVisible, onClose }: FloatingQuickStatsWidgetProps) => {
  const { user } = useAuth();
  const { books } = useBooks(user?.id);
  const { streakData } = useStreaks(user?.id);
  const { triggerHaptic } = useHapticFeedback();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<HTMLDivElement>(null);

  if (!isVisible) return null;

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const booksReadThisMonth = books.filter((book) => {
    if (book.status !== "completed" || !book.date_finished) return false;
    const finishedDate = new Date(book.date_finished);
    return finishedDate.getMonth() === currentMonth && finishedDate.getFullYear() === currentYear;
  }).length;

  const totalPages = books
    .filter((book) => book.status === "completed")
    .reduce((sum, book) => sum + (book.pages || 0), 0);
  const totalReadingTime = Math.floor(totalPages / 40) * 60;

  const readingHours = Math.floor(totalReadingTime / 60);
  const readingMinutes = totalReadingTime % 60;

  const handleTouchStart = (event: React.TouchEvent) => {
    setIsDragging(true);
    setStartPos({
      x: event.touches[0].clientX - position.x,
      y: event.touches[0].clientY - position.y,
    });
    triggerHaptic("light");
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    if (!isDragging) return;
    const newX = event.touches[0].clientX - startPos.x;
    const newY = event.touches[0].clientY - startPos.y;
    setPosition({ x: newX, y: newY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);

    if (position.y > 100 || position.x > 150) {
      triggerHaptic("medium");
      onClose();
      return;
    }

    setPosition({ x: 0, y: 0 });
  };

  const handleClose = () => {
    triggerHaptic("light");
    onClose();
  };

  return (
    <div
      ref={dragRef}
      className="fixed bottom-24 right-6 z-[9998] animate-scale-in cursor-move touch-none"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging ? "none" : "transform 0.3s ease-out",
        opacity: isDragging && (position.y > 50 || position.x > 100) ? 0.7 : 1,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Card className="w-[300px] border-0 bg-gradient-card shadow-glow backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-display flex items-center gap-2 text-base font-bold">
              <APP_ICONS.floatingAction.quickStats className="h-4 w-4 text-primary" />
              Quick Stats
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClose}
              className="h-8 w-8 p-0"
              disableHaptic
            >
              <Xmark className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg bg-background/50 p-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
              <APP_ICONS.stats.completed className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-sans text-2xl font-bold text-foreground">{booksReadThisMonth}</div>
              <div className="font-sans text-xs text-muted-foreground">Books this month</div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-background/50 p-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-orange-500/10">
              <APP_ICONS.stats.streak className="h-5 w-5 text-orange-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-sans text-2xl font-bold text-foreground">{streakData.currentStreak}</div>
              <div className="font-sans text-xs text-muted-foreground">Day streak</div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-background/50 p-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/10">
              <APP_ICONS.stats.readingTime className="h-5 w-5 text-blue-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-sans text-2xl font-bold text-foreground">
                {readingHours > 0 ? `${readingHours}h` : `${readingMinutes}m`}
              </div>
              <div className="font-sans text-xs text-muted-foreground">Total reading time</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
