import { useEffect, useState } from "react";
import { toast } from "sonner";
import { readingCoreSync } from "@/services/sync/engine";

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      toast.success("Back online");
      
      setTimeout(() => {
        readingCoreSync.syncCurrentUser().catch(console.error);
      }, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.info("You're offline. Reading changes will save locally and sync when you're back online.");
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
