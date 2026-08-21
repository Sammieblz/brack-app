import { useEffect, useState, useRef } from "react";
import { LogoSpinner } from "@/components/animations/LogoSpinner";
import { Progress } from "@/components/ui/progress";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { AnimatePresence, motion } from "framer-motion";

interface BrandedLoadingScreenProps {
  onComplete?: () => void;
  minDisplayTime?: number;
  progress?: number;
  message?: string;
}

export const BrandedLoadingScreen = ({
  onComplete,
  minDisplayTime = 1500,
  progress,
  message = "Loading your reading journey...",
}: BrandedLoadingScreenProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const startTime = useRef(Date.now());
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const elapsed = Date.now() - startTime.current;
    const remaining = Math.max(0, minDisplayTime - elapsed);
    let completionTimer: number | undefined;

    const timer = window.setTimeout(() => {
      setIsVisible(false);
      completionTimer = window.setTimeout(() => {
        onComplete?.();
      }, reducedMotion ? 0 : 200);
    }, remaining);

    return () => {
      window.clearTimeout(timer);
      if (completionTimer !== undefined) {
        window.clearTimeout(completionTimer);
      }
    };
  }, [minDisplayTime, onComplete, reducedMotion]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: reducedMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
          exit={{ opacity: 0, transition: { duration: reducedMotion ? 0 : 0.2 } }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background p-4 supports-[backdrop-filter]:bg-background/95 supports-[backdrop-filter]:backdrop-blur-sm"
        >
          <LogoSpinner size="lg" text={message} />
          {progress !== undefined && (
            <Progress
              value={progress}
              variant="dimensional"
              className="mt-8 w-64 max-w-[calc(100%_-_2rem)]"
              aria-label="Loading progress"
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
