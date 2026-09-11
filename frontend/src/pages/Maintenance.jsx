import React, { useEffect, useState, useCallback } from "react";
import Layout from "../components/layout/Layout";
import api from "../api/axios";

// ============================================================
// API helpers
// ============================================================
const getMaintenance = (vehicleId) => {
  const params = vehicleId ? `?vehicle_id=${vehicleId}` : "";
  return api.get(`/maintenance/${params}`).then((r) => r.data);
};
const getUpcoming = () => api.get("/maintenance/upcoming?days=14").then((r) => r.data);
const scheduleMaintenance = (data) => api.post("/maintenance/", data).then((r) => r.data);
const updateMaintenance = (id, data) => api.put(`/maintenance/${id}`, data).then((r) => r.data);
const getVehicles = () => api.get("/vehicles/").then((r) => r.data);
const runAlertCheck = () => api.post("/maintenance/check-alerts?days=7").then((r) => r.data);
const getWorkerStatus = () => api.get("/maintenance/worker-status").then((r) => r.data);

const TYPES = [
  "Oil Change",
  "Tire Replacement",
  "Engine Service",
  "Brake Service",
  "General Inspection",
];

const STATUSES = ["Scheduled", "In Progress", "Completed"];

// ============================================================
// Helpers
// ============================================================
function statusStyle(status) {
  const map = {
    Scheduled: { bg: "rgba(99,102,241,0.15)", color: "#818cf8", border: "rgba(99,102,241,0.3)" },
    "In Progress": { bg: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "rgba(245,158,11,0.3)" },
    Completed: { bg: "rgba(16,185,129,0.15)", color: "#34d399", border: "rgba(16,185,129,0.3)" },
  };
  return map[status] || { bg: "rgba(107,114,128,0.15)", color: "#9ca3af", border: "rgba(107,114,128,0.3)" };
}

