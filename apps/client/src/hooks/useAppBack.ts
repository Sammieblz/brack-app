import { useCallback, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AppNavigationContext } from "@/contexts/appNavigation";
import { requestOverlayBack } from "@/lib/backLayers";

export interface BackButtonConfig {
  label?: string;
  ariaLabel?: string;
  fallbackPath?: string;
  to?: string;
  onBack?: () => void;
}

export const useAppBack = ({
  fallbackPath,
  to,
  onBack,
}: BackButtonConfig = {}) => {
  const navigate = useNavigate();
  const navigation = useContext(AppNavigationContext);
  const requestBack = navigation?.requestBack;

  const goBack = useCallback(() => {
    if (requestBack) { requestBack({ fallbackPath, to, onBack }); return; }
    // Isolated consumers without the app boundary still dismiss existing layers,
    // but cannot infer a predecessor from another router's numeric index.
    if (requestOverlayBack()) return;
    if (onBack) {
      onBack();
      return;
    }

    if (to) {
      navigate(to);
      return;
    }

    navigate(fallbackPath ?? "/dashboard", { replace: true });
  }, [fallbackPath, navigate, onBack, to, requestBack]);

  return { goBack, canGoBack: navigation?.canGoBack ?? false };
};
