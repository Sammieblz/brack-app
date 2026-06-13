import * as React from "react"
import { cn } from "@/lib/utils"

interface LiveRegionProps {
  level?: "polite" | "assertive" | "off";
  className?: string;
  children?: React.ReactNode;
}

/**
 * Live region component for screen reader announcements
 * Use for status updates, errors, and important messages
 */
export const LiveRegion = ({ 
  level = "polite", 
  className,
  children 
}: LiveRegionProps) => {
  return (
    <div
      role="status"
      aria-live={level}
      aria-atomic="true"
      className={cn("sr-only", className)}
    >
      {children}
    </div>
  );
};

/**
 * Hook to announce messages to screen readers
 */
export const useLiveRegion = () => {
  const [announcement, setAnnouncement] = React.useState<string>("");
  const [level, setLevel] = React.useState<"polite" | "assertive">("polite");
  const timeoutRef = React.useRef<NodeJS.Timeout>();

  const announce = React.useCallback((message: string, priority: "polite" | "assertive" = "polite") => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set announcement
    setLevel(priority);
    setAnnouncement(message);

    // Clear after announcement
    timeoutRef.current = setTimeout(() => {
      setAnnouncement("");
    }, 1000);
  }, []);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    announcement,
    level,
    announce,
    LiveRegionComponent: (
      <LiveRegion level={level}>
        {announcement}
      </LiveRegion>
    ),
  };
};
