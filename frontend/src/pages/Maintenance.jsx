import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Wrench, Plus, AlertTriangle, CheckCircle2, Clock, Calendar, DollarSign, FileText } from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Maintenance() {
  const { user } = useAuth();
  const [maintenanceList, setMaintenanceList] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    vehicle_id: "",
    maintenance_type: "General Inspection",
    service_date: new Date().toISOString().split("T")[0],
    next_service_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    cost: "",
    remarks: "",
    status: "Scheduled"
  });

  const canManage = user && ["Admin", "FleetManager"].includes(user.role);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [mRes, vRes] = await Promise.all([
        api.get("/maintenance"),
        api.get("/fleet/vehicles")
      ]);
      setMaintenanceList(Array.isArray(mRes.data) ? mRes.data : []);
      setVehicles(Array.isArray(vRes.data) ? vRes.data : []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load vehicle maintenance records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/maintenance", formData);
      setShowModal(false);
      setFormData({
        vehicle_id: "",
        maintenance_type: "General Inspection",
        service_date: new Date().toISOString().split("T")[0],
        next_service_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        cost: "",
        remarks: "",
        status: "Scheduled"
      });
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to schedule vehicle maintenance record.");
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await api.put(`/maintenance/${id}`, { status: newStatus });
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to update maintenance status.");
    }
  };

  const handleDelete = async (mId) => {
    if (!window.confirm("Are you sure you want to delete this maintenance record?")) return;
    try {
      await api.delete(`/maintenance/${mId}`);
      fetchData();
    } catch (err) {
      console.error("Failed to delete maintenance record", err);
      alert("Failed to delete maintenance record.");
    }
  };

  const overdueCount = maintenanceList.filter(m => m.is_overdue).length;
  const upcomingCount = maintenanceList.filter(m => m.is_upcoming).length;

  return (
    <AppLayout title="Vehicle Maintenance Control" subtitle="Schedule servicing, monitor vehicle health, and track maintenance costs.">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* Header Actions & Badges */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", gap: "1rem" }}>
            <div style={{ background: "white", padding: "0.75rem 1.25rem", borderRadius: "1rem", border: "1.5px solid rgba(15,23,42,0.06)", display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <AlertTriangle size={18} color="#ef4444" />
              <div>
                <p style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Overdue Service</p>
                <p style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0f172a" }}>{overdueCount}</p>
              </div>
            </div>
            <div style={{ background: "white", padding: "0.75rem 1.25rem", borderRadius: "1rem", border: "1.5px solid rgba(15,23,42,0.06)", display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <Clock size={18} color="#f59e0b" />
              <div>
                <p style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Upcoming (7 Days)</p>
                <p style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0f172a" }}>{upcomingCount}</p>
              </div>
            </div>
          </div>

          {canManage && (
            <button
              onClick={() => setShowModal(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                color: "white",
                padding: "0.625rem 1.25rem",
                borderRadius: "0.875rem",
                border: "none",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(99,102,241,0.2)"
              }}
            >
              <Plus size={16} />
              <span>Schedule Service</span>
            </button>
          )}
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1.5px solid #fecdd3", color: "#991b1b", borderRadius: "0.75rem", padding: "1rem", fontSize: "0.875rem" }}>
            {error}
          </div>
        )}

        {/* Maintenance Table */}
        {maintenanceList.length === 0 ? (
          <div style={{ background: "white", borderRadius: "1.25rem", border: "1.5px solid rgba(15,23,42,0.06)", padding: "3rem", textAlign: "center" }}>
            <Wrench size={48} color="#94a3b8" style={{ margin: "0 auto 1rem" }} />
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>No Maintenance Logs</h3>
            <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.25rem" }}>There are no maintenance records registered.</p>
          </div>
        ) : (
          <div style={{ background: "white", border: "1.5px solid rgba(15,23,42,0.06)", borderRadius: "1.25rem", overflow: "hidden", boxShadow: "0 4px 12px rgba(15,23,42,0.01)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Vehicle", "Type", "Service Date", "Next Due Date", "Cost", "Remarks", "Status", "Resolution", "Actions"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "0.75rem 1rem", color: "#94a3b8", fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.05em", textTransform: "uppercase", borderBottom: "1.5px solid #f1f5f9" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {maintenanceList.map((m) => {
                  let badgeBg = "#eff6ff";
                  let badgeColor = "#2563eb";
                  if (m.status === "In Service") {
                    badgeBg = "#fffbebfb";
                    badgeColor = "#d97706";
                  } else if (m.status === "Completed" || m.status === "Resolved") {
                    badgeBg = "#ecfdf5";
                    badgeColor = "#059669";
                  }

                  const isResolved = m.resolution_status === "Resolved" || m.status === "Completed" || m.status === "Resolved";

                  return (
                    <tr key={m.maintenance_id} style={{ borderBottom: "1px solid #f8fafc" }}>
                      <td style={{ padding: "1rem", fontWeight: 700, color: "#0f172a" }}>
                        {m.registration_number}
                        <span style={{ display: "block", fontSize: "0.6875rem", color: "#64748b", fontWeight: 500 }}>{m.vehicle_type}</span>
                      </td>
                      <td style={{ padding: "1rem", fontWeight: 600, color: "#475569" }}>{m.maintenance_type}</td>
                      <td style={{ padding: "1rem", color: "#64748b", fontSize: "0.8125rem" }}>{m.service_date}</td>
                      <td style={{ padding: "1rem" }}>
                        <span style={{ color: m.is_overdue ? "#dc2626" : m.is_upcoming ? "#d97706" : "#475569", fontWeight: m.is_overdue || m.is_upcoming ? 700 : 500, fontSize: "0.8125rem" }}>
                          {m.next_service_date}
                          {m.is_overdue && " (OVERDUE)"}
                          {m.is_upcoming && " (UPCOMING)"}
                        </span>
                      </td>
                      <td style={{ padding: "1rem", fontWeight: 700, color: "#0f172a" }}>₹{m.cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: "1rem", color: "#64748b", fontSize: "0.8125rem", maxWidth: "200px" }}>{m.remarks || "-"}</td>
                      <td style={{ padding: "1rem" }}>
                        <span style={{ background: badgeBg, color: badgeColor, padding: "0.25rem 0.625rem", borderRadius: "0.5rem", fontSize: "0.75rem", fontWeight: 700 }}>
                          {m.status}
                        </span>
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <span style={{
                          background: isResolved ? "#f0fdf4" : "#fef2f2",
                          color: isResolved ? "#15803d" : "#b91c1c",
                          border: `1px solid ${isResolved ? "#bbf7d0" : "#fecaca"}`,
                          padding: "0.25rem 0.625rem",
                          borderRadius: "0.5rem",
                          fontSize: "0.75rem",
                          fontWeight: 700
                        }}>
                          {isResolved ? "Resolved ✓" : "Unresolved ⏳"}
                        </span>
                      </td>
                      <td style={{ padding: "1rem" }}>
                        {canManage && (
                          <div style={{ display: "flex", gap: "0.375rem", alignItems: "center", flexWrap: "wrap" }}>
                            {m.status === "Scheduled" && !isResolved && (
                              <button
                                onClick={() => handleStatusUpdate(m.maintenance_id, "In Service")}
                                style={{ padding: "0.375rem 0.625rem", borderRadius: "0.5rem", border: "1px solid #d97706", background: "#fef3c7", color: "#92400e", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
                              >
                                Start Service
                              </button>
                            )}
                            {!isResolved ? (
                              <button
                                onClick={() => handleStatusUpdate(m.maintenance_id, "Resolved")}
                                style={{ padding: "0.375rem 0.625rem", borderRadius: "0.5rem", border: "1px solid #16a34a", background: "#f0fdf4", color: "#15803d", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}
                              >
                                Mark Resolved
                              </button>
                            ) : (
                              <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 700 }}>
                                Closed
                              </span>
                            )}
                            <button
                              onClick={() => handleDelete(m.maintenance_id)}
                              style={{ padding: "0.375rem 0.625rem", borderRadius: "0.5rem", border: "1px solid #fee2e2", background: "#fef2f2", color: "#ef4444", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Schedule Modal */}
        {showModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
            <div style={{ background: "white", borderRadius: "1.25rem", padding: "1.75rem", width: "100%", maxWidth: "500px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", marginBottom: "1.25rem" }}>Schedule Vehicle Maintenance</h3>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Select Vehicle</label>
                  <select name="vehicle_id" required value={formData.vehicle_id} onChange={handleChange} style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", marginTop: "0.25rem" }}>
                    <option value="">-- Choose Vehicle --</option>
                    {vehicles.map(v => (
                      <option key={v.vehicle_id} value={v.vehicle_id}>{v.registration_number} ({v.vehicle_type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Maintenance Type</label>
                  <select name="maintenance_type" required value={formData.maintenance_type} onChange={handleChange} style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", marginTop: "0.25rem" }}>
                    <option value="Oil Change">Oil Change</option>
                    <option value="Tire Replacement">Tire Replacement</option>
                    <option value="Engine Service">Engine Service</option>
                    <option value="Brake Service">Brake Service</option>
                    <option value="General Inspection">General Inspection</option>
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Service Date</label>
                    <input type="date" name="service_date" required value={formData.service_date} onChange={handleChange} style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", marginTop: "0.25rem" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Next Service Due</label>
                    <input type="date" name="next_service_date" required value={formData.next_service_date} onChange={handleChange} style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", marginTop: "0.25rem" }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Estimated Cost (₹)</label>
                  <input type="number" step="0.01" name="cost" required value={formData.cost} onChange={handleChange} placeholder="e.g. 350.00" style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", marginTop: "0.25rem" }} />
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Remarks / Notes</label>
                  <textarea name="remarks" rows="2" value={formData.remarks} onChange={handleChange} placeholder="Service details..." style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", marginTop: "0.25rem" }} />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <button type="button" onClick={() => setShowModal(false)} style={{ padding: "0.625rem 1.25rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", background: "transparent", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  <button type="submit" style={{ padding: "0.625rem 1.25rem", borderRadius: "0.75rem", border: "none", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white", fontWeight: 600, cursor: "pointer" }}>Schedule</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
