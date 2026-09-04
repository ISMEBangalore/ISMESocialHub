import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { isAdminRole } from "@/lib/roles";

export function ProtectedRoute({ children, adminOnly = false }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="p-10 text-center text-neutral-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdminRole(user.role)) return <Navigate to="/feed" replace />;
  return children;
}
