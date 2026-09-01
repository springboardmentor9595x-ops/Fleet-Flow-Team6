import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Truck, Package2, Route, Fuel, CheckCircle2, Calendar, Clock, MapPin, Wrench, Award } from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function DriverDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFuelModal, setShowFuelModal] = useState(false);

  const [fuelData, setFuelData] = useState({
    amount: "",
    cost: "",
    mileage: "",
    refill_date: new Date().toISOString().split("T")[0]
  });

  const fetchDriverData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/drivers/me");
      setProfile(res.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load driver profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDriverData();
  }, []);

  const handleAttendance = async (statusVal) => {
    try {
      await api.post("/drivers/attendance", { status: statusVal });
      fetchDriverData();
    } catch (err) {
      console.error(err);
      alert("Failed to update attendance.");
    }
  };

  const handleFuelSubmit = async (e) => {
    e.preventDefault();
    if (!profile?.assigned_vehicle?.vehicle_id) {
      alert("No vehicle currently assigned to log fuel for.");
      return;
    }
    try {
      await api.post("/fuel", {
        vehicle_id: profile.assigned_vehicle.vehicle_id,
        amount: parseFloat(fuelData.amount),
        cost: parseFloat(fuelData.cost),
        mileage: parseFloat(fuelData.mileage || 0.0),
        refill_date: fuelData.refill_date
      });
      setShowFuelModal(false);
      setFuelData({
        amount: "",
        cost: "",
        mileage: "",
        refill_date: new Date().toISOString().split("T")[0]
      });
      alert("Fuel refill logged successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to log fuel refill.");
    }
  };

  if (loading) {
    return (
      <AppLayout title="Driver Portal" subtitle="Loading your personal driver dashboard...">
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "350px", flexDirection: "column", gap: "1rem" }}>
          <div className="ff-pulse-dot" style={{ width: "36px", height: "36px", background: "#6366f1" }} />
          <p style={{ fontSize: "0.875rem", color: "#64748b" }}>Loading Driver Workspace...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={`Driver Portal — ${user?.full_name || "Operator"}`} subtitle="Self-scoped dashboard for your assigned vehicle, active shipment, performance, and attendance.">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {error && (
          <div style={{ background: "#fef2f2", border: "1.5px solid #fecdd3", color: "#991b1b", borderRadius: "0.75rem", padding: "1rem", fontSize: "0.875rem" }}>
            {error}
          </div>
        )}

        {/* Top 4 KPI & Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
          
          {/* 1. Current Assigned Vehicle */}
          <div className="ff-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "0.75rem", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Truck size={20} color="#2563eb" />
              </div>
              <div>
                <p style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Assigned Vehicle</p>
                <h4 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0f172a" }}>
                  {profile?.assigned_vehicle?.registration_number || "Unassigned"}
                </h4>
              </div>
            </div>
            {profile?.assigned_vehicle && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8125rem", color: "#475569" }}>
                <span>Type: {profile.assigned_vehicle.vehicle_type}</span>
                <button
                  onClick={() => setShowFuelModal(true)}
                  style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: "#f1f5f9", border: "none", borderRadius: "0.5rem", padding: "0.375rem 0.625rem", color: "#0f172a", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}
                >
                  <Fuel size={14} color="#6366f1" />
                  <span>Log Fuel</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. My Attendance */}
          <div className="ff-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "0.75rem", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle2 size={20} color="#16a34a" />
              </div>
              <div>
                <p style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>My Attendance</p>
                <h4 style={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a" }}>{profile?.today_attendance || "Not Marked"}</h4>
              </div>
            </div>
            <p style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 600 }}>{profile?.attendance_summary}</p>
          </div>

          {/* 3. My Performance */}
          <div className="ff-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "0.75rem", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Award size={20} color="#d97706" />
              </div>
              <div>
                <p style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>My Performance</p>
                <h4 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0f172a" }}>{profile?.trips_completed || 0} Trips Completed</h4>
              </div>
            </div>
            <p style={{ fontSize: "0.75rem", color: "#64748b" }}>License: {profile?.license_number}</p>
          </div>

          {/* 4. My Vehicle's Maintenance Status */}
          <div className="ff-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "0.75rem", background: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Wrench size={20} color="#7c3aed" />
              </div>
              <div>
                <p style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Vehicle Maintenance</p>
                <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0f172a" }}>{profile?.vehicle_maintenance_status}</h4>
              </div>
            </div>
          </div>

        </div>

        {/* Current Active Shipment */}
        <div className="ff-card" style={{ padding: "1.5rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Package2 size={18} color="#6366f1" />
            <span>Current Assignment</span>
          </h3>

          {profile?.active_shipment ? (
            <div style={{ background: "#f8fafc", borderRadius: "1rem", border: "1.5px solid rgba(15,23,42,0.06)", padding: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#6366f1" }}>#{profile.active_shipment.tracking_number}</span>
                <p style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0f172a", marginTop: "0.25rem" }}>
                  {profile.active_shipment.source} → {profile.active_shipment.destination}
                </p>
              </div>
              <span style={{ background: "#e0e7ff", color: "#4338ca", padding: "0.375rem 0.875rem", borderRadius: "0.625rem", fontSize: "0.8125rem", fontWeight: 700 }}>
                {profile.active_shipment.status}
              </span>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
              <p style={{ fontSize: "0.875rem" }}>No active shipment currently assigned to you.</p>
            </div>
          )}
        </div>

        {/* Recent Activity Table */}
        <div className="ff-card" style={{ padding: "1.5rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Route size={18} color="#3b82f6" />
            <span>Recent Activity (Last Trips)</span>
          </h3>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ padding: "0.625rem", textAlign: "left", color: "#94a3b8" }}>Route</th>
                  <th style={{ padding: "0.625rem", textAlign: "left", color: "#94a3b8" }}>Distance (km)</th>
                  <th style={{ padding: "0.625rem", textAlign: "left", color: "#94a3b8" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {profile?.recent_trips && profile.recent_trips.length > 0 ? (
                  profile.recent_trips.map((t, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.625rem", fontWeight: 700, color: "#0f172a" }}>{t.route}</td>
                      <td style={{ padding: "0.625rem", color: "#475569" }}>{t.distance_km} km</td>
                      <td style={{ padding: "0.625rem" }}>
                        <span style={{ background: "#eff6ff", color: "#1d4ed8", padding: "0.25rem 0.5rem", borderRadius: "0.375rem", fontWeight: 700, fontSize: "0.75rem" }}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" style={{ textAlign: "center", padding: "1.5rem", color: "#94a3b8" }}>
                      No recent trip activity recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Log Fuel Modal */}
        {showFuelModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
            <div style={{ background: "white", borderRadius: "1.25rem", padding: "1.75rem", width: "100%", maxWidth: "450px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", marginBottom: "1.25rem" }}>Log Fuel Refill</h3>
              <form onSubmit={handleFuelSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Fuel Volume (Liters)</label>
                  <input type="number" step="0.1" required value={fuelData.amount} onChange={(e) => setFuelData({...fuelData, amount: e.target.value})} placeholder="e.g. 50.0" style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", marginTop: "0.25rem" }} />
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Total Cost (₹)</label>
                  <input type="number" step="0.01" required value={fuelData.cost} onChange={(e) => setFuelData({...fuelData, cost: e.target.value})} placeholder="e.g. 4200.00" style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", marginTop: "0.25rem" }} />
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Current Odometer Reading (km)</label>
                  <input type="number" step="1" value={fuelData.mileage} onChange={(e) => setFuelData({...fuelData, mileage: e.target.value})} placeholder="e.g. 12500" style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", marginTop: "0.25rem" }} />
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Refill Date</label>
                  <input type="date" required value={fuelData.refill_date} onChange={(e) => setFuelData({...fuelData, refill_date: e.target.value})} style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", marginTop: "0.25rem" }} />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <button type="button" onClick={() => setShowFuelModal(false)} style={{ padding: "0.625rem 1.25rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", background: "transparent", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  <button type="submit" style={{ padding: "0.625rem 1.25rem", borderRadius: "0.75rem", border: "none", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white", fontWeight: 600, cursor: "pointer" }}>Log Refill</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
