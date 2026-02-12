import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { deepLinkService } from "@/services/deepLinkService";

/**
 * Component to handle deep linking initialization
 * Should be placed inside BrowserRouter
 */
export const DeepLinkHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let cleanupFn: (() => void) | undefined;

    // Initialize deep link service with navigate function
    // Support both simple path navigation and navigation with state
    deepLinkService.initialize((path: string, options?: { state?: unknown }) => {
      if (options?.state) {
        navigate(path, { state: options.state });
      } else {
        navigate(path);
      }
    }).then((cleanup) => {
      cleanupFn = cleanup;
    });

    return () => {
      if (cleanupFn) {
        cleanupFn();
      }
    };
  }, [navigate]);

  return null;
};
