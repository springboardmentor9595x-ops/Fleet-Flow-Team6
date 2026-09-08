import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/VerifyEmail";
import Dashboard from "./pages/Dashboard";
import DispatcherDashboard from "./pages/DispatcherDashboard";
import AdminAuditLogs from "./pages/AdminAuditLogs";
import WorkUpdates from "./pages/WorkUpdates";
import Unauthorized from "./pages/Unauthorized";

import Users from "./pages/Users";
import Drivers from "./pages/Drivers";
import Vehicles from "./pages/Vehicles";
import Trips from "./pages/Trips";
import Reports from "./pages/Reports";
import Maintenance from "./pages/Maintenance";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import Shipments from "./pages/Shipments";
import ShipmentDetail from "./pages/ShipmentDetail";
import Fuel from "./pages/Fuel";
import Attendance from "./pages/Attendance";

import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import { getDashboardRoute } from "./config/permissions";

function DashboardDispatcher() {
  const { user } = useAuth();
  const target = getDashboardRoute(user?.role);
  return <Navigate to={target} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify" element={<VerifyEmail />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Dynamic /dashboard entry redirects to role-specific dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardDispatcher />
            </ProtectedRoute>
          }
        />

        {/* 1. Admin Dashboard Route */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <Dashboard viewMode="admin" />
            </ProtectedRoute>
          }
        />

        {/* Admin Audit Logs */}
        <Route
          path="/admin/audit-logs"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <AdminAuditLogs />
            </ProtectedRoute>
          }
        />

        {/* 2. Fleet Manager Dashboard Route */}
        <Route
          path="/fleet/dashboard"
          element={
            <ProtectedRoute allowedRoles={["FleetManager", "Admin"]}>
              <Dashboard viewMode="fleet" />
            </ProtectedRoute>
          }
        />

        {/* 3. Dispatcher Dashboard Route */}
        <Route
          path="/dispatcher/dashboard"
          element={
            <ProtectedRoute allowedRoles={["Dispatcher", "FleetManager", "Admin"]}>
              <DispatcherDashboard />
            </ProtectedRoute>
          }
        />

        {/* 4. Driver Dashboard Route */}
        <Route
          path="/driver/dashboard"
          element={
            <ProtectedRoute allowedRoles={["Driver", "Admin"]}>
              <Dashboard viewMode="driver" />
            </ProtectedRoute>
          }
        />

        {/* Work Updates */}
        <Route
          path="/work-updates"
          element={
            <ProtectedRoute>
              <WorkUpdates />
            </ProtectedRoute>
          }
        />

        {/* Role-Protected Operations Pages */}
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="/drivers"
          element={
            <ProtectedRoute allowedRoles={["Admin", "FleetManager", "Dispatcher"]}>
              <Drivers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vehicles"
          element={
            <ProtectedRoute allowedRoles={["Admin", "FleetManager", "Dispatcher", "Driver"]}>
              <Vehicles />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shipments"
          element={
            <ProtectedRoute allowedRoles={["Admin", "FleetManager", "Dispatcher", "Driver"]}>
              <Shipments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shipments/:id"
          element={
            <ProtectedRoute allowedRoles={["Admin", "FleetManager", "Dispatcher", "Driver"]}>
              <ShipmentDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/trips"
          element={
            <ProtectedRoute allowedRoles={["Admin", "FleetManager", "Dispatcher", "Driver"]}>
              <Trips />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={["Admin", "FleetManager", "Dispatcher"]}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/maintenance"
          element={
            <ProtectedRoute allowedRoles={["Admin", "FleetManager"]}>
              <Maintenance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fuel"
          element={
            <ProtectedRoute allowedRoles={["Admin", "FleetManager", "Dispatcher", "Driver"]}>
              <Fuel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/attendance"
          element={
            <ProtectedRoute allowedRoles={["Admin", "FleetManager", "Dispatcher", "Driver"]}>
              <Attendance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute allowedRoles={["Admin", "FleetManager", "Dispatcher", "Driver"]}>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* Profile - all authenticated users */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute allowedRoles={["Admin", "FleetManager", "Dispatcher", "Driver"]}>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* Report Issue - Driver + Admin */}
        <Route
          path="/report-issue"
          element={
            <ProtectedRoute allowedRoles={["Driver", "Admin"]}>
              <WorkUpdates />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/unauthorized" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;