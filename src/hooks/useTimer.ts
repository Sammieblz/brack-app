import { useState, useEffect } from "react";

export const useTimer = (initialTime = 0) => {
  const [time, setTime] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRunning) {
      interval = setInterval(() => {
        setTime(time => time + 1);
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  const start = () => {
    if (!isRunning) {
      setStartTime(new Date());
      setIsRunning(true);
    }
  };

  const pause = () => {
    setIsRunning(false);
  };

  const reset = () => {
    setTime(0);
    setIsRunning(false);
    setStartTime(null);
  };

  const stop = () => {
    setIsRunning(false);
    return time;
  };

  return {
    time,
    isRunning,
    startTime,
    start,
    pause,
    reset,
    stop
  };
};