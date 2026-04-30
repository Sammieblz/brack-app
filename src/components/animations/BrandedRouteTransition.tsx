import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BrandedLoadingScreen } from "@/components/animations/BrandedLoadingScreen";

interface BrandedRouteTransitionProps {
  to: string;
  message: string;
  replace?: boolean;
  minDisplayTime?: number;
}

export const BrandedRouteTransition = ({
  to,
  message,
  replace = true,
  minDisplayTime = 900,
}: BrandedRouteTransitionProps) => {
  const navigate = useNavigate();

  const handleComplete = useCallback(() => {
    navigate(to, { replace });
  }, [navigate, replace, to]);

  return (
    <BrandedLoadingScreen
      message={message}
      minDisplayTime={minDisplayTime}
      onComplete={handleComplete}
    />
  );
};
