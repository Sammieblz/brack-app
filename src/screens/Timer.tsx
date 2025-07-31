import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Play, Pause, Square } from "lucide-react";
import { toast } from "sonner";
import { formatTime } from "@/utils";

const Timer = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { bookId, bookTitle } = location.state || {};
  
  const [user, setUser] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(0); // in seconds
  const [startTime, setStartTime] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUser(user);
    };
    
    getUser();
  }, [navigate]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTime(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const handleStart = () => {
    if (!isRunning) {
      setStartTime(new Date());
      setIsRunning(true);
    }
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleFinish = async () => {
    if (!user || !bookId || !startTime) {
      toast.error("Missing required data to save session");
      return;
    }

    setIsRunning(false);
    
    if (time === 0) {
      toast.error("No time recorded");
      return;
    }

    try {
      const endTime = new Date();
      const durationMinutes = Math.round(time / 60);

      const { error } = await supabase
        .from('reading_sessions')
        .insert({
          user_id: user.id,
          book_id: bookId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          duration: durationMinutes
        });

      if (error) throw error;

      toast.success(`Reading session saved: ${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`);
      navigate(`/book/${bookId}`);
    } catch (error: any) {
      console.error('Error saving session:', error);
      toast.error("Failed to save reading session");
    }
  };

  const handleCancel = () => {
    if (isRunning || time > 0) {
      if (!confirm("Are you sure you want to cancel this session? All progress will be lost.")) {
        return;
      }
    }
    navigate("/dashboard");
  };

  if (!bookId || !bookTitle) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
        <Card className="bg-gradient-card shadow-medium border-0">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">No book selected for timer</p>
            <Button onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            className="border-border/50 hover:shadow-soft transition-all duration-300"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>

        {/* Timer Card */}
        <Card className="bg-gradient-card shadow-medium border-0 animate-scale-in">
          <CardHeader className="text-center">
            <CardTitle className="text-xl font-bold text-foreground">
              Reading Timer ⏱️
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Current Book: {bookTitle}
            </p>
          </CardHeader>
          <CardContent className="space-y-8 text-center">
            {/* Time Display */}
            <div className="py-8">
              <div className="text-6xl font-mono font-bold text-foreground mb-2">
                {formatTime(time)}
              </div>
              <p className="text-muted-foreground text-sm">
                {isRunning ? "Reading in progress..." : time > 0 ? "Paused" : "Ready to start"}
              </p>
            </div>

            {/* Control Buttons */}
            <div className="flex justify-center space-x-4">
              {!isRunning ? (
                <Button
                  onClick={handleStart}
                  size="lg"
                  className="bg-gradient-primary hover:shadow-glow transition-all duration-300 text-white font-medium px-8"
                >
                  <Play className="mr-2 h-5 w-5" />
                  Start
                </Button>
              ) : (
                <Button
                  onClick={handlePause}
                  size="lg"
                  variant="outline"
                  className="border-border/50 hover:shadow-soft transition-all duration-300 px-8"
                >
                  <Pause className="mr-2 h-5 w-5" />
                  Pause
                </Button>
              )}

              {time > 0 && (
                <Button
                  onClick={handleFinish}
                  size="lg"
                  variant="outline"
                  className="border-green-500/50 text-green-600 hover:bg-green-500/10 transition-all duration-300 px-8"
                >
                  <Square className="mr-2 h-5 w-5" />
                  Finish
                </Button>
              )}
            </div>

            {/* Instructions */}
            <div className="text-center text-sm text-muted-foreground space-y-1">
              <p>Click Start to begin your reading session</p>
              <p>Use Pause to take breaks</p>
              <p>Click Finish when you're done to save your progress</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Timer;