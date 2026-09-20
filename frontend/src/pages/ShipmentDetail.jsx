import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Package, MapPin, Truck, User, ArrowLeft, Navigation, 
  Clock, AlertTriangle, Compass, CheckCircle2, RefreshCw, Trash2
} from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const CITY_COORDINATES = {
  Mumbai: [19.0760, 72.8777],
  Delhi: [28.6139, 77.2090],
  Bangalore: [12.9716, 77.5946],
  Bengaluru: [12.9716, 77.5946],
  Hyderabad: [17.3850, 78.4867],
  Ahmedabad: [23.0225, 72.5714],
  Chennai: [13.0827, 80.2707],
  Kolkata: [22.5726, 88.3639],
  Surat: [21.1702, 72.8311],
  Pune: [18.5204, 73.8567],
  Jaipur: [26.9124, 75.7873],
  Lucknow: [26.8467, 80.9462],
  Kanpur: [26.4499, 80.3319],
  Nagpur: [21.1458, 79.0882],
  Indore: [22.7196, 75.8577],
  Thane: [19.2183, 72.9781],
  Bhopal: [23.2599, 77.4126],
  Visakhapatnam: [17.6868, 83.2185],
  Pimpri: [18.6298, 73.7997],
  Patna: [25.5941, 85.1376],
  Vadodara: [22.3072, 73.1812],
  Ghaziabad: [28.6692, 77.4538],
  Ludhiana: [30.9010, 75.8573],
  Agra: [27.1767, 78.0081],
  Nashik: [19.9975, 73.7898],
  Ranchi: [23.3441, 85.3096],
  Faridabad: [28.4089, 77.3178],
  Meerut: [28.9845, 77.7064],
  Rajkot: [22.3039, 70.8022],
  Varanasi: [25.3176, 82.9739],
  Srinagar: [34.0837, 74.7973],
  Aurangabad: [19.8762, 75.3433],
  Dhanbad: [23.7957, 86.4304],
  Amritsar: [31.6340, 74.8723],
  Allahabad: [25.4358, 81.8463],
  Prayagraj: [25.4358, 81.8463],
  Howrah: [22.5958, 88.2636],
  Gwalior: [26.2183, 78.1828],
  Jabalpur: [23.1815, 79.9864],
  Coimbatore: [11.0168, 76.9558],
  Vijayawada: [16.5062, 80.6480],
  Jodhpur: [26.2389, 73.0243],
  Madurai: [9.9252, 78.1198],
  Raipur: [21.2514, 81.6296],
  Kota: [25.2138, 75.8648],
  Chandigarh: [30.7333, 76.7794],
  Guwahati: [26.1445, 91.7362],
  Solapur: [17.6599, 75.9064],
  Hubli: [15.3647, 75.1240],
  Mysore: [12.2958, 76.6394],
  Tiruchirappalli: [10.7905, 78.7047],
  Bareilly: [28.3670, 79.4304],
  Aligarh: [27.8974, 78.0880],
  Gurgaon: [28.4595, 77.0266],
  Gurugram: [28.4595, 77.0266],
  Jalandhar: [31.3260, 75.5762],
  Bhubaneswar: [20.2961, 85.8245],
  Salem: [11.6643, 78.1460],
  Warangal: [17.9689, 79.5941],
  Thiruvananthapuram: [8.5241, 76.9366],
  Trivandrum: [8.5241, 76.9366],
  Dehradun: [30.3165, 78.0322],
  Shimla: [31.1048, 77.1734],
  Kochi: [9.9312, 76.2673],
  Cochin: [9.9312, 76.2673],
  Jammu: [32.7266, 74.8570],
  Mangalore: [12.9141, 74.8560],
  Udaipur: [24.5854, 73.7125],
};

const getCoordinatesForCity = (cityName) => {
  if (!cityName) return [20.5937, 78.9629];
  const clean = cityName.trim().toLowerCase();
  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    if (key.toLowerCase() === clean || clean.includes(key.toLowerCase()) || key.toLowerCase().includes(clean)) {
      return coords;
    }
  }
  let hash = 0;
  for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  const lat = 12.0 + (Math.abs(hash) % 16) + ((Math.abs(hash) % 100) / 100);
  const lng = 73.0 + (Math.abs(hash) % 15) + ((Math.abs(hash) % 200) / 200);
  return [parseFloat(lat.toFixed(4)), parseFloat(lng.toFixed(4))];
};

