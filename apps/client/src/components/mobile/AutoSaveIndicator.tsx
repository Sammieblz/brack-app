import { Check, Refresh, WarningCircle } from "iconoir-react";
import { cn } from "@/lib/utils";

interface AutoSaveIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved?: Date | null;
  className?: string;
}

export const AutoSaveIndicator = ({
  status,
  lastSaved,
  className,
}: AutoSaveIndicatorProps) => {
  if (status === 'idle') return null;

  const getStatusContent = () => {
    switch (status) {
      case 'saving':
        return (
          <>
            <Refresh className="h-3 w-3 animate-spin" />
            <span className="font-sans text-xs">Saving...</span>
          </>
        );
      case 'saved':
        return (
          <>
            <Check className="h-3 w-3" />
            <span className="font-sans text-xs">
              Saved{lastSaved && ` at ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            </span>
          </>
        );
      case 'error':
        return (
          <>
            <WarningCircle className="h-3 w-3" />
            <span className="font-sans text-xs">Save failed</span>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs transition-opacity",
        status === 'saving' && "text-muted-foreground",
        status === 'saved' && "text-green-600 dark:text-green-400",
        status === 'error' && "text-destructive",
        className
      )}
    >
      {getStatusContent()}
    </div>
  );
};
