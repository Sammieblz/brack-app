import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Xmark, StatsReport, FireFlame, Clock } from "iconoir-react";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useBooks } from "@/hooks/useBooks";
import { useStreaks } from "@/hooks/useStreaks";
import { useAuth } from "@/hooks/useAuth";

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

  // Calculate stats
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  const booksReadThisMonth = books.filter(book => {
    if (book.status !== 'completed' || !book.date_finished) return false;
    const finishedDate = new Date(book.date_finished);
    return finishedDate.getMonth() === currentMonth && finishedDate.getFullYear() === currentYear;
  }).length;

  // Calculate approximate reading time (40 pages/hour average)
  const totalPages = books.filter(b => b.status === 'completed').reduce((sum, book) => sum + (book.pages || 0), 0);
  const totalReadingTime = Math.floor(totalPages / 40) * 60; // in minutes

  const readingHours = Math.floor(totalReadingTime / 60);
  const readingMinutes = totalReadingTime % 60;

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartPos({
      x: e.touches[0].clientX - position.x,
      y: e.touches[0].clientY - position.y,
    });
    triggerHaptic('light');
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const newX = e.touches[0].clientX - startPos.x;
    const newY = e.touches[0].clientY - startPos.y;
    setPosition({ x: newX, y: newY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    
    // Swipe to dismiss - if swiped down significantly
    const swipeDistance = position.y;
    if (swipeDistance > 100) {
      triggerHaptic('medium');
      onClose();
      return;
    }
    
    // Swipe right to dismiss
    if (position.x > 150) {
      triggerHaptic('medium');
      onClose();
      return;
    }
    
    // Snap back to original position if not dismissed
    setPosition({ x: 0, y: 0 });
  };

  const handleClose = () => {
    triggerHaptic('light');
    onClose();
  };

  return (
    <div 
      ref={dragRef}
      className="fixed bottom-24 right-6 z-[9998] animate-scale-in cursor-move touch-none"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        opacity: isDragging && (position.y > 50 || position.x > 100) ? 0.7 : 1,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Card className="bg-gradient-card shadow-glow border-0 backdrop-blur-sm w-[300px]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-base font-bold flex items-center gap-2">
              📊 Quick Stats
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
          {/* Books This Month */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <StatsReport className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-sans text-2xl font-bold text-foreground">{booksReadThisMonth}</div>
              <div className="font-sans text-xs text-muted-foreground">Books this month</div>
            </div>
          </div>

          {/* Current Streak */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
            <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
              <FireFlame className="h-5 w-5 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-sans text-2xl font-bold text-foreground">{streakData.currentStreak}</div>
              <div className="font-sans text-xs text-muted-foreground">Day streak</div>
            </div>
          </div>

          {/* Reading Time */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
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
