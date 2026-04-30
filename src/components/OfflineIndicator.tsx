import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { WifiOff, Wifi, Refresh, CheckCircle } from "iconoir-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { offlineQueue } from "@/services/offlineQueue";
import { useToast } from "@/hooks/use-toast";

export const OfflineIndicator = () => {
  const isOnline = useNetworkStatus();
  const [queueSize, setQueueSize] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const updateQueueSize = () => {
      setQueueSize(offlineQueue.getQueueSize());
    };

    updateQueueSize();
    const unsubscribe = offlineQueue.subscribe(updateQueueSize);

    // Auto-sync when coming back online
    if (isOnline && queueSize > 0) {
      handleSync();
    }

    return unsubscribe;
  }, [isOnline, queueSize]);

  const handleSync = async () => {
    if (syncing || !isOnline) return;

    setSyncing(true);
    try {
      await offlineQueue.sync();
      const remaining = offlineQueue.getQueueSize();
      
      if (remaining === 0) {
        toast({
          title: "Sync complete",
          description: "All pending changes have been synced",
        });
      } else {
        toast({
          title: "Sync in progress",
          description: `${remaining} items remaining`,
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
  };

  if (isOnline && queueSize === 0) {
    return null;
  }

  return (
    <Alert
      className={`fixed left-1/2 top-16 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 border shadow-lg backdrop-blur ${
        isOnline
          ? 'border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-100'
          : 'border-orange-500/30 bg-orange-500/10 text-orange-900 dark:text-orange-100'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <>
              <Wifi className="h-4 w-4 text-blue-600 dark:text-blue-300" />
              <AlertDescription className="font-sans text-current">
                {queueSize > 0 ? (
                  <>
                    {queueSize} pending change{queueSize > 1 ? 's' : ''} to sync
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 inline mr-1" />
                    All changes synced
                  </>
                )}
              </AlertDescription>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-orange-600 dark:text-orange-300" />
              <AlertDescription className="font-sans text-current">
                You're offline. {queueSize > 0 && `${queueSize} change${queueSize > 1 ? 's' : ''} queued`}
              </AlertDescription>
            </>
          )}
        </div>
        
        {isOnline && queueSize > 0 && (
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
        )}
      </div>
    </Alert>
  );
};
