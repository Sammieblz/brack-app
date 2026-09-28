import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

// BrowserRouter's index counts app-owned history entries. Replacing a direct
// entry (for example, changing a tab query) creates a key without a prior page.
export const hasAppHistory = () => Number.isInteger(window.history.state?.idx)
  && window.history.state.idx > 0;

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

  const goBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }

    if (to) {
      navigate(to);
      return;
    }

    if (hasAppHistory()) {
      navigate(-1);
      return;
    }

    navigate(fallbackPath);
  }, [fallbackPath, navigate, onBack, to]);

  return { goBack };
};
