import { useState, useEffect } from "react";
import {
  RefreshCw,
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import api from "../api/axios";
import AppLayout from "../layouts/AppLayout";

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [roleFilter, setRoleFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchAction, setSearchAction] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (roleFilter) params.role = roleFilter;
      if (moduleFilter) params.module = moduleFilter;
      if (statusFilter) params.status = statusFilter;
      if (searchAction) params.action = searchAction;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await api.get("/api/audit-logs", { params });
      setLogs(response.data.logs || []);
      setTotal(response.data.total || 0);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to fetch audit logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [roleFilter, moduleFilter, statusFilter, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  return (
    <AppLayout
      title="System Audit Logs"
      subtitle="Centralized Audit Trail, Security Event Monitoring & User Action Logs"
    >
      <div style={{ maxWidth: "1400px", margin: "0 auto", width: "100%" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#6366f1", fontWeight: 700, fontSize: "0.875rem" }}>
            <Shield size={18} />
            <span>AUDIT TRAIL ENGINE</span>
          </div>
          <button
            onClick={fetchLogs}
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
            Refresh Logs
          </button>
        </div>

        {error && (
          <div style={{ padding: "1rem", borderRadius: "0.75rem", background: "#fef2f2", color: "#b91c1c", marginBottom: "1.5rem" }}>
            <AlertCircle size={18} style={{ display: "inline", marginRight: "0.5rem" }} />
            {error}
          </div>
        )}

        {/* Filter Bar */}
        <div style={{ background: "white", padding: "1.25rem", borderRadius: "1rem", border: "1px solid #e2e8f0", marginBottom: "1.5rem" }}>
          <form onSubmit={handleSearchSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", alignItems: "end" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", marginBottom: "0.375rem" }}>
                Filter by Role
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "0.5rem", border: "1px solid #cbd5e1", fontSize: "0.875rem" }}
              >
                <option value="">All Roles</option>
                <option value="Admin">Admin</option>
                <option value="FleetManager">Fleet Manager</option>
                <option value="Dispatcher">Dispatcher</option>
                <option value="Driver">Driver</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", marginBottom: "0.375rem" }}>
                Filter by Module
              </label>
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "0.5rem", border: "1px solid #cbd5e1", fontSize: "0.875rem" }}
              >
                <option value="">All Modules</option>
                <option value="Authentication">Authentication</option>
                <option value="Attendance">Attendance</option>
                <option value="Dispatch">Dispatch</option>
                <option value="Trips">Trips</option>
                <option value="Shipments">Shipments</option>
                <option value="Vehicles">Vehicles</option>
                <option value="Drivers">Drivers</option>
                <option value="Fuel">Fuel</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", marginBottom: "0.375rem" }}>
                Filter by Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "0.5rem", border: "1px solid #cbd5e1", fontSize: "0.875rem" }}
              >
                <option value="">All Statuses</option>
                <option value="Success">Success</option>
                <option value="Failure">Failure</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", marginBottom: "0.375rem" }}>
                Search Action
              </label>
              <input
                type="text"
                placeholder="e.g. Login, Assign..."
                value={searchAction}
                onChange={(e) => setSearchAction(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "0.5rem", border: "1px solid #cbd5e1", fontSize: "0.875rem" }}
              />
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="submit"
                style={{ flex: 1, padding: "0.5rem 1rem", borderRadius: "0.5rem", background: "#6366f1", color: "white", fontWeight: 700, border: "none", cursor: "pointer", fontSize: "0.875rem" }}
              >
                Apply
              </button>
            </div>
          </form>
        </div>

        {/* Audit Log Table */}
        <div style={{ background: "white", borderRadius: "1rem", padding: "1.5rem", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b" }}>
              Showing {logs.length} of {total} Total Log Entries
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f1f5f9", color: "#64748b", fontWeight: 600 }}>
                  <th style={{ padding: "0.75rem" }}>Date & Time</th>
                  <th style={{ padding: "0.75rem" }}>User</th>
                  <th style={{ padding: "0.75rem" }}>Role</th>
                  <th style={{ padding: "0.75rem" }}>Module</th>
                  <th style={{ padding: "0.75rem" }}>Action</th>
                  <th style={{ padding: "0.75rem" }}>Description</th>
                  <th style={{ padding: "0.75rem" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.75rem", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>{log.time}</div>
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{log.date}</div>
                      </td>
                      <td style={{ padding: "0.75rem", fontWeight: 700, color: "#334155" }}>
                        {log.user}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        <span
                          style={{
                            padding: "0.2rem 0.5rem",
                            borderRadius: "0.375rem",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            background:
                              log.role === "Admin"
                                ? "#f5f3ff"
                                : log.role === "Dispatcher"
                                ? "#ecfdf5"
                                : log.role === "FleetManager"
                                ? "#eff6ff"
                                : "#fffbeb",
                            color:
                              log.role === "Admin"
                                ? "#6366f1"
                                : log.role === "Dispatcher"
                                ? "#059669"
                                : log.role === "FleetManager"
                                ? "#2563eb"
                                : "#d97706",
                          }}
                        >
                          {log.role}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem", fontWeight: 600, color: "#475569" }}>{log.module}</td>
                      <td style={{ padding: "0.75rem", fontWeight: 700, color: "#0f172a" }}>{log.action}</td>
                      <td style={{ padding: "0.75rem", color: "#334155", maxWidth: "320px" }}>{log.description}</td>
                      <td style={{ padding: "0.75rem" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "9999px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            background: log.status === "Success" ? "#dcfce7" : "#fee2e2",
                            color: log.status === "Success" ? "#166534" : "#991b1b",
                          }}
                        >
                          {log.status === "Success" ? <CheckCircle size={12} /> : <XCircle size={12} />}
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                      No audit log records match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
