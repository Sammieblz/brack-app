import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

interface FeatureGateProps {
  feature: "social";
  children: ReactNode;
}

export const FeatureGate = ({ feature, children }: FeatureGateProps) => {
  const flags = useFeatureFlags();
  const enabled = feature === "social" ? flags.socialEnabled : true;

  return enabled ? children : <Navigate to="/dashboard" replace />;
};
