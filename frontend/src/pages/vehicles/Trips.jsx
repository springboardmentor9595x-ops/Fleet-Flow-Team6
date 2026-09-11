import React, { useEffect, useState, useCallback, useRef } from "react";
import Layout from "../../components/layout/Layout";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import {
  getTrips,
  addTrip,
  startTrip,
  endTrip,
  deleteTrip,
  optimizeRoute,
  recalculateRoute,
} from "../../api/tripsApi";
import { getShipments } from "../../api/shipmentApi";
import { getVehicles } from "../../api/vehicle";
import { getDrivers } from "../../api/driversApi";
import useGPSWebSocket from "../../hooks/useGPSWebSocket";

// Fix leaflet marker icon issue with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const DEFAULT_ROUTE_OPTIONS = {
  Fastest: { distance: 214.59, duration: 2.8, delay: "+2m delay" },
  Shortest: { distance: 206.01, duration: 3.2, delay: "+5m delay" },
  "Traffic Avoidance": { distance: 231.76, duration: 3.0, delay: "Clear" },
  "Fuel-Efficient": { distance: 212.44, duration: 3.0, delay: "+1m delay" },
};

const STATUS_COLOR = {
  Scheduled: "#3b82f6",
  "In Transit": "#10b981",
  Completed: "#10b981",
  Cancelled: "#ef4444",
};

function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] || "#6b7280";
  return (
    <span
      style={{
        background: `${color}22`,
        color: color,
        border: `1px solid ${color}44`,
        borderRadius: 12,
        padding: "4px 12px",
        fontSize: "0.75rem",
        fontWeight: 700,
      }}
    >
      {status}
    </span>
  );
}

function MapUpdater({ geometry, startCoords, destCoords }) {
  const map = useMap();
  useEffect(() => {
    try {
      if (geometry && geometry.length > 1) {
        map.fitBounds(geometry, { padding: [40, 40] });
      } else if (startCoords && destCoords) {
        map.fitBounds([startCoords, destCoords], { padding: [40, 40] });
      } else if (startCoords) {
        map.setView(startCoords, 8);
      }
    } catch (_) {}
  }, [geometry, startCoords, destCoords, map]);
  return null;
}

function RouteMap({ geometry, startCoords, destCoords, liveGps, selectedTrip }) {
  const mapCenter = startCoords || (geometry?.[0]) || (liveGps?.latitude && liveGps?.longitude ? [liveGps.latitude, liveGps.longitude] : [15.8497, 74.4977]);

  return (
    <div style={{ position: "relative", width: "100%", height: 380, borderRadius: 16, overflow: "hidden", marginTop: 16 }}>
      <MapContainer
        center={mapCenter}
        zoom={7}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />
        <MapUpdater geometry={geometry} startCoords={startCoords} destCoords={destCoords} />
        {geometry && geometry.length > 1 && (
          <Polyline positions={geometry} color="#06b6d4" weight={5} opacity={0.85} />
        )}
        {startCoords && (
          <Marker position={startCoords}>
            <Popup>
              <strong>Start:</strong> {selectedTrip?.start_location || "Origin"}
            </Popup>
          </Marker>
        )}
        {destCoords && (
          <Marker position={destCoords}>
            <Popup>
              <strong>Destination:</strong> {selectedTrip?.destination || "Destination"}
            </Popup>
          </Marker>
        )}
        {liveGps?.latitude && liveGps?.longitude && (
          <Marker position={[liveGps.latitude, liveGps.longitude]}>
            <Popup>Live Vehicle Position</Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Floating Live GPS HUD */}
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 1000,
          background: "rgba(15, 23, 42, 0.85)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 14,
          padding: "14px 18px",
          color: "#fff",
          minWidth: 170,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: "0.85rem", fontWeight: 700, color: "#10b981" }}>
          <span style={{ height: 8, width: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 10px #10b981" }} />
          Live GPS HUD
        </div>
        <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.7)", display: "flex", flexDirection: "column", gap: 4 }}>
          <div>Lat: <span style={{ color: "#fff", fontWeight: 600 }}>{liveGps?.latitude ? liveGps.latitude.toFixed(4) : "16.9437"}</span></div>
          <div>Lng: <span style={{ color: "#fff", fontWeight: 600 }}>{liveGps?.longitude ? liveGps.longitude.toFixed(4) : "82.2351"}</span></div>
          <div>Speed: <span style={{ color: "#fff", fontWeight: 600 }}>{liveGps?.speed != null ? `${liveGps.speed} km/h` : "0 km/h"}</span></div>
          <div>Dist: <span style={{ color: "#fff", fontWeight: 600 }}>{selectedTrip?.distance ? `${selectedTrip.distance} km` : "218.6 km"}</span></div>
          <div>ETA: <span style={{ color: "#fff", fontWeight: 600 }}>{selectedTrip?.eta ? new Date(selectedTrip.eta).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "5:54:55 pm"}</span></div>
        </div>
      </div>
    </div>
  );
}

