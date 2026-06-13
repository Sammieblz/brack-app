import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { completeAuthCallback } from "@/services/authRedirect";
import { deepLinkService } from "@/services/deepLinkService";
import { closeExternalAuthSession, onDesktopAuthCallback } from "@/services/platform";

/**
 * Component to handle deep linking initialization
 * Should be placed inside BrowserRouter
 */
export const DeepLinkHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let cleanupFn: (() => void) | undefined;
    let handlingAuthCallback = false;

    const finishAuthCallback = async (url: string, source: "desktop" | "native") => {
      if (handlingAuthCallback) return;
      handlingAuthCallback = true;

      try {
        const nextPath = await completeAuthCallback(url);
        navigate(nextPath, { replace: true });
      } catch (error) {
        console.error(`Failed to handle ${source} auth callback:`, error);
        navigate("/auth", { replace: true });
      } finally {
        if (source === "native") {
          await closeExternalAuthSession();
        }
        handlingAuthCallback = false;
      }
    };

    // Initialize deep link service with navigate function
    // Support both simple path navigation and navigation with state
    deepLinkService.initialize(
      (path: string, options?: { state?: unknown }) => {
        if (options?.state) {
          navigate(path, { state: options.state });
        } else {
          navigate(path);
        }
      },
      {
        onAuthCallback: (url) => finishAuthCallback(url, "native"),
      }
    ).then((cleanup) => {
      cleanupFn = cleanup;
    });

    const cleanupAuthCallback = onDesktopAuthCallback(async (url) => {
      await finishAuthCallback(url, "desktop");
    });

    return () => {
      if (cleanupFn) {
        cleanupFn();
      }
      if (cleanupAuthCallback) {
        cleanupAuthCallback();
      }
    };
  }, [navigate]);

  return null;
};
