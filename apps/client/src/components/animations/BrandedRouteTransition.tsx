import { Navigate } from "react-router-dom";

interface BrandedRouteTransitionProps {
  to: string;
  message: string;
  replace?: boolean;
}

export const BrandedRouteTransition = ({
  to,
  replace = true,
}: BrandedRouteTransitionProps) => <Navigate to={to} replace={replace} />;
