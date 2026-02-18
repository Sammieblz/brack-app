import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { WifiOff, Wifi, RefreshCw, CheckCircle2 } from "lucide-react";
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
      className={`fixed top-16 left-1/2 transform -translate-x-1/2 z-50 max-w-md shadow-lg ${
        isOnline ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <>
              <Wifi className="h-4 w-4 text-blue-600" />
              <AlertDescription className="font-sans text-blue-800">
                {queueSize > 0 ? (
                  <>
                    {queueSize} pending change{queueSize > 1 ? 's' : ''} to sync
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 inline mr-1" />
                    All changes synced
                  </>
                )}
              </AlertDescription>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-orange-600" />
              <AlertDescription className="font-sans text-orange-800">
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
            className="h-8"
          >
            {syncing ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                Sync Now
              </>
            )}
          </Button>
        )}
      </div>
    </Alert>
  );
};
