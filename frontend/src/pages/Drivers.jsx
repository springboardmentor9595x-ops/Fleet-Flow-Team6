import React, { useEffect, useState, useCallback } from "react";
import Layout from "../components/layout/Layout";
import {
  getDrivers,
  addDriver,
  updateDriver,
  deleteDriver,
  assignVehicle,
  unassignVehicle,
  getDriverActivity,
  getEligibleUsers,
  getVehicles,
} from "../api/driversApi";
import { useAuth } from "../context/AuthContext";

function statusBadge(status) {
  const map = {
    Available: "badge-available",
    Inactive: "badge-inactive",
    "On Trip": "badge-in-transit",
    Assigned: "badge-assigned",
  };
  return `badge ${map[status] || "badge-created"}`;
}

function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return <div className={`toast toast-${type}`}>{msg}</div>;
}

const emptyDriver = {
  license_number: "",
  experience_years: "",
  address: "",
  status: "Available",
  user_id: "",
};

export default function Drivers() {
  const { user } = useAuth();
  const isDriverUser = user?.role === "Driver";
  const canManage = user?.role === "Admin" || user?.role === "FleetManager";

  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [eligibleUsers, setEligibleUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [toast, setToast] = useState(null);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyDriver);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Assign vehicle modal
  const [assignModalDriver, setAssignModalDriver] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Activity drawer / modal
  const [activityDriver, setActivityDriver] = useState(null);
  const [activityData, setActivityData] = useState(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
  };

  const load = useCallback(async () => {
    try {
      const [driversData, vehiclesData] = await Promise.all([
        getDrivers(),
        getVehicles(),
      ]);
      setDrivers(driversData || []);
      setVehicles(vehiclesData || []);

      if (canManage) {
        getEligibleUsers().then(setEligibleUsers).catch(() => {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    load();
  }, [load]);

  // Load activity automatically for Driver role on first load
  useEffect(() => {
    if (isDriverUser && drivers.length > 0 && !activityData) {
      viewActivity(drivers[0]);
    }
  }, [isDriverUser, drivers]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyDriver);
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (driver) => {
    setEditing(driver);
    setForm({
      license_number: driver.license_number || "",
      experience_years: driver.experience_years ?? "",
      address: driver.address || "",
      status: driver.status || "Available",
      user_id: driver.user_id || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        license_number: form.license_number,
        experience_years: form.experience_years ? Number(form.experience_years) : null,
        address: form.address || null,
        status: form.status,
        user_id: form.user_id || null,
      };

      if (editing) {
        await updateDriver(editing.driver_id, payload);
        showToast("Driver updated successfully.");
      } else {
        await addDriver(payload);
        showToast("Driver added successfully.");
      }
      setShowModal(false);
      load();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setFormError(Array.isArray(detail) ? detail.map((d) => d.msg).join(", ") : detail || "Operation failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, license) => {
    if (!window.confirm(`Delete driver with license ${license}?`)) return;
    try {
      await deleteDriver(id);
      showToast("Driver deleted.");
      load();
    } catch {
      showToast("Failed to delete driver.", "error");
    }
  };

  // Open Vehicle Assignment Modal
  const openAssignModal = (driver) => {
    setAssignModalDriver(driver);
    setSelectedVehicleId(driver.assigned_vehicle?.vehicle_id || "");
  };

  const handleAssignVehicle = async (e) => {
    e.preventDefault();
    if (!selectedVehicleId) return;
    setAssigning(true);
    try {
      await assignVehicle(assignModalDriver.driver_id, selectedVehicleId);
      showToast("Vehicle assigned to driver successfully.");
      setAssignModalDriver(null);
      load();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to assign vehicle.";
      showToast(msg, "error");
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignVehicle = async (driver) => {
    if (!window.confirm(`Unassign vehicle ${driver.assigned_vehicle?.registration_number} from driver ${driver.license_number}?`)) return;
    try {
      await unassignVehicle(driver.driver_id);
      showToast("Vehicle unassigned successfully.");
      load();
    } catch (err) {
      showToast("Failed to unassign vehicle.", "error");
    }
  };

  // View Activity & Performance metrics
  const viewActivity = async (driver) => {
    setActivityDriver(driver);
    setLoadingActivity(true);
    try {
      const data = await getDriverActivity(driver.driver_id);
      setActivityData(data);
    } catch (err) {
      console.error(err);
      showToast("Failed to load driver activity.", "error");
    } finally {
      setLoadingActivity(false);
    }
  };

  const filtered = drivers.filter((d) => {
    const q = search.toLowerCase();
    const matchSearch =
      d.license_number?.toLowerCase().includes(q) ||
      d.status?.toLowerCase().includes(q) ||
      d.address?.toLowerCase().includes(q) ||
      d.user?.full_name?.toLowerCase().includes(q) ||
      d.assigned_vehicle?.registration_number?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "All" || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <Layout>
      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="page-header">
        <div className="page-header-left">
          <h1>{isDriverUser ? "My Driver Profile & Assignment" : "Drivers & Vehicle Assignments"}</h1>
          <p>
            {isDriverUser
              ? "View your active vehicle assignment, recent trips, and performance activity"
              : "Register drivers, assign vehicles, and track individual driver performance"}
          </p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={openAdd}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Driver
          </button>
        )}
      </div>

      {/* Driver Self-Dashboard Card if logged in as Driver */}
      {isDriverUser && drivers.length > 0 && (
        <div
          style={{
            background: "linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95))",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 16,
            padding: "24px",
            marginBottom: 28,
            boxShadow: "0 12px 32px rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#818cf8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Driver Portal
              </span>
              <h2 style={{ margin: "4px 0 8px", color: "#f1f5f9", fontSize: "1.4rem" }}>
                {drivers[0]?.user?.full_name || user?.full_name}
              </h2>
              <div style={{ display: "flex", gap: 16, color: "rgba(255,255,255,0.6)", fontSize: "0.85rem", flexWrap: "wrap" }}>
                <span>License: <strong style={{ color: "#38bdf8" }}>{drivers[0]?.license_number}</strong></span>
                <span>Experience: <strong style={{ color: "#f1f5f9" }}>{drivers[0]?.experience_years ?? 0} yrs</strong></span>
                <span>Status: <span className={statusBadge(drivers[0]?.status)}>{drivers[0]?.status}</span></span>
              </div>
            </div>

            {drivers[0]?.assigned_vehicle ? (
              <div
                style={{
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  borderRadius: 12,
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span style={{ fontSize: "1.8rem" }}>🚚</span>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#34d399", fontWeight: 700 }}>CURRENT ASSIGNED VEHICLE</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#f1f5f9", fontFamily: "monospace" }}>
                    {drivers[0].assigned_vehicle.registration_number}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>
                    {drivers[0].assigned_vehicle.vehicle_type} ({drivers[0].assigned_vehicle.brand || "Fleet"})
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: "rgba(245,158,11,0.1)",
                  border: "1px solid rgba(245,158,11,0.25)",
                  borderRadius: 12,
                  padding: "14px 18px",
                  color: "#fbbf24",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                }}
              >
                🔔 No vehicle currently assigned. Fleet management will assign an available vehicle when scheduled.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter Bar (for Admin / FleetManager) */}
      {!isDriverUser && (
        <div className="filter-bar">
          <div className="search-box">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by driver name, license, vehicle registration, status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Available">Available</option>
            <option value="On Trip">On Trip</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="loading-screen">
          <div className="spinner" />
          <span>Loading drivers & vehicle assignments...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
          <h3>No drivers found</h3>
          <p>Register your first driver profile or adjust filters.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Driver Name & User</th>
                <th>License Number</th>
                <th>Experience</th>
                <th>Assigned Vehicle</th>
                <th>Driver Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const veh = d.assigned_vehicle;
                return (
                  <tr key={d.driver_id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "#f1f5f9" }}>
                        {d.user?.full_name || "Unlinked User"}
                      </div>
                      {d.user?.email && (
                        <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                          {d.user.email}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: "var(--accent-cyan)", fontFamily: "monospace", letterSpacing: "0.04em" }}>
                        {d.license_number}
                      </span>
                    </td>
                    <td>{d.experience_years != null ? `${d.experience_years} yrs` : "—"}</td>
                    <td>
                      {veh ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              background: "rgba(59,130,246,0.15)",
                              color: "#60a5fa",
                              border: "1px solid rgba(59,130,246,0.3)",
                              borderRadius: 6,
                              padding: "3px 8px",
                              fontFamily: "monospace",
                              fontWeight: 700,
                              fontSize: "0.82rem",
                            }}
                          >
                            {veh.registration_number}
                          </span>
                          {canManage && (
                            <button
                              onClick={() => handleUnassignVehicle(d)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#f87171",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                                padding: "2px",
                              }}
                              title="Unassign vehicle"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                          No vehicle
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={statusBadge(d.status)}>{d.status || "Available"}</span>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => viewActivity(d)}
                          title="View Activity & Trips"
                        >
                          📊 Activity
                        </button>
                        {canManage && (
                          <>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => openAssignModal(d)}
                              title="Assign Vehicle"
                              style={{ color: "#38bdf8" }}
                            >
                              🚗 Assign
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => openEdit(d)}
                              title="Edit Driver Profile"
                            >
                              ✏️
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDelete(d.driver_id, d.license_number)}
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Vehicle Assignment Modal */}
      {assignModalDriver && (
        <div className="modal-overlay" onClick={() => setAssignModalDriver(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2>🚗 Assign Vehicle to Driver</h2>
              <button className="modal-close" onClick={() => setAssignModalDriver(null)}>×</button>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "0 0 16px" }}>
              Driver: <strong>{assignModalDriver.user?.full_name || assignModalDriver.license_number}</strong>
            </p>
            <form onSubmit={handleAssignVehicle}>
              <div className="form-group">
                <label className="form-label">Select Vehicle *</label>
                <select
                  className="form-control"
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  required
                >
                  <option value="">Choose an available vehicle...</option>
                  {vehicles.map((v) => (
                    <option key={v.vehicle_id} value={v.vehicle_id} disabled={v.status === "Maintenance"}>
                      {v.registration_number} — {v.vehicle_type} ({v.status})
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-actions" style={{ marginTop: 20 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setAssignModalDriver(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={assigning || !selectedVehicleId}>
                  {assigning ? "Assigning..." : "Confirm Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Driver Registration / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? "Edit Driver Profile" : "Register Driver Profile"}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>

            {formError && (
              <div className="auth-error" style={{ marginBottom: 16 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {formError}
              </div>
            )}

            <form onSubmit={handleSave}>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label className="form-label">Link User Account (Role: Driver)</label>
                  <select
                    className="form-control"
                    name="user_id"
                    value={form.user_id}
                    onChange={(e) => setForm((p) => ({ ...p, user_id: e.target.value }))}
                  >
                    <option value="">Select user account...</option>
                    {eligibleUsers.map((u) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.full_name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">License Number *</label>
                  <input
                    name="license_number"
                    className="form-control"
                    placeholder="e.g. TN0520230012345"
                    value={form.license_number}
                    onChange={(e) => setForm((p) => ({ ...p, license_number: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Experience (Years)</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    name="experience_years"
                    className="form-control"
                    placeholder="e.g. 5"
                    value={form.experience_years}
                    onChange={(e) => setForm((p) => ({ ...p, experience_years: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    name="status"
                    className="form-control"
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  >
                    <option value="Available">Available</option>
                    <option value="On Trip">On Trip</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="form-group full-width">
                  <label className="form-label">Address / Base Depot</label>
                  <textarea
                    name="address"
                    className="form-control"
                    placeholder="Full residential or depot address..."
                    rows={2}
                    value={form.address}
                    onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  />
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: 20 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editing ? "Update Profile" : "Register Driver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Driver Activity & Performance Drawer */}
      {activityDriver && (
        <div className="modal-overlay" onClick={() => setActivityDriver(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 640, maxHeight: "90vh", overflowY: "auto" }}
          >
            <div className="modal-header">
              <h2>📊 Driver Activity & Performance Log</h2>
              <button className="modal-close" onClick={() => setActivityDriver(null)}>×</button>
            </div>

            <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 16 }}>
              Driver: <strong>{activityDriver.user?.full_name || activityDriver.license_number}</strong>
            </div>

            {loadingActivity ? (
              <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>Loading activity records...</div>
            ) : activityData ? (
              <div>
                {/* Stat Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                  <div style={statBox}>
                    <div style={statLabel}>Total Trips</div>
                    <div style={{ ...statVal, color: "#60a5fa" }}>{activityData.total_trips}</div>
                  </div>
                  <div style={statBox}>
                    <div style={statLabel}>Completed Trips</div>
                    <div style={{ ...statVal, color: "#34d399" }}>{activityData.completed_trips}</div>
                  </div>
                  <div style={statBox}>
                    <div style={statLabel}>Total Distance</div>
                    <div style={{ ...statVal, color: "#f59e0b" }}>{activityData.total_distance_km} km</div>
                  </div>
                </div>

                <h3 style={{ fontSize: "0.95rem", color: "#f1f5f9", marginBottom: 10 }}>Recent Trips</h3>
                {activityData.recent_trips?.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", padding: 12 }}>No trips logged yet.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                    {activityData.recent_trips.slice(0, 5).map((t) => (
                      <div
                        key={t.trip_id}
                        style={{
                          background: "rgba(15,23,42,0.6)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: 8,
                          padding: "10px 14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "0.82rem",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: "#f1f5f9" }}>
                            {t.start_location} → {t.destination}
                          </div>
                          <div style={{ color: "var(--text-muted)", fontSize: "0.74rem" }}>
                            {t.distance ? `${t.distance} km • ` : ""}{t.created_at ? new Date(t.created_at).toLocaleDateString() : ""}
                          </div>
                        </div>
                        <span className={statusBadge(t.status)}>{t.status}</span>
                      </div>
                    ))}
                  </div>
                )}

                <h3 style={{ fontSize: "0.95rem", color: "#f1f5f9", marginBottom: 10 }}>Attendance Logs</h3>
                {activityData.recent_attendance?.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", padding: 12 }}>No attendance records recorded.</div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {activityData.recent_attendance.map((a) => (
                      <span
                        key={a.attendance_id}
                        style={{
                          background: a.status === "Present" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                          color: a.status === "Present" ? "#34d399" : "#f87171",
                          border: `1px solid ${a.status === "Present" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                          borderRadius: 6,
                          padding: "4px 8px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        {a.date}: {a.status}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </Layout>
  );
}

const statBox = {
  background: "rgba(15,23,42,0.6)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  padding: "12px",
  textAlign: "center",
};

const statLabel = {
  fontSize: "0.72rem",
  color: "rgba(255,255,255,0.5)",
  marginBottom: 4,
};

const statVal = {
  fontSize: "1.25rem",
  fontWeight: 800,
};