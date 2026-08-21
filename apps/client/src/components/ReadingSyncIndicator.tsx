import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { OfflineIndicator } from "@/components/OfflineIndicator";

const SYNC_UI_HIDDEN_ROUTES = new Set([
  "/",
  "/onboarding",
  "/welcome",
  "/questionnaire",
  "/goals",
]);

const isSyncUiHiddenRoute = (pathname: string) => {
  const normalizedPath = pathname.length > 1
    ? pathname.replace(/\/+$/, "")
    : pathname;

  return (
    SYNC_UI_HIDDEN_ROUTES.has(normalizedPath) ||
    normalizedPath === "/auth" ||
    normalizedPath.startsWith("/auth/")
  );
};

export const ReadingSyncIndicator = () => {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading || !user || isSyncUiHiddenRoute(pathname)) {
    return null;
  }

  return <OfflineIndicator />;
};
