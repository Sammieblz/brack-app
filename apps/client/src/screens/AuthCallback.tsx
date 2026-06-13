import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "@/components/LoadingSpinner";
import { completeAuthCallback } from "@/services/authRedirect";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const finishAuth = async () => {
      try {
        const nextPath = await completeAuthCallback(window.location.href);
        if (!cancelled) {
          navigate(nextPath, { replace: true });
        }
      } catch (authError) {
        console.error("Failed to complete auth callback:", authError);
        if (!cancelled) {
          setError(authError instanceof Error ? authError.message : "Authentication failed");
          navigate("/auth", { replace: true });
        }
      }
    };

    finishAuth();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-app-viewport items-center justify-center bg-gradient-background px-4">
      <LoadingSpinner size="lg" text={error ?? "Finishing sign in..."} />
    </div>
  );
};

export default AuthCallback;
