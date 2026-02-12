import { Check, Loader2, AlertCircle } from "lucide-react";
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
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-xs">Saving...</span>
          </>
        );
      case 'saved':
        return (
          <>
            <Check className="h-3 w-3" />
            <span className="text-xs">
              Saved{lastSaved && ` at ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            </span>
          </>
        );
      case 'error':
        return (
          <>
            <AlertCircle className="h-3 w-3" />
            <span className="text-xs">Save failed</span>
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
