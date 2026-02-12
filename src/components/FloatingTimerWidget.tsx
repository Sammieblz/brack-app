import { useState, useRef, useEffect } from "react";
import { useTimer } from "@/contexts/TimerContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Pause, Square, Minimize2, Maximize2, X, Clock } from "lucide-react";
import { formatTime } from "@/utils";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap } from "gsap";
import { Confetti } from "@/components/animations/Confetti";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const STORAGE_KEY = "floatingTimerPosition";
const DEFAULT_MARGIN = 12;
const DEFAULT_SIZE = { w: 260, h: 140 };

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
  const [position, setPosition] = useState<{ x: number; y: number }>(() => ({ x: 0, y: 0 }));
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const dragStartPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<HTMLDivElement>(null);
  const dragBounds = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const timeDisplayRef = useRef<HTMLDivElement>(null);
  const clockIconRef = useRef<HTMLDivElement>(null);
  const [showSessionComplete, setShowSessionComplete] = useState(false);

  const constrainToViewport = (pos: { x: number; y: number }, size = DEFAULT_SIZE) => {
    if (typeof window === "undefined") return pos;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      x: clamp(pos.x, DEFAULT_MARGIN, Math.max(DEFAULT_MARGIN, vw - size.w - DEFAULT_MARGIN)),
      y: clamp(pos.y, DEFAULT_MARGIN, Math.max(DEFAULT_MARGIN, vh - size.h - DEFAULT_MARGIN)),
    };
  };

  const savePosition = (pos: { x: number; y: number }) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch {
      // ignore
    }
  };

  // Initialize position once we know viewport size
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPosition(constrainToViewport(parsed));
        return;
      } catch {
        // ignore invalid storage
      }
    }
    // Default near bottom-right with margin
    setPosition(constrainToViewport({ x: vw - DEFAULT_SIZE.w, y: vh - DEFAULT_SIZE.h }));
  }, []);

  // Timer start pulse animation
  useGSAP(() => {
    if (clockIconRef.current && isRunning) {
      gsap.to(clockIconRef.current, {
        scale: 1.2,
        duration: 0.3,
        yoyo: true,
        repeat: 1,
        ease: "power2.out",
      });
    }
  }, { dependencies: [isRunning] });

  // Smooth time display updates
  useGSAP(() => {
    if (timeDisplayRef.current && isRunning) {
      gsap.to(timeDisplayRef.current, {
        scale: 1.05,
        duration: 0.1,
        yoyo: true,
        ease: "power2.out",
      });
    }
  }, { dependencies: [time, isRunning] });

  // Trigger celebration on session completion
  useEffect(() => {
    if (time === 0 && !isRunning && !isVisible) {
      // Timer was just finished
      setShowSessionComplete(true);
      setTimeout(() => setShowSessionComplete(false), 3000);
    }
  }, [time, isRunning, isVisible]);

  if (!isVisible) return null;

  const updateBounds = () => {
    const w = dragRef.current?.offsetWidth ?? 0;
    const h = dragRef.current?.offsetHeight ?? 0;
    dragBounds.current = { width: w, height: h };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    updateBounds();
    dragStartPosition.current = { ...position };
    setIsDragging(true);
    setStartPos({
      x: e.touches[0].clientX - position.x,
      y: e.touches[0].clientY - position.y,
    });
    triggerHaptic('light');
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const { width, height } = dragBounds.current;
    const newX = e.touches[0].clientX - startPos.x;
    const newY = e.touches[0].clientY - startPos.y;

    // constrain to viewport with a small margin
    const constrained = {
      x: clamp(newX, DEFAULT_MARGIN, vw - (width || DEFAULT_SIZE.w) - DEFAULT_MARGIN),
      y: clamp(newY, DEFAULT_MARGIN, vh - (height || DEFAULT_SIZE.h) - DEFAULT_MARGIN),
    };

    setPosition(constrained);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsDragging(false);
    const deltaX = position.x - dragStartPosition.current.x;
    const deltaY = position.y - dragStartPosition.current.y;
    
    // Swipe to dismiss only on intentional fling distances
    const verticalDismiss = deltaY > 140;
    const horizontalDismiss = deltaX > 180;
    if (verticalDismiss || horizontalDismiss) {
      triggerHaptic('medium');
      cancelTimer();
      return;
    }
    
    // Persist position on end (clamped once more)
    const clamped = constrainToViewport(position, {
      w: dragBounds.current.width || DEFAULT_SIZE.w,
      h: dragBounds.current.height || DEFAULT_SIZE.h,
    });
    setPosition(clamped);
    savePosition(clamped);
  };

  const commonDragProps = {
    ref: dragRef,
    className: "fixed z-[9999] animate-scale-in cursor-move touch-none",
    style: {
      transform: `translate(${position.x}px, ${position.y}px)`,
      transition: isDragging ? 'none' : 'transform 0.3s ease-out',
      opacity: isDragging && (position.y > 50 || position.x > 100) ? 0.9 : 1,
      touchAction: "none",
      left: 0,
      top: 0,
      maxWidth: "calc(100vw - 24px)",
    } as React.CSSProperties,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };

  if (isMinimized) {
    return (
      <div {...commonDragProps}>
        <Card className="bg-gradient-card shadow-soft border border-border/50 backdrop-blur-sm min-w-[200px] max-w-[90vw]">
          <CardContent className="p-3 flex items-center gap-3">
            <span className="text-lg font-semibold">Timer</span>
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
    <>
      {showSessionComplete && <Confetti trigger={showSessionComplete} />}
      <div {...commonDragProps}>
        <Card className="bg-gradient-card shadow-soft border border-border/60 backdrop-blur-sm w-[340px] max-w-[90vw]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <div ref={clockIconRef}>
                <Clock className="h-5 w-5 text-primary" />
              </div>
              Reading Timer
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
            <div ref={timeDisplayRef} className="text-5xl font-mono font-bold text-foreground">
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
    </>
  );
};
