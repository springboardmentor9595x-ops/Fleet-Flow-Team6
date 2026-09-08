import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Route,
  UserCheck,
  Truck,
  Package,
  CalendarCheck,
  RefreshCw,
  Plus,
  Activity,
  AlertCircle,
} from "lucide-react";
import api from "../api/axios";
import AppLayout from "../layouts/AppLayout";

export default function DispatcherDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [availableVehicles, setAvailableVehicles] = useState([]);

  // Assignment Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [assignForm, setAssignForm] = useState({
    trip_id: "",
    driver_id: "",
    vehicle_id: "",
    shipment_id: "",
  });
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [assignSuccess, setAssignSuccess] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const [dashRes, driversRes, vehiclesRes] = await Promise.all([
        api.get("/api/dispatcher/dashboard"),
        api.get("/api/dispatcher/available-drivers"),
        api.get("/api/dispatcher/available-vehicles"),
      ]);
      setData(dashRes.data);
      setAvailableDrivers(driversRes.data || []);
      setAvailableVehicles(vehiclesRes.data || []);
    } catch (err) {
      setError("Failed to load dispatcher operational data. " + (err.response?.data?.detail || ""));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const openAssignModal = (trip) => {
    setSelectedTrip(trip);
    setAssignForm({
      trip_id: trip ? trip.trip_id : "",
      driver_id: trip && trip.driver_id ? trip.driver_id : "",
      vehicle_id: trip && trip.vehicle_id ? trip.vehicle_id : "",
      shipment_id: "",
    });
    setAssignError("");
    setAssignSuccess("");
    setShowAssignModal(true);
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    setAssignError("");
    setAssignSuccess("");
    if (!assignForm.trip_id || !assignForm.driver_id || !assignForm.vehicle_id) {
      setAssignError("Trip, Driver, and Vehicle are required for assignment.");
      return;
    }
    setAssignLoading(true);
    try {
      const res = await api.post("/api/dispatcher/trips/assign", assignForm);
      setAssignSuccess(res.data.message || "Trip dispatched successfully!");
      setTimeout(() => {
        setShowAssignModal(false);
        fetchData();
      }, 1200);
    } catch (err) {
      setAssignError(err.response?.data?.detail || "Failed to assign trip.");
    } finally {
      setAssignLoading(false);
    }
  };

  const metrics = data?.metrics || {
    active_trips: 0,
    pending_trips: 0,
    completed_trips: 0,
    available_drivers: 0,
    available_vehicles: 0,
    active_shipments: 0,
    pending_shipments: 0,
    attendance: { present: 0, absent: 0, leave: 0, off_duty: 0 },
  };

  return (
    <AppLayout
      title="Dispatcher Operations Dashboard"
      subtitle="Real-Time Dispatch Control, Driver Assignments & Fleet Availability"
    >
      <div style={{ maxWidth: "1400px", margin: "0 auto", width: "100%" }}>
        {/* Sub Header / Refresh */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#10b981", fontWeight: 700, fontSize: "0.875rem" }}>
            <Activity size={18} />
            <span>REAL-TIME DISPATCH QUEUE</span>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.75rem",
              background: "white",
              border: "1px solid #cbd5e1",
              color: "#334155",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            Refresh Queue
          </button>
        </div>

        {error && (
          <div style={{ padding: "1rem", borderRadius: "0.75rem", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", marginBottom: "1.5rem" }}>
            <AlertCircle size={18} style={{ display: "inline", marginRight: "0.5rem" }} />
            {error}
          </div>
        )}

        {/* Metrics Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
          {/* Active Trips */}
          <div style={{ background: "white", padding: "1.25rem", borderRadius: "1rem", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#3b82f6" }}>
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b" }}>Active Trips</span>
              <Route size={20} />
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a", marginTop: "0.5rem" }}>{metrics.active_trips}</div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>{metrics.pending_trips} Pending Dispatch</div>
          </div>

          {/* Available Drivers */}
          <div style={{ background: "white", padding: "1.25rem", borderRadius: "1rem", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#10b981" }}>
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b" }}>Available Drivers</span>
              <UserCheck size={20} />
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a", marginTop: "0.5rem" }}>{metrics.available_drivers}</div>
            <div style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 600, marginTop: "0.25rem" }}>{metrics.attendance.present} Present & Checked In</div>
          </div>

          {/* Available Vehicles */}
          <div style={{ background: "white", padding: "1.25rem", borderRadius: "1rem", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#6366f1" }}>
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b" }}>Available Vehicles</span>
              <Truck size={20} />
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a", marginTop: "0.5rem" }}>{metrics.available_vehicles}</div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>Ready for assignment</div>
          </div>

          {/* Active Shipments */}
          <div style={{ background: "white", padding: "1.25rem", borderRadius: "1rem", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#f59e0b" }}>
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b" }}>Active Shipments</span>
              <Package size={20} />
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a", marginTop: "0.5rem" }}>{metrics.active_shipments}</div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>{metrics.pending_shipments} Pending Processing</div>
          </div>
        </div>

        {/* Operational Sections */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
          {/* Active Trips Dispatch Table */}
          <div style={{ background: "white", borderRadius: "1rem", padding: "1.5rem", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>Active & Pending Dispatch Trips</h2>
              <button
                onClick={() => openAssignModal(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "0.5rem 0.875rem",
                  borderRadius: "0.5rem",
                  background: "#10b981",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Plus size={16} /> Quick Assign Trip
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f1f5f9", color: "#64748b", fontWeight: 600 }}>
                    <th style={{ padding: "0.75rem" }}>Trip Code</th>
                    <th style={{ padding: "0.75rem" }}>Route</th>
                    <th style={{ padding: "0.75rem" }}>Driver</th>
                    <th style={{ padding: "0.75rem" }}>Vehicle</th>
                    <th style={{ padding: "0.75rem" }}>Status</th>
                    <th style={{ padding: "0.75rem" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recent_trips?.length > 0 ? (
                    data.recent_trips.map((trip) => (
                      <tr key={trip.trip_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.75rem", fontWeight: 700, color: "#3b82f6" }}>{trip.trip_code}</td>
                        <td style={{ padding: "0.75rem", color: "#334155" }}>
                          {trip.origin} → {trip.destination}
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          <span style={{ fontWeight: 600, color: trip.driver_name !== "Unassigned" ? "#0f172a" : "#94a3b8" }}>
                            {trip.driver_name}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem", color: "#475569" }}>{trip.vehicle_name}</td>
                        <td style={{ padding: "0.75rem" }}>
                          <span
                            style={{
                              padding: "0.25rem 0.625rem",
                              borderRadius: "9999px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              background:
                                trip.status === "In Transit"
                                  ? "#eff6ff"
                                  : trip.status === "Assigned"
                                  ? "#f0fdf4"
                                  : "#fffbeb",
                              color:
                                trip.status === "In Transit"
                                  ? "#1d4ed8"
                                  : trip.status === "Assigned"
                                  ? "#15803d"
                                  : "#b45309",
                            }}
                          >
                            {trip.status}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          <button
                            onClick={() => openAssignModal(trip)}
                            style={{
                              padding: "0.375rem 0.625rem",
                              borderRadius: "0.375rem",
                              background: "#f1f5f9",
                              color: "#334155",
                              fontWeight: 600,
                              fontSize: "0.75rem",
                              border: "1px solid #cbd5e1",
                              cursor: "pointer",
                            }}
                          >
                            Reassign / Update
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                        No active trips found in dispatch queue.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Available Resources & Attendance Overview */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Attendance Overview Card */}
            <div style={{ background: "white", borderRadius: "1rem", padding: "1.5rem", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                <CalendarCheck size={18} color="#10b981" />
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>Driver Attendance Today</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div style={{ background: "#f0fdf4", padding: "0.75rem", borderRadius: "0.5rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#166534" }}>{metrics.attendance.present}</div>
                  <div style={{ fontSize: "0.75rem", color: "#15803d", fontWeight: 600 }}>Present / Working</div>
                </div>
                <div style={{ background: "#fef2f2", padding: "0.75rem", borderRadius: "0.5rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#991b1b" }}>{metrics.attendance.absent}</div>
                  <div style={{ fontSize: "0.75rem", color: "#b91c1c", fontWeight: 600 }}>Absent</div>
                </div>
                <div style={{ background: "#fffbeb", padding: "0.75rem", borderRadius: "0.5rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#92400e" }}>{metrics.attendance.leave}</div>
                  <div style={{ fontSize: "0.75rem", color: "#b45309", fontWeight: 600 }}>On Leave</div>
                </div>
                <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "0.5rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#475569" }}>{metrics.attendance.off_duty}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Off Duty</div>
                </div>
              </div>
            </div>

            {/* Ready Drivers List */}
            <div style={{ background: "white", borderRadius: "1rem", padding: "1.5rem", border: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginBottom: "1rem" }}>
                Ready Drivers ({availableDrivers.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "220px", overflowY: "auto" }}>
                {availableDrivers.length > 0 ? (
                  availableDrivers.map((d) => (
                    <div
                      key={d.driver_id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.625rem 0.75rem",
                        borderRadius: "0.5rem",
                        background: "#f8fafc",
                        border: "1px solid #f1f5f9",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>{d.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Lic: {d.license_number}</div>
                      </div>
                      <span style={{ padding: "0.2rem 0.5rem", borderRadius: "9999px", background: "#dcfce7", color: "#15803d", fontSize: "0.7rem", fontWeight: 700 }}>
                        Ready
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: "0.8125rem", color: "#94a3b8", textAlign: "center", padding: "1rem" }}>
                    No drivers currently available for dispatch.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Assignment Modal */}
        {showAssignModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ background: "white", borderRadius: "1.25rem", padding: "2rem", width: "100%", maxWidth: "520px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a" }}>
                  {selectedTrip ? `Assign Trip ${selectedTrip.trip_code}` : "Assign & Dispatch Trip"}
                </h3>
                <button onClick={() => setShowAssignModal(false)} style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#64748b" }}>
                  ✕
                </button>
              </div>

              {assignError && (
                <div style={{ padding: "0.75rem", borderRadius: "0.5rem", background: "#fef2f2", color: "#b91c1c", fontSize: "0.875rem", marginBottom: "1rem" }}>
                  {assignError}
                </div>
              )}
              {assignSuccess && (
                <div style={{ padding: "0.75rem", borderRadius: "0.5rem", background: "#f0fdf4", color: "#166534", fontSize: "0.875rem", marginBottom: "1rem" }}>
                  {assignSuccess}
                </div>
              )}

              <form onSubmit={handleAssignSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {!selectedTrip && (
                  <div>
                    <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: "0.375rem" }}>Trip ID</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter trip ID"
                      value={assignForm.trip_id}
                      onChange={(e) => setAssignForm({ ...assignForm, trip_id: e.target.value })}
                      style={{ width: "100%", padding: "0.625rem", borderRadius: "0.5rem", border: "1px solid #cbd5e1" }}
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: "0.375rem" }}>Select Available Driver (Checked In)</label>
                  <select
                    required
                    value={assignForm.driver_id}
                    onChange={(e) => setAssignForm({ ...assignForm, driver_id: e.target.value })}
                    style={{ width: "100%", padding: "0.625rem", borderRadius: "0.5rem", border: "1px solid #cbd5e1" }}
                  >
                    <option value="">-- Choose Available Driver --</option>
                    {availableDrivers.map((d) => (
                      <option key={d.driver_id} value={d.driver_id}>
                        {d.name} ({d.license_number})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: "0.375rem" }}>Select Available Vehicle</label>
                  <select
                    required
                    value={assignForm.vehicle_id}
                    onChange={(e) => setAssignForm({ ...assignForm, vehicle_id: e.target.value })}
                    style={{ width: "100%", padding: "0.625rem", borderRadius: "0.5rem", border: "1px solid #cbd5e1" }}
                  >
                    <option value="">-- Choose Available Vehicle --</option>
                    {availableVehicles.map((v) => (
                      <option key={v.vehicle_id} value={v.vehicle_id}>
                        {v.make} {v.model} ({v.registration_number})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    style={{ flex: 1, padding: "0.625rem", borderRadius: "0.5rem", background: "#e2e8f0", border: "none", color: "#334155", fontWeight: 600, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={assignLoading}
                    style={{ flex: 1, padding: "0.625rem", borderRadius: "0.5rem", background: "#10b981", border: "none", color: "white", fontWeight: 700, cursor: "pointer" }}
                  >
                    {assignLoading ? "Dispatching..." : "Confirm Assignment"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
