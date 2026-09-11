import React, { useEffect, useState } from "react";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import useGPSWebSocket from "../hooks/useGPSWebSocket";
import api from "../api/axiosInstance";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import "./Dashboard.css";

// Chart Color Palette
const COLORS = {
  primary: "#6366f1",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
  chartColors: ["#6366f1", "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"],
};

// Reusable Stat Card
const StatCard = ({ label, value, sub, icon, gradient, delay = 0 }) => (
  <div className="stat-card" style={{ animationDelay: `${delay}ms` }}>
    <div className="stat-card-body">
      <div className="stat-info">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value ?? "—"}</span>
        {sub && <span className="stat-sub">{sub}</span>}
      </div>
      <div className="stat-icon-wrap" style={{ background: gradient }}>
        {icon}
      </div>
    </div>
  </div>
);

// Custom Chart Tooltip
const CustomTooltip = ({ active, payload, label, prefix = "", suffix = "" }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: "rgba(15, 23, 42, 0.95)",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        borderRadius: 8,
        padding: "10px 14px",
        boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
      }}>
        <p style={{ margin: "0 0 4px", fontSize: "0.8rem", color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
          {label}
        </p>
        {payload.map((entry, idx) => (
          <p key={idx} style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, color: entry.color || "#818cf8" }}>
            {entry.name ? `${entry.name}: ` : ""}{prefix}{Number(entry.value).toLocaleString()}{suffix}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role;

  const [activeTab, setActiveTab] = useState(() => {
    return role === "Admin" ? "admin" :
           role === "FleetManager" ? "fleet" :
           role === "Dispatcher" ? "logistics" : "driver";
  });
  const [loading, setLoading] = useState(true);

  // Data states
  const [adminData, setAdminData] = useState(null);
  const [fleetData, setFleetData] = useState(null);
  const [logisticsData, setLogisticsData] = useState(null);
  const [driverData, setDriverData] = useState(null);

  // Live GPS WebSocket Feed
  const { gpsData, connected } = useGPSWebSocket();

  // Sync active tab with user role whenever user/role updates
  useEffect(() => {
    if (role) {
      if (role !== "Admin" && activeTab === "admin") {
        setActiveTab(
          role === "FleetManager" ? "fleet" :
          role === "Dispatcher" ? "logistics" : "driver"
        );
      }
    }
  }, [role, activeTab]);

  useEffect(() => {
    if (!user || !role) return;
    setLoading(true);
    if (role === "Driver") {
      api.get("/dashboard/driver")
        .then(res => setDriverData(res.data))
        .catch(err => console.error("Driver dash error:", err))
        .finally(() => setLoading(false));
    } else if (role === "Dispatcher") {
      api.get("/dashboard/logistics")
        .then(res => setLogisticsData(res.data))
        .catch(err => console.error("Logistics dash error:", err))
        .finally(() => setLoading(false));
    } else if (role === "FleetManager") {
      Promise.allSettled([
        api.get("/dashboard/fleet").then(r => setFleetData(r.data)),
        api.get("/dashboard/logistics").then(r => setLogisticsData(r.data)),
      ]).finally(() => setLoading(false));
    } else if (role === "Admin") {
      Promise.allSettled([
        api.get("/dashboard/admin").then(r => setAdminData(r.data)),
        api.get("/dashboard/fleet").then(r => setFleetData(r.data)),
        api.get("/dashboard/logistics").then(r => setLogisticsData(r.data)),
      ]).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user, role]);


  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <Layout>
      <div className="dashboard-page">
        {/* Header */}
        <div className="dashboard-header">
          <div className="dashboard-header-left">
            <div className="greeting-badge">
              <span className="live-dot" />
              <span>System Live</span>
              {connected && <span style={{ marginLeft: 6, color: "#10b981", fontSize: "0.75rem" }}>• GPS Connected</span>}
            </div>
            <h1 className="dashboard-title">
              {greeting()}, {user?.full_name?.split(" ")[0] || "User"}
            </h1>
            <p className="dashboard-sub">
              {role === "Admin" && "Full system oversight, fleet financials, driver leaderboards, and telemetry."}
              {role === "FleetManager" && "Fleet utilization, fuel consumption, service alerts, and active logistics."}
              {role === "Dispatcher" && "Active shipment pipeline, ETA tracking, and real-time transit routes."}
              {role === "Driver" && "Your active assignments, assigned vehicle alerts, and attendance record."}
            </p>
          </div>

          {/* Navigation Switcher Tabs (For Admin & FleetManager) */}
          {(role === "Admin" || role === "FleetManager") && (
            <div style={{ display: "flex", gap: 8, background: "rgba(15,23,42,0.6)", padding: 4, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
              {role === "Admin" && (
                <button
                  onClick={() => setActiveTab("admin")}
                  style={{
                    padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: "0.82rem", fontWeight: activeTab === "admin" ? 700 : 500,
                    background: activeTab === "admin" ? "var(--primary, #6366f1)" : "transparent",
                    color: activeTab === "admin" ? "#fff" : "rgba(255,255,255,0.6)",
                    transition: "all 0.15s ease",
                  }}
                >
                  Admin Overview
                </button>
              )}
              <button
                onClick={() => setActiveTab("fleet")}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: "0.82rem", fontWeight: activeTab === "fleet" ? 700 : 500,
                  background: activeTab === "fleet" ? "var(--primary, #6366f1)" : "transparent",
                  color: activeTab === "fleet" ? "#fff" : "rgba(255,255,255,0.6)",
                  transition: "all 0.15s ease",
                }}
              >
                Fleet Operations
              </button>
              <button
                onClick={() => setActiveTab("logistics")}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: "0.82rem", fontWeight: activeTab === "logistics" ? 700 : 500,
                  background: activeTab === "logistics" ? "var(--primary, #6366f1)" : "transparent",
                  color: activeTab === "logistics" ? "#fff" : "rgba(255,255,255,0.6)",
                  transition: "all 0.15s ease",
                }}
              >
                Logistics &amp; Delivery
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ padding: "80px 0", textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
            <div className="spinner" style={{ margin: "0 auto 12px" }} />
            Loading live operational metrics...
          </div>
        ) : (
          <>
            {/* ======================================================== */}
            {/* 1. ADMIN DASHBOARD VIEW */}
            {/* ======================================================== */}
            {activeTab === "admin" && adminData && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Top Stat Cards */}
                <div className="stats-grid">
                  <StatCard
                    label="Fleet Vehicles"
                    value={adminData.kpis?.total_vehicles}
                    sub={`${adminData.kpis?.utilization_percent ?? 0}% Utilized`}
                    icon="🚛"
                    gradient="linear-gradient(135deg, #6366f1, #4f46e5)"
                  />
                  <StatCard
                    label="Active Shipments"
                    value={adminData.kpis?.active_shipments}
                    sub={`${adminData.kpis?.delivered_shipments ?? 0} Delivered`}
                    icon="📦"
                    gradient="linear-gradient(135deg, #10b981, #059669)"
                    delay={100}
                  />
                  <StatCard
                    label="Total Fuel Cost"
                    value={`₹${(adminData.operational_costs?.total_fuel ?? 0).toLocaleString()}`}
                    sub="Fleet consumption"
                    icon="⛽"
                    gradient="linear-gradient(135deg, #f59e0b, #d97706)"
                    delay={200}
                  />
                  <StatCard
                    label="Maintenance Cost"
                    value={`₹${(adminData.operational_costs?.total_maintenance ?? 0).toLocaleString()}`}
                    sub={adminData.system_health?.status || "Healthy"}
                    icon="🔧"
                    gradient="linear-gradient(135deg, #ef4444, #dc2626)"
                    delay={300}
                  />
                </div>

                {/* Charts Row 1: Fuel Trends (Area Chart) & Maintenance by Type (Donut Chart) */}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
                  {/* Monthly Fuel Cost Trends */}
                  <div className="card" style={{ padding: "20px 24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#f1f5f9" }}>
                          📈 Monthly Fuel Cost Trends
                        </h3>
                        <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" }}>
                          Fleet expenditure trajectory over time
                        </p>
                      </div>
                      <span style={{ fontSize: "0.75rem", padding: "4px 10px", borderRadius: 6, background: "rgba(99,102,241,0.15)", color: "#818cf8", fontWeight: 600 }}>
                        Real-time Aggregation
                      </span>
                    </div>

                    <div style={{ width: "100%", height: 260 }}>
                      {adminData.fuel_trends && adminData.fuel_trends.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={adminData.fuel_trends} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <defs>
                              <linearGradient id="fuelGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey="month" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} />
                            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
                            <Tooltip content={<CustomTooltip prefix="₹" />} />
                            <Area type="monotone" dataKey="total_cost" name="Fuel Spend" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#fuelGradient)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)" }}>
                          No fuel trend records available
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Maintenance Cost by Service Type */}
                  <div className="card" style={{ padding: "20px 24px" }}>
                    <div style={{ marginBottom: 18 }}>
                      <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#f1f5f9" }}>
                        🛠️ Maintenance by Type
                      </h3>
                      <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" }}>
                        Cost allocation per service category
                      </p>
                    </div>

                    <div style={{ width: "100%", height: 260 }}>
                      {adminData.maintenance_by_type && adminData.maintenance_by_type.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={adminData.maintenance_by_type}
                              dataKey="cost"
                              nameKey="type"
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={85}
                              paddingAngle={4}
                            >
                              {adminData.maintenance_by_type.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS.chartColors[index % COLORS.chartColors.length]} stroke="rgba(15,23,42,0.8)" strokeWidth={2} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip prefix="₹" />} />
                            <Legend formatter={(value) => <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.74rem" }}>{value}</span>} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)" }}>
                          No maintenance cost data
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Charts Row 2: Driver Leaderboard & Fleet/Delivery Distributions */}
                <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: 20 }}>
                  {/* Driver Performance Leaderboard */}
                  <div className="card" style={{ padding: "20px 24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#f1f5f9" }}>
                        🏆 Driver Performance Leaderboard
                      </h3>
                      <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.4)" }}>
                        Ranked by Completed Trips &amp; Punctuality
                      </span>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontSize: "0.72rem" }}>
                            <th style={{ padding: "10px 12px", textAlign: "left" }}>Driver</th>
                            <th style={{ padding: "10px 12px", textAlign: "center" }}>Trips</th>
                            <th style={{ padding: "10px 12px", textAlign: "center" }}>On-Time Rate</th>
                            <th style={{ padding: "10px 12px", textAlign: "center" }}>Attendance</th>
                            <th style={{ padding: "10px 12px", textAlign: "right" }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(adminData.driver_leaderboard || []).slice(0, 5).map((d, i) => (
                            <tr key={d.driver_id || i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                              <td style={{ padding: "10px 12px", fontWeight: 600, color: "#f1f5f9" }}>
                                <span style={{ marginRight: 8, opacity: 0.5 }}>#{i + 1}</span> {d.name}
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "center", color: "#818cf8", fontWeight: 700 }}>
                                {d.trips_completed}
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                <span style={{
                                  padding: "2px 8px", borderRadius: 6, fontSize: "0.74rem", fontWeight: 700,
                                  background: d.on_time_rate >= 90 ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                                  color: d.on_time_rate >= 90 ? "#10b981" : "#f59e0b"
                                }}>
                                  {d.on_time_rate}%
                                </span>
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "center", color: "rgba(255,255,255,0.6)" }}>
                                {d.attendance_summary}
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "right" }}>
                                <span style={{
                                  padding: "2px 8px", borderRadius: 6, fontSize: "0.72rem",
                                  background: d.status === "On Trip" ? "rgba(99,102,241,0.15)" : "rgba(16,185,129,0.15)",
                                  color: d.status === "On Trip" ? "#818cf8" : "#10b981"
                                }}>
                                  {d.status || "Available"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Vehicle Fleet Status Breakdown */}
                  <div className="card" style={{ padding: "20px 24px" }}>
                    <div style={{ marginBottom: 16 }}>
                      <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#f1f5f9" }}>
                        🚗 Vehicle Status Composition
                      </h3>
                      <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" }}>
                        Fleet readiness distribution
                      </p>
                    </div>

                    <div style={{ width: "100%", height: 230 }}>
                      {adminData.vehicle_distribution && adminData.vehicle_distribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={adminData.vehicle_distribution} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis type="number" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                            <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.7)" fontSize={11} width={80} />
                            <Tooltip content={<CustomTooltip suffix=" vehicles" />} />
                            <Bar dataKey="value" name="Vehicles" fill="#3b82f6" radius={[0, 6, 6, 0]}>
                              {adminData.vehicle_distribution.map((entry, index) => {
                                const color = entry.name === "Available" ? "#10b981" :
                                              entry.name === "Assigned" ? "#3b82f6" :
                                              entry.name === "InTransit" ? "#8b5cf6" : "#ef4444";
                                return <Cell key={`cell-${index}`} fill={color} />;
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)" }}>
                          No vehicle distribution data
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* 2. FLEET OPERATIONS DASHBOARD VIEW */}
            {/* ======================================================== */}
            {activeTab === "fleet" && fleetData && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Fleet Stat Cards */}
                <div className="stats-grid">
                  <StatCard
                    label="Total Fleet"
                    value={fleetData.total_vehicles}
                    sub="Registered vehicles"
                    icon="🚛"
                    gradient="linear-gradient(135deg, #3b82f6, #1d4ed8)"
                  />
                  <StatCard
                    label="Fleet Utilization"
                    value={`${fleetData.utilization_percent ?? 0}%`}
                    sub="Active / Assigned"
                    icon="⚡"
                    gradient="linear-gradient(135deg, #10b981, #047857)"
                    delay={100}
                  />
                  <StatCard
                    label="Upcoming Services"
                    value={fleetData.maintenance?.upcoming_count ?? 0}
                    sub="Due in 7 days"
                    icon="📅"
                    gradient="linear-gradient(135deg, #f59e0b, #b45309)"
                    delay={200}
                  />
                  <StatCard
                    label="Overdue Maintenance"
                    value={fleetData.maintenance?.overdue_count ?? 0}
                    sub="Immediate action required"
                    icon="⚠️"
                    gradient="linear-gradient(135deg, #ef4444, #b91c1c)"
                    delay={300}
                  />
                </div>

                {/* Fleet Charts: Top Fuel Consuming Vehicles & Status Breakdown */}
                <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: 20 }}>
                  {/* Top Fuel Consumers Bar Chart */}
                  <div className="card" style={{ padding: "20px 24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#f1f5f9" }}>
                          ⛽ Top 5 Fuel-Consuming Vehicles
                        </h3>
                        <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" }}>
                          Vehicles with highest accumulated fuel expenditures
                        </p>
                      </div>
                    </div>

                    <div style={{ width: "100%", height: 260 }}>
                      {fleetData.fuel_summary?.top_consumers && fleetData.fuel_summary.top_consumers.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={fleetData.fuel_summary.top_consumers} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey="registration_number" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickFormatter={(v) => `₹${v / 1000}k`} />
                            <Tooltip content={<CustomTooltip prefix="₹" />} />
                            <Bar dataKey="cost" name="Total Fuel Cost" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)" }}>
                          No fuel consumption records logged
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fleet Status Composition Donut Chart */}
                  <div className="card" style={{ padding: "20px 24px" }}>
                    <div style={{ marginBottom: 18 }}>
                      <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#f1f5f9" }}>
                        📊 Vehicle Status Breakdown
                      </h3>
                      <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" }}>
                        Current operational fleet distribution
                      </p>
                    </div>

                    <div style={{ width: "100%", height: 260 }}>
                      {Object.keys(fleetData.by_status || {}).length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={Object.entries(fleetData.by_status).map(([name, value]) => ({ name, value }))}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={4}
                            >
                              {Object.entries(fleetData.by_status).map(([name], idx) => {
                                const fill = name === "Available" ? "#10b981" :
                                             name === "Assigned" ? "#3b82f6" :
                                             name === "InTransit" ? "#8b5cf6" : "#ef4444";
                                return <Cell key={`status-${idx}`} fill={fill} stroke="rgba(15,23,42,0.8)" strokeWidth={2} />;
                              })}
                            </Pie>
                            <Tooltip content={<CustomTooltip suffix=" vehicles" />} />
                            <Legend formatter={(value) => <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.74rem" }}>{value}</span>} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)" }}>
                          No status data
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Overdue / Upcoming Service Alerts List */}
                <div className="card" style={{ padding: "20px 24px" }}>
                  <h3 style={{ margin: "0 0 16px", fontSize: "1.05rem", fontWeight: 700, color: "#f1f5f9" }}>
                    ⚠️ Service Alerts &amp; Upcoming Maintenance
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <h4 style={{ margin: "0 0 10px", fontSize: "0.85rem", color: "#ef4444", fontWeight: 700 }}>
                        🚨 Overdue Services ({fleetData.maintenance?.overdue_count ?? 0})
                      </h4>
                      {(fleetData.maintenance?.overdue_list || []).length === 0 ? (
                        <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.4)" }}>No overdue services.</div>
                      ) : (
                        fleetData.maintenance.overdue_list.slice(0, 3).map((item, idx) => (
                          <div key={idx} style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, marginBottom: 8 }}>
                            <div style={{ fontWeight: 700, color: "#f87171" }}>{item.registration} &bull; {item.type}</div>
                            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>Due: {item.due} &bull; Est. Cost: ₹{item.cost}</div>
                          </div>
                        ))
                      )}
                    </div>

                    <div>
                      <h4 style={{ margin: "0 0 10px", fontSize: "0.85rem", color: "#f59e0b", fontWeight: 700 }}>
                        ⏳ Upcoming This Week ({fleetData.maintenance?.upcoming_count ?? 0})
                      </h4>
                      {(fleetData.maintenance?.upcoming_list || []).length === 0 ? (
                        <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.4)" }}>No services due this week.</div>
                      ) : (
                        fleetData.maintenance.upcoming_list.slice(0, 3).map((item, idx) => (
                          <div key={idx} style={{ padding: "10px 14px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, marginBottom: 8 }}>
                            <div style={{ fontWeight: 700, color: "#fbbf24" }}>{item.registration} &bull; {item.type}</div>
                            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>Due: {item.due} &bull; Est. Cost: ₹{item.cost}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* 3. LOGISTICS DASHBOARD VIEW */}
            {/* ======================================================== */}
            {activeTab === "logistics" && logisticsData && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Logistics Stat Cards */}
                <div className="stats-grid">
                  <StatCard
                    label="Total Shipments"
                    value={logisticsData.total_shipments}
                    sub="Lifetime dispatches"
                    icon="📦"
                    gradient="linear-gradient(135deg, #6366f1, #4338ca)"
                  />
                  <StatCard
                    label="Active in Pipeline"
                    value={logisticsData.active_shipments}
                    sub="In Transit or Assigned"
                    icon="🚚"
                    gradient="linear-gradient(135deg, #3b82f6, #1d4ed8)"
                    delay={100}
                  />
                  <StatCard
                    label="On-Time Delivery Rate"
                    value={logisticsData.delivery_metrics?.on_time_rate_percent ? `${logisticsData.delivery_metrics.on_time_rate_percent}%` : "100%"}
                    sub="ETA Accuracy"
                    icon="⏱️"
                    gradient="linear-gradient(135deg, #10b981, #059669)"
                    delay={200}
                  />
                  <StatCard
                    label="Avg Delivery Time"
                    value={logisticsData.delivery_metrics?.avg_delivery_hours ? `${logisticsData.delivery_metrics.avg_delivery_hours}h` : "—"}
                    sub="Origin to Destination"
                    icon="📍"
                    gradient="linear-gradient(135deg, #8b5cf6, #6d28d9)"
                    delay={300}
                  />
                </div>

                {/* Logistics Charts: Pipeline Breakdown & Route Mode Usage */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  {/* Shipment Status Pipeline */}
                  <div className="card" style={{ padding: "20px 24px" }}>
                    <div style={{ marginBottom: 18 }}>
                      <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#f1f5f9" }}>
                        📊 Shipment Pipeline Distribution
                      </h3>
                      <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" }}>
                        Current status across all shipment orders
                      </p>
                    </div>

                    <div style={{ width: "100%", height: 260 }}>
                      {Object.keys(logisticsData.by_status || {}).length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={Object.entries(logisticsData.by_status).map(([name, count]) => ({ name: name.replace("ShipmentStatus.", ""), count }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} />
                            <Tooltip content={<CustomTooltip suffix=" orders" />} />
                            <Bar dataKey="count" name="Shipments" fill="#6366f1" radius={[6, 6, 0, 0]}>
                              {Object.keys(logisticsData.by_status).map((_, idx) => (
                                <Cell key={`pipe-${idx}`} fill={COLORS.chartColors[idx % COLORS.chartColors.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)" }}>
                          No shipment data
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Route Modes Usage */}
                  <div className="card" style={{ padding: "20px 24px" }}>
                    <div style={{ marginBottom: 18 }}>
                      <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#f1f5f9" }}>
                        🛣️ Route Mode Utilization
                      </h3>
                      <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" }}>
                        Selected routing algorithms across trips
                      </p>
                    </div>

                    <div style={{ width: "100%", height: 260 }}>
                      {Object.keys(logisticsData.route_mode_usage || {}).length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={Object.entries(logisticsData.route_mode_usage).map(([name, count]) => ({ name, count }))}
                              dataKey="count"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={4}
                            >
                              {Object.keys(logisticsData.route_mode_usage).map((_, idx) => (
                                <Cell key={`route-${idx}`} fill={COLORS.chartColors[idx % COLORS.chartColors.length]} stroke="rgba(15,23,42,0.8)" strokeWidth={2} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip suffix=" trips" />} />
                            <Legend formatter={(value) => <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.74rem" }}>{value}</span>} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)" }}>
                          No trip route mode data
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Live Active Trips Table */}
                <div className="card" style={{ padding: "20px 24px" }}>
                  <h3 style={{ margin: "0 0 16px", fontSize: "1.05rem", fontWeight: 700, color: "#f1f5f9" }}>
                    🔴 Live In-Transit Trips
                  </h3>
                  {(logisticsData.live_trips || []).length === 0 ? (
                    <div style={{ padding: "30px 0", textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
                      No active trips currently in transit.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontSize: "0.72rem" }}>
                            <th style={{ padding: "10px 12px", textAlign: "left" }}>Tracking #</th>
                            <th style={{ padding: "10px 12px", textAlign: "left" }}>Route</th>
                            <th style={{ padding: "10px 12px", textAlign: "left" }}>Vehicle &amp; Driver</th>
                            <th style={{ padding: "10px 12px", textAlign: "center" }}>Mode</th>
                            <th style={{ padding: "10px 12px", textAlign: "right" }}>ETA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {logisticsData.live_trips.map((t, idx) => (
                            <tr key={t.trip_id || idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                              <td style={{ padding: "10px 12px", fontWeight: 700, color: "#818cf8" }}>{t.tracking_number}</td>
                              <td style={{ padding: "10px 12px", color: "#f1f5f9" }}>{t.origin || "Origin"} ➔ {t.destination}</td>
                              <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.7)" }}>{t.vehicle_reg} &bull; {t.driver_name}</td>
                              <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: "0.72rem", background: "rgba(99,102,241,0.15)", color: "#818cf8" }}>
                                  {t.route_type}
                                </span>
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "right", color: "#10b981", fontWeight: 600 }}>
                                {t.eta ? new Date(t.eta).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "En route"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* 4. DRIVER PERSONAL DASHBOARD VIEW */}
            {/* ======================================================== */}
            {role === "Driver" && driverData && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Driver Stat Cards */}
                <div className="stats-grid">
                  <StatCard
                    label="Completed Trips"
                    value={driverData.performance?.completed_trips ?? 0}
                    sub={`Out of ${driverData.performance?.total_trips ?? 0} total`}
                    icon="🚚"
                    gradient="linear-gradient(135deg, #10b981, #059669)"
                  />
                  <StatCard
                    label="On-Time Rate"
                    value={driverData.performance?.on_time_rate ? `${driverData.performance.on_time_rate}%` : "100%"}
                    sub="Punctuality Score"
                    icon="⏱️"
                    gradient="linear-gradient(135deg, #6366f1, #4338ca)"
                    delay={100}
                  />
                  <StatCard
                    label="Monthly Attendance"
                    value={`${driverData.attendance?.present_days ?? 0}/${driverData.attendance?.total_days ?? 0}`}
                    sub="Days marked Present"
                    icon="📅"
                    gradient="linear-gradient(135deg, #3b82f6, #1d4ed8)"
                    delay={200}
                  />
                  <StatCard
                    label="Assigned Vehicle"
                    value={driverData.assigned_vehicle?.registration_number || "Unassigned"}
                    sub={driverData.assigned_vehicle?.model || "Fleet Unit"}
                    icon="🚗"
                    gradient="linear-gradient(135deg, #f59e0b, #d97706)"
                    delay={300}
                  />
                </div>

                {/* Active Assignment Card */}
                {driverData.current_assignment && (
                  <div className="card" style={{ padding: "20px 24px", background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(16,185,129,0.1))", border: "1px solid rgba(99,102,241,0.4)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: "0.72rem", background: "rgba(16,185,129,0.2)", color: "#10b981", fontWeight: 700 }}>
                          🟢 ACTIVE TRIP IN PROGRESS
                        </span>
                        <h3 style={{ margin: "10px 0 4px", fontSize: "1.2rem", fontWeight: 800, color: "#f1f5f9" }}>
                          Destination: {driverData.current_assignment.destination}
                        </h3>
                        <p style={{ margin: 0, fontSize: "0.82rem", color: "rgba(255,255,255,0.6)" }}>
                          Tracking Number: {driverData.current_assignment.shipment_tracking || "N/A"}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>ESTIMATED ARRIVAL</div>
                        <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#10b981" }}>
                          {driverData.current_assignment.eta ? new Date(driverData.current_assignment.eta).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Calculating..."}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Vehicle Maintenance Alert */}
                {driverData.vehicle_maintenance && (
                  <div style={{
                    padding: "16px 20px", borderRadius: 12,
                    background: driverData.vehicle_maintenance.is_overdue ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                    border: `1px solid ${driverData.vehicle_maintenance.is_overdue ? "#ef4444" : "#f59e0b"}`,
                    display: "flex", alignItems: "center", gap: 14
                  }}>
                    <span style={{ fontSize: "1.5rem" }}>{driverData.vehicle_maintenance.is_overdue ? "🚨" : "🔧"}</span>
                    <div>
                      <div style={{ fontWeight: 700, color: driverData.vehicle_maintenance.is_overdue ? "#ef4444" : "#f59e0b" }}>
                        Vehicle Service Notice: {driverData.vehicle_maintenance.type}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.6)" }}>
                        Scheduled Service Date: {driverData.vehicle_maintenance.next_service_date}
                      </div>
                    </div>
                  </div>
                )}

                {/* Recent Trips Table */}
                <div className="card" style={{ padding: "20px 24px" }}>
                  <h3 style={{ margin: "0 0 16px", fontSize: "1.05rem", fontWeight: 700, color: "#f1f5f9" }}>
                    📜 Recent Trip History
                  </h3>
                  {(driverData.recent_trips || []).length === 0 ? (
                    <div style={{ padding: "24px 0", textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
                      No recent trip records found.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", fontSize: "0.72rem" }}>
                            <th style={{ padding: "10px 12px", textAlign: "left" }}>Destination</th>
                            <th style={{ padding: "10px 12px", textAlign: "center" }}>Status</th>
                            <th style={{ padding: "10px 12px", textAlign: "right" }}>Start Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {driverData.recent_trips.map((t, idx) => (
                            <tr key={t.trip_id || idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                              <td style={{ padding: "10px 12px", fontWeight: 600, color: "#f1f5f9" }}>{t.destination}</td>
                              <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                <span style={{
                                  padding: "2px 8px", borderRadius: 6, fontSize: "0.72rem",
                                  background: t.status === "Completed" ? "rgba(16,185,129,0.15)" : "rgba(99,102,241,0.15)",
                                  color: t.status === "Completed" ? "#10b981" : "#818cf8"
                                }}>
                                  {t.status}
                                </span>
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "right", color: "rgba(255,255,255,0.5)" }}>
                                {t.start_time ? new Date(t.start_time).toLocaleString() : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}