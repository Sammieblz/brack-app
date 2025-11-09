import { useState, useRef } from "react";
import { useTimer } from "@/contexts/TimerContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Pause, Square, Minimize2, Maximize2, X } from "lucide-react";
import { formatTime } from "@/utils";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

export const FloatingTimerWidget = () => {
  const {
    time,
    isRunning,
    isVisible,
    isMinimized,
    bookTitle,
    pauseTimer,
    resumeTimer,
    finishTimer,
    cancelTimer,
    toggleMinimized,
  } = useTimer();

  const { triggerHaptic } = useHapticFeedback();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<HTMLDivElement>(null);

  if (!isVisible) return null;

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

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsDragging(false);
    
    // Swipe to dismiss - if swiped down significantly
    const swipeDistance = position.y;
    if (swipeDistance > 100) {
      triggerHaptic('medium');
      cancelTimer();
      return;
    }
    
    // Swipe right to dismiss
    if (position.x > 150) {
      triggerHaptic('medium');
      cancelTimer();
      return;
    }
    
    // Snap back to original position if not dismissed
    setPosition({ x: 0, y: 0 });
  };

  if (isMinimized) {
    return (
      <div 
        ref={dragRef}
        className="fixed bottom-6 right-6 z-[9999] animate-scale-in cursor-move touch-none"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Card className="bg-gradient-card shadow-glow border-0 backdrop-blur-sm">
          <CardContent className="p-3 flex items-center gap-3">
            <span className="text-lg">📚</span>
            <span className="font-mono font-bold text-foreground min-w-[80px]">
              {formatTime(time)}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={isRunning ? pauseTimer : resumeTimer}
              className="h-8 w-8 p-0"
            >
              {isRunning ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleMinimized}
              className="h-8 w-8 p-0"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div 
      ref={dragRef}
      className="fixed bottom-6 right-6 z-[9999] animate-scale-in cursor-move touch-none"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        opacity: isDragging && (position.y > 50 || position.x > 100) ? 0.7 : 1,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Card className="bg-gradient-card shadow-glow border-0 backdrop-blur-sm w-[340px]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              ⏱️ Reading Timer
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={cancelTimer}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {bookTitle}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Time Display */}
          <div className="text-center py-4">
            <div className="text-5xl font-mono font-bold text-foreground">
              {formatTime(time)}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {isRunning ? "Reading in progress..." : time > 0 ? "Paused" : "Ready"}
            </p>
          </div>

          {/* Control Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={isRunning ? pauseTimer : resumeTimer}
              size="sm"
              variant={isRunning ? "outline" : "default"}
              className={isRunning ? "" : "bg-gradient-primary"}
            >
              {isRunning ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </>
              )}
            </Button>
            
            {time > 0 && (
              <Button
                onClick={finishTimer}
                size="sm"
                variant="outline"
                className="border-green-500/50 text-green-600 hover:bg-green-500/10"
              >
                <Square className="mr-2 h-4 w-4" />
                Finish
              </Button>
            )}
          </div>

          {/* Minimize Button */}
          <Button
            onClick={toggleMinimized}
            size="sm"
            variant="ghost"
            className="w-full"
          >
            <Minimize2 className="mr-2 h-4 w-4" />
            Minimize
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
