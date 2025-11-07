import { useTimer } from "@/contexts/TimerContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Pause, Square, Minimize2, Maximize2, X } from "lucide-react";
import { formatTime } from "@/utils";

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

  if (!isVisible) return null;

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-[9999] animate-scale-in">
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
    <div className="fixed bottom-6 right-6 z-[9999] animate-scale-in">
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
