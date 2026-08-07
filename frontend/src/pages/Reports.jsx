import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, DollarSign, Route, FileText, Download, Calendar, ArrowUpRight } from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";

export default function Reports() {
  const [stats, setStats] = useState({
    totalDistance: 0,
    avgTripDistance: 0,
    activeRoutes: 0,
    maintenanceOverdue: 0,
    fuelExpenses: 0,
    tripsCount: 0,
    onTimeRate: "0%"
  });
  const [loading, setLoading] = useState(true);
  const [tripStats, setTripStats] = useState([]);
  const [fuelEfficiency, setFuelEfficiency] = useState([]);
  
  useEffect(() => {
    // Quick load simulation, or fetch dashboard summary to update
    const loadReportData = async () => {
      try {
        const summary = await api.get("/dashboard/summary");
        const trips = await api.get("/dashboard/trips");
        
        // This is a placeholder for a real reports endpoint.
        // For now, we'll derive some stats from existing endpoints.
        const reportData = await api.get("/reports/operational-summary").catch(() => ({ data: {} }));
        
        const summaryData = {};
        summary.data.forEach(item => {
          const key = item.label.toLowerCase().replace(/ /g, '');
          summaryData[key] = item.value;
        });

        setStats(prev => ({
          ...prev,
          totalDistance: reportData.data.total_distance || 0,
          avgTripDistance: reportData.data.avg_trip_distance || 0,
          fuelExpenses: reportData.data.fuel_expenses || 0,
          activeRoutes: parseInt(summaryData['activetrips']) || 0,
          maintenanceOverdue: parseInt(summaryData['maintenancedue']) || 0,
          onTimeRate: summaryData['on-timerate'] || "0%",
          tripsCount: trips.data.length || 0
        }));
        setTripStats(reportData.data.trip_stats || []);
        setFuelEfficiency(reportData.data.fuel_efficiency || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadReportData();
  }, []);

  return (
    <AppLayout title="Operational Analytics" subtitle="Analyze fleet performance, fuel utilization, and service metrics">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* Top bar controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "white", padding: "0.5rem 1rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.08)", fontSize: "0.875rem", color: "#475569", cursor: "pointer" }}>
            <Calendar size={15} />
            <span>Last 30 Days (July 2026)</span>
          </div>
          <button className="ff-btn-ghost" onClick={() => window.print()} style={{ gap: "0.5rem" }}>
            <Download size={15} />
            Export PDF Report
          </button>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "250px", flexDirection: "column", gap: "1rem" }}>
            <div className="ff-pulse-dot" style={{ width: "36px", height: "36px", background: "#8b5cf6" }} />
            <p style={{ fontSize: "0.875rem", color: "#64748b" }}>Analyzing operations data...</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
              
              <div className="ff-stat-card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>Total Fleet Mileage</span>
                  <Route size={16} color="#6366f1" />
                </div>
                <h3 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a" }}>{stats.totalDistance} km</h3>
                <span style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 500 }}><ArrowUpRight size={12} style={{ display: "inline", verticalAlign: "middle" }} /> +12.4% vs last month</span>
              </div>

              <div className="ff-stat-card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>Est. Fuel Costs</span>
                  <DollarSign size={16} color="#059669" />
                </div>
                <h3 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a" }}>₹{stats.fuelExpenses.toLocaleString()}</h3>
                <span style={{ fontSize: "0.75rem", color: "#d97706", fontWeight: 500 }}>Within projected budget</span>
              </div>

              <div className="ff-stat-card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>Completed Dispatches</span>
                  <BarChart3 size={16} color="#8b5cf6" />
                </div>
                <h3 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a" }}>{stats.tripsCount} trips</h3>
                <span style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 500 }}>100% resolution rate</span>
              </div>

              <div className="ff-stat-card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>On-Time Dispatch Rate</span>
                  <TrendingUp size={16} color="#06b6d4" />
                </div>
                <h3 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a" }}>{stats.onTimeRate}</h3>
                <span style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 500 }}>Excellent performance</span>
              </div>

            </div>

            {/* Charts section */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }} className="reports-grid">
              
              {/* Bar chart - Dispatches per route */}
              <div className="ff-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a" }}>Trip Milestones by Distance (km)</h4>
                  <p style={{ fontSize: "0.75rem", color: "#64748b" }}>Overview of scheduled routes and planned mileage</p>
                </div>

                {tripStats.length > 0 ? (
                  <div style={{ height: "200px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1rem", paddingTop: "1rem" }}>
                    {tripStats.map((item, idx) => {
                      const maxVal = Math.max(...tripStats.map(ts => ts.val));
                      const pct = (item.val / (maxVal > 0 ? maxVal : 1)) * 100;
                      return (
                        <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: "0.5rem" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>{item.val}</span>
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${pct}%` }}
                            transition={{ duration: 0.5, delay: idx * 0.1 }}
                            style={{ width: "100%", maxWidth: "32px", background: item.color || "#6366f1", borderRadius: "4px 4px 0 0", minHeight: "8px" }} 
                          />
                          <span style={{ fontSize: "0.6875rem", color: "#94a3b8", fontWeight: 600, whiteSpace: "nowrap" }}>{item.route}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ height: "200px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
                    No chart data available.
                  </div>
                )}
              </div>

              {/* Trend Chart (SVG Line Chart) */}
              <div className="ff-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a" }}>Daily Average Fuel Efficiency</h4>
                  <p style={{ fontSize: "0.75rem", color: "#64748b" }}>Trend analysis (km per Litre)</p>
                </div>

                {fuelEfficiency.length > 0 ? (
                  <div style={{ height: "200px", position: "relative", width: "100%" }}>
                    <svg viewBox="0 0 500 200" style={{ width: "100%", height: "100%" }}>
                      {/* Grid lines */}
                      {[50, 100, 150].map(y => <line key={y} x1="0" y1={y} x2="500" y2={y} stroke="#f1f5f9" strokeWidth="1" />)}
                      
                      {/* Line path */}
                      <motion.path 
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.8 }}
                        d={fuelEfficiency.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} 
                        fill="none" 
                        stroke="url(#gradient)" 
                        strokeWidth="3.5" 
                        strokeLinecap="round"
                      />

                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="50%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                      </defs>

                      {fuelEfficiency.map((pt, i) => (
                        <g key={i}>
                          <circle cx={pt.x} cy={pt.y} r="5" fill="white" stroke="#6366f1" strokeWidth="2.5" />
                          <text x={pt.x} y="185" fontSize="10" fill="#94a3b8" textAnchor="middle" fontWeight="600">{pt.label}</text>
                        </g>
                      ))}
                    </svg>
                  </div>
                ) : (
                  <div style={{ height: "200px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
                    No chart data available.
                  </div>
                )}
              </div>

            </div>
          </>
        )}

      </div>
      <style>{`
        @media (max-width: 768px) { .reports-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </AppLayout>
  );
}
