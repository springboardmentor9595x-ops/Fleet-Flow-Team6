import React, { useEffect, useState, useCallback } from "react";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../api/axiosInstance";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  Present: { bg: "rgba(16,185,129,0.15)", border: "#10b981", text: "#10b981" },
  Absent: { bg: "rgba(239,68,68,0.15)", border: "#ef4444", text: "#ef4444" },
  Leave: { bg: "rgba(245,158,11,0.15)", border: "#f59e0b", text: "#f59e0b" },
  Late: { bg: "rgba(139,92,246,0.15)", border: "#8b5cf6", text: "#8b5cf6" },
};

const today = new Date().toISOString().split("T")[0];

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || { bg: "rgba(255,255,255,0.08)", border: "#64748b", text: "#94a3b8" };
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.text, borderRadius: 6, padding: "3px 10px",
      fontSize: "0.75rem", fontWeight: 700,
    }}>
      {status}
    </span>
  );
}

// ─── Admin/FleetManager: Mark Attendance ─────────────────────────────────────

function MarkAttendancePanel({ drivers }) {
  const [driverId, setDriverId] = useState("");
  const [dateVal, setDateVal] = useState(today);
  const [statusVal, setStatusVal] = useState("Present");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!driverId) return setMsg({ type: "err", text: "Select a driver first." });
    setSaving(true);
    setMsg(null);
    try {
      await api.post("/attendance/", {
        driver_id: driverId,
        attendance_date: dateVal,
        status: statusVal,
      });
      setMsg({ type: "ok", text: `Attendance marked as ${statusVal} ✅` });
    } catch (err) {
      setMsg({ type: "err", text: err?.response?.data?.detail || "Failed to save attendance." });
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#f1f5f9", borderRadius: 9, padding: "10px 14px",
    fontSize: "0.87rem", width: "100%", boxSizing: "border-box",
    outline: "none",
  };

  return (
    <div style={{
      background: "rgba(15,23,42,0.7)", borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.06)", padding: "24px",
    }}>
      <h3 style={{ margin: "0 0 18px", fontSize: "1rem", fontWeight: 700, color: "#f1f5f9", display: "flex", alignItems: "center", gap: 8 }}>
        ✏️ Mark Attendance
      </h3>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem", color: "rgba(255,255,255,0.5)", marginBottom: 6, fontWeight: 600 }}>
            Driver
          </label>
          <select value={driverId} onChange={e => setDriverId(e.target.value)} style={inputStyle} required>
            <option value="">— Select Driver —</option>
            {drivers.map(d => (
              <option key={d.driver_id} value={d.driver_id}>
                {d.user?.full_name || "Unknown"} — {d.license_number}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem", color: "rgba(255,255,255,0.5)", marginBottom: 6, fontWeight: 600 }}>
            Date
          </label>
          <input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)} style={inputStyle} required />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem", color: "rgba(255,255,255,0.5)", marginBottom: 6, fontWeight: 600 }}>
            Status
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["Present", "Absent", "Leave", "Late"].map(s => {
              const c = STATUS_COLORS[s];
              const selected = statusVal === s;
              return (
                <button
                  key={s} type="button" onClick={() => setStatusVal(s)}
                  style={{
                    background: selected ? c.bg : "rgba(255,255,255,0.04)",
                    border: `1px solid ${selected ? c.border : "rgba(255,255,255,0.1)"}`,
                    color: selected ? c.text : "rgba(255,255,255,0.5)",
                    borderRadius: 8, padding: "8px 16px", cursor: "pointer",
                    fontWeight: selected ? 700 : 500, fontSize: "0.83rem",
                    transition: "all 0.15s ease",
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
        {msg && (
          <div style={{
            padding: "10px 14px", borderRadius: 8, fontSize: "0.84rem",
            background: msg.type === "ok" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
            border: `1px solid ${msg.type === "ok" ? "#10b981" : "#ef4444"}`,
            color: msg.type === "ok" ? "#10b981" : "#ef4444",
          }}>
            {msg.text}
          </div>
        )}
        <button type="submit" disabled={saving} style={{
          background: "linear-gradient(135deg, #6366f1, #4f46e5)",
          color: "#fff", border: "none", borderRadius: 10,
          padding: "11px", fontWeight: 700, fontSize: "0.9rem",
          cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
        }}>
          {saving ? "Saving..." : "Save Attendance"}
        </button>
      </form>
    </div>
  );
}

// ─── Records Table ────────────────────────────────────────────────────────────

function AttendanceTable({ records, drivers }) {
  const getDriverName = (id) => {
    const d = drivers.find(x => x.driver_id === id);
    return d?.user?.full_name || id?.slice(0, 8) || "—";
  };

  if (records.length === 0) return (
    <div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.35)" }}>
      No attendance records found.
    </div>
  );

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
        <thead>
          <tr style={{ background: "rgba(99,102,241,0.12)" }}>
            {["Date", "Driver", "Status"].map(h => (
              <th key={h} style={{
                padding: "11px 16px", textAlign: "left", color: "rgba(255,255,255,0.5)",
                fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.07)", fontSize: "0.78rem", textTransform: "uppercase",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.attendance_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <td style={{ padding: "10px 16px", color: "#f1f5f9", fontWeight: 600 }}>{r.attendance_date}</td>
              <td style={{ padding: "10px 16px", color: "rgba(255,255,255,0.75)" }}>{getDriverName(r.driver_id)}</td>
              <td style={{ padding: "10px 16px" }}><StatusBadge status={r.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Attendance() {
  const { user } = useAuth();
  const role = user?.role;
  const isManager = role === "Admin" || role === "FleetManager";
  const isDispatcher = role === "Dispatcher";
  const isDriver = role === "Driver";

  const [records, setRecords] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterDate, setFilterDate] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const [filterDriver, setFilterDriver] = useState("");

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await api.get("/drivers/");
      setDrivers(res.data || []);
    } catch { setDrivers([]); }
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterDate) params.attendance_date = filterDate;
      if (filterEnd) params.end_date = filterEnd;
      if (filterDriver && !isDriver) params.driver_id = filterDriver;
      const res = await api.get("/attendance/", { params });
      setRecords(res.data || []);
    } catch { setRecords([]); }
    setLoading(false);
  }, [filterDate, filterEnd, filterDriver, isDriver]);

  useEffect(() => {
    if (isManager || isDispatcher) fetchDrivers();
    fetchRecords();
  }, [fetchRecords, fetchDrivers, isManager, isDispatcher]);

  // Summary for driver own view
  const presentCount = records.filter(r => r.status === "Present").length;
  const absentCount = records.filter(r => r.status === "Absent").length;
  const leaveCount = records.filter(r => r.status === "Leave").length;

  const inputStyle = {
    background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#f1f5f9", borderRadius: 9, padding: "9px 12px",
    fontSize: "0.84rem", outline: "none",
  };

  return (
    <Layout>
      <div style={{ padding: "28px 32px", minHeight: "100vh" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: "1.9rem", fontWeight: 800, letterSpacing: "-0.5px" }}>
            📅 Attendance
          </h1>
          <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.5)", fontSize: "0.88rem" }}>
            {isManager ? "Mark and manage driver attendance records" :
             isDispatcher ? "View driver attendance for scheduling" :
             "Your attendance history"}
          </p>
        </div>

        {/* Summary cards for Driver */}
        {isDriver && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
            {[
              { label: "Present", count: presentCount, color: "#10b981", icon: "✅" },
              { label: "Absent", count: absentCount, color: "#ef4444", icon: "❌" },
              { label: "Leave", count: leaveCount, color: "#f59e0b", icon: "🏖" },
            ].map(({ label, count, color, icon }) => (
              <div key={label} style={{
                background: "rgba(15,23,42,0.7)", borderRadius: 14,
                border: `1px solid ${color}33`, padding: "18px 22px",
              }}>
                <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>{icon} {label}</div>
                <div style={{ fontSize: "2rem", fontWeight: 800, color }}>{count}</div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", marginTop: 4 }}>days recorded</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: isManager ? "300px 1fr" : "1fr", gap: 24, alignItems: "start" }}>
          {/* Mark panel — Admin/FleetManager only */}
          {isManager && <MarkAttendancePanel drivers={drivers} />}

          {/* Records panel */}
          <div style={{
            background: "rgba(15,23,42,0.7)", borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.06)", padding: "24px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#f1f5f9" }}>
                {isDriver ? "My Attendance History" : "All Attendance Records"}
              </h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {!isDriver && drivers.length > 0 && (
                  <select value={filterDriver} onChange={e => setFilterDriver(e.target.value)} style={inputStyle}>
                    <option value="">All Drivers</option>
                    {drivers.map(d => (
                      <option key={d.driver_id} value={d.driver_id}>
                        {d.user?.full_name || d.license_number}
                      </option>
                    ))}
                  </select>
                )}
                <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ ...inputStyle, width: 140 }} placeholder="From date" title="From date" />
                <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} style={{ ...inputStyle, width: 140 }} placeholder="To date" title="To date" />
                <button onClick={fetchRecords} style={{
                  background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.4)",
                  color: "#818cf8", borderRadius: 8, padding: "9px 14px",
                  cursor: "pointer", fontWeight: 700, fontSize: "0.83rem",
                }}>
                  🔍 Filter
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
                Loading attendance data...
              </div>
            ) : (
              <AttendanceTable records={records} drivers={drivers} />
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
