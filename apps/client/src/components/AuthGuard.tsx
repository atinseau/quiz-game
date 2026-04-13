import { useAuth } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";

declare global {
  interface Window {
    __clerk_test_bypass__?: boolean;
  }
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();

  // Allow E2E tests to bypass auth (set via Playwright addInitScript)
  if (window.__clerk_test_bypass__) {
    return children;
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return children;
}
