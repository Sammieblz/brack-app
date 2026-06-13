import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-app-viewport items-center justify-center bg-gradient-background px-4">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold mb-4">404</h1>
        <p className="font-sans text-xl text-muted-foreground mb-4">Oops! Page not found</p>
        <a href="/" className="font-sans text-primary hover:text-primary/80 underline">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
