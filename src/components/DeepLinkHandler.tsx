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
    // Initialize deep link service with navigate function
    // Support both simple path navigation and navigation with state
    const cleanup = deepLinkService.initialize((path: string, options?: { state?: any }) => {
      if (options?.state) {
        navigate(path, { state: options.state });
      } else {
        navigate(path);
      }
    });

    return cleanup;
  }, [navigate]);

  return null;
};
