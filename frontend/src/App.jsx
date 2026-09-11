import React from "react";

import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/VerifyEmail";
import ResendVerification from "./pages/ResendVerification";
import Dashboard from "./pages/Dashboard";
import Vehicles from "./pages/Vehicles";
import AddVehicle from "./pages/AddVehicle";
import Drivers from "./pages/Drivers";
import Shipment from "./pages/Shipment";
import Trips from "./pages/vehicles/Trips";
import Profile from "./pages/Profile";
import Maintenance from "./pages/Maintenance";
import FuelRecords from "./pages/FuelRecords";
import Analytics from "./pages/Analytics";
import Reports from "./pages/Reports";
import Attendance from "./pages/Attendance";
import Users from "./pages/Users";

import ProtectedRoute from "./routes/ProtectedRoute";



function App() {
  return (
    <Routes>

      {/* Public Routes */}

      <Route
        path="/"
        element={<Navigate to="/login" replace />}
      />

      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/signup"
        element={<Signup />}
      />

      <Route
        path="/verify-email"
        element={<VerifyEmail />}
      />

      <Route
        path="/resend-verification"
        element={<ResendVerification />}
      />


      {/* Protected Routes */}

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/vehicles"
        element={
          <ProtectedRoute>
            <Vehicles />
          </ProtectedRoute>
        }
      />

      <Route
        path="/vehicles/add"
        element={
          <ProtectedRoute>
            <AddVehicle />
          </ProtectedRoute>
        }
      />

      <Route
        path="/drivers"
        element={
          <ProtectedRoute>
            <Drivers />
          </ProtectedRoute>
        }
      />

      <Route
        path="/shipments"
        element={
          <ProtectedRoute>
            <Shipment />
          </ProtectedRoute>
        }
      />

      <Route
        path="/trips"
        element={
          <ProtectedRoute>
            <Trips />
          </ProtectedRoute>
        }
      />

      <Route
        path="/maintenance"
        element={
          <ProtectedRoute>
            <Maintenance />
          </ProtectedRoute>
        }
      />

      <Route
        path="/fuel"
        element={
          <ProtectedRoute>
            <FuelRecords />
          </ProtectedRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        }
      />

      <Route
        path="/attendance"
        element={
          <ProtectedRoute>
            <Attendance />
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <Users />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />


      {/* Unknown route */}
      <Route
        path="*"
        element={<Navigate to="/dashboard" replace />}
      />

    </Routes>
  );
}

export default App;