function getOverdueDays(record) {
  if (!record.next_service_date || record.status === "Completed") return 0;
  const next = new Date(record.next_service_date);
  const now = new Date();
  const diffTime = now.setHours(0,0,0,0) - next.setHours(0,0,0,0);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getUpcomingDays(record) {
  if (!record.next_service_date || record.status === "Completed") return null;
  const next = new Date(record.next_service_date);
  const now = new Date();
  const diffTime = next.setHours(0,0,0,0) - now.setHours(0,0,0,0);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function isOverdue(record) {
  return getOverdueDays(record) > 0;
}

function isUpcomingRecord(record) {
  const days = getUpcomingDays(record);
  return days !== null && days >= 0 && days <= 14;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const emptyForm = {
  vehicle_id: "",
  maintenance_type: "Oil Change",
  service_date: new Date().toISOString().split("T")[0],
  next_service_date: "",
  cost: "",
  remarks: "",
  status: "Scheduled",
  is_resolved: false,
};

export default function Maintenance() {
  const [records, setRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterVehicle, setFilterVehicle] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [checkingAlerts, setCheckingAlerts] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState(null);
  const [workerInfo, setWorkerInfo] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    try {
      const [recs, vs] = await Promise.all([
        getMaintenance(filterVehicle || null),
        getVehicles(),
      ]);
      setRecords(recs);
      setVehicles(vs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filterVehicle]);

  useEffect(() => {
    load();
    getWorkerStatus().then(setWorkerInfo).catch(() => {});
  }, [load]);

  // ---- Form handling ----
  const openAdd = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      vehicle_id: filterVehicle || (vehicles[0]?.vehicle_id || ""),
      service_date: new Date().toISOString().split("T")[0],
      is_resolved: false,
    });
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (rec) => {
    setEditing(rec);
    setForm({
      vehicle_id: rec.vehicle_id || "",
      maintenance_type: rec.maintenance_type || "Oil Change",
      service_date: rec.service_date || "",
      next_service_date: rec.next_service_date || "",
      cost: rec.cost ?? "",
      remarks: rec.remarks || "",
      status: rec.status || "Scheduled",
      is_resolved: rec.is_resolved ?? false,
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.vehicle_id || !form.service_date) {
      setFormError("Vehicle and service date are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        vehicle_id: form.vehicle_id,
        maintenance_type: form.maintenance_type,
        service_date: form.service_date,
        next_service_date: form.next_service_date || null,
        cost: form.cost ? parseFloat(form.cost) : null,
        remarks: form.remarks || null,
        status: form.status,
        is_resolved: form.is_resolved,
      };
      if (editing) {
        await updateMaintenance(editing.maintenance_id, payload);
        showToast("Maintenance record updated!");
      } else {
        await scheduleMaintenance(payload);
        showToast("Maintenance record scheduled!");
      }
      setShowModal(false);
      await load();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d) => `${d.loc.join(".")}: ${d.msg}`).join(", ")
        : detail || "Failed to save.";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  // ---- Quick Status Transitions ----
  const setRecordStatus = async (rec, newStatus) => {
    try {
      await updateMaintenance(rec.maintenance_id, { status: newStatus });
      const statusMsg =
        newStatus === "In Progress"
          ? "Service Started — Vehicle set to 'Maintenance'."
          : newStatus === "Completed"
          ? "Service Completed — Vehicle set to 'Available'."
          : `Status updated to ${newStatus}.`;
      showToast(statusMsg, "success");
      await load();
    } catch (err) {
      showToast("Failed to update maintenance status.", "error");
    }
  };

  const handleToggleResolve = async (rec) => {
    try {
      await updateMaintenance(rec.maintenance_id, { is_resolved: !rec.is_resolved });
      showToast(!rec.is_resolved ? "Alert resolved!" : "Alert unresolved.", "success");
      await load();
    } catch (err) {
      showToast("Failed to update resolution status.", "error");
    }
  };

  // ---- Trigger Celery / Background Alert Check ----
  const handleRunAlertCheck = async () => {
    setCheckingAlerts(true);
    try {
      const res = await runAlertCheck();
      const count = res.alerts_created ?? 0;
      showToast(
        `Background check completed! ${count} new notification(s) created. ${res.celery_task_id ? "(Celery Job: " + res.celery_task_id.substring(0,8) + "...)" : ""}`,
        "success"
      );
      getWorkerStatus().then(setWorkerInfo).catch(() => {});
    } catch (err) {
      showToast("Failed to trigger background alert check.", "error");
    } finally {
      setCheckingAlerts(false);
    }
  };

  const getVehicleObj = (id) => vehicles.find((x) => x.vehicle_id === id);

  const getVehicleLabel = (id) => {
    const v = getVehicleObj(id);
    return v ? `${v.registration_number} (${v.brand || v.vehicle_type})` : id?.substring(0, 8) + "...";
  };

  // ---- Derived counts ----
  const overdue = records.filter(isOverdue).length;
  const upcoming = records.filter(isUpcomingRecord).length;
  const inProgress = records.filter((r) => r.status === "In Progress").length;
  const completed = records.filter((r) => r.status === "Completed").length;
  const totalCost = records.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0);

  const filtered = records.filter((r) => {
    if (filterStatus === "All") return true;
    if (filterStatus === "Overdue") return isOverdue(r);
    if (filterStatus === "Upcoming") return isUpcomingRecord(r);
    return r.status === filterStatus;
  });

  return (
    <Layout>
      <div style={{ padding: "24px 32px", minHeight: "100vh" }}>
        {/* Toast */}
        {toast && (
          <div
            style={{
              position: "fixed",
              top: 24,
              right: 24,
              zIndex: 9999,
              background: toast.type === "error" ? "#ef4444" : "#10b981",
              color: "#fff",
              padding: "12px 22px",
              borderRadius: 10,
              fontWeight: 600,
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>{toast.type === "error" ? "🚨" : "✅"}</span>
            <span>{toast.msg}</span>
          </div>
        )}

        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 28,
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 800, color: "#f1f5f9" }}>
                🔧 Vehicle Maintenance & Fleet Health
              </h1>
              {workerInfo && (
                <span
                  style={{
                    fontSize: "0.72rem",
                    padding: "3px 8px",
                    borderRadius: 99,
                    background: workerInfo.redis_connected ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                    color: workerInfo.redis_connected ? "#34d399" : "#fbbf24",
                    border: `1px solid ${workerInfo.redis_connected ? "#10b98144" : "#f59e0b44"}`,
                    fontWeight: 600,
                  }}
                  title={`Celery Broker: ${workerInfo.broker_url}`}
                >
                  ⚡ Celery: {workerInfo.redis_connected ? "Redis Connected" : "Local Engine"}
                </span>
              )}
            </div>
            <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.5)", fontSize: "0.9rem" }}>
              Schedule maintenance, monitor approaching/overdue services, and trigger automated Celery alerts
            </p>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={handleRunAlertCheck}
              disabled={checkingAlerts}
              style={{
                background: "rgba(99,102,241,0.15)",
                color: "#818cf8",
                border: "1px solid rgba(99,102,241,0.3)",
                borderRadius: 10,
                padding: "11px 18px",
                fontWeight: 700,
                fontSize: "0.88rem",
                cursor: checkingAlerts ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.2s",
              }}
              title="Run Celery background task to detect upcoming & overdue maintenance and dispatch alerts"
            >
              <span>{checkingAlerts ? "⏳ Checking..." : "⚡ Run Celery Alert Check"}</span>
            </button>

            <button
              onClick={openAdd}
              style={{
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "11px 22px",
                fontWeight: 700,
                fontSize: "0.88rem",
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(245,158,11,0.4)",
              }}
            >
              + Schedule Maintenance
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          {[
            { label: "Total Tracked Services", value: records.length, color: "#6366f1", icon: "📋" },
            { label: "In Service (Maintenance)", value: inProgress, color: "#f59e0b", icon: "🛠️" },
            { label: "Overdue Services", value: overdue, color: "#ef4444", icon: "⚠️" },
            { label: "Upcoming (14 Days)", value: upcoming, color: "#38bdf8", icon: "🔔" },
            { label: "Completed Services", value: completed, color: "#10b981", icon: "✅" },
            { label: "Total Cost Incurred", value: `₹${totalCost.toLocaleString("en-IN")}`, color: "#ec4899", icon: "💰" },
          ].map((card) => (
            <div
              key={card.label}
              style={{
                background: "rgba(30,41,59,0.8)",
                border: `1px solid ${card.color}33`,
                borderRadius: 14,
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", marginBottom: 4 }}>{card.label}</div>
                <div style={{ color: card.color, fontSize: "1.6rem", fontWeight: 800 }}>{card.value}</div>
              </div>
              <span style={{ fontSize: "1.8rem", opacity: 0.8 }}>{card.icon}</span>
            </div>
          ))}
        </div>

        {/* Alert Banners */}
        {overdue > 0 && (
          <div
            style={{
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.35)",
              borderRadius: 12,
              padding: "12px 18px",
              marginBottom: 14,
              color: "#f87171",
              fontWeight: 600,
              fontSize: "0.88rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              ⚠️ <strong>{overdue} vehicle service{overdue > 1 ? "s are" : " is"} OVERDUE</strong>. Immediate attention required to ensure fleet safety.
            </div>
            <button
              onClick={() => setFilterStatus("Overdue")}
              style={{
                background: "#ef4444",
                color: "#fff",
                border: "none",
                padding: "4px 12px",
                borderRadius: 6,
                fontWeight: 700,
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              View Overdue
            </button>
          </div>
        )}

        {upcoming > 0 && (
          <div
            style={{
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: 12,
              padding: "12px 18px",
              marginBottom: 20,
              color: "#fbbf24",
              fontWeight: 600,
              fontSize: "0.88rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              🔔 <strong>{upcoming} maintenance service{upcoming > 1 ? "s" : ""} approaching</strong> within the next 14 days.
            </div>
            <button
              onClick={() => setFilterStatus("Upcoming")}
              style={{
                background: "#f59e0b",
                color: "#fff",
                border: "none",
                padding: "4px 12px",
                borderRadius: 6,
                fontWeight: 700,
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              View Upcoming
            </button>
          </div>
        )}

        {/* Filters and History Selector */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          {["All", "Overdue", "Upcoming", "Scheduled", "In Progress", "Completed"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                background: filterStatus === s ? "#f59e0b" : "rgba(30,41,59,0.8)",
                color: filterStatus === s ? "#fff" : "rgba(255,255,255,0.7)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "8px 16px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.82rem",
                transition: "all 0.15s",
              }}
            >
              {s}
            </button>
          ))}

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", fontWeight: 600 }}>Vehicle History:</span>
            <select
              value={filterVehicle}
              onChange={(e) => setFilterVehicle(e.target.value)}
              style={{
                background: "rgba(30,41,59,0.8)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                color: "#f1f5f9",
                padding: "8px 14px",
                fontSize: "0.84rem",
                outline: "none",
              }}
            >
              <option value="">All Vehicles ({vehicles.length})</option>
              {vehicles.map((v) => (
                <option key={v.vehicle_id} value={v.vehicle_id}>
                  {v.registration_number} — {v.vehicle_type} ({v.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: 60 }}>Loading maintenance data...</div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "rgba(255,255,255,0.4)",
              padding: 60,
              background: "rgba(30,41,59,0.4)",
              borderRadius: 16,
              border: "1px dashed rgba(255,255,255,0.12)",
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🔧</div>
            <div style={{ fontWeight: 600, fontSize: "1rem" }}>No maintenance records match the selected criteria.</div>
            <div style={{ fontSize: "0.82rem", marginTop: 4 }}>Schedule a service or select another filter.</div>
          </div>
        ) : (
          <div
            style={{
              background: "rgba(30,41,59,0.85)",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.07)",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(15,23,42,0.4)" }}>
                  {["Vehicle & Status", "Maintenance Type", "Service Date", "Next Service / Health", "Cost", "Service Status", "Actions"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "14px 16px",
                        color: "rgba(255,255,255,0.5)",
                        fontWeight: 700,
                        fontSize: "0.76rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((rec) => {
                  const over = isOverdue(rec);
                  const overDays = getOverdueDays(rec);
                  const upDays = getUpcomingDays(rec);
                  const up = isUpcomingRecord(rec);
                  const ss = statusStyle(rec.status);
                  const vehicleObj = getVehicleObj(rec.vehicle_id);

                  return (
                    <tr
                      key={rec.maintenance_id}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        background: over ? "rgba(239,68,68,0.05)" : up ? "rgba(245,158,11,0.04)" : "transparent",
                        transition: "background 0.2s",
                      }}
                    >
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 700, color: "#f1f5f9", fontFamily: "monospace" }}>
                          {vehicleObj?.registration_number || getVehicleLabel(rec.vehicle_id)}
                        </div>
                        {vehicleObj && (
                          <div style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                            {vehicleObj.vehicle_type} • Status: <span style={{ color: vehicleObj.status === "Maintenance" ? "#fbbf24" : "#34d399", fontWeight: 600 }}>{vehicleObj.status}</span>
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{rec.maintenance_type || "—"}</span>
                        {rec.remarks && (
                          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                            {rec.remarks}
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>{fmtDate(rec.service_date)}</td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <span>{fmtDate(rec.next_service_date)}</span>
                          {over && (
                            <span
                              style={{
                                background: "rgba(239,68,68,0.2)",
                                color: "#f87171",
                                border: "1px solid rgba(239,68,68,0.35)",
                                borderRadius: 4,
                                padding: "1px 6px",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                width: "fit-content",
                              }}
                            >
                              ⚠️ {overDays}d Overdue
                            </span>
                          )}
                          {up && !over && (
                            <span
                              style={{
                                background: "rgba(245,158,11,0.2)",
                                color: "#fbbf24",
                                border: "1px solid rgba(245,158,11,0.35)",
                                borderRadius: 4,
                                padding: "1px 6px",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                width: "fit-content",
                              }}
                            >
                              🔔 Due in {upDays}d
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        {rec.cost ? (
                          <span style={{ fontWeight: 600, color: "#f1f5f9" }}>
                            ₹{parseFloat(rec.cost).toLocaleString("en-IN")}
                          </span>
                        ) : (
                          <span style={{ color: "rgba(255,255,255,0.3)" }}>—</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            background: ss.bg,
                            color: ss.color,
                            border: `1px solid ${ss.border}`,
                            borderRadius: 8,
                            padding: "4px 10px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            display: "inline-block",
                          }}
                        >
                          {rec.status}
                        </span>
                        <div style={{ marginTop: 4 }}>
                          <span
                            style={{
                              background: rec.is_resolved ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                              color: rec.is_resolved ? "#34d399" : "#f87171",
                              border: `1px solid ${rec.is_resolved ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                              borderRadius: 8,
                              padding: "2px 8px",
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              display: "inline-block",
                            }}
                          >
                            {rec.is_resolved ? "Resolved" : "Unresolved"}
                          </span>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {rec.status === "Scheduled" && (
                            <button
                              onClick={() => setRecordStatus(rec, "In Progress")}
                              style={actionBtn("#f59e0b")}
                              title="Start service and set vehicle to Maintenance status"
                            >
                              Start Service
                            </button>
                          )}
                          {rec.status === "In Progress" && (
                            <button
                              onClick={() => setRecordStatus(rec, "Completed")}
                              style={actionBtn("#10b981")}
                              title="Complete service and return vehicle to Available status"
                            >
                              Complete
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleResolve(rec)}
                            style={actionBtn(rec.is_resolved ? "#ef4444" : "#10b981")}
                            title={rec.is_resolved ? "Mark as unresolved" : "Mark as resolved"}
                          >
                            {rec.is_resolved ? "Unresolve" : "Resolve"}
                          </button>
                          <button
                            onClick={() => openEdit(rec)}
                            style={actionBtn("#6366f1")}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Schedule / Edit Modal */}
        {showModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.75)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              backdropFilter: "blur(6px)",
              padding: 24,
            }}
          >
            <div
              style={{
                background: "#1e293b",
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.12)",
                padding: "30px",
                width: "100%",
                maxWidth: 520,
                boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
                maxHeight: "90vh",
                overflowY: "auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ margin: 0, color: "#f1f5f9", fontWeight: 800, fontSize: "1.3rem" }}>
                  {editing ? "✏️ Edit Maintenance Record" : "🔧 Schedule Vehicle Maintenance"}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "rgba(255,255,255,0.5)",
                    fontSize: "1.4rem",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSave}>
                {formError && (
                  <div
                    style={{
                      background: "rgba(239,68,68,0.15)",
                      color: "#ef4444",
                      border: "1px solid rgba(239,68,68,0.3)",
                      borderRadius: 8,
                      padding: "10px 14px",
                      marginBottom: 16,
                      fontSize: "0.85rem",
                    }}
                  >
                    {formError}
                  </div>
                )}

                <label style={labelStyle}>Target Vehicle *</label>
                <select
                  value={form.vehicle_id}
                  onChange={(e) => setForm((p) => ({ ...p, vehicle_id: e.target.value }))}
                  style={inputStyle}
                  required
                >
                  <option value="">Select vehicle...</option>
                  {vehicles.map((v) => (
                    <option key={v.vehicle_id} value={v.vehicle_id}>
                      {v.registration_number} — {v.vehicle_type} ({v.status})
                    </option>
                  ))}
                </select>

                <label style={labelStyle}>Maintenance Type *</label>
                <select
                  value={form.maintenance_type}
                  onChange={(e) => setForm((p) => ({ ...p, maintenance_type: e.target.value }))}
                  style={inputStyle}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Service Date *</label>
                    <input
                      type="date"
                      value={form.service_date}
                      onChange={(e) => setForm((p) => ({ ...p, service_date: e.target.value }))}
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Next Service Date</label>
                    <input
                      type="date"
                      value={form.next_service_date}
                      onChange={(e) => setForm((p) => ({ ...p, next_service_date: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Estimated / Incurred Cost (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.cost}
                      onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value }))}
                      placeholder="0.00"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Maintenance Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                      style={inputStyle}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    id="is_resolved"
                    checked={form.is_resolved}
                    onChange={(e) => setForm((p) => ({ ...p, is_resolved: e.target.checked }))}
                    style={{ width: 18, height: 18, cursor: "pointer" }}
                  />
                  <label htmlFor="is_resolved" style={{ color: "#f1f5f9", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}>
                    Mark Alert / Record as Resolved (Mutes repeating alerts)
                  </label>
                </div>

                <label style={labelStyle}>Remarks / Service Notes</label>
                <textarea
                  value={form.remarks}
                  onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                  rows={3}
                  placeholder="e.g., Replaced brake pads and topped up fluids..."
                  style={{ ...inputStyle, resize: "vertical" }}
                />

                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      flex: 1,
                      background: "linear-gradient(135deg, #f59e0b, #d97706)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 10,
                      padding: "12px",
                      fontWeight: 700,
                      cursor: saving ? "not-allowed" : "pointer",
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? "Saving..." : editing ? "Update Record" : "Schedule Service"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    style={{
                      flex: 1,
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.7)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 10,
                      padding: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

const tdStyle = {
  padding: "14px 16px",
  color: "rgba(255,255,255,0.75)",
  fontSize: "0.85rem",
  verticalAlign: "middle",
};

const labelStyle = {
  display: "block",
  color: "rgba(255,255,255,0.6)",
  fontSize: "0.8rem",
  fontWeight: 600,
  marginBottom: 6,
  marginTop: 14,
};

const inputStyle = {
  width: "100%",
  background: "rgba(15,23,42,0.6)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  color: "#f1f5f9",
  padding: "10px 12px",
  fontSize: "0.88rem",
  boxSizing: "border-box",
};

const actionBtn = (color) => ({
  background: `${color}22`,
  color,
  border: `1px solid ${color}44`,
  borderRadius: 6,
  padding: "5px 12px",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: "0.75rem",
});
