import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Package2, Route, Clock, CheckCircle2, AlertTriangle, Truck, MapPin, Navigation, Compass, ExternalLink, Eye, Filter } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";

export default function LogisticsDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [gpsData, setGpsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const mapInstanceRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [logRes, shipRes, gpsRes] = await Promise.all([
          api.get("/analytics/logistics-dashboard"),
          api.get("/shipments"),
          api.get("/gps/tracking").catch(() => ({ data: [] }))
        ]);
        setData(logRes.data);
        setShipments(Array.isArray(shipRes.data) ? shipRes.data : []);
        setGpsData(Array.isArray(gpsRes.data) ? gpsRes.data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const shipmentLocations = data?.shipment_locations || [];

  const filteredLocations = shipmentLocations.filter(s => {
    if (statusFilter === "ALL") return true;
    return s.status?.toUpperCase() === statusFilter.toUpperCase();
  });

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (loading || !filteredLocations) return;

    // Load Leaflet CSS dynamically if missing
    if (!document.getElementById("leaflet-css")) {
      const css = document.createElement("link");
      css.id = "leaflet-css";
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
    }

    const initMap = () => {
      const L = window.L;
      if (!L) return;

      const container = document.getElementById("logistics-live-map");
      if (!container) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map("logistics-live-map", {
        center: [20.5937, 78.9629],
        zoom: 5,
        zoomControl: true
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
      }).addTo(map);

      const bounds = [];

      filteredLocations.forEach(s => {
        if (!s.current_lat || !s.current_lng) return;
        const pos = [s.current_lat, s.current_lng];
        bounds.push(pos);

        const colorMap = {
          "In Transit": "#6366f1",
          "Assigned": "#3b82f6",
          "Delayed": "#ef4444",
          "Delivered": "#10b981",
          "Created": "#f59e0b"
        };
        const color = colorMap[s.status] || "#6366f1";

        const isDelivered = s.status === "Delivered" || s.status === "Completed";
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

      mapInstanceRef.current = map;
    };

    if (!window.L) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      initMap();
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [loading, statusFilter, shipmentLocations]);

  if (loading) {
    return (
      <AppLayout title="Logistics & Dispatch Control" subtitle="Loading live logistics operations stream...">
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "350px", flexDirection: "column", gap: "1rem" }}>
          <div className="ff-pulse-dot" style={{ width: "36px", height: "36px", background: "#6366f1" }} />
          <p style={{ fontSize: "0.875rem", color: "#64748b" }}>Connecting to Dispatch Stream...</p>
        </div>
      </AppLayout>
    );
  }

  const statusBk = data?.status_breakdown || { Created: 0, Assigned: 0, "In Transit": 0, Delayed: 0, Delivered: 0, Cancelled: 0 };
  const routeModes = data?.route_mode_counts || { fastest: 0, shortest: 0, traffic_avoidance: 0, fuel_efficient: 0 };

  return (
    <AppLayout title="Logistics & Dispatch Operations Control" subtitle="Real-time shipment tracking, current location map snapshot, delivery status breakdown, and route performance analytics.">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* KPI Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
          
          <div className="ff-card" style={{ padding: "1.25rem" }}>
            <p style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Total Shipments</p>
            <h4 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", marginTop: "0.25rem" }}>{data?.total_shipments || 0}</h4>
          </div>

          <div className="ff-card" style={{ padding: "1.25rem" }}>
            <p style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Active Shipments</p>
            <h4 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#2563eb", marginTop: "0.25rem" }}>{data?.active_shipments_count || 0}</h4>
          </div>

          <div className="ff-card" style={{ padding: "1.25rem" }}>
            <p style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>On-Time Delivery Rate</p>
            <h4 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#059669", marginTop: "0.25rem" }}>{data?.on_time_rate_pct || 100.0}%</h4>
          </div>

          <div className="ff-card" style={{ padding: "1.25rem" }}>
            <p style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>ETA Accuracy Score</p>
            <h4 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#8b5cf6", marginTop: "0.25rem" }}>{data?.eta_accuracy_pct || 94.5}%</h4>
          </div>

        </div>

        {/* Live Fleet Map Snapshot with Shipment Locations */}
        <div className="ff-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <MapPin size={18} color="#6366f1" />
                <h4 style={{ fontSize: "1.0625rem", fontWeight: 800, color: "#0f172a" }}>Live Fleet & Shipment Map Snapshot</h4>
              </div>
              <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.125rem" }}>
                Real-time current location pins for active customer shipments across India
              </p>
            </div>

            {/* Filter Pills */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", background: "#f8fafc", padding: "0.25rem", borderRadius: "0.625rem", border: "1px solid #e2e8f0" }}>
              {["ALL", "IN TRANSIT", "ASSIGNED", "DELAYED", "DELIVERED"].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: "0.3125rem 0.625rem",
                    borderRadius: "0.5rem",
                    border: "none",
                    background: statusFilter === st ? "#3b82f6" : "transparent",
                    color: statusFilter === st ? "white" : "#64748b",
                    fontWeight: 700,
                    fontSize: "0.6875rem",
                    cursor: "pointer"
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Leaflet Map Container */}
          <div
            id="logistics-live-map"
            style={{
              height: "360px",
              width: "100%",
              borderRadius: "0.875rem",
              border: "1.5px solid #cbd5e1",
              boxShadow: "0 4px 12px rgba(15,23,42,0.06)",
              overflow: "hidden"
            }}
          />

          {/* Current Shipment Location Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.875rem", marginTop: "0.5rem" }}>
            {filteredLocations.map(s => (
              <div
                key={s.shipment_id}
                onClick={() => navigate(`/shipments/${s.shipment_id}`)}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.75rem",
                  padding: "0.875rem",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.375rem",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "#3b82f6"}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "#e2e8f0"}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#6366f1" }}>#{s.tracking_number}</span>
                  <span style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    padding: "0.125rem 0.5rem",
                    borderRadius: "0.375rem",
                    background: s.status === "In Transit" ? "#e0e7ff" : s.status === "Delivered" ? "#dcfce7" : s.status === "Delayed" ? "#fff1f2" : "#f1f5f9",
                    color: s.status === "In Transit" ? "#4338ca" : s.status === "Delivered" ? "#15803d" : s.status === "Delayed" ? "#e11d48" : "#475569"
                  }}>
                    {s.status}
                  </span>
                </div>

                <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0f172a" }}>
                  {s.customer_name}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", color: "#475569" }}>
                  <MapPin size={12} color="#059669" />
                  <span style={{ fontWeight: 600 }}>Current Location:</span>
                  <span>{s.current_location_name}</span>
                </div>

                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  Route: {s.source} → {s.destination}
                </div>

                <div style={{ fontSize: "0.75rem", color: "#64748b", display: "flex", justifyContent: "space-between", marginTop: "0.25rem" }}>
                  <span>Vehicle: <strong style={{ color: "#334155" }}>{s.vehicle_reg}</strong></span>
                  <span style={{ color: "#2563eb", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.125rem" }}>View Map <Eye size={12} /></span>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Middle Section: Delivery Status Breakdown & Route Performance */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }} className="dashboard-grid">
          
          {/* Delivery Status Breakdown */}
          <div className="ff-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a" }}>Delivery Status Breakdown</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "0.75rem", borderRadius: "0.5rem" }}>
                <span style={{ fontSize: "0.6875rem", color: "#64748b", fontWeight: 700 }}>Created</span>
                <p style={{ fontSize: "1.25rem", fontWeight: 800, color: "#475569" }}>{statusBk.Created}</p>
              </div>
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "0.75rem", borderRadius: "0.5rem" }}>
                <span style={{ fontSize: "0.6875rem", color: "#1d4ed8", fontWeight: 700 }}>Assigned</span>
                <p style={{ fontSize: "1.25rem", fontWeight: 800, color: "#2563eb" }}>{statusBk.Assigned}</p>
              </div>
              <div style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", padding: "0.75rem", borderRadius: "0.5rem" }}>
                <span style={{ fontSize: "0.6875rem", color: "#6d28d9", fontWeight: 700 }}>In Transit</span>
                <p style={{ fontSize: "1.25rem", fontWeight: 800, color: "#7c3aed" }}>{statusBk["In Transit"]}</p>
              </div>
              <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", padding: "0.75rem", borderRadius: "0.5rem" }}>
                <span style={{ fontSize: "0.6875rem", color: "#be123c", fontWeight: 700 }}>Delayed</span>
                <p style={{ fontSize: "1.25rem", fontWeight: 800, color: "#e11d48" }}>{statusBk.Delayed}</p>
              </div>
              <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "0.75rem", borderRadius: "0.5rem" }}>
                <span style={{ fontSize: "0.6875rem", color: "#047857", fontWeight: 700 }}>Delivered</span>
                <p style={{ fontSize: "1.25rem", fontWeight: 800, color: "#059669" }}>{statusBk.Delivered}</p>
              </div>
              <div style={{ background: "#fef2f2", border: "1px solid #fecdd3", padding: "0.75rem", borderRadius: "0.5rem" }}>
                <span style={{ fontSize: "0.6875rem", color: "#991b1b", fontWeight: 700 }}>Cancelled</span>
                <p style={{ fontSize: "1.25rem", fontWeight: 800, color: "#dc2626" }}>{statusBk.Cancelled}</p>
              </div>
            </div>
          </div>

          {/* Route Performance & Route Modes */}
          <div className="ff-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a" }}>Route Mode Performance</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {Object.entries(routeModes).map(([mode, cnt]) => (
                <div key={mode} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem", background: "#f8fafc", borderRadius: "0.5rem", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#334155", textTransform: "capitalize" }}>{mode.replace('_', ' ')} Route</span>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#6366f1" }}>{cnt} trips</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Active Shipments Queue Table */}
        <div className="ff-card" style={{ padding: "1.5rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginBottom: "1rem" }}>Active Dispatch Queue</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Tracking #", "Customer", "Route", "Carrier Vehicle", "Status"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "0.625rem 0.875rem", color: "#94a3b8", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shipments.map(s => (
                  <tr key={s.shipment_id} style={{ borderBottom: "1px solid #f8fafc", cursor: "pointer" }} onClick={() => navigate(`/shipments/${s.shipment_id}`)}>
                    <td style={{ padding: "0.875rem", fontWeight: 700, color: "#6366f1" }}>#{s.tracking_number}</td>
                    <td style={{ padding: "0.875rem", fontWeight: 600, color: "#0f172a" }}>{s.customer_name}</td>
                    <td style={{ padding: "0.875rem", color: "#475569" }}>{s.source} → {s.destination}</td>
                    <td style={{ padding: "0.875rem", color: "#475569" }}>{s.vehicle_reg || "Unassigned"}</td>
                    <td style={{ padding: "0.875rem" }}>
                      <span style={{
                        background: s.status === "In Transit" ? "#e0e7ff" : s.status === "Delivered" ? "#dcfce7" : s.status === "Delayed" ? "#fff1f2" : "#f1f5f9",
                        color: s.status === "In Transit" ? "#4338ca" : s.status === "Delivered" ? "#15803d" : s.status === "Delayed" ? "#e11d48" : "#475569",
                        padding: "0.25rem 0.625rem", borderRadius: "0.5rem", fontSize: "0.75rem", fontWeight: 700
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

      </div>
    </AppLayout>
  );
}
