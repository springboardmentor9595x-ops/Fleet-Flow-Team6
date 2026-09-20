import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck, Users, Truck, Package2, Route, Wrench, Fuel, BarChart2,
  AlertCircle, Activity, TrendingUp, PieChart, Gauge, Navigation, Compass,
  ArrowUpRight, CheckCircle2, Clock, MapPin, UserCheck, Layers, Award
} from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function AdminDashboard() {
  const [dashboardMode, setDashboardMode] = useState("admin"); // "admin", "fleet", "logistics"
  const [data, setData] = useState(null);
  const [maintCost, setMaintCost] = useState(null);
  const [fleetData, setFleetData] = useState(null);
  const [logisticsData, setLogisticsData] = useState(null);
  const [loading, setLoading] = useState(true);

  const adminMapRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [adminRes, mntRes, fleetRes, logRes] = await Promise.all([
          api.get("/analytics/admin-dashboard"),
          api.get("/analytics/maintenance-cost").catch(() => ({ data: { total_maintenance_cost: 0, cost_by_type: [] } })),
          api.get("/analytics/fleet-dashboard").catch(() => ({ data: null })),
          api.get("/analytics/logistics-dashboard").catch(() => ({ data: null }))
        ]);
        setData(adminRes.data);
        setMaintCost(mntRes.data);
        setFleetData(fleetRes.data);
        setLogisticsData(logRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Leaflet map initialization for Logistics Dashboard view in Admin Portal
  useEffect(() => {
    if (dashboardMode !== "logistics" || loading || !logisticsData) return;

    const locations = logisticsData?.shipment_locations || [];

    if (!document.getElementById("leaflet-css")) {
      const css = document.createElement("link");
      css.id = "leaflet-css";
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
    }

    const initAdminMap = () => {
      const L = window.L;
      if (!L) return;

      const container = document.getElementById("admin-logistics-live-map");
      if (!container) return;

      if (adminMapRef.current) {
        adminMapRef.current.remove();
        adminMapRef.current = null;
      }

      const map = L.map("admin-logistics-live-map", {
        center: [20.5937, 78.9629],
        zoom: 5,
        zoomControl: true
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
      }).addTo(map);

      const bounds = [];

      locations.forEach(s => {
        if (!s.current_lat || !s.current_lng) return;
        const pos = [s.current_lat, s.current_lng];
        bounds.push(pos);

        const isDelivered = s.status === "Delivered" || s.status === "Completed";
        const colorMap = {
          "In Transit": "#6366f1",
          "Assigned": "#3b82f6",
          "Delayed": "#ef4444",
          "Delivered": "#10b981",
          "Completed": "#10b981",
          "Created": "#f59e0b"
        };
        const color = colorMap[s.status] || "#6366f1";
        const symbol = isDelivered ? "🏁" : "📦";

        const icon = L.divIcon({
          className: "custom-shipment-pin",
          html: `<div style="background-color: ${color}; width: 26px; height: 26px; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 12px ${color}; cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; font-size: 13px; font-weight: bold;">${symbol}</div>`
        });

        const popupContent = `
          <div style="font-family: sans-serif; padding: 4px; min-width: 190px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
              <strong style="color: #6366f1; font-size: 13px;">#${s.tracking_number}</strong>
              <span style="font-size: 10px; font-weight: 700; color: white; background: ${color}; padding: 2px 6px; border-radius: 4px;">${s.status}</span>
            </div>
            <div style="font-size: 12px; color: #0f172a; font-weight: 600; margin-bottom: 3px;">
              ${s.customer_name}
            </div>
            <div style="font-size: 11px; color: #475569; margin-bottom: 3px;">
              📍 <strong>Location:</strong> ${s.current_location_name}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">
              🛣️ <strong>Route:</strong> ${s.source} → ${s.destination}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
              🚚 <strong>Vehicle:</strong> ${s.vehicle_reg}
            </div>
            <a href="/shipments/${s.shipment_id}" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;">Track Shipment →</a>
          </div>
        `;

        L.marker(pos, { icon }).addTo(map).bindPopup(popupContent);
      });

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
      }

      adminMapRef.current = map;
    };

    if (!window.L) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = initAdminMap;
      document.head.appendChild(script);
    } else {
      initAdminMap();
    }

    return () => {
      if (adminMapRef.current) {
        adminMapRef.current.remove();
        adminMapRef.current = null;
      }
    };
  }, [dashboardMode, loading, logisticsData]);

  if (loading) {
    return (
      <AppLayout title="Admin Dashboard" subtitle="Connecting to Admin Dashboard...">
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "350px", flexDirection: "column", gap: "1rem" }}>
          <div className="ff-pulse-dot" style={{ width: "36px", height: "36px", background: "#6366f1" }} />
          <p style={{ fontSize: "0.875rem", color: "#64748b" }}>Loading System Metrics...</p>
        </div>
      </AppLayout>
    );
  }

  const sysSummary = data?.system_summary || { total_users: 0, total_drivers: 0, total_vehicles: 0, total_shipments: 0, total_trips: 0 };
  const driverLeaderboard = data?.driver_leaderboard || [];
  const attentionShipments = data?.attention_shipments || [];

  // Graph 1: Trips Status (Bar Chart)
  const tripsStatusData = data?.trips_status_breakdown || { Scheduled: 0, "In Transit": 0, Completed: 0 };
  const barChartData = {
    labels: ["Scheduled", "In Transit", "Completed"],
    datasets: [
      {
        label: "Trips Count",
        data: [
          tripsStatusData.Scheduled || 0,
          tripsStatusData["In Transit"] || 0,
          tripsStatusData.Completed || 0
        ],
        backgroundColor: ["#f59e0b", "#6366f1", "#10b981"],
        borderRadius: 8,
        barThickness: 32
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { cornerRadius: 8 }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "rgba(148, 163, 184, 0.1)" },
        ticks: { stepSize: 1 }
      },
      x: {
        grid: { display: false }
      }
    }
  };

  // Graph 2: Shipment Status (Donut / Pie Chart)
  const shipmentStatusData = data?.shipment_status_breakdown || { Created: 0, Assigned: 0, "In Transit": 0, Delivered: 0, Cancelled: 0 };
  const doughnutChartData = {
    labels: ["Created", "Assigned", "In Transit", "Delivered", "Cancelled"],
    datasets: [
      {
        label: "Shipments",
        data: [
          shipmentStatusData.Created || 0,
          shipmentStatusData.Assigned || 0,
          shipmentStatusData["In Transit"] || 0,
          shipmentStatusData.Delivered || 0,
          shipmentStatusData.Cancelled || 0
        ],
        backgroundColor: ["#0284c7", "#3b82f6", "#8b5cf6", "#10b981", "#ef4444"],
        borderWidth: 2,
        borderColor: "#ffffff"
      }
    ]
  };

  const doughnutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "68%",
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 12, padding: 12, font: { size: 11, weight: 600 } }
      }
    }
  };

  // Graph 3: Trips Over Time (Line Chart)
  const tripsTrend = data?.trips_over_time || [];
  const lineChartData = {
    labels: tripsTrend.map(t => t.date),
    datasets: [
      {
        label: "Fleet Trips",
        data: tripsTrend.map(t => t.trips),
        borderColor: "#6366f1",
        backgroundColor: "rgba(99, 102, 241, 0.12)",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#6366f1",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        pointRadius: 5
      }
    ]
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { cornerRadius: 8 }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "rgba(148, 163, 184, 0.1)" },
        ticks: { stepSize: 1 }
      },
      x: {
        grid: { display: false }
      }
    }
  };

  // System Analytics Data Helpers
  const sysAnalytics = data?.system_analytics || {
    users_role_breakdown: { Admin: 1, FleetManager: 1, Dispatcher: 1, Driver: 1, Manager: 1 },
    vehicle_type_breakdown: { Truck: 0, Van: 0, "Cargo Van": 0, Pickup: 0 },
    vehicle_status_breakdown: { Available: 0, Assigned: 0, "In Transit": 0, Maintenance: 0 },
    delivery_fulfillment_rate_pct: 100.0
  };

  // System Analytics Graph 1: User Roles Distribution (Doughnut Chart)
  const userRolesData = sysAnalytics.users_role_breakdown || {};
  const userRolesChartData = {
    labels: Object.keys(userRolesData),
    datasets: [
      {
        label: "User Accounts",
        data: Object.values(userRolesData),
        backgroundColor: ["#6366f1", "#3b82f6", "#8b5cf6", "#10b981", "#64748b"],
        borderWidth: 2,
        borderColor: "#ffffff"
      }
    ]
  };

  const userRolesChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "65%",
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 12, padding: 10, font: { size: 11, weight: 600 } }
      }
    }
  };

  // System Analytics Graph 2: Vehicle Register & Type Breakdown (Bar Chart)
  const vehicleTypeData = sysAnalytics.vehicle_type_breakdown || {};
  const vehicleRegisterChartData = {
    labels: Object.keys(vehicleTypeData).length > 0 ? Object.keys(vehicleTypeData) : ["Truck", "Van", "Cargo Van", "Pickup"],
    datasets: [
      {
        label: "Vehicles Count",
        data: Object.keys(vehicleTypeData).length > 0 ? Object.values(vehicleTypeData) : [0, 0, 0, 0],
        backgroundColor: "#2563eb",
        borderRadius: 6,
        barThickness: 28
      }
    ]
  };

  const vehicleRegisterChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { cornerRadius: 8 }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "rgba(148, 163, 184, 0.1)" },
        ticks: { stepSize: 1 }
      },
      x: { grid: { display: false } }
    }
  };

  // Fleet View Data Helpers
  const fleetStatusBk = fleetData?.status_breakdown || { Available: 0, Assigned: 0, "In Transit": 0, Maintenance: 0 };
  const fleetTypeBk = fleetData?.type_breakdown || {};
  const fuelSummary = fleetData?.fuel_summary || { total_cost_inr: 0, total_liters: 0, top_vehicles_by_cost: [] };
  const maintSummary = fleetData?.maintenance_summary || { overdue_count: 0, upcoming_count: 0, upcoming_list: [] };

  // Logistics View Data Helpers
  const logStatusCounts = logisticsData?.status_breakdown || { Created: 0, Assigned: 0, "In Transit": 0, Delayed: 0, Delivered: 0, Cancelled: 0 };
  const logRouteModes = logisticsData?.route_mode_counts || { fastest: 0, shortest: 0, traffic_avoidance: 0, fuel_efficient: 0 };
  const logLocations = logisticsData?.shipment_locations || [];

  return (
    <AppLayout
      title="Admin Dashboard"
      subtitle="Global fleet monitoring, driver performance metrics, system activity, and analytics."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* Dashboard Switcher Toggle Button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", background: "#f8fafc", padding: "0.5rem 0.875rem", borderRadius: "1rem", border: "1.5px solid rgba(15,23,42,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Activity size={18} color="#6366f1" />
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0f172a" }}>Switch Dashboard View:</span>
          </div>

          <div style={{ display: "flex", gap: "0.375rem", background: "#e2e8f0", padding: "0.25rem", borderRadius: "0.75rem" }}>
            
            {/* Admin Overview Toggle */}
            <button
              onClick={() => setDashboardMode("admin")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: "none",
                background: dashboardMode === "admin" ? "#ffffff" : "transparent",
                color: dashboardMode === "admin" ? "#6366f1" : "#475569",
                fontWeight: 700,
                fontSize: "0.8125rem",
                cursor: "pointer",
                boxShadow: dashboardMode === "admin" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease"
              }}
            >
              <ShieldCheck size={16} color={dashboardMode === "admin" ? "#6366f1" : "#64748b"} />
              <span>Admin Overview</span>
            </button>

            {/* Fleet Dashboard Toggle */}
            <button
              onClick={() => setDashboardMode("fleet")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: "none",
                background: dashboardMode === "fleet" ? "#ffffff" : "transparent",
                color: dashboardMode === "fleet" ? "#2563eb" : "#475569",
                fontWeight: 700,
                fontSize: "0.8125rem",
                cursor: "pointer",
                boxShadow: dashboardMode === "fleet" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease"
              }}
            >
              <Gauge size={16} color={dashboardMode === "fleet" ? "#2563eb" : "#64748b"} />
              <span>Fleet Dashboard</span>
            </button>

            {/* Logistics Dashboard Toggle */}
            <button
              onClick={() => setDashboardMode("logistics")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                border: "none",
                background: dashboardMode === "logistics" ? "#ffffff" : "transparent",
                color: dashboardMode === "logistics" ? "#0891b2" : "#475569",
                fontWeight: 700,
                fontSize: "0.8125rem",
                cursor: "pointer",
                boxShadow: dashboardMode === "logistics" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease"
              }}
            >
              <Navigation size={16} color={dashboardMode === "logistics" ? "#0891b2" : "#64748b"} />
              <span>Logistics Dashboard</span>
            </button>

          </div>
        </div>

        {/* ----------------------------------------------------
            MODE 1: ADMIN OVERVIEW
           ---------------------------------------------------- */}
        {dashboardMode === "admin" && (
          <>
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

            {/* 3 Main Operational Graphs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
              
              {/* Graph 1: Trips Status (Bar) */}
              <div className="ff-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <div>
                    <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      <BarChart2 size={16} color="#6366f1" />
                      <span>Trips Status</span>
                    </h3>
                    <p style={{ fontSize: "0.75rem", color: "#64748b" }}>Scheduled vs In Transit vs Completed</p>
                  </div>
                </div>
                <div style={{ height: "220px", position: "relative" }}>
                  <Bar data={barChartData} options={barChartOptions} />
                </div>
              </div>

              {/* Graph 2: Shipment Status (Donut / Pie) */}
              <div className="ff-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <div>
                    <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      <PieChart size={16} color="#0891b2" />
                      <span>Shipment Status</span>
                    </h3>
                    <p style={{ fontSize: "0.75rem", color: "#64748b" }}>Shipment lifecycle distribution</p>
                  </div>
                </div>
                <div style={{ height: "220px", position: "relative" }}>
                  <Doughnut data={doughnutChartData} options={doughnutChartOptions} />
                </div>
              </div>

              {/* Graph 3: Trips Over Time (Line) */}
              <div className="ff-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <div>
                    <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      <TrendingUp size={16} color="#10b981" />
                      <span>Trips Over Time</span>
                    </h3>
                    <p style={{ fontSize: "0.75rem", color: "#64748b" }}>Fleet activity/trend (Last 7 Days)</p>
                  </div>
                </div>
                <div style={{ height: "220px", position: "relative" }}>
                  <Line data={lineChartData} options={lineChartOptions} />
                </div>
              </div>

            </div>

            {/* ----------------------------------------------------
                SYSTEM ANALYTICS SECTION (Users, Vehicles, Shipment Delivery)
               ---------------------------------------------------- */}
            <div className="ff-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <h3 style={{ fontSize: "1.0625rem", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Layers size={20} color="#6366f1" />
                    <span>System Analytics & Role Distributions</span>
                  </h3>
                  <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.125rem" }}>
                    User role status, vehicle registration categories, and shipment delivery fulfillment metrics
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem" }}>
                
                {/* 1. User Roles & Status Distribution Graph */}
                <div style={{ background: "#f8fafc", borderRadius: "1rem", padding: "1.25rem", border: "1.5px solid rgba(15,23,42,0.06)", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <UserCheck size={16} color="#6366f1" />
                    <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0f172a" }}>User Accounts by Role</h4>
                  </div>
                  <div style={{ height: "180px", position: "relative" }}>
                    <Doughnut data={userRolesChartData} options={userRolesChartOptions} />
                  </div>
                </div>

                {/* 2. Vehicle Registration Breakdown Graph */}
                <div style={{ background: "#f8fafc", borderRadius: "1rem", padding: "1.25rem", border: "1.5px solid rgba(15,23,42,0.06)", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <Truck size={16} color="#2563eb" />
                    <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0f172a" }}>Vehicle Register by Category</h4>
                  </div>
                  <div style={{ height: "180px", position: "relative" }}>
                    <Bar data={vehicleRegisterChartData} options={vehicleRegisterChartOptions} />
                  </div>
                </div>

                {/* 3. Shipment Delivery Fulfillment Performance Card */}
                <div style={{ background: "#f8fafc", borderRadius: "1rem", padding: "1.25rem", border: "1.5px solid rgba(15,23,42,0.06)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <Award size={16} color="#059669" />
                      <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0f172a" }}>Shipment Delivery Analytics</h4>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "#64748b" }}>Order fulfillment score & status</p>

                    <div style={{ marginTop: "1rem" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#059669" }}>Delivery Fulfillment Rate</span>
                      <h3 style={{ fontSize: "2rem", fontWeight: 900, color: "#059669", marginTop: "0.125rem" }}>
                        {sysAnalytics.delivery_fulfillment_rate_pct}%
                      </h3>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                    <div style={{ flex: 1, background: "#ffffff", padding: "0.5rem", borderRadius: "0.5rem", border: "1px solid #e2e8f0", textAlign: "center" }}>
                      <span style={{ fontSize: "0.6875rem", color: "#64748b", fontWeight: 600 }}>Delivered</span>
                      <p style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#10b981" }}>{shipmentStatusData.Delivered || 0}</p>
                    </div>
                    <div style={{ flex: 1, background: "#ffffff", padding: "0.5rem", borderRadius: "0.5rem", border: "1px solid #e2e8f0", textAlign: "center" }}>
                      <span style={{ fontSize: "0.6875rem", color: "#64748b", fontWeight: 600 }}>In-Transit</span>
                      <p style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#6366f1" }}>{shipmentStatusData["In Transit"] || 0}</p>
                    </div>
                  </div>
                </div>

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
          </>
        )}

        {/* ----------------------------------------------------
            MODE 2: FLEET DASHBOARD VIEW
           ---------------------------------------------------- */}
        {dashboardMode === "fleet" && (
          <>
            {/* Top 4 Fleet KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
              
              <div className="ff-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>Active Fleet Vehicles</span>
                  <Truck size={18} color="#3b82f6" />
                </div>
                <h3 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a" }}>{fleetData?.total_vehicles || 0}</h3>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.75rem", color: "#475569" }}>
                  {Object.entries(fleetTypeBk).map(([t, cnt]) => (
                    <span key={t} style={{ background: "#f1f5f9", padding: "0.125rem 0.375rem", borderRadius: "0.375rem" }}>{t}: {cnt}</span>
                  ))}
                </div>
              </div>

              <div className="ff-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>Fleet Utilization Rate</span>
                  <TrendingUp size={18} color="#059669" />
                </div>
                <h3 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#059669" }}>{fleetData?.utilization_rate_pct || 0}%</h3>
                <span style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 500 }}><ArrowUpRight size={12} style={{ display: "inline" }} /> Active vs Available</span>
              </div>

              <div className="ff-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>Monthly Fuel Spend</span>
                  <Fuel size={18} color="#6366f1" />
                </div>
                <h3 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a" }}>₹{fuelSummary.total_cost_inr?.toLocaleString() || "0"}</h3>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{fuelSummary.total_liters} Liters consumed</span>
              </div>

              <div className="ff-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>Maintenance Alerts</span>
                  <Wrench size={18} color="#d97706" />
                </div>
                <h3 style={{ fontSize: "1.75rem", fontWeight: 700, color: maintSummary.overdue_count > 0 ? "#e11d48" : "#d97706" }}>
                  {maintSummary.upcoming_count} Due
                </h3>
                <span style={{ fontSize: "0.75rem", color: maintSummary.overdue_count > 0 ? "#e11d48" : "#64748b" }}>
                  {maintSummary.overdue_count} Overdue Services
                </span>
              </div>

            </div>

            {/* Vehicle Status Breakdown & Top Vehicles by Cost */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
              
              <div className="ff-card" style={{ padding: "1.5rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginBottom: "1rem" }}>Vehicle Availability Status</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {Object.entries(fleetStatusBk).map(([st, count]) => (
                    <div key={st} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.625rem 0.875rem", background: "#f8fafc", borderRadius: "0.625rem" }}>
                      <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#475569" }}>{st}</span>
                      <span style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>{count} vehicles</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ff-card" style={{ padding: "1.5rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginBottom: "1rem" }}>Top Vehicles by Fuel Cost</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {fuelSummary.top_vehicles_by_cost.length > 0 ? (
                    fuelSummary.top_vehicles_by_cost.map((v, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.625rem 0.875rem", background: "#f8fafc", borderRadius: "0.625rem" }}>
                        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#2563eb" }}>{v.registration_number}</span>
                        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#059669" }}>₹{v.total_cost_inr.toLocaleString()}</span>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: "0.8125rem", color: "#94a3b8", textAlign: "center", padding: "1rem" }}>No fuel records logged yet.</p>
                  )}
                </div>
              </div>

            </div>
          </>
        )}

        {/* ----------------------------------------------------
            MODE 3: LOGISTICS DASHBOARD VIEW
           ---------------------------------------------------- */}
        {dashboardMode === "logistics" && (
          <>
            {/* Top 4 Logistics KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
              
              <div className="ff-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>Total Shipments</span>
                  <Package2 size={18} color="#0891b2" />
                </div>
                <h3 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a" }}>{logisticsData?.total_shipments || 0}</h3>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Lifetime registered orders</span>
              </div>

              <div className="ff-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>Active Shipments</span>
                  <Compass size={18} color="#6366f1" />
                </div>
                <h3 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#6366f1" }}>{logisticsData?.active_shipments_count || 0}</h3>
                <span style={{ fontSize: "0.75rem", color: "#6366f1", fontWeight: 600 }}>In-Transit & Assigned</span>
              </div>

              <div className="ff-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>On-Time Rate</span>
                  <CheckCircle2 size={18} color="#059669" />
                </div>
                <h3 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#059669" }}>{logisticsData?.on_time_rate_pct || 100}%</h3>
                <span style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 500 }}>Schedule Compliance</span>
              </div>

              <div className="ff-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>ETA Accuracy</span>
                  <Clock size={18} color="#d97706" />
                </div>
                <h3 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#d97706" }}>{logisticsData?.eta_accuracy_pct || 94.5}%</h3>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>AI Route Estimations</span>
              </div>

            </div>

            {/* Live Tracking Map Component with Completed Destination Markers */}
            <div className="ff-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <MapPin size={18} color="#6366f1" />
                    <h4 style={{ fontSize: "1.0625rem", fontWeight: 800, color: "#0f172a" }}>Live Tracking & Completed Destination Map</h4>
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.125rem" }}>
                    Real-time position markers for active in-transit shipments and 🏁 completed shipments pinned at their destination location
                  </p>
                </div>
              </div>

              <div
                id="admin-logistics-live-map"
                style={{
                  height: "380px",
                  width: "100%",
                  borderRadius: "1rem",
                  border: "1.5px solid rgba(15,23,42,0.08)",
                  zIndex: 1
                }}
              />
            </div>

            {/* Shipment Lifecycle & Route Modes */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
              
              <div className="ff-card" style={{ padding: "1.5rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginBottom: "1rem" }}>Shipment Lifecycle Breakdown</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                  {Object.entries(logStatusCounts).map(([st, cnt]) => (
                    <div key={st} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem", background: "#f8fafc", borderRadius: "0.5rem" }}>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#475569" }}>{st}</span>
                      <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0f172a" }}>{cnt}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ff-card" style={{ padding: "1.5rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginBottom: "1rem" }}>Smart Route Modes Used</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                  {Object.entries(logRouteModes).map(([mode, cnt]) => (
                    <div key={mode} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem", background: "#f8fafc", borderRadius: "0.5rem" }}>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#475569", textTransform: "capitalize" }}>{mode.replace("_", " ")}</span>
                      <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#2563eb" }}>{cnt} trips</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Active Shipments Live Table */}
            <div className="ff-card" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginBottom: "1rem" }}>Shipments & Destination Status Table</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={{ padding: "0.625rem", textAlign: "left", color: "#94a3b8" }}>Tracking #</th>
                      <th style={{ padding: "0.625rem", textAlign: "left", color: "#94a3b8" }}>Customer</th>
                      <th style={{ padding: "0.625rem", textAlign: "left", color: "#94a3b8" }}>Route</th>
                      <th style={{ padding: "0.625rem", textAlign: "left", color: "#94a3b8" }}>Vehicle</th>
                      <th style={{ padding: "0.625rem", textAlign: "left", color: "#94a3b8" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logLocations.map((s, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.625rem", fontWeight: 700, color: "#6366f1" }}>#{s.tracking_number}</td>
                        <td style={{ padding: "0.625rem", fontWeight: 600 }}>{s.customer_name}</td>
                        <td style={{ padding: "0.625rem", color: "#475569" }}>{s.source} → {s.destination}</td>
                        <td style={{ padding: "0.625rem", color: "#475569" }}>{s.vehicle_reg}</td>
                        <td style={{ padding: "0.625rem" }}>
                          <span style={{
                            background: s.status === "Delivered" || s.status === "Completed" ? "#dcfce7" : "#e0e7ff",
                            color: s.status === "Delivered" || s.status === "Completed" ? "#15803d" : "#4338ca",
                            padding: "0.25rem 0.5rem",
                            borderRadius: "0.375rem",
                            fontWeight: 700,
                            fontSize: "0.75rem"
                          }}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
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