export default function ShipmentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [shipment, setShipment] = useState(null);
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Real-time tracking state
  const [liveLocation, setLiveLocation] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [lastPing, setLastPing] = useState(null);
  const [routeOptions, setRouteOptions] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState("fastest");
  const [eta, setEta] = useState("");
  const [distanceRemaining, setDistanceRemaining] = useState(0);

  const mapInstanceRef = useRef(null);
  const truckMarkerRef = useRef(null);
  const polylineRef = useRef(null);
  const wsRef = useRef(null);

  const isOpsRole = user && ["Admin", "FleetManager", "Dispatcher"].includes(user.role);

  const fetchDetails = async () => {
    try {
      const res = await api.get(`/shipments/${id}`);
      setShipment(res.data);
      
      // Try to find the active or pending trip linked to this shipment
      const tripsRes = await api.get("/fleet/trips");
      const linkedTrip = tripsRes.data.find(t => t.shipment_id === id);
      setTrip(linkedTrip || null);

      if (res.data.source && res.data.destination) {
        // Fetch route options
        const routesRes = await api.get(`/fleet/route-options?source=${res.data.source}&destination=${res.data.destination}`);
        setRouteOptions(routesRes.data);
        const defaultRoute = routesRes.data.find(r => r.id === "fastest") || routesRes.data[0];
        if (defaultRoute) {
          setEta(defaultRoute.eta);
          setDistanceRemaining(defaultRoute.distance);
        }
      }
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load shipment lifecycle parameters.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [id]);

  // Load Leaflet map scripts dynamically
  useEffect(() => {
    if (loading || !shipment) return;

    const sourceCoords = getCoordinatesForCity(shipment.source);
    const destCoords = getCoordinatesForCity(shipment.destination);

    // Setup Leaflet assets if they aren't loaded
    if (!document.getElementById("leaflet-css")) {
      const css = document.createElement("link");
      css.id = "leaflet-css";
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
    }

    if (!window.L) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => initMap(sourceCoords, destCoords);
      document.head.appendChild(script);
    } else {
      initMap(sourceCoords, destCoords);
    }

    // Connect to WebSocket for live telemetry pings
    connectWebSocket();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [loading, shipment, routeOptions]);

  const initMap = (fallbackSource, fallbackDest) => {
    const L = window.L;
    if (!L || mapInstanceRef.current) return;

    const routeObj = routeOptions.find(r => r.id === selectedRoute) || routeOptions[0];
    const pathCoordinates = routeObj ? routeObj.path : [fallbackSource, fallbackDest];

    const sourceCoords = pathCoordinates ? pathCoordinates[0] : fallbackSource;
    const destCoords = pathCoordinates ? pathCoordinates[pathCoordinates.length - 1] : fallbackDest;

    // Create Leaflet Map centered in the middle of the shipment route
    const midLat = (sourceCoords[0] + destCoords[0]) / 2;
    const midLng = (sourceCoords[1] + destCoords[1]) / 2;
    
    const map = L.map("tracking-map", {
      center: [midLat, midLng],
      zoom: 6,
      zoomControl: true,
    });

    // Tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors"
    }).addTo(map);

    // Custom Icon configurations
    const sourceIcon = L.divIcon({
      className: "custom-map-marker source-marker",
      html: `<div style="background-color: #6366f1; width: 14px; height: 14px; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(99,102,241,0.5)"></div>`
    });

    const destIcon = L.divIcon({
      className: "custom-map-marker dest-marker",
      html: `<div style="background-color: #ef4444; width: 14px; height: 14px; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(239,68,68,0.5)"></div>`
    });

    // Add source and destination markers at exact starting and ending points
    L.marker(sourceCoords, { icon: sourceIcon }).addTo(map).bindPopup(`<b>Origin:</b> ${shipment.source}`);
    L.marker(destCoords, { icon: destIcon }).addTo(map).bindPopup(`<b>Destination:</b> ${shipment.destination}`);

    // Generate and draw route polyline
    const polyline = L.polyline(pathCoordinates, {
      color: "#6366f1",
      weight: 4,
      opacity: 0.8,
      dashArray: shipment.status?.toLowerCase() === "in transit" ? "8, 6" : "0"
    }).addTo(map);

    polylineRef.current = polyline;

    // Create the vehicle/truck marker if active
    const truckIcon = L.divIcon({
      className: "custom-truck-marker",
      html: `<div style="background: linear-gradient(135deg, #4f46e5, #3b82f6); width: 28px; height: 28px; border-radius: 50%; border: 2.5px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(79,70,229,0.3)">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="10" x="2" y="6" rx="2"/><path d="M22 10v4M2 10h16M18 10l3-3h-3"/></svg>
             </div>`
    });

    // Position truck at live location or exact origin start
    const initialPosition = liveLocation || sourceCoords;
    const truckMarker = L.marker(initialPosition, { icon: truckIcon }).addTo(map);
    truckMarkerRef.current = truckMarker;

    // Fit map view bounds precisely to starting and ending markers
    const bounds = L.latLngBounds([sourceCoords, destCoords]);
    map.fitBounds(bounds, { padding: [50, 50] });
    mapInstanceRef.current = map;
  };

  const updateRoutePathOnMap = (routeId) => {
    setSelectedRoute(routeId);
    const selected = routeOptions.find(r => r.id === routeId);
    if (!selected || !window.L || !mapInstanceRef.current) return;
    
    setEta(selected.eta);
    setDistanceRemaining(selected.distance);

    if (polylineRef.current) {
      polylineRef.current.setLatLngs(selected.path);
    }
  };

  const connectWebSocket = () => {
    const wsUrl = `ws://${window.location.hostname}:8000/gps/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Check if update is for this active trip
      if (data.type === "gps_update" && trip && data.trip_id === trip.trip_id) {
        const newCoords = [data.latitude, data.longitude];
        setLiveLocation(newCoords);
        setSpeed(data.speed);
        setProgress(data.progress);
        setLastPing(new Date().toLocaleTimeString());

        // Update truck position on map
        if (truckMarkerRef.current) {
          truckMarkerRef.current.setLatLng(newCoords);
          
          // Re-calculate remaining distance linearly based on progress
          const routeObj = routeOptions.find(r => r.id === selectedRoute) || routeOptions[0];
          if (routeObj) {
            const remDist = Math.max(0, routeObj.distance * (1 - data.progress / 100));
            setDistanceRemaining(round(remDist, 1));
          }
        }
      }

      if (data.type === "trip_completed" && trip && data.trip_id === trip.trip_id) {
        fetchDetails(); // Reload data
        alert("Shipment has been successfully delivered!");
      }
    };

    ws.onclose = () => {
      // Auto reconnect after 5s
      setTimeout(connectWebSocket, 5000);
    };
  };

  const round = (val, dec) => {
    return parseFloat(val.toFixed(dec));
  };

  const handleStartTrip = async () => {
    if (!trip) return;
    try {
      await api.put(`/fleet/trips/${trip.trip_id}/start`);
      fetchDetails();
    } catch (err) {
      console.error(err);
      alert("Failed to start trip.");
    }
  };

  const handleEndTrip = async () => {
    if (!trip) return;
    try {
      await api.put(`/fleet/trips/${trip.trip_id}/end`);
      fetchDetails();
    } catch (err) {
      console.error(err);
      alert("Failed to end trip.");
    }
  };

  const handleRecalculateRoute = async () => {
    if (!trip) return;
    try {
      const res = await api.post(`/trips/${trip.trip_id}/recalculate-route`);
      setEta(res.data.updated_eta);
      setDistanceRemaining(round(res.data.new_distance, 1));
      if (res.data.planned_route && polylineRef.current) {
        polylineRef.current.setLatLngs(res.data.planned_route);
      }
      setRerouteNotice(`Route optimized dynamically. New distance: ${res.data.new_distance} km. Updated ETA: ${res.data.updated_eta}`);
    } catch (err) {
      console.error(err);
      alert("Failed to optimize route.");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this shipment? This action cannot be undone.")) return;
    try {
      await api.delete(`/shipments/${id}`);
      navigate("/shipments");
    } catch (err) {
      console.error(err);
      alert("Failed to delete shipment.");
    }
  };

  if (loading) {
    return (
      <AppLayout title="Shipment Telemetry" subtitle="Loading detailed tracking panel...">
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "350px", flexDirection: "column", gap: "1rem" }}>
          <div className="ff-pulse-dot" style={{ width: "36px", height: "36px", background: "#6366f1" }} />
          <p style={{ fontSize: "0.875rem", color: "#64748b" }}>Initializing tracking console...</p>
        </div>
      </AppLayout>
    );
  }

  if (error || !shipment) {
    return (
      <AppLayout title="Shipment Telemetry" subtitle="Tracking error">
        <div style={{ background: "#fef2f2", border: "1.5px solid #fecdd3", color: "#991b1b", borderRadius: "1rem", padding: "1.5rem", maxWidth: "600px" }}>
          <h3 style={{ fontWeight: 800 }}>Cargo Tracker Offline</h3>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>{error || "Shipment record could not be found."}</p>
          <button onClick={() => navigate("/shipments")} style={{ marginTop: "1rem", padding: "0.5rem 1rem", border: "none", background: "#ef4444", color: "white", borderRadius: "0.5rem", cursor: "pointer", fontWeight: 600 }}>
            Back to Registry
          </button>
        </div>
      </AppLayout>
    );
  }

  // Determine active stepper phase
  const statusStr = shipment.status?.toLowerCase();
  const steps = ["Created", "Assigned", "In Transit", "Delivered"];
  let activeStep = 0;
  if (statusStr === "assigned") activeStep = 1;
  else if (statusStr === "in transit" || statusStr === "delayed") activeStep = 2;
  else if (statusStr === "delivered") activeStep = 3;

  return (
    <AppLayout title="Live Telemetry Console" subtitle={`Tracking Shipment ${shipment.tracking_number}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* Back navigation & Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button 
            onClick={() => navigate("/shipments")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "transparent",
              border: "none",
              color: "#64748b",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.875rem"
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Shipments</span>
          </button>

          {isOpsRole && (
            <button
              onClick={handleDelete}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "#fee2e2",
                color: "#ef4444",
                border: "1.5px solid #fecdd3",
                padding: "0.5rem 1rem",
                borderRadius: "0.75rem",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              <Trash2 size={16} />
              <span>Delete Shipment</span>
            </button>
          )}
        </div>

        {/* Stepper tracker */}
        <div style={{ background: "white", borderRadius: "1.25rem", border: "1.5px solid rgba(15,23,42,0.06)", padding: "1.5rem", boxShadow: "0 2px 8px rgba(15,23,42,0.02)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 1, maxWidth: "600px", margin: "0 auto" }}>
            {/* Stepper Progress bar */}
            <div style={{ position: "absolute", top: "18px", left: 0, right: 0, height: "3px", background: "#e2e8f0", zIndex: -1 }}>
              <div style={{ width: `${(activeStep / (steps.length - 1)) * 100}%`, height: "100%", background: "linear-gradient(90deg, #6366f1, #3b82f6)", transition: "width 0.3s ease" }} />
            </div>

            {steps.map((step, idx) => {
              const isActive = idx <= activeStep;
              const isCurrent = idx === activeStep;
              return (
                <div key={step} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: isCurrent ? "#6366f1" : isActive ? "linear-gradient(135deg, #818cf8, #60a5fa)" : "white",
                    border: isActive ? "3px solid white" : "3px solid #cbd5e1",
                    boxShadow: isActive ? "0 4px 10px rgba(99, 102, 241, 0.3)" : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isActive ? "white" : "#94a3b8",
                    fontWeight: 700,
                    fontSize: "0.875rem",
                    transition: "all 0.3s ease"
                  }}>
                    {idx < activeStep ? <CheckCircle2 size={16} /> : idx + 1}
                  </div>
                  <span style={{ fontSize: "0.75rem", fontWeight: isCurrent ? 700 : 500, color: isCurrent ? "#6366f1" : "#64748b" }}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Console layout */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem", flexWrap: "wrap" }}>
          
          {/* Left panel: Map container */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div
              style={{
                background: "white",
                borderRadius: "1.5rem",
                border: "1.5px solid rgba(15,23,42,0.06)",
                padding: "0.75rem",
                boxShadow: "0 4px 16px rgba(15,23,42,0.02)"
              }}
            >
              <div
                id="tracking-map"
                style={{
                  height: "450px",
                  width: "100%",
                  borderRadius: "1rem",
                  background: "#f1f5f9",
                  overflow: "hidden",
                  zIndex: 1
                }}
              />
            </div>

            {/* Live Telemetry Panel */}
            {shipment.status?.toLowerCase() === "in transit" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", background: "white", border: "1.5px solid rgba(15,23,42,0.06)", borderRadius: "1.25rem", padding: "1.25rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Current Speed</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    <Compass size={16} color="#6366f1" />
                    <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "#1e293b" }}>{speed} km/h</span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Trip Progress</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    <Clock size={16} color="#059669" />
                    <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "#1e293b" }}>{progress}%</span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Distance Left</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    <Truck size={16} color="#3b82f6" />
                    <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "#1e293b" }}>{distanceRemaining} km</span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Last Ping</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    <RefreshCw size={14} color="#d97706" className="ff-pulse-dot" />
                    <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "#1e293b" }}>{lastPing || "Awaiting..."}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right panel: Details & Route selection */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            
            {/* Shipment details card */}
            <div style={{ background: "white", border: "1.5px solid rgba(15,23,42,0.06)", borderRadius: "1.25rem", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a", borderBottom: "1.5px solid rgba(15,23,42,0.06)", paddingBottom: "0.5rem" }}>
                Shipment Registry
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.875rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Tracking #:</span>
                  <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{shipment.tracking_number}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Customer:</span>
                  <span style={{ fontWeight: 600 }}>{shipment.customer_name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Cargo Weight:</span>
                  <span style={{ fontWeight: 600 }}>{shipment.shipment_weight} kg</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Vehicle assigned:</span>
                  <span style={{ fontWeight: 600, color: shipment.vehicle_reg ? "#334155" : "#94a3b8" }}>
                    {shipment.vehicle_reg || "Unassigned"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Driver assigned:</span>
                  <span style={{ fontWeight: 600, color: shipment.driver_name ? "#334155" : "#94a3b8" }}>
                    {shipment.driver_name || "Unassigned"}
                  </span>
                </div>
              </div>

              {isOpsRole && (
                <button
                  onClick={handleDelete}
                  style={{
                    marginTop: "0.5rem",
                    padding: "0.625rem",
                    borderRadius: "0.75rem",
                    border: "1.5px solid #fee2e2",
                    background: "#fef2f2",
                    color: "#ef4444",
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.375rem"
                  }}
                >
                  <Trash2 size={14} />
                  <span>Delete Shipment Record</span>
                </button>
              )}
            </div>

            {/* Routing controls */}
            {trip && (
              <div style={{ background: "white", border: "1.5px solid rgba(15,23,42,0.06)", borderRadius: "1.25rem", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a" }}>Route Optimization</h3>
                
                {/* Available routes */}
                {routeOptions.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Select Path Plan</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {routeOptions.map((opt) => (
                        <div
                          key={opt.id}
                          onClick={() => updateRoutePathOnMap(opt.id)}
                          style={{
                            border: selectedRoute === opt.id ? "1.5px solid #6366f1" : "1.5px solid rgba(15,23,42,0.06)",
                            background: selectedRoute === opt.id ? "#f5f3ff" : "transparent",
                            borderRadius: "0.875rem",
                            padding: "0.75rem",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#1e293b" }}>{opt.name}</span>
                            {opt.fuel_saving_pct > 0 && (
                              <span style={{ fontSize: "0.6875rem", background: "#ecfdf5", color: "#059669", fontWeight: 700, padding: "0.125rem 0.375rem", borderRadius: "0.25rem" }}>
                                Eco +{opt.fuel_saving_pct}%
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                            <span>{opt.distance} km</span>
                            <span>•</span>
                            <span>{Math.round(opt.duration_mins / 60)} hrs</span>
                            <span>•</span>
                            <span style={{ color: opt.traffic_level === "Heavy" ? "#e11d48" : "#059669", fontWeight: 600 }}>
                              {opt.traffic_level} Traffic
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Operations dispatcher action controls */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
                  {(trip.status === "Scheduled" || trip.status === "pending") && (
                    <button
                      onClick={handleStartTrip}
                      style={{
                        width: "100%",
                        padding: "0.625rem",
                        borderRadius: "0.75rem",
                        background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                        color: "white",
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer"
                      }}
                    >
                      Start Trip (In Transit)
                    </button>
                  )}
                  {(trip.status === "In Transit" || trip.status === "active") && (
                    <>
                      <button
                        onClick={handleRecalculateRoute}
                        style={{
                          width: "100%",
                          padding: "0.625rem",
                          borderRadius: "0.75rem",
                          background: "#f1f5f9",
                          color: "#334155",
                          fontWeight: 600,
                          border: "1.5px solid #cbd5e1",
                          cursor: "pointer"
                        }}
                      >
                        Recalculate & Optimize Route
                      </button>
                      <button 
                        onClick={handleEndTrip}
                        style={{
                          width: "100%",
                          padding: "0.625rem",
                          borderRadius: "0.75rem",
                          background: "#059669",
                          color: "white",
                          fontWeight: 600,
                          border: "none",
                          cursor: "pointer"
                        }}
                      >
                        Complete Delivery (End Trip)
                      </button>
                    </>
                  )}
                </div>

                <div style={{ borderTop: "1.5px solid rgba(15,23,42,0.06)", paddingTop: "0.75rem", fontSize: "0.8125rem", color: "#64748b", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Calculated ETA:</span>
                    <span style={{ fontWeight: 700, color: "#1e293b" }}>{eta}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Planned Distance:</span>
                    <span style={{ fontWeight: 700, color: "#1e293b" }}>{distanceRemaining} km</span>
                  </div>
                </div>

              </div>
            )}

          </div>

        </div>

      </div>
    </AppLayout>
  );
}
