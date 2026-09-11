import React, { useEffect, useState, useCallback } from "react";
import Layout from "../components/layout/Layout";
import {
  getFleetUtilization,
  getDriverPerformance,
  getDeliveryPerformance,
  getMaintenanceAnalytics,
  getAdminSummary,
} from "../api/analyticsApi";
import {
  getFleetSummaryPdf,
  getMaintenanceCostPdf,
  getFuelReportPdf,
} from "../api/reportsApi";
import { useAuth } from "../context/AuthContext";

// Simple Bar/Donut Chart replacements using CSS
function ProgressBar({ pct, color }) {
  return (
    <div style={{ height: 8, background: "rgba(255,255,255,0.07)", borderRadius: 99, flex: 1 }}>
      <div style={{
        height: "100%", width: `${pct}%`,
        background: color, borderRadius: 99,
      }} />
    </div>
  );
}

export default function Analytics() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("fleet"); // fleet, logistics, admin
  const [loading, setLoading] = useState(true);

  // Data states
  const [fleetData, setFleetData] = useState(null);
  const [logisticsData, setLogisticsData] = useState(null);
  const [adminData, setAdminData] = useState(null);
  const [driverData, setDriverData] = useState(null);
  const [maintenanceData, setMaintenanceData] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "fleet") {
        const [f, m] = await Promise.all([getFleetUtilization(), getMaintenanceAnalytics()]);
        setFleetData(f);
        setMaintenanceData(m);
      } else if (activeTab === "logistics") {
        const l = await getDeliveryPerformance();
        setLogisticsData(l);
      } else if (activeTab === "admin" && user?.role === "Admin") {
        const [a, d] = await Promise.all([getAdminSummary(), getDriverPerformance()]);
        setAdminData(a);
        setDriverData(d);
      }
    } catch (err) {
      if (err?.response?.status === 403) {
        console.warn("Analytics: 403 Forbidden — user role is not authorized for this section.");
      } else {
        console.error("Analytics fetch error:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (user && user.role !== "Admin" && activeTab === "admin") {
      setActiveTab("fleet");
    }
  }, [user, activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const renderFleetTab = () => {
    if (!fleetData || !maintenanceData) return <div style={loaderStyle}>Loading...</div>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={gridStyle(3)}>
          <StatCard title="Total Vehicles" value={fleetData.total_vehicles} color="#3b82f6" />
          <StatCard title="Fleet Utilization" value={`${fleetData.utilization_percent}%`} color="#10b981" />
          <StatCard title="Upcoming Maintenance" value={maintenanceData.upcoming_7_days} color="#f59e0b" />
        </div>

        <div style={gridStyle(2)}>
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>Vehicle Status Breakdown</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Object.entries(fleetData.by_status).map(([status, count]) => (
                <div key={status} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 100, color: "rgba(255,255,255,0.7)", fontSize: "0.85rem" }}>{status}</span>
                  <ProgressBar pct={(count / fleetData.total_vehicles) * 100 || 0} color="#6366f1" />
                  <span style={{ fontWeight: 600 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>Maintenance Health</h3>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={miniStat}>
                <div style={{ color: "#ef4444", fontSize: "1.5rem", fontWeight: 800 }}>{maintenanceData.overdue}</div>
                <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>Overdue</div>
              </div>
              <div style={miniStat}>
                <div style={{ color: "#10b981", fontSize: "1.5rem", fontWeight: 800 }}>{maintenanceData.completed}</div>
                <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>Completed</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLogisticsTab = () => {
    if (!logisticsData) return <div style={loaderStyle}>Loading...</div>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={gridStyle(4)}>
          <StatCard title="Total Shipments" value={logisticsData.total_shipments} color="#3b82f6" />
          <StatCard title="On-Time Rate" value={`${logisticsData.on_time_rate_percent ?? 0}%`} color="#10b981" />
          <StatCard title="Avg Delivery (hrs)" value={logisticsData.avg_delivery_hours ?? 0} color="#8b5cf6" />
          <StatCard title="Delayed" value={logisticsData.delayed} color="#ef4444" />
        </div>
        
        <div style={gridStyle(2)}>
           <div style={cardStyle}>
            <h3 style={cardTitleStyle}>Shipment Pipeline</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
               {[
                 { label: "Created", val: logisticsData.created, color: "#9ca3af" },
                 { label: "Assigned", val: logisticsData.assigned, color: "#3b82f6" },
                 { label: "In Transit", val: logisticsData.in_transit, color: "#f59e0b" },
                 { label: "Delivered", val: logisticsData.delivered, color: "#10b981" },
                 { label: "Cancelled", val: logisticsData.cancelled, color: "#ef4444" },
               ].map((item) => (
                 <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 100, color: "rgba(255,255,255,0.7)", fontSize: "0.85rem" }}>{item.label}</span>
                  <ProgressBar pct={(item.val / logisticsData.total_shipments) * 100 || 0} color={item.color} />
                  <span style={{ fontWeight: 600 }}>{item.val}</span>
                </div>
               ))}
            </div>
           </div>
        </div>
      </div>
    );
  };

  const renderAdminTab = () => {
    if (user?.role !== "Admin") {
      return (
        <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
          Admin Dashboard requires Administrator role.
        </div>
      );
    }
    if (!adminData || !driverData) return <div style={loaderStyle}>Loading...</div>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={gridStyle(3)}>
          <StatCard title="Total Users" value={adminData.total_users} color="#6366f1" />
          <StatCard title="Operational Cost" value={`₹${adminData.total_operational_cost.toLocaleString()}`} color="#ef4444" />
          <StatCard title="Total Fuel Cost" value={`₹${adminData.total_fuel_cost.toLocaleString()}`} color="#f59e0b" />
        </div>

        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Driver Performance</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left" }}>
                <th style={{ padding: "12px 8px", color: "rgba(255,255,255,0.5)" }}>Driver Name</th>
                <th style={{ padding: "12px 8px", color: "rgba(255,255,255,0.5)" }}>License</th>
                <th style={{ padding: "12px 8px", color: "rgba(255,255,255,0.5)" }}>Completed Trips</th>
                <th style={{ padding: "12px 8px", color: "rgba(255,255,255,0.5)" }}>On-Time Rate</th>
              </tr>
            </thead>
            <tbody>
              {driverData.map((d) => (
                <tr key={d.driver_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "12px 8px", fontWeight: 600 }}>{d.full_name}</td>
                  <td style={{ padding: "12px 8px" }}>{d.license_number}</td>
                  <td style={{ padding: "12px 8px" }}>{d.completed_trips}</td>
                  <td style={{ padding: "12px 8px", color: d.on_time_rate_percent >= 80 ? "#10b981" : "#f59e0b" }}>
                    {d.on_time_rate_percent ?? 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (type) => {
    setDownloading(true);
    try {
      if (type === "fleet") await getFleetSummaryPdf();
      else if (type === "maintenance") await getMaintenanceCostPdf();
      else if (type === "fuel") await getFuelReportPdf();
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to download PDF report. Ensure backend is running and ReportLab is installed.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Layout>
      <div style={{ padding: "24px 32px", minHeight: "100vh" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 800 }}>📊 Analytics & Reports</h1>
            <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.6)", fontSize: "0.85rem" }}>
              Real-time operational intelligence and exportable audit reports
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => handleDownload("fleet")}
              disabled={downloading}
              style={pdfBtnStyle}
              title="Download Fleet Summary PDF"
            >
              📄 {downloading ? "Generating..." : "Fleet Summary PDF"}
            </button>
            <button
              onClick={() => handleDownload("maintenance")}
              disabled={downloading}
              style={{ ...pdfBtnStyle, background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
              title="Download Maintenance Cost PDF"
            >
              🛠 {downloading ? "Generating..." : "Maintenance Cost PDF"}
            </button>
            <button
              onClick={() => handleDownload("fuel")}
              disabled={downloading}
              style={{ ...pdfBtnStyle, background: "linear-gradient(135deg, #10b981, #059669)" }}
              title="Download Fuel Analytics PDF"
            >
              ⛽ {downloading ? "Generating..." : "Fuel Report PDF"}
            </button>
          </div>
        </div>
        
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          {["fleet", "logistics", ...(user?.role === "Admin" ? ["admin"] : [])].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? "#6366f1" : "rgba(30,41,59,0.8)",
                color: activeTab === tab ? "#fff" : "rgba(255,255,255,0.6)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                padding: "10px 24px", cursor: "pointer", fontWeight: 700,
                textTransform: "capitalize"
              }}
            >
              {tab} Dashboard
            </button>
          ))}
        </div>

        {activeTab === "fleet" && renderFleetTab()}
        {activeTab === "logistics" && renderLogisticsTab()}
        {activeTab === "admin" && renderAdminTab()}

      </div>
    </Layout>
  );
}

const pdfBtnStyle = {
  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "9px 16px",
  fontSize: "0.82rem",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
  transition: "all 0.2s ease",
};

function StatCard({ title, value, color }) {
  return (
    <div style={{
      background: "rgba(30,41,59,0.8)",
      border: `1px solid ${color}33`,
      borderRadius: 14, padding: "18px 22px",
    }}>
      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", marginBottom: 6 }}>{title}</div>
      <div style={{ color, fontSize: "2rem", fontWeight: 800 }}>{value}</div>
    </div>
  );
}

const gridStyle = (cols) => ({
  display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16
});

const cardStyle = {
  background: "rgba(30,41,59,0.85)", borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.07)", padding: "20px 24px",
};

const cardTitleStyle = { margin: "0 0 16px", fontSize: "1rem", color: "#f1f5f9" };

const miniStat = {
  background: "rgba(15,23,42,0.5)", borderRadius: 10, padding: "16px", minWidth: 120, textAlign: "center"
};

const loaderStyle = { padding: 40, textAlign: "center", color: "rgba(255,255,255,0.4)" };
