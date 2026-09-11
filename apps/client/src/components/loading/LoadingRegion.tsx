import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LoadingRegionProps {
  loading: boolean;
  refreshing?: boolean;
  label: string;
  children: ReactNode;
  className?: string;
  containerClassName?: string;
}

/** The caller owns data identity, empty/error states and retained content.
 * This component only publishes status; it never hides or remounts children.
 * Keep the live region outside aria-busy so the loading announcement is not
 * deferred until after the request completes.
 */
export function LoadingRegion({ loading, refreshing = false, label, children, className, containerClassName }: LoadingRegionProps) {
  const updating = refreshing && !loading;
  return (
    <div className={cn("relative min-w-0", containerClassName)} data-loading-region="">
      <div aria-busy={loading || refreshing} aria-label={label} className={className}>
        {children}
      </div>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {loading ? label : updating ? `Updating. ${label}` : ""}
      </span>
      {updating && (
        <span
          aria-hidden="true"
          data-refresh-indicator=""
          className="pointer-events-none absolute right-2 top-0 z-10 rounded-b-md border border-t-0 border-border bg-background px-2 py-0.5 text-xs text-muted-foreground"
        >
          Updating…
        </span>
      )}
    </div>
  );
}

export function LoadingError({ message, onRetry, className }: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-card p-4", className)}>
      <p role="alert" className="min-w-0 text-sm text-foreground">{message}</p>
      {onRetry && <Button type="button" variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
