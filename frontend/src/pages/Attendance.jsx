import { useState, useEffect, useCallback } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const STATUS_CONFIG = {
  Present: {
    label: "Present",
    color: "#059669",
    bg: "#ecfdf5",
    border: "#a7f3d0",
    icon: CheckCircle2,
  },
  Absent: {
    label: "Absent",
    color: "#e11d48",
    bg: "#fff1f2",
    border: "#fecdd3",
    icon: XCircle,
  },
  Leave: {
    label: "On Leave",
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    icon: Clock,
  },
};

export default function Attendance() {
  const { user } = useAuth();
  const role = user?.role || "Admin";
  const isDriver = role === "Driver";
  const isManager = role === "Admin" || role === "FleetManager" || role === "Dispatcher";

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [drivers, setDrivers] = useState([]);
  const [records, setRecords] = useState([]);
  const [myAttendance, setMyAttendance] = useState(null);
  const [todayStatus, setTodayStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [markingId, setMarkingId] = useState(null);

  const fetchTodayStatus = useCallback(async () => {
    if (isDriver) {
      try {
        const res = await api.get("/attendance/today");
        setTodayStatus(res.data);
      } catch (err) {}
    }
  }, [isDriver]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (isDriver) {
        const [myRes, todayRes] = await Promise.all([
          api.get("/attendance/my"),
          api.get("/attendance/today").catch(() => ({ data: null }))
        ]);
        setMyAttendance(myRes.data);
        if (todayRes.data) setTodayStatus(todayRes.data);
      } else {
        const [attRes, statsRes, drvRes] = await Promise.all([
          api.get(`/attendance/fleet?date=${selectedDate}`),
          api.get(`/attendance/stats?date=${selectedDate}`),
          api.get("/drivers").catch(() => ({ data: [] })),
        ]);
        setRecords(attRes.data || []);
        setStats(statsRes.data);
        setDrivers(drvRes.data || []);
      }
    } catch (err) {
      console.error("Failed to load attendance data:", err);
      toast.error("Failed to load attendance records.");
    } finally {
      setLoading(false);
    }
  }, [isDriver, selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      const res = await api.post("/attendance/check-in");
      toast.success(res.data.message || "Checked in successfully!");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Check-in failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    try {
      const res = await api.post("/attendance/check-out");
      toast.success(res.data.message || "Checked out successfully!");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Check-out failed.");
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Mark Attendance
  const handleMark = async (driverId, newStatus) => {
    if (!isManager) {
      toast.error("Only Admins and Fleet Managers can mark attendance.");
      return;
    }
    setMarkingId(driverId);
    try {
      await api.post("/attendance/mark", {
        driver_id: driverId,
        date: selectedDate,
        status: newStatus,
      });
      toast.success(`Marked as ${newStatus}`);
      fetchData();
    } catch (err) {
      console.error("Failed to mark attendance:", err);
      toast.error("Failed to update attendance.");
    } finally {
      setMarkingId(null);
    }
  };

  // Date Navigation
  const changeDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  // Map drivers to their attendance for the selected date
  const driverIdsInDrivers = new Set(drivers.map((d) => d.driver_id));
  const extraFromRecords = records
    .filter((r) => r.driver_id && !driverIdsInDrivers.has(r.driver_id))
    .map((r) => ({
      driver_id: r.driver_id,
      full_name: r.driver_name || "Driver",
      license_number: r.license_number || "N/A",
      status: r.status,
    }));

  const allDriversList = [...drivers, ...extraFromRecords];

  const combinedDriverList = allDriversList.map((drv) => {
    const rec = records.find((r) => r.driver_id === drv.driver_id);
    return {
      ...drv,
      attendanceStatus: rec ? rec.status : "Unmarked",
      attendanceId: rec ? rec.attendance_id : null,
    };
  });

  const filteredDrivers = combinedDriverList.filter((d) => {
    const matchesSearch =
      d.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.license_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      statusFilter === "All" || d.attendanceStatus === statusFilter;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <AppLayout
        title={isDriver ? "My Attendance" : "Driver Attendance"}
        subtitle="Loading attendance data..."
      >
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "350px", flexDirection: "column", gap: "1rem" }}>
          <div className="ff-pulse-dot" style={{ width: "36px", height: "36px", background: "#6366f1" }} />
          <p style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: 500 }}>Loading attendance records...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={isDriver ? "My Attendance" : "Driver Attendance"}
      subtitle={
        isDriver
          ? "View your shifts, attendance history, and monthly punctuality metrics"
          : "Monitor driver availability, daily check-ins, and leave status"
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* DRIVER SELF-SERVICE VIEW */}
        {isDriver && (
          <>
            {/* Today's Check-In / Check-Out Action Panel */}
            <div
              style={{
                background: "white",
                border: "1.5px solid #cbd5e1",
                borderRadius: "1.25rem",
                padding: "1.5rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "#64748b",
                  }}
                >
                  TODAY'S SHIFT ATTENDANCE
                </span>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", marginTop: "0.25rem" }}>
                  Current Status:{" "}
                  <span
                    style={{
                      color:
                        todayStatus?.checked_in
                          ? "#059669"
                          : todayStatus?.checked_out
                          ? "#64748b"
                          : "#d97706",
                    }}
                  >
                    {todayStatus?.status || "Not Checked In"}
                  </span>
                </h3>
                {todayStatus?.check_in_time && (
                  <p style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.25rem" }}>
                    Checked In at: {new Date(todayStatus.check_in_time).toLocaleTimeString()}
                    {todayStatus.check_out_time && ` | Checked Out at: ${new Date(todayStatus.check_out_time).toLocaleTimeString()}`}
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: "1rem" }}>
                {!todayStatus?.checked_in ? (
                  <button
                    onClick={handleCheckIn}
                    disabled={actionLoading}
                    style={{
                      padding: "0.75rem 1.5rem",
                      borderRadius: "0.75rem",
                      background: "#10b981",
                      color: "white",
                      fontWeight: 700,
                      border: "none",
                      cursor: actionLoading ? "not-allowed" : "pointer",
                      boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <CheckCircle2 size={18} />
                    {actionLoading ? "Processing..." : "Check In Now"}
                  </button>
                ) : (
                  <button
                    onClick={handleCheckOut}
                    disabled={actionLoading || todayStatus?.checked_out}
                    style={{
                      padding: "0.75rem 1.5rem",
                      borderRadius: "0.75rem",
                      background: todayStatus?.checked_out ? "#94a3b8" : "#ef4444",
                      color: "white",
                      fontWeight: 700,
                      border: "none",
                      cursor: actionLoading || todayStatus?.checked_out ? "not-allowed" : "pointer",
                      boxShadow: "0 4px 12px rgba(239,68,68,0.3)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <XCircle size={18} />
                    {actionLoading ? "Processing..." : todayStatus?.checked_out ? "Shift Completed" : "Check Out"}
                  </button>
                )}
              </div>
            </div>

            {/* Driver Summary Card */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1rem",
              }}
            >
              {[
                {
                  label: "Days Present",
                  val: myAttendance?.summary?.present ?? 0,
                  color: "#059669",
                  bg: "#ecfdf5",
                  border: "#a7f3d0",
                  icon: CheckCircle2,
                },
                {
                  label: "Days Absent",
                  val: myAttendance?.summary?.absent ?? 0,
                  color: "#e11d48",
                  bg: "#fff1f2",
                  border: "#fecdd3",
                  icon: XCircle,
                },
                {
                  label: "Approved Leave",
                  val: myAttendance?.summary?.leave ?? 0,
                  color: "#d97706",
                  bg: "#fffbeb",
                  border: "#fde68a",
                  icon: Clock,
                },
                {
                  label: "Attendance Rate",
                  val: `${myAttendance?.summary?.rate_pct ?? 100}%`,
                  color: "#6366f1",
                  bg: "#f5f3ff",
                  border: "#ddd6fe",
                  icon: CalendarCheck,
                },
              ].map(({ label, val, color, bg, border, icon: Icon }) => (
                <div
                  key={label}
                  style={{
                    background: "white",
                    border: `1.5px solid ${border}`,
                    borderRadius: "1.25rem",
                    padding: "1.25rem",
                    boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                >
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "0.75rem",
                      background: bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={22} color={color} />
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: "0.8125rem",
                        color: "#64748b",
                        fontWeight: 600,
                      }}
                    >
                      {label}
                    </p>
                    <p
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      {val}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Attendance History Table */}
            <div
              style={{
                background: "white",
                border: "1.5px solid rgba(15,23,42,0.08)",
                borderRadius: "1.25rem",
                padding: "1.5rem",
                boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
              }}
            >
              <h3
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#0f172a",
                  marginBottom: "1rem",
                }}
              >
                Recent Attendance History
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.875rem",
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "1.5px solid #f1f5f9" }}>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "0.75rem",
                          color: "#94a3b8",
                        }}
                      >
                        Date
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "0.75rem",
                          color: "#94a3b8",
                        }}
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(myAttendance?.records || []).map((rec) => {
                      const cfg =
                        STATUS_CONFIG[rec.status] || STATUS_CONFIG.Present;
                      const Icon = cfg.icon;
                      return (
                        <tr
                          key={rec.attendance_id}
                          style={{ borderBottom: "1px solid #f8fafc" }}
                        >
                          <td
                            style={{
                              padding: "0.75rem",
                              fontWeight: 600,
                              color: "#1e293b",
                            }}
                          >
                            {rec.date}
                          </td>
                          <td style={{ padding: "0.75rem" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.375rem",
                                padding: "0.25rem 0.625rem",
                                borderRadius: "9999px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                background: cfg.bg,
                                color: cfg.color,
                                border: `1px solid ${cfg.border}`,
                              }}
                            >
                              <Icon size={12} />
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ADMIN / FLEET MANAGER / DISPATCHER VIEW */}
        {!isDriver && (
          <>
            {/* Header: Date navigation & Stats */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                background: "white",
                padding: "1rem 1.25rem",
                borderRadius: "1.25rem",
                border: "1.5px solid rgba(15,23,42,0.08)",
                boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
              >
                <button
                  onClick={() => changeDate(-1)}
                  style={{
                    padding: "0.5rem",
                    borderRadius: "0.625rem",
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    cursor: "pointer",
                  }}
                >
                  <ChevronLeft size={16} color="#475569" />
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.625rem",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                />
                <button
                  onClick={() => changeDate(1)}
                  style={{
                    padding: "0.5rem",
                    borderRadius: "0.625rem",
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    cursor: "pointer",
                  }}
                >
                  <ChevronRight size={16} color="#475569" />
                </button>
                {!isToday && (
                  <button
                    onClick={() =>
                      setSelectedDate(new Date().toISOString().split("T")[0])
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.625rem",
                      background: "#eff6ff",
                      color: "#2563eb",
                      border: "1px solid #bfdbfe",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <RotateCcw size={13} />
                    Today
                  </button>
                )}
              </div>

              {/* Stats overview */}
              <div
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    background: "#ecfdf5",
                    color: "#059669",
                    padding: "0.35rem 0.75rem",
                    borderRadius: "9999px",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    border: "1px solid #a7f3d0",
                  }}
                >
                  Present: {stats?.present ?? 0}
                </span>
                <span
                  style={{
                    background: "#fff1f2",
                    color: "#e11d48",
                    padding: "0.35rem 0.75rem",
                    borderRadius: "9999px",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    border: "1px solid #fecdd3",
                  }}
                >
                  Absent: {stats?.absent ?? 0}
                </span>
                <span
                  style={{
                    background: "#fffbeb",
                    color: "#d97706",
                    padding: "0.35rem 0.75rem",
                    borderRadius: "9999px",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    border: "1px solid #fde68a",
                  }}
                >
                  Leave: {stats?.leave ?? 0}
                </span>
                <span
                  style={{
                    background: "#f5f3ff",
                    color: "#6366f1",
                    padding: "0.35rem 0.75rem",
                    borderRadius: "9999px",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    border: "1px solid #ddd6fe",
                  }}
                >
                  Attendance: {stats?.attendance_rate_pct ?? 100}%
                </span>
              </div>
            </div>

            {/* Filters & Search */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  background: "white",
                  padding: "0.5rem 0.875rem",
                  borderRadius: "0.75rem",
                  border: "1.5px solid rgba(15,23,42,0.1)",
                  width: "100%",
                  maxWidth: "320px",
                }}
              >
                <Search size={16} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Search driver by name or license..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    border: "none",
                    outline: "none",
                    fontSize: "0.875rem",
                    width: "100%",
                  }}
                />
              </div>

              <div
                style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
              >
                {["All", "Present", "Absent", "Leave"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    style={{
                      padding: "0.45rem 0.875rem",
                      borderRadius: "0.625rem",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      ...(statusFilter === status
                        ? {
                            background: "#0f172a",
                            color: "white",
                            border: "1px solid #0f172a",
                          }
                        : {
                            background: "white",
                            color: "#64748b",
                            border: "1.5px solid rgba(15,23,42,0.08)",
                          }),
                    }}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Drivers Attendance Table */}
            <div
              style={{
                background: "white",
                border: "1.5px solid rgba(15,23,42,0.08)",
                borderRadius: "1.25rem",
                padding: "1.5rem",
                boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
              }}
            >
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.875rem",
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "1.5px solid #f1f5f9" }}>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "0.75rem",
                          color: "#94a3b8",
                          fontWeight: 600,
                          fontSize: "0.75rem",
                          textTransform: "uppercase",
                        }}
                      >
                        Driver Name
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "0.75rem",
                          color: "#94a3b8",
                          fontWeight: 600,
                          fontSize: "0.75rem",
                          textTransform: "uppercase",
                        }}
                      >
                        License
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "0.75rem",
                          color: "#94a3b8",
                          fontWeight: 600,
                          fontSize: "0.75rem",
                          textTransform: "uppercase",
                        }}
                      >
                        Status on {selectedDate}
                      </th>
                      {isManager && (
                        <th
                          style={{
                            textAlign: "right",
                            padding: "0.75rem",
                            color: "#94a3b8",
                            fontWeight: 600,
                            fontSize: "0.75rem",
                            textTransform: "uppercase",
                          }}
                        >
                          Mark Action
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDrivers.length > 0 ? (
                      filteredDrivers.map((driver) => {
                        const cfg = STATUS_CONFIG[driver.attendanceStatus];
                        const Icon = cfg?.icon || AlertCircle;
                        const isBusy = markingId === driver.driver_id;
                        return (
                          <tr
                            key={driver.driver_id}
                            style={{
                              borderBottom: "1px solid #f8fafc",
                              transition: "background 0.15s",
                            }}
                          >
                            <td style={{ padding: "0.75rem" }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.625rem",
                                }}
                              >
                                <div
                                  style={{
                                    width: "32px",
                                    height: "32px",
                                    borderRadius: "0.5rem",
                                    background: "#f1f5f9",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#475569",
                                  }}
                                >
                                  <UserCheck size={16} />
                                </div>
                                <div>
                                  <p
                                    style={{
                                      fontWeight: 600,
                                      color: "#0f172a",
                                      margin: 0,
                                    }}
                                  >
                                    {driver.full_name}
                                  </p>
                                  <p
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "#94a3b8",
                                      margin: 0,
                                    }}
                                  >
                                    {driver.experience_years} yrs exp
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td
                              style={{
                                padding: "0.75rem",
                                fontFamily: "monospace",
                                color: "#475569",
                              }}
                            >
                              {driver.license_number}
                            </td>
                            <td style={{ padding: "0.75rem" }}>
                              {cfg ? (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.375rem",
                                    padding: "0.25rem 0.625rem",
                                    borderRadius: "9999px",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    background: cfg.bg,
                                    color: cfg.color,
                                    border: `1px solid ${cfg.border}`,
                                  }}
                                >
                                  <Icon size={12} />
                                  {cfg.label}
                                </span>
                              ) : (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.375rem",
                                    padding: "0.25rem 0.625rem",
                                    borderRadius: "9999px",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    background: "#f8fafc",
                                    color: "#94a3b8",
                                    border: "1px solid #e2e8f0",
                                  }}
                                >
                                  Not Marked
                                </span>
                              )}
                            </td>
                            {isManager && (
                              <td
                                style={{
                                  padding: "0.75rem",
                                  textAlign: "right",
                                }}
                              >
                                <div
                                  style={{
                                    display: "inline-flex",
                                    gap: "0.375rem",
                                  }}
                                >
                                  <button
                                    disabled={isBusy}
                                    onClick={() =>
                                      handleMark(driver.driver_id, "Present")
                                    }
                                    style={{
                                      padding: "0.35rem 0.625rem",
                                      borderRadius: "0.5rem",
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      cursor: isBusy
                                        ? "not-allowed"
                                        : "pointer",
                                      background:
                                        driver.attendanceStatus === "Present"
                                          ? "#059669"
                                          : "#f0fdf4",
                                      color:
                                        driver.attendanceStatus === "Present"
                                          ? "white"
                                          : "#059669",
                                      border: "1px solid #bbf7d0",
                                    }}
                                  >
                                    Present
                                  </button>
                                  <button
                                    disabled={isBusy}
                                    onClick={() =>
                                      handleMark(driver.driver_id, "Absent")
                                    }
                                    style={{
                                      padding: "0.35rem 0.625rem",
                                      borderRadius: "0.5rem",
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      cursor: isBusy
                                        ? "not-allowed"
                                        : "pointer",
                                      background:
                                        driver.attendanceStatus === "Absent"
                                          ? "#e11d48"
                                          : "#fff1f2",
                                      color:
                                        driver.attendanceStatus === "Absent"
                                          ? "white"
                                          : "#e11d48",
                                      border: "1px solid #fecdd3",
                                    }}
                                  >
                                    Absent
                                  </button>
                                  <button
                                    disabled={isBusy}
                                    onClick={() =>
                                      handleMark(driver.driver_id, "Leave")
                                    }
                                    style={{
                                      padding: "0.35rem 0.625rem",
                                      borderRadius: "0.5rem",
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      cursor: isBusy
                                        ? "not-allowed"
                                        : "pointer",
                                      background:
                                        driver.attendanceStatus === "Leave"
                                          ? "#d97706"
                                          : "#fffbeb",
                                      color:
                                        driver.attendanceStatus === "Leave"
                                          ? "white"
                                          : "#d97706",
                                      border: "1px solid #fde68a",
                                    }}
                                  >
                                    Leave
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={isManager ? 4 : 3}
                          style={{
                            textAlign: "center",
                            padding: "2rem",
                            color: "#94a3b8",
                          }}
                        >
                          No driver attendance records found for this date.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
