import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Truck, Route, Wrench, BarChart3, Bell, TrendingUp, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";

const statusStyles = {
  active:       { color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", label: "Active"      },
  completed:    { color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe", label: "Completed"   },
  pending:      { color: "#92400e", bg: "#fffbeb", border: "#fde68a", label: "Pending"     },
  "in transit": { color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe", label: "In Transit"  },
  assigned:     { color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc", label: "Assigned"    },
};

const alertStyles = {
  warning: { icon: AlertTriangle, color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  info:    { icon: Bell,          color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  success: { icon: CheckCircle2,  color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
};

const iconMap = {
  Truck: Truck,
  Route: Route,
  Wrench: Wrench,
  TrendingUp: TrendingUp,
};

const card   = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.08 } } };

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState([]);
  const [recentTrips, setRecentTrips] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const [statsRes, tripsRes, alertsRes] = await Promise.all([
          api.get("/dashboard/summary"),
          api.get("/dashboard/trips"),
          api.get("/dashboard/alerts")
        ]);
        if (active) {
          setStats(statsRes.data);
          setRecentTrips(tripsRes.data);
          setAlerts(alertsRes.data);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load dashboard statistics:", err);
        if (active) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };
  const name = user?.full_name?.split(" ")[0] || "there";

  if (loading) {
    return (
      <AppLayout title={`${greeting()}, ${name} 👋`} subtitle="Loading live operational data...">
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "350px", flexDirection: "column", gap: "1rem" }}>
          <div className="ff-pulse-dot" style={{ width: "36px", height: "36px", background: "#6366f1" }} />
          <p style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: 500 }}>Connecting to FleetFlow API...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={`${greeting()}, ${name} 👋`} subtitle="Here's your fleet at a glance today.">
      <motion.div variants={stagger} initial="hidden" animate="show">

        {/* Stat cards */}
        <motion.div variants={stagger} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          {stats.map(({ label, value, delta, positive, icon: iconName, color, bg, border }) => {
            const Icon = iconMap[iconName] || Truck;
            return (
              <motion.div key={label} variants={card}
                style={{ background: "white", border: `1.5px solid ${border}`, borderRadius: "1.25rem", padding: "1.25rem 1.5rem", boxShadow: "0 2px 8px rgba(15,23,42,0.06)", display: "flex", flexDirection: "column", gap: "0.75rem", transition: "box-shadow 0.2s, transform 0.2s" }}
                whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(15,23,42,0.10)" }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <p style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>{label}</p>
                  <div style={{ borderRadius: "0.625rem", background: bg, border: `1px solid ${border}`, padding: "0.5rem", display: "flex" }}>
                    <Icon size={16} color={color} />
                  </div>
                </div>
                <p style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1, color: "#0f172a" }}>{value}</p>
                <p style={{ fontSize: "0.75rem", color: positive ? "#059669" : "#d97706", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  {positive ? "▲" : "▼"} {delta}
                </p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Two-column lower */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.25rem", alignItems: "start" }} className="dashboard-grid">

          {/* Trips table */}
          <motion.div variants={card} style={{ background: "white", border: "1.5px solid rgba(15,23,42,0.08)", borderRadius: "1.25rem", padding: "1.5rem", boxShadow: "0 2px 8px rgba(15,23,42,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>Recent Trips</h3>
                <p style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.125rem" }}>Live and completed routes</p>
              </div>
              <span className="ff-badge ff-badge-emerald">
                <span className="ff-pulse-dot" style={{ width: "6px", height: "6px", background: "#059669" }} />
                {(recentTrips || []).filter(t => t.status?.toLowerCase() === "active").length} active
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr>
                    {["Trip ID", "Driver", "Route", "Vehicle", "Status", "Started"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "0.5rem 0.75rem", color: "#94a3b8", fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.05em", textTransform: "uppercase", borderBottom: "1.5px solid #f1f5f9", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentTrips && recentTrips.length > 0 ? (
                    recentTrips.map((trip, i) => {
                      const s = statusStyles[trip.status?.toLowerCase()] || statusStyles.pending;
                      return (
                        <motion.tr key={trip.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
                          style={{ borderBottom: "1px solid #f8fafc", cursor: "default" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                          <td style={{ padding: "0.75rem", color: "#6366f1", fontWeight: 700, whiteSpace: "nowrap" }}>{trip.id}</td>
                          <td style={{ padding: "0.75rem", color: "#0f172a", fontWeight: 500, whiteSpace: "nowrap" }}>{trip.driver}</td>
                          <td style={{ padding: "0.75rem", color: "#475569", whiteSpace: "nowrap" }}>{trip.route}</td>
                          <td style={{ padding: "0.75rem", whiteSpace: "nowrap" }}>
                            <span style={{ fontFamily: "monospace", fontSize: "0.8125rem", background: "#f1f5f9", color: "#475569", padding: "0.125rem 0.5rem", borderRadius: "0.375rem" }}>{trip.vehicle}</span>
                          </td>
                          <td style={{ padding: "0.75rem" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.25rem 0.625rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                              {trip.status?.toLowerCase() === "active" && <span className="ff-pulse-dot" style={{ width: "5px", height: "5px", background: s.color }} />}
                              {s.label}
                            </span>
                          </td>
                          <td style={{ padding: "0.75rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                            <Clock size={12} style={{ display: "inline", marginRight: "4px", verticalAlign: "middle" }} />
                            {trip.started}
                          </td>
                        </motion.tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                        No recent trips found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Alerts panel */}
          <motion.div variants={card} className="ff-card" style={{ padding: "1.5rem" }}>
            <div style={{ marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>Fleet Alerts</h3>
              <p style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.125rem" }}>{alerts.length} notifications</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "320px", overflowY: "auto" }}>
              {alerts.map((alert, i) => {
                const { icon: AlertIcon, color, bg, border } = alertStyles[alert.type] || alertStyles.info;
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.07 }}
                    style={{ display: "flex", gap: "0.75rem", padding: "0.875rem", borderRadius: "0.875rem", background: bg, border: `1px solid ${border}`, cursor: "default" }}>
                    <div style={{ flexShrink: 0, width: "32px", height: "32px", borderRadius: "0.5rem", background: "white", border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <AlertIcon size={14} color={color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "0.8125rem", color: "#334155", lineHeight: 1.4 }}>{alert.text}</p>
                      <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>{alert.time}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <button
              style={{ width: "100%", marginTop: "1rem", padding: "0.625rem", borderRadius: "0.875rem", background: "transparent", border: "1.5px solid rgba(15,23,42,0.08)", color: "#64748b", fontSize: "0.8125rem", cursor: "pointer", transition: "background 0.15s, color 0.15s, border-color 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.color = "#0f172a"; e.currentTarget.style.borderColor = "rgba(15,23,42,0.15)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; e.currentTarget.style.borderColor = "rgba(15,23,42,0.08)"; }}>
              View all notifications
            </button>
          </motion.div>
        </div>
      </motion.div>

      <style>{`
        @media (max-width: 1024px) { .dashboard-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </AppLayout>
  );
}