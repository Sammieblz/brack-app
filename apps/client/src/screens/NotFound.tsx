import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { hasAppHistory } from "@/hooks/useAppBack";
import { NavArrowLeft } from "iconoir-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const recoveryPath = user ? "/my-books" : "/";

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <main className="flex min-h-app-viewport items-center justify-center bg-gradient-background px-4 py-8">
      <div className="max-w-md space-y-4 text-center">
        <p className="font-sans text-sm text-muted-foreground">404</p>
        <h1 className="font-display text-3xl font-bold">Page not found</h1>
        <p className="font-sans text-muted-foreground">This link may have changed or the page may no longer exist.</p>
        <div className="flex flex-wrap justify-center gap-3">
          {hasAppHistory() && <Button type="button" variant="outline" onClick={() => {
            if (hasAppHistory()) navigate(-1);
            else navigate(recoveryPath, { replace: true });
          }}>
            <NavArrowLeft className="mr-2 h-5 w-5" aria-hidden="true" />Go back
          </Button>}
          <Button asChild><Link to={recoveryPath} replace>{user ? "Go to my library" : "Go home"}</Link></Button>
        </div>
      </div>
    </main>
  );
};

export default NotFound;
