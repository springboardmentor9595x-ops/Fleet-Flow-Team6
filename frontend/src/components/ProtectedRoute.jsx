import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { token, user } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && user?.role) {
    if (!allowedRoles.includes(user.role)) {
      if (user.role === "Driver") return <Navigate to="/driver-dashboard" replace />;
      if (user.role === "Dispatcher") return <Navigate to="/logistics-dashboard" replace />;
      if (user.role === "FleetManager") return <Navigate to="/fleet-dashboard" replace />;
      return <Navigate to="/admin" replace />;
    }
  }

  return children;
}