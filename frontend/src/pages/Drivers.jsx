import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { UserCircle2, Plus, Truck, ShieldCheck, Phone, Mail, Award, CheckCircle2, CalendarCheck } from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Drivers() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [assignModalDriver, setAssignModalDriver] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  // Attendance modal state
  const [attModalDriver, setAttModalDriver] = useState(null);
  const [attStatus, setAttStatus] = useState("Present");
  const [attDate, setAttDate] = useState(new Date().toISOString().split("T")[0]);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "DriverPass123!",
    phone: "",
    license_number: "",
    experience_years: 3,
    address: "",
    vehicle_id: ""
  });

  const canManage = user && ["Admin", "FleetManager"].includes(user.role);

  const [leaveRequests, setLeaveRequests] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dRes, vRes, lRes] = await Promise.all([
        api.get("/drivers"),
        api.get("/fleet/vehicles"),
        api.get("/attendance/leave-requests").catch(() => ({ data: [] }))
      ]);
      setDrivers(Array.isArray(dRes.data) ? dRes.data : []);
      setVehicles(Array.isArray(vRes.data) ? vRes.data : []);
      setLeaveRequests(Array.isArray(lRes.data) ? lRes.data : []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load driver roster.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApproveLeave = async (leaveId) => {
    try {
      await api.put(`/attendance/leave-requests/${leaveId}/approve`);
      alert("Leave request approved successfully! Driver attendance set to 'On Leave'.");
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to approve leave request.");
    }
  };

  const handleRejectLeave = async (leaveId) => {
    try {
      await api.put(`/attendance/leave-requests/${leaveId}/reject`);
      alert("Leave request rejected.");
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to reject leave request.");
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/drivers", formData);
      setShowModal(false);
      setFormData({
        full_name: "",
        email: "",
        password: "DriverPass123!",
        phone: "",
        license_number: "",
        experience_years: 3,
        address: "",
        vehicle_id: ""
      });
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to register driver profile.");
    }
  };

  const handleAssignVehicle = async (e) => {
    e.preventDefault();
    if (!assignModalDriver || !selectedVehicleId) return;
    try {
      await api.put(`/drivers/${assignModalDriver.driver_id}/assign-vehicle`, {
        vehicle_id: selectedVehicleId
      });
      setAssignModalDriver(null);
      setSelectedVehicleId("");
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to assign vehicle to driver.");
    }
  };

  const handleUnassign = async (driverId) => {
    try {
      await api.put(`/drivers/${driverId}/unassign`);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to unassign driver.");
    }
  };

  const handleSaveAttendance = async (e) => {
    e.preventDefault();
    if (!attModalDriver) return;
    try {
      await api.post("/attendance", {
        driver_id: attModalDriver.driver_id,
        date: attDate,
        status: attStatus
      });
      setAttModalDriver(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to mark attendance.");
    }
  };

  return (
    <AppLayout title="Driver Roster & Attendance" subtitle="Manage driver profiles, licenses, vehicle assignments, and attendance logs.">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* Driver Leave Approvals Section */}
        {canManage && leaveRequests && leaveRequests.length > 0 && (
          <div className="ff-card" style={{ padding: "1.5rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <CalendarCheck size={18} color="#d97706" />
              <span>Driver Leave Approvals</span>
              <span style={{ fontSize: "0.75rem", background: "#fef3c7", color: "#b45309", padding: "0.125rem 0.5rem", borderRadius: "9999px", fontWeight: 700 }}>
                {leaveRequests.filter(r => r.status === "Pending").length} Pending
              </span>
            </h3>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ padding: "0.625rem", textAlign: "left", color: "#94a3b8" }}>Driver</th>
                    <th style={{ padding: "0.625rem", textAlign: "left", color: "#94a3b8" }}>License</th>
                    <th style={{ padding: "0.625rem", textAlign: "left", color: "#94a3b8" }}>Requested Dates</th>
                    <th style={{ padding: "0.625rem", textAlign: "left", color: "#94a3b8" }}>Reason</th>
                    <th style={{ padding: "0.625rem", textAlign: "left", color: "#94a3b8" }}>Status</th>
                    <th style={{ padding: "0.625rem", textAlign: "right", color: "#94a3b8" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.map((req, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.625rem", fontWeight: 700, color: "#0f172a" }}>{req.driver_name}</td>
                      <td style={{ padding: "0.625rem", color: "#64748b", fontFamily: "monospace" }}>{req.license_number || "N/A"}</td>
                      <td style={{ padding: "0.625rem", fontWeight: 700, color: "#2563eb" }}>{req.start_date} → {req.end_date}</td>
                      <td style={{ padding: "0.625rem", color: "#475569" }}>{req.reason || "N/A"}</td>
                      <td style={{ padding: "0.625rem" }}>
                        <span style={{
                          padding: "0.25rem 0.625rem",
                          borderRadius: "0.375rem",
                          fontWeight: 700,
                          fontSize: "0.75rem",
                          background: req.status === "Approved" ? "#dcfce7" : req.status === "Rejected" ? "#fee2e2" : "#fef3c7",
                          color: req.status === "Approved" ? "#15803d" : req.status === "Rejected" ? "#b91c1c" : "#b45309"
                        }}>
                          {req.status}
                        </span>
                      </td>
                      <td style={{ padding: "0.625rem", textAlign: "right" }}>
                        {req.status === "Pending" ? (
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                            <button
                              onClick={() => handleApproveLeave(req.leave_id)}
                              style={{
                                padding: "0.375rem 0.75rem",
                                borderRadius: "0.5rem",
                                border: "none",
                                background: "#10b981",
                                color: "white",
                                fontWeight: 700,
                                fontSize: "0.75rem",
                                cursor: "pointer"
                              }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectLeave(req.leave_id)}
                              style={{
                                padding: "0.375rem 0.75rem",
                                borderRadius: "0.5rem",
                                border: "none",
                                background: "#ef4444",
                                color: "white",
                                fontWeight: 700,
                                fontSize: "0.75rem",
                                cursor: "pointer"
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Reviewed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Header Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>Active Drivers ({drivers.length})</h3>
            <p style={{ fontSize: "0.8125rem", color: "#64748b" }}>Roster of verified fleet operators</p>
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
              <span>Register Driver</span>
            </button>
          )}
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1.5px solid #fecdd3", color: "#991b1b", borderRadius: "0.75rem", padding: "1rem", fontSize: "0.875rem" }}>
            {error}
          </div>
        )}

        {/* Drivers Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
          {drivers.map((d) => (
            <motion.div
              key={d.driver_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: "white",
                borderRadius: "1.25rem",
                border: "1.5px solid rgba(15,23,42,0.06)",
                padding: "1.25rem",
                boxShadow: "0 4px 12px rgba(15,23,42,0.02)",
                display: "flex",
                flexDirection: "column",
                gap: "1rem"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ width: "42px", height: "42px", borderRadius: "0.875rem", background: "linear-gradient(135deg, #6366f1, #3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700 }}>
                    {d.full_name.charAt(0)}
                  </div>
                  <div>
                    <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a" }}>{d.full_name}</h4>
                    <p style={{ fontSize: "0.75rem", color: "#64748b" }}>Lic: {d.license_number}</p>
                  </div>
                </div>

                <span style={{
                  background: d.status === "Assigned" ? "#e0e7ff" : d.status === "Active" ? "#dcfce7" : "#f1f5f9",
                  color: d.status === "Assigned" ? "#4338ca" : d.status === "Active" ? "#15803d" : "#475569",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  padding: "0.25rem 0.625rem",
                  borderRadius: "0.5rem"
                }}>
                  {d.status}
                </span>
              </div>

              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.375rem", fontSize: "0.8125rem", color: "#475569" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Mail size={14} color="#94a3b8" />
                  <span>{d.email}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Phone size={14} color="#94a3b8" />
                  <span>{d.phone || "No phone listed"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Award size={14} color="#94a3b8" />
                  <span>{d.experience_years} years experience</span>
                </div>
              </div>

              {/* Attendance Control Tag */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: d.today_attendance && d.today_attendance !== "Not Marked" ? "#f0fdf4" : "#fffbeb", padding: "0.625rem", borderRadius: "0.75rem", border: d.today_attendance && d.today_attendance !== "Not Marked" ? "1px solid #bbf7d0" : "1px solid #fde68a" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 700, color: d.today_attendance && d.today_attendance !== "Not Marked" ? "#15803d" : "#b45309" }}>
                  <CalendarCheck size={14} color={d.today_attendance && d.today_attendance !== "Not Marked" ? "#16a34a" : "#d97706"} />
                  <span>Attendance: {d.today_attendance && d.today_attendance !== "Not Marked" ? `Marked (${d.today_attendance})` : "Not Marked"}</span>
                </div>
                {canManage && (
                  <button
                    onClick={() => { setAttModalDriver(d); setAttStatus("Present"); }}
                    style={{ fontSize: "0.75rem", color: "#059669", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
                  >
                    {d.today_attendance && d.today_attendance !== "Not Marked" ? "Update" : "Mark"}
                  </button>
                )}
              </div>

              {/* Vehicle Assignment Card */}
              <div style={{ background: "#f8fafc", borderRadius: "0.875rem", border: "1px solid rgba(15,23,42,0.06)", padding: "0.75rem" }}>
                <p style={{ fontSize: "0.6875rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.25rem" }}>Assigned Vehicle</p>
                {d.assigned_vehicle ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0f172a" }}>{d.assigned_vehicle.registration_number}</p>
                      <p style={{ fontSize: "0.75rem", color: "#64748b" }}>{d.assigned_vehicle.vehicle_type}</p>
                    </div>
                    {canManage && (
                      <button
                        onClick={() => handleUnassign(d.driver_id)}
                        style={{ fontSize: "0.75rem", color: "#ef4444", background: "transparent", border: "none", cursor: "pointer", fontWeight: 600 }}
                      >
                        Unassign
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ fontSize: "0.8125rem", color: "#94a3b8", italic: "true" }}>No vehicle assigned</p>
                    {canManage && (
                      <button
                        onClick={() => { setAssignModalDriver(d); setSelectedVehicleId(""); }}
                        style={{ fontSize: "0.75rem", color: "#4f46e5", background: "transparent", border: "none", cursor: "pointer", fontWeight: 600 }}
                      >
                        + Assign
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mark Attendance Modal */}
        {attModalDriver && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
            <div style={{ background: "white", borderRadius: "1.25rem", padding: "1.75rem", width: "100%", maxWidth: "400px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.375rem" }}>Mark Attendance</h3>
              <p style={{ fontSize: "0.8125rem", color: "#64748b", marginBottom: "1rem" }}>Mark attendance record for {attModalDriver.full_name}</p>
              
              <form onSubmit={handleSaveAttendance} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Date</label>
                  <input type="date" value={attDate} onChange={e => setAttDate(e.target.value)} required style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", marginTop: "0.25rem" }} />
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Status</label>
                  <select value={attStatus} onChange={e => setAttStatus(e.target.value)} style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", marginTop: "0.25rem" }}>
                    <option value="Present">Present ✓</option>
                    <option value="Leave">Leave 🏖️</option>
                    <option value="Absent">Absent ❌</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <button type="button" onClick={() => setAttModalDriver(null)} style={{ padding: "0.625rem 1.25rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", background: "transparent", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  <button type="submit" style={{ padding: "0.625rem 1.25rem", borderRadius: "0.75rem", border: "none", background: "#059669", color: "white", fontWeight: 600, cursor: "pointer" }}>Save Attendance</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Register Driver Modal */}
        {showModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
            <div style={{ background: "white", borderRadius: "1.25rem", padding: "1.75rem", width: "100%", maxWidth: "500px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", marginBottom: "1.25rem" }}>Register Driver Profile</h3>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Full Name</label>
                  <input type="text" name="full_name" required value={formData.full_name} onChange={handleChange} placeholder="e.g. John Doe" style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", marginTop: "0.25rem" }} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Email Address</label>
                    <input type="email" name="email" required value={formData.email} onChange={handleChange} placeholder="john@fleet.com" style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", marginTop: "0.25rem" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Password</label>
                    <input type="password" name="password" required value={formData.password} onChange={handleChange} style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", marginTop: "0.25rem" }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Phone Number</label>
                    <input type="text" name="phone" value={formData.phone} onChange={handleChange} placeholder="+1 555-0192" style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", marginTop: "0.25rem" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>License Number</label>
                    <input type="text" name="license_number" required value={formData.license_number} onChange={handleChange} placeholder="DL-998877" style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", marginTop: "0.25rem" }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Experience (Years)</label>
                  <input type="number" name="experience_years" value={formData.experience_years} onChange={handleChange} style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", marginTop: "0.25rem" }} />
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Initial Vehicle Assignment (Optional)</label>
                  <select name="vehicle_id" value={formData.vehicle_id} onChange={handleChange} style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", marginTop: "0.25rem" }}>
                    <option value="">-- Unassigned --</option>
                    {vehicles.map(v => (
                      <option key={v.vehicle_id} value={v.vehicle_id}>{v.registration_number} ({v.vehicle_type})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <button type="button" onClick={() => setShowModal(false)} style={{ padding: "0.625rem 1.25rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", background: "transparent", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  <button type="submit" style={{ padding: "0.625rem 1.25rem", borderRadius: "0.75rem", border: "none", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white", fontWeight: 600, cursor: "pointer" }}>Register</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Assign Vehicle Control Modal */}
        {assignModalDriver && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
            <div style={{ background: "white", borderRadius: "1.25rem", padding: "1.75rem", width: "100%", maxWidth: "420px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" }}>Assign Vehicle</h3>
              <p style={{ fontSize: "0.8125rem", color: "#64748b", marginBottom: "1.25rem" }}>Assign a vehicle to {assignModalDriver.full_name}</p>
              
              <form onSubmit={handleAssignVehicle} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Select Available Vehicle</label>
                  <select
                    required
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", marginTop: "0.25rem" }}
                  >
                    <option value="">-- Choose Vehicle --</option>
                    {vehicles.map(v => (
                      <option key={v.vehicle_id} value={v.vehicle_id}>{v.registration_number} ({v.vehicle_type})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <button type="button" onClick={() => setAssignModalDriver(null)} style={{ padding: "0.625rem 1.25rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.1)", background: "transparent", color: "#475569", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  <button type="submit" style={{ padding: "0.625rem 1.25rem", borderRadius: "0.75rem", border: "none", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white", fontWeight: 600, cursor: "pointer" }}>Save Assignment</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
