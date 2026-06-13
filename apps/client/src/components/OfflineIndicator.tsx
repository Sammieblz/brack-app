import { useCallback, useState, useEffect } from "react";
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

  const handleSync = useCallback(async () => {
    if (syncing || !isOnline) return;

    setSyncing(true);
    try {
      const nextStatus = await readingCoreSync.syncCurrentUser();
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
    if (isOnline && (status.pending > 0 || status.failed > 0)) {
      void handleSync();
    }
  }, [handleSync, isOnline, status.failed, status.pending]);

  const pendingCount = status.pending + status.failed + status.syncing;

  if (isOnline && pendingCount === 0) {
    return null;
  }

  const hasFailures = status.failed > 0;

  return (
    <>
      <Alert
        className={cn(
          "fixed left-1/2 top-16 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 border border-primary/25 bg-background/90 text-foreground shadow-lg backdrop-blur",
          !isOnline && "border-primary/35",
          hasFailures && "border-destructive/40"
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                {hasFailures ? (
                  <WarningTriangle className="h-4 w-4 text-destructive" />
                ) : (
                  <Refresh className="h-4 w-4 text-primary" />
                )}
                <AlertDescription className="font-sans text-current">
                  {pendingCount > 0 ? (
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
            <div className="flex shrink-0 items-center gap-2">
              {hasFailures && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setReviewOpen(true)}
                  className="h-8"
                >
                  Review
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleSync}
                disabled={syncing}
                className="h-8 bg-background/80"
              >
                {syncing ? (
                  <>
                    <Refresh className="h-3 w-3 mr-1 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Refresh className="h-3 w-3 mr-1" />
                    Sync Now
                  </>
                )}
              </Button>
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
