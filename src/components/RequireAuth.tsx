import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const RequireAuth = () => {
  const { user, loading } = useAuth();

  if (loading) return null; // or a spinner
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

export default RequireAuth;
