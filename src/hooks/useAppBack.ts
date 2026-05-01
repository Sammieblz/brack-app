import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export interface BackButtonConfig {
  label?: string;
  ariaLabel?: string;
  fallbackPath?: string;
  to?: string;
  onBack?: () => void;
}

export const useAppBack = ({
  fallbackPath = "/dashboard",
  to,
  onBack,
}: BackButtonConfig = {}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }

    if (to) {
      navigate(to);
      return;
    }

    if (location.key && location.key !== "default") {
      navigate(-1);
      return;
    }

    navigate(fallbackPath);
  }, [fallbackPath, location.key, navigate, onBack, to]);

  return { goBack };
};
