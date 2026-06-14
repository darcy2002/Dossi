import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui/misc";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, ready } = useAuth();
  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-6 w-6 text-primary" />
      </div>
    );
  }
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
