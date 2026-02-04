import { useEffect, useState } from "react";
import { toast } from "sonner";
import { offlineQueue } from "@/services/offlineQueue";

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      toast.success("Back online");
      
      // Auto-sync queued actions when coming back online
      if (offlineQueue.getQueueSize() > 0) {
        setTimeout(() => {
          offlineQueue.sync().catch(console.error);
        }, 1000); // Small delay to ensure connection is stable
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      const queueSize = offlineQueue.getQueueSize();
      if (queueSize > 0) {
        toast.info(`You are offline. ${queueSize} change${queueSize > 1 ? 's' : ''} will sync when you're back online.`);
      } else {
        toast.info("You are offline. Changes will be queued for sync.");
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
};
