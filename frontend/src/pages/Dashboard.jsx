import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Truck, Route, Wrench, Fuel, BarChart3, Bell, TrendingUp, Clock, CheckCircle2, AlertTriangle, ArrowUpRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [recentTrips, setRecentTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [dashRes, tripsRes] = await Promise.all([
          api.get("/analytics/fleet-dashboard"),
          api.get("/dashboard/trips")
        ]);
        setData(dashRes.data);
        setRecentTrips(tripsRes.data || []);
      } catch (err) {
        console.error("Failed to load Fleet Dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
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
      <AppLayout title={`${greeting()}, ${name} 👋`} subtitle="Loading live fleet overview...">
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "350px", flexDirection: "column", gap: "1rem" }}>
          <div className="ff-pulse-dot" style={{ width: "36px", height: "36px", background: "#3b82f6" }} />
          <p style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: 500 }}>Fetching Fleet Analytics...</p>
        </div>
      </AppLayout>
    );
  }

  const statusBk = data?.status_breakdown || { Available: 0, Assigned: 0, "In Transit": 0, Maintenance: 0 };
  const typeBk = data?.type_breakdown || {};
  const fuelSummary = data?.fuel_summary || { total_cost_inr: 0, total_liters: 0, top_vehicles_by_cost: [] };
  const maintSummary = data?.maintenance_summary || { overdue_count: 0, upcoming_count: 0, upcoming_list: [] };

  return (
    <AppLayout title={`${greeting()}, ${name} 👋`} subtitle="Fleet Operational Control Center & Utilization Overview">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* Top 4 KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
          
          {/* Active Vehicles */}
          <div className="ff-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>Active Fleet Vehicles</span>
              <Truck size={18} color="#3b82f6" />
            </div>
            <h3 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a" }}>{data?.total_vehicles || 0}</h3>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.75rem", color: "#475569" }}>
              {Object.entries(typeBk).map(([t, cnt]) => (
                <span key={t} style={{ background: "#f1f5f9", padding: "0.125rem 0.375rem", borderRadius: "0.375rem" }}>{t}: {cnt}</span>
              ))}
            </div>
          </div>

          {/* Fleet Utilization Rate */}
          <div className="ff-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>Fleet Utilization Rate</span>
              <TrendingUp size={18} color="#059669" />
            </div>
            <h3 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#059669" }}>{data?.utilization_rate_pct || 0}%</h3>
            <span style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 500 }}><ArrowUpRight size={12} style={{ display: "inline" }} /> Active vs Available</span>
          </div>

          {/* Fuel Costs */}
          <div className="ff-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>Monthly Fuel Spend</span>
              <Fuel size={18} color="#6366f1" />
            </div>
            <h3 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a" }}>₹{fuelSummary.total_cost_inr.toLocaleString()}</h3>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{fuelSummary.total_liters} Liters consumed</span>
          </div>

          {/* Maintenance Alerts */}
          <div className="ff-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>Maintenance Status</span>
              <Wrench size={18} color="#d97706" />
            </div>
            <h3 style={{ fontSize: "1.75rem", fontWeight: 700, color: maintSummary.overdue_count > 0 ? "#dc2626" : "#0f172a" }}>
              {maintSummary.overdue_count} Overdue
            </h3>
            <span style={{ fontSize: "0.75rem", color: "#d97706" }}>{maintSummary.upcoming_count} upcoming in 7 days</span>
          </div>

        </div>

        {/* Middle Row: Vehicle Status Overview & Fuel Consumption Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }} className="dashboard-grid">
          
          {/* Vehicle Status Breakdown */}
          <div className="ff-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a" }}>Vehicle Status Overview</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "1rem", borderRadius: "0.75rem" }}>
                <span style={{ fontSize: "0.75rem", color: "#047857", fontWeight: 700 }}>Available</span>
                <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#059669" }}>{statusBk.Available}</h3>
              </div>
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "1rem", borderRadius: "0.75rem" }}>
                <span style={{ fontSize: "0.75rem", color: "#1d4ed8", fontWeight: 700 }}>Assigned</span>
                <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#2563eb" }}>{statusBk.Assigned}</h3>
              </div>
              <div style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", padding: "1rem", borderRadius: "0.75rem" }}>
                <span style={{ fontSize: "0.75rem", color: "#6d28d9", fontWeight: 700 }}>In Transit</span>
                <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#7c3aed" }}>{statusBk["In Transit"]}</h3>
              </div>
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: "1rem", borderRadius: "0.75rem" }}>
                <span style={{ fontSize: "0.75rem", color: "#b45309", fontWeight: 700 }}>Maintenance</span>
                <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#d97706" }}>{statusBk.Maintenance}</h3>
              </div>
            </div>
          </div>

          {/* Top Fuel Consumption Vehicles */}
          <div className="ff-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a" }}>Top Fuel Consuming Vehicles</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {fuelSummary.top_vehicles_by_cost.length > 0 ? (
                fuelSummary.top_vehicles_by_cost.map((v, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.625rem 0.875rem", background: "#f8fafc", borderRadius: "0.625rem", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#1e293b" }}>{v.registration_number}</span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#059669" }}>₹{v.total_cost_inr.toLocaleString()}</span>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: "0.8125rem", color: "#94a3b8", textAlign: "center", padding: "1rem" }}>No fuel records logged yet.</p>
              )}
            </div>
          </div>

        </div>

        {/* Bottom Row: Upcoming Maintenance List & Recent Trips */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }} className="dashboard-grid">
          
          {/* Upcoming Maintenance List */}
          <div className="ff-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a" }}>Upcoming & Overdue Maintenance</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {maintSummary.upcoming_list.length > 0 ? (
                maintSummary.upcoming_list.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.625rem 0.875rem", background: "#fffbeb", borderRadius: "0.625rem", border: "1px solid #fde68a" }}>
                    <div>
                      <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0f172a" }}>{m.vehicle_reg}</p>
                      <p style={{ fontSize: "0.75rem", color: "#64748b" }}>{m.type} • Due {m.next_service_date}</p>
                    </div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#b45309", background: "#fef3c7", padding: "0.25rem 0.5rem", borderRadius: "0.375rem" }}>
                      {m.resolution_status}
                    </span>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: "0.8125rem", color: "#94a3b8", textAlign: "center", padding: "1rem" }}>No upcoming maintenance tasks due.</p>
              )}
            </div>
          </div>

          {/* Recent Trips */}
          <div className="ff-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a" }}>Recent Fleet Trips</h4>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ padding: "0.5rem", textAlign: "left", color: "#94a3b8" }}>Trip ID</th>
                    <th style={{ padding: "0.5rem", textAlign: "left", color: "#94a3b8" }}>Driver</th>
                    <th style={{ padding: "0.5rem", textAlign: "left", color: "#94a3b8" }}>Route</th>
                    <th style={{ padding: "0.5rem", textAlign: "left", color: "#94a3b8" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrips.slice(0, 4).map((t, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.5rem", fontWeight: 700, color: "#6366f1" }}>{t.id}</td>
                      <td style={{ padding: "0.5rem", fontWeight: 600 }}>{t.driver}</td>
                      <td style={{ padding: "0.5rem", color: "#64748b" }}>{t.route}</td>
                      <td style={{ padding: "0.5rem" }}>
                        <span style={{ padding: "0.125rem 0.375rem", borderRadius: "0.25rem", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: "0.6875rem" }}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

      <style>{`
        @media (max-width: 1024px) { .dashboard-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </AppLayout>
  );
}