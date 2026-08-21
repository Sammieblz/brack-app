import { useCallback, useRef, useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { WifiOff, Refresh, CheckCircle, WarningTriangle } from "iconoir-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { readingCoreSync, SYNC_STATUS_EVENT, type SyncStatusDetail } from "@/services/sync/engine";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SyncReviewDialog } from "@/components/SyncReviewDialog";

export const OfflineIndicator = () => {
  const isOnline = useNetworkStatus();
  const [status, setStatus] = useState<SyncStatusDetail>({
    pending: 0,
    failed: 0,
    syncing: 0,
  });
  const [syncing, setSyncing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const lastAutoSyncAtRef = useRef(0);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;

    readingCoreSync.getStatus().then((nextStatus) => {
      if (mounted) setStatus(nextStatus);
    });

    const handleStatus = (event: Event) => {
      setStatus((event as CustomEvent<SyncStatusDetail>).detail);
    };

    window.addEventListener(SYNC_STATUS_EVENT, handleStatus);
    return () => {
      mounted = false;
      window.removeEventListener(SYNC_STATUS_EVENT, handleStatus);
    };
  }, []);

  const handleSync = useCallback(async (forcePending = false) => {
    if (syncing || !isOnline) return;

    setSyncing(true);
    try {
      const nextStatus = await readingCoreSync.syncCurrentUser({ forcePending });
      setStatus(nextStatus);
      
      if (nextStatus.pending === 0 && nextStatus.failed === 0) {
        toast({
          title: "Sync complete",
          description: "All pending reading changes have been synced",
        });
      } else {
        toast({
          title: "Some changes need attention",
          description: `${nextStatus.pending + nextStatus.failed} reading change${
            nextStatus.pending + nextStatus.failed === 1 ? "" : "s"
          } remaining`,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: "Some changes could not be synced. They will be retried automatically.",
      });
    } finally {
      setSyncing(false);
    }
  }, [isOnline, syncing, toast]);

  useEffect(() => {
    const autoSyncDue = Date.now() - lastAutoSyncAtRef.current > 30_000;
    if (isOnline && status.pending + status.syncing > 0 && autoSyncDue) {
      lastAutoSyncAtRef.current = Date.now();
      void handleSync(false);
    }
  }, [handleSync, isOnline, status.pending, status.syncing]);

  const pendingCount = status.pending + status.failed + status.syncing;
  const retryingCount = status.pending + status.syncing;

  if (isOnline && pendingCount === 0) {
    return null;
  }

  const hasFailures = status.failed > 0;

  return (
    <>
      <Alert
        className={cn(
          "fixed inset-x-4 bottom-[calc(max(env(safe-area-inset-bottom),24px)+96px)] z-40 mx-auto w-auto max-w-md border border-primary/25 bg-background/90 text-foreground shadow-lg backdrop-blur md:bottom-4 md:left-auto md:right-4 md:mx-0 md:w-[calc(100%-2rem)]",
          !isOnline && "border-primary/35",
          hasFailures && "border-destructive/40"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {isOnline ? (
              <>
                {hasFailures ? (
                  <WarningTriangle className="h-4 w-4 text-destructive" />
                ) : (
                  <Refresh className="h-4 w-4 text-primary" />
                )}
                <AlertDescription className="min-w-0 font-sans leading-tight text-current">
                  {hasFailures ? (
                    <>
                      {status.failed} reading change{status.failed === 1 ? " needs" : "s need"} review
                      {retryingCount > 0
                        ? `; ${retryingCount} ${retryingCount === 1 ? "is" : "are"} still syncing`
                        : ""}
                    </>
                  ) : pendingCount > 0 ? (
                    <>
                      {pendingCount} reading change{pendingCount > 1 ? "s" : ""} to sync
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 inline mr-1" />
                      All reading changes synced
                    </>
                  )}
                </AlertDescription>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-primary" />
                <AlertDescription className="font-sans text-current">
                  You're offline. Reading changes save locally{pendingCount > 0 ? ` (${pendingCount} pending)` : ""}.
                </AlertDescription>
              </>
            )}
          </div>
          
          {isOnline && pendingCount > 0 && (
            <div className="flex shrink-0 items-center justify-end gap-2">
              {hasFailures && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setReviewOpen(true)}
                  aria-label="Review reading changes"
                  className="h-11 min-w-11"
                >
                  Review
                </Button>
              )}
              {retryingCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleSync(true)}
                  disabled={syncing}
                  aria-label={syncing ? "Syncing reading changes" : "Sync reading changes now"}
                  className="h-11 min-w-11 bg-background/80 px-3"
                >
                  {syncing ? (
                    <>
                      <Refresh className="h-4 w-4 animate-spin min-[380px]:mr-1" />
                      <span className="hidden min-[380px]:inline">Syncing...</span>
                    </>
                  ) : (
                    <>
                      <Refresh className="h-4 w-4 min-[380px]:mr-1" />
                      <span className="hidden min-[380px]:inline">Sync now</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </Alert>

      <SyncReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onResolved={async () => setStatus(await readingCoreSync.getStatus())}
      />
    </>
  );
};