const emptyForm = {
  shipment_id: "",
  vehicle_id: "",
  driver_id: "",
  start_location: "",
  destination: "",
  route_type: "Fastest",
  waypoints: [],
};

export default function Trips() {
  const [trips, setTrips] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [waypointInputs, setWaypointInputs] = useState([""]);
  const [saving, setSaving] = useState(false);
  const [topError, setTopError] = useState("");
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState("Fastest");
  const [routeDataMap, setRouteDataMap] = useState({});
  const [isRerouting, setIsRerouting] = useState(false);

  // GPS Simulator State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simIndex, setSimIndex] = useState(0);
  const [simSpeed, setSimSpeed] = useState(1);
  const [simGps, setSimGps] = useState(null);
  const simTimerRef = useRef(null);

  const { gpsData } = useGPSWebSocket();

  const loadData = useCallback(async () => {
    try {
      const [t, s, v, d] = await Promise.all([
        getTrips(),
        getShipments(),
        getVehicles(),
        getDrivers(),
      ]);
      setTrips(t);
      setShipments(s);
      setVehicles(v);
      setDrivers(d);
      if (t.length > 0 && !selectedTripId) {
        setSelectedTripId(t[0].trip_id);
        if (t[0].route_type) setSelectedStrategy(t[0].route_type);
      }
    } catch (err) {
      console.error("Error loading trips data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedTripId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeTrip = trips.find((t) => t.trip_id === selectedTripId) || trips[0];

  const handleStrategyChange = async (strategy) => {
    setSelectedStrategy(strategy);
    if (!activeTrip) return;
    try {
      const res = await optimizeRoute(activeTrip.trip_id, strategy);
      setRouteDataMap((prev) => ({ ...prev, [activeTrip.trip_id]: res }));
      await loadData();
    } catch (err) {
      console.error("Failed to set strategy:", err);
    }
  };

  const handleRecalculate = async () => {
    if (!activeTrip) return;
    setIsRerouting(true);
    try {
      const res = await recalculateRoute(activeTrip.trip_id);
      setRouteDataMap((prev) => ({ ...prev, [activeTrip.trip_id]: res }));
      await loadData();
    } catch (err) {
      console.error("Recalculation error:", err);
    } finally {
      setIsRerouting(false);
    }
  };

  const handleStart = async (tripId) => {
    setTopError("");
    try {
      await startTrip(tripId);
      await loadData();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg || d.message).join("; ") : "Failed to start trip.");
      setTopError(msg);
    }
  };

  const handleEnd = async (tripId) => {
    setTopError("");
    try {
      await endTrip(tripId);
      await loadData();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg || d.message).join("; ") : "Failed to complete trip.");
      setTopError(msg);
    }
  };

  const handleShipmentSelect = (shipmentId) => {
    const selectedShipment = shipments.find((s) => s.shipment_id === shipmentId);
    if (selectedShipment) {
      setForm((prev) => ({
        ...prev,
        shipment_id: shipmentId,
        start_location: selectedShipment.source || prev.start_location,
        destination: selectedShipment.destination || prev.destination,
        vehicle_id: selectedShipment.vehicle_id || prev.vehicle_id,
        driver_id: selectedShipment.driver_id || prev.driver_id,
      }));
    } else {
      setForm((prev) => ({ ...prev, shipment_id: shipmentId }));
    }
  };

  const handleDelete = async (tripId) => {
    if (!window.confirm("Delete this trip?")) return;
    setTopError("");
    try {
      await deleteTrip(tripId);
      if (selectedTripId === tripId) setSelectedTripId(null);
      await loadData();
    } catch (err) {
      setTopError("Failed to delete trip.");
    }
  };

  const handleAddWaypointInput = () => {
    setWaypointInputs((prev) => [...prev, ""]);
  };

  const handleWaypointChange = (index, value) => {
    setWaypointInputs((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleRemoveWaypointInput = (index) => {
    setWaypointInputs((prev) => prev.filter((_, i) => i !== index));
  };

  const currentRouteData = activeTrip ? (routeDataMap[activeTrip.trip_id] || activeTrip) : null;
  const currentOptions = currentRouteData?.route_options || DEFAULT_ROUTE_OPTIONS;

  // GPS Simulation Loop
  useEffect(() => {
    if (!isSimulating || !currentRouteData?.geometry || currentRouteData.geometry.length === 0) {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
      return;
    }

    const geom = currentRouteData.geometry;
    const intervalMs = Math.max(150, 1000 / simSpeed);

    simTimerRef.current = setInterval(() => {
      setSimIndex((prev) => {
        const next = prev + 1;
        if (next >= geom.length) {
          setIsSimulating(false);
          clearInterval(simTimerRef.current);
          return geom.length - 1;
        }
        const pt = geom[next];
        setSimGps({
          latitude: pt[0],
          longitude: pt[1],
          speed: Math.floor(55 + Math.sin(next) * 15),
        });
        return next;
      });
    }, intervalMs);

    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, [isSimulating, simSpeed, currentRouteData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setTopError("");
    if (!form.shipment_id || !form.vehicle_id || !form.driver_id || !form.start_location || !form.destination) {
      setTopError("All fields are required to schedule a trip.");
      return;
    }
    setSaving(true);
    try {
      const activeWaypoints = waypointInputs.filter((w) => w && w.trim().length > 0);
      const payload = {
        ...form,
        waypoints: activeWaypoints.length > 0 ? activeWaypoints : undefined,
      };
      const newTrip = await addTrip(payload);
      setShowModal(false);
      setForm(emptyForm);
      setWaypointInputs([""]);
      setSelectedTripId(newTrip.trip_id);
      await loadData();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      let msg = "Failed to schedule trip.";
      if (typeof detail === "string") {
        msg = detail;
      } else if (Array.isArray(detail)) {
        msg = detail.map((d) => d.msg || d.message || JSON.stringify(d)).join("; ");
      }
      setTopError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div style={{ padding: "20px 28px", color: "#f8fafc", minHeight: "100vh" }}>
        
        {/* Top Validation Banner Alert */}
        {topError && (
          <div
            style={{
              background: "rgba(220, 38, 38, 0.2)",
              border: "1px solid #ef4444",
              color: "#fca5a5",
              padding: "12px 20px",
              borderRadius: 10,
              fontSize: "0.88rem",
              fontWeight: 600,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>⚠️ {topError}</span>
            <button
              onClick={() => setTopError("")}
              style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: "1.1rem" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Main Grid Layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
          
          {/* Left Column: Trip Tracking & Map */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            
            {/* Tracking Top Header Card */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 16,
                padding: "20px 24px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#f8fafc" }}>
                    Trip Tracking - ID: {activeTrip?.trip_id ? activeTrip.trip_id.substring(0, 8) + "..." : "d570c271..."}
                  </h2>
                  <div style={{ color: "#a5f3fc", fontSize: "0.82rem", fontWeight: 700, marginTop: 4 }}>
                    Strategy: {selectedStrategy.toUpperCase()}
                  </div>
                </div>

                <button
                  onClick={handleRecalculate}
                  disabled={isRerouting || !activeTrip}
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    padding: "10px 18px",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: isRerouting ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(99, 102, 241, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: "1rem" }}>⚙</span>
                  {isRerouting ? "Recalculating..." : "Recalculate Route"}
                </button>
              </div>

              {/* Route Strategy Options Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.92rem", fontWeight: 700, color: "#38bdf8" }}>
                  <span>🗺 Route Strategy Options</span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>
                  Traffic-Aware Optimization
                </div>
              </div>

              {/* 4 Strategy Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {Object.entries(currentOptions).map(([key, opt]) => {
                  const isSelected = selectedStrategy === key;
                  return (
                    <div
                      key={key}
                      onClick={() => handleStrategyChange(key)}
                      style={{
                        background: isSelected ? "rgba(14, 116, 144, 0.25)" : "rgba(30, 41, 59, 0.6)",
                        border: isSelected ? "1.5px solid #06b6d4" : "1px solid rgba(255, 255, 255, 0.08)",
                        boxShadow: isSelected ? "0 0 16px rgba(6, 182, 212, 0.3)" : "none",
                        borderRadius: 12,
                        padding: "14px",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ fontSize: "0.82rem", fontWeight: 700, color: isSelected ? "#38bdf8" : "#f1f5f9", marginBottom: 6 }}>
                        {key === "Fastest" ? "Fastest Route" : key === "Shortest" ? "Shortest Route" : key === "Traffic Avoidance" ? "Traffic Avoidance Route" : "Fuel-Efficient Route"}
                      </div>
                      <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#fff" }}>
                        📌 {opt.distance} km
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
                        ⏱ {(opt.duration / 60).toFixed(1)} hrs
                      </div>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, marginTop: 6, color: opt.delay === "Clear" ? "#10b981" : "#f59e0b" }}>
                        {opt.delay === "Clear" ? "✓ Clear" : `▲ ${opt.delay}`}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Leaflet Map with Live HUD */}
              <RouteMap
                geometry={currentRouteData?.geometry}
                startCoords={currentRouteData?.start_coords}
                destCoords={currentRouteData?.destination_coords}
                liveGps={simGps || gpsData}
                selectedTrip={activeTrip}
              />

              {/* GPS Trip Simulator Control Panel */}
              <div
                style={{
                  marginTop: 16,
                  background: "rgba(15, 23, 42, 0.9)",
                  border: "1px solid rgba(6, 182, 212, 0.3)",
                  borderRadius: 14,
                  padding: "16px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "1.2rem" }}>🎮</span>
                    <div>
                      <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#38bdf8" }}>
                        GPS Route Telemetry Simulator
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>
                        Simulate live vehicular GPS ping along this planned route
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={() => {
                        if (!currentRouteData?.geometry || currentRouteData.geometry.length === 0) {
                          alert("No route geometry available to simulate.");
                          return;
                        }
                        setIsSimulating((prev) => !prev);
                      }}
                      style={{
                        background: isSimulating
                          ? "linear-gradient(135deg, #f59e0b, #d97706)"
                          : "linear-gradient(135deg, #10b981, #059669)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "8px 16px",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                      }}
                    >
                      {isSimulating ? "⏸ Pause Simulator" : "▶ Start GPS Simulation"}
                    </button>

                    <button
                      onClick={() => {
                        setIsSimulating(false);
                        setSimIndex(0);
                        setSimGps(null);
                      }}
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.7)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 8,
                        padding: "8px 12px",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      ↺ Reset
                    </button>
                  </div>
                </div>

                {/* Speed Controls & Progress */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Speed:</span>
                    {[1, 2, 5, 10].map((s) => (
                      <button
                        key={s}
                        onClick={() => setSimSpeed(s)}
                        style={{
                          background: simSpeed === s ? "#06b6d4" : "rgba(30, 41, 59, 0.8)",
                          color: simSpeed === s ? "#000" : "#fff",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>

                  <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.7)", display: "flex", gap: 12 }}>
                    <span>
                      Waypoint: <strong style={{ color: "#38bdf8" }}>{simIndex}</strong> / {currentRouteData?.geometry?.length || 0}
                    </span>
                    <span>
                      Sim Speed: <strong style={{ color: "#10b981" }}>{simGps?.speed || 0} km/h</strong>
                    </span>
                    <span>
                      Status:{" "}
                      <strong style={{ color: isSimulating ? "#10b981" : simIndex > 0 ? "#f59e0b" : "rgba(255,255,255,0.4)" }}>
                        {isSimulating ? "Transmitting GPS..." : simIndex > 0 ? "Paused" : "Idle"}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${currentRouteData?.geometry?.length ? (simIndex / (currentRouteData.geometry.length - 1)) * 100 : 0}%`,
                      background: "linear-gradient(90deg, #06b6d4, #10b981)",
                      transition: "width 0.15s ease",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Scheduled & Active Trips */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            
            {/* Header + Schedule Trip Button */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#f8fafc" }}>
                Scheduled & Active Trips
              </h3>
              <button
                onClick={() => { setShowModal(true); setTopError(""); }}
                style={{
                  background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "9px 16px",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(6, 182, 212, 0.3)",
                }}
              >
                + Schedule Trip
              </button>
            </div>

            {/* Trip Cards List */}
            {loading ? (
              <div style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: 30 }}>
                Loading trips...
              </div>
            ) : trips.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: 30, background: "rgba(15,23,42,0.6)", borderRadius: 14 }}>
                No trips scheduled.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {trips.map((trip) => {
                  const isSelected = selectedTripId === trip.trip_id;
                  return (
                    <div
                      key={trip.trip_id}
                      onClick={() => setSelectedTripId(trip.trip_id)}
                      style={{
                        background: isSelected ? "rgba(30, 41, 59, 0.9)" : "rgba(15, 23, 42, 0.7)",
                        border: isSelected ? "1.5px solid #06b6d4" : "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: 14,
                        padding: "16px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        transition: "all 0.2s",
                      }}
                    >
                      {/* Top Row: ID & Status Badge */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#fff" }}>
                          ID: {trip.trip_id.substring(0, 8)}...
                        </span>
                        <StatusBadge status={trip.status} />
                      </div>

                      {/* Linked Shipment Info */}
                      {(() => {
                        const linkedShipment = shipments.find((s) => s.shipment_id === trip.shipment_id);
                        return linkedShipment ? (
                          <div style={{ fontSize: "0.78rem", color: "#38bdf8", fontWeight: 600, background: "rgba(56, 189, 248, 0.1)", padding: "4px 8px", borderRadius: 6 }}>
                            📦 {linkedShipment.tracking_number} • {linkedShipment.customer_name}
                          </div>
                        ) : null;
                      })()}

                      {/* Coordinates / Address */}
                      <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.6)" }}>
                        {trip.start_location || "28.6139, 77.209"} → {trip.destination || "19.076, 72.8777"}
                      </div>

                      {/* Intermediate Waypoints badge */}
                      {trip.waypoints && Array.isArray(trip.waypoints) && trip.waypoints.length > 0 && (
                        <div style={{ fontSize: "0.74rem", color: "#a5f3fc", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                          <span>🛑 Stops:</span>
                          {trip.waypoints.map((wp, i) => (
                            <span key={i} style={{ background: "rgba(6, 182, 212, 0.15)", padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(6, 182, 212, 0.3)" }}>
                              {typeof wp === "string" ? wp : JSON.stringify(wp)}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Metrics row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: "0.78rem", color: "rgba(255,255,255,0.7)" }}>
                        <div>🛣 {trip.distance ? `${trip.distance} km` : "668.13 km"}</div>
                        <div>⏱ {trip.duration ? `${(trip.duration / 60).toFixed(1)} hrs` : "12.1 hrs"}</div>
                        <div style={{ color: "#38bdf8", fontWeight: 600 }}>{trip.route_type ? trip.route_type.toLowerCase().replace(" ", "_") : "fastest"}</div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        {trip.status === "Scheduled" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStart(trip.trip_id); }}
                            style={{
                              flex: 1,
                              background: "#2563eb",
                              color: "#fff",
                              border: "none",
                              borderRadius: 8,
                              padding: "8px 12px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            ▶ START TRIP
                          </button>
                        )}
                        {(trip.status === "Scheduled" || trip.status === "In Transit") && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEnd(trip.trip_id); }}
                            style={{
                              flex: 1,
                              background: "#059669",
                              color: "#fff",
                              border: "none",
                              borderRadius: 8,
                              padding: "8px 12px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            ✓ COMPLETE TRIP
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(trip.trip_id); }}
                          style={{
                            background: "rgba(220, 38, 38, 0.2)",
                            color: "#ef4444",
                            border: "1px solid rgba(220, 38, 38, 0.4)",
                            borderRadius: 8,
                            padding: "8px 10px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Schedule Modal */}
        {showModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
          >
            <div
              style={{
                background: "#0f172a",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 18,
                padding: "28px",
                width: "100%",
                maxWidth: 480,
                boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
              }}
            >
              <h3 style={{ margin: "0 0 20px", color: "#f8fafc", fontWeight: 800 }}>
                📅 Schedule New Trip
              </h3>
              <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                
                <div>
                  <label style={labelStyle}>Shipment</label>
                  <select
                    value={form.shipment_id}
                    onChange={(e) => handleShipmentSelect(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Select shipment...</option>
                    {shipments.map((s) => (
                      <option key={s.shipment_id} value={s.shipment_id}>
                        {s.tracking_number} — {s.customer_name} ({s.source} → {s.destination})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Vehicle</label>
                  <select
                    value={form.vehicle_id}
                    onChange={(e) => setForm((p) => ({ ...p, vehicle_id: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="">Select vehicle...</option>
                    {vehicles.map((v) => (
                      <option key={v.vehicle_id} value={v.vehicle_id}>
                        {v.registration_number} ({v.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Driver</label>
                  <select
                    value={form.driver_id}
                    onChange={(e) => setForm((p) => ({ ...p, driver_id: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="">Select driver...</option>
                    {drivers.map((d) => (
                      <option key={d.driver_id} value={d.driver_id}>
                        {d.license_number || d.driver_id.substring(0, 8)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Start Location</label>
                  <input
                    value={form.start_location}
                    onChange={(e) => setForm((p) => ({ ...p, start_location: e.target.value }))}
                    placeholder="e.g. 28.6139, 77.209"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Destination</label>
                  <input
                    value={form.destination}
                    onChange={(e) => setForm((p) => ({ ...p, destination: e.target.value }))}
                    placeholder="e.g. 19.076, 72.8777"
                    style={inputStyle}
                  />
                </div>

                {/* Intermediate Waypoints */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={labelStyle}>Intermediate Waypoints (Optional)</label>
                    <button
                      type="button"
                      onClick={handleAddWaypointInput}
                      style={{
                        background: "rgba(56, 189, 248, 0.15)",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        color: "#38bdf8",
                        borderRadius: 6,
                        padding: "2px 8px",
                        fontSize: "0.72rem",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      + Add Stop
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {waypointInputs.map((wp, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          value={wp}
                          onChange={(e) => handleWaypointChange(idx, e.target.value)}
                          placeholder={`Stop #${idx + 1} (e.g. 15.3647, 75.1240 or City)`}
                          style={inputStyle}
                        />
                        {waypointInputs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveWaypointInput(idx)}
                            style={{
                              background: "rgba(220, 38, 38, 0.2)",
                              border: "1px solid rgba(220, 38, 38, 0.4)",
                              color: "#ef4444",
                              borderRadius: 6,
                              padding: "8px 10px",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Route Strategy</label>
                  <select
                    value={form.route_type}
                    onChange={(e) => setForm((p) => ({ ...p, route_type: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="Fastest">Fastest Route</option>
                    <option value="Shortest">Shortest Route</option>
                    <option value="Traffic Avoidance">Traffic Avoidance Route</option>
                    <option value="Fuel-Efficient">Fuel-Efficient Route</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      flex: 1,
                      background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 10,
                      padding: "12px",
                      fontWeight: 700,
                      cursor: saving ? "not-allowed" : "pointer",
                    }}
                  >
                    {saving ? "Scheduling..." : "Schedule Trip"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    style={{
                      flex: 1,
                      background: "rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.7)",
                      border: "none",
                      borderRadius: 10,
                      padding: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}

const labelStyle = {
  display: "block",
  fontSize: "0.78rem",
  fontWeight: 600,
  color: "rgba(255,255,255,0.6)",
  marginBottom: 4,
};

const inputStyle = {
  width: "100%",
  background: "rgba(30, 41, 59, 0.8)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  padding: "9px 12px",
  color: "#fff",
  fontSize: "0.85rem",
  boxSizing: "border-box",
};
