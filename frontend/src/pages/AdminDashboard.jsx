import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Users, Truck, Package2, Route, Wrench, Fuel, BarChart2, AlertCircle, Activity } from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [maintCost, setMaintCost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [adminRes, mntRes] = await Promise.all([
          api.get("/analytics/admin-dashboard"),
          api.get("/analytics/maintenance-cost").catch(() => ({ data: { total_maintenance_cost: 0, cost_by_type: [] } }))
        ]);
        setData(adminRes.data);
        setMaintCost(mntRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <AppLayout title="Executive System Command Center" subtitle="Connecting to Executive Command Center...">
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "350px", flexDirection: "column", gap: "1rem" }}>
          <div className="ff-pulse-dot" style={{ width: "36px", height: "36px", background: "#6366f1" }} />
          <p style={{ fontSize: "0.875rem", color: "#64748b" }}>Loading System Command Metrics...</p>
        </div>
      </AppLayout>
    );
  }

  const sysSummary = data?.system_summary || { total_users: 0, total_drivers: 0, total_vehicles: 0, total_shipments: 0, total_trips: 0 };
  const driverLeaderboard = data?.driver_leaderboard || [];
  const attentionShipments = data?.attention_shipments || [];

  return (
    <AppLayout title="Executive System Command Center (God View)" subtitle="Global fleet monitoring, driver performance metrics, system activity, and maintenance analytics.">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* System Summary KPI Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.25rem" }}>
          
          <div className="ff-card" style={{ padding: "1.25rem" }}>
            <p style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Total System Users</p>
            <h4 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", marginTop: "0.25rem" }}>{sysSummary.total_users}</h4>
          </div>

          <div className="ff-card" style={{ padding: "1.25rem" }}>
            <p style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Registered Drivers</p>
            <h4 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#6366f1", marginTop: "0.25rem" }}>{sysSummary.total_drivers}</h4>
          </div>

          <div className="ff-card" style={{ padding: "1.25rem" }}>
            <p style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Fleet Vehicles</p>
            <h4 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#2563eb", marginTop: "0.25rem" }}>{sysSummary.total_vehicles}</h4>
          </div>

          <div className="ff-card" style={{ padding: "1.25rem" }}>
            <p style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Total Shipments</p>
            <h4 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#059669", marginTop: "0.25rem" }}>{sysSummary.total_shipments}</h4>
          </div>

          <div className="ff-card" style={{ padding: "1.25rem" }}>
            <p style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Maintenance Spend</p>
            <h4 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#d97706", marginTop: "0.25rem" }}>₹{data?.maintenance_analytics?.total_cost_inr?.toLocaleString() || "0"}</h4>
          </div>

        </div>

        {/* Driver Performance Leaderboard */}
        <div className="ff-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>Driver Performance Leaderboard</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "#94a3b8" }}>Driver</th>
                  <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "#94a3b8" }}>License</th>
                  <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "#94a3b8" }}>Trips</th>
                  <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "#94a3b8" }}>Attendance</th>
                </tr>
              </thead>
              <tbody>
                {driverLeaderboard.map((d, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.625rem 0.75rem", fontWeight: 700, color: "#0f172a" }}>{d.driver_name}</td>
                    <td style={{ padding: "0.625rem 0.75rem", color: "#64748b" }}>{d.license_number}</td>
                    <td style={{ padding: "0.625rem 0.75rem", fontWeight: 700, color: "#059669" }}>{d.completed_trips}/{d.total_trips}</td>
                    <td style={{ padding: "0.625rem 0.75rem", fontWeight: 700, color: "#2563eb" }}>{d.attendance_rate_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Shipments Needing Attention Card */}
        <div className="ff-card" style={{ padding: "1.5rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#dc2626", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <AlertCircle size={18} color="#dc2626" />
            <span>Shipments Needing Attention (Delayed / Cancelled)</span>
          </h3>

          {attentionShipments.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ background: "#fff1f2" }}>
                    <th style={{ padding: "0.625rem", textAlign: "left", color: "#991b1b" }}>Tracking #</th>
                    <th style={{ padding: "0.625rem", textAlign: "left", color: "#991b1b" }}>Customer</th>
                    <th style={{ padding: "0.625rem", textAlign: "left", color: "#991b1b" }}>Route</th>
                    <th style={{ padding: "0.625rem", textAlign: "left", color: "#991b1b" }}>Vehicle</th>
                    <th style={{ padding: "0.625rem", textAlign: "left", color: "#991b1b" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attentionShipments.map((s, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #fee2e2" }}>
                      <td style={{ padding: "0.625rem", fontWeight: 700, color: "#be123c" }}>#{s.tracking_number}</td>
                      <td style={{ padding: "0.625rem", fontWeight: 600 }}>{s.customer_name}</td>
                      <td style={{ padding: "0.625rem", color: "#475569" }}>{s.source} → {s.destination}</td>
                      <td style={{ padding: "0.625rem", color: "#475569" }}>{s.vehicle_reg}</td>
                      <td style={{ padding: "0.625rem" }}>
                        <span style={{ background: s.status === "Delayed" ? "#fef3c7" : "#fef2f2", color: s.status === "Delayed" ? "#b45309" : "#991b1b", padding: "0.25rem 0.5rem", borderRadius: "0.375rem", fontWeight: 700, fontSize: "0.75rem" }}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ fontSize: "0.875rem", color: "#059669", fontWeight: 600, textAlign: "center", padding: "1rem" }}>
              All shipments running smoothly on schedule! No delayed or cancelled shipments.
            </p>
          )}
        </div>

      </div>
    </AppLayout>
  );
}
