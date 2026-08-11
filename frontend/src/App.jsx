import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/VerifyEmail";
import Dashboard from "./pages/Dashboard";

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

import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify" element={<VerifyEmail />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }/>

        <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
        <Route path="/drivers" element={<ProtectedRoute><Drivers /></ProtectedRoute>} />
        <Route path="/vehicles" element={<ProtectedRoute><Vehicles /></ProtectedRoute>} />
        <Route path="/shipments" element={<ProtectedRoute><Shipments /></ProtectedRoute>} />
        <Route path="/shipments/:id" element={<ProtectedRoute><ShipmentDetail /></ProtectedRoute>} />
        <Route path="/trips" element={<ProtectedRoute><Trips /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/maintenance" element={<ProtectedRoute><Maintenance /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/dashboard" />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;