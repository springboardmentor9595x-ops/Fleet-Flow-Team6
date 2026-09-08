import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Route, Plus, Trash2, MapPin, Truck, User, Navigation, 
  Search, AlertCircle, Play, CheckCircle2, ChevronRight, Package 
} from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Trips() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [trips, setTrips] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [shipments, setShipments] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [routeOptions, setRouteOptions] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState("");

  const [formData, setFormData] = useState({
    vehicle_id: "",
    driver_id: "",
    shipment_id: "",
    start_location: "",
    destination: "",
    distance: ""
  });

  const isOpsRole = user && ["Admin", "FleetManager"].includes(user.role);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tripsRes, driversRes, vehiclesRes, shipmentsRes] = await Promise.all([
        api.get("/fleet/trips"),
        isOpsRole ? api.get("/fleet/drivers") : Promise.resolve({ data: [] }),
        api.get("/fleet/vehicles"),
        api.get("/shipments")
      ]);
      setTrips(tripsRes.data);
      setDrivers(driversRes.data.filter(d => d.status === "Active"));
      setVehicles(vehiclesRes.data.filter(v => v.status === "Available" || v.status === "Assigned"));
      setShipments(shipmentsRes.data.filter(s => s.status?.toLowerCase() === "created"));
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch operational trip log database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleShipmentChange = async (e) => {
    const shipmentId = e.target.value;
    if (!shipmentId) {
      setFormData(prev => ({
        ...prev,
        shipment_id: "",
        start_location: "",
        destination: "",
        distance: ""
      }));
      setRouteOptions([]);
      return;
    }

    const selectedShipment = shipments.find(s => s.shipment_id === shipmentId);
    if (!selectedShipment) return;

    try {
      // Fetch route options based on shipment source/destination
      const res = await api.get(`/fleet/route-options?source=${selectedShipment.source}&destination=${selectedShipment.destination}`);
      setRouteOptions(res.data);
      const fastest = res.data.find(r => r.id === "fastest") || res.data[0];
      
      setFormData(prev => ({
        ...prev,
        shipment_id: shipmentId,
        start_location: selectedShipment.source,
        destination: selectedShipment.destination,
        distance: fastest ? fastest.distance : "",
        driver_id: selectedShipment.driver_id || prev.driver_id,
        vehicle_id: selectedShipment.vehicle_id || prev.vehicle_id
      }));

      if (fastest) {
        setSelectedRoute(fastest.id);
      }
    } catch (err) {
      console.error("Failed to load route options", err);
      // Fallback: manually pre-populate details
      setFormData(prev => ({
        ...prev,
        shipment_id: shipmentId,
        start_location: selectedShipment.source,
        destination: selectedShipment.destination,
        distance: ""
      }));
    }
  };

  const handleRouteSelect = (routeId) => {
    setSelectedRoute(routeId);
    const selected = routeOptions.find(r => r.id === routeId);
    if (selected) {
      setFormData(prev => ({
        ...prev,
        distance: selected.distance
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/fleet/trips", formData);
      setShowModal(false);
      setFormData({
        vehicle_id: "",
        driver_id: "",
        shipment_id: "",
        start_location: "",
        destination: "",
        distance: ""
      });
      setRouteOptions([]);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to create dispatch route.");
    }
  };

  const handleStartTrip = async (id) => {
    try {
      await api.put(`/fleet/trips/${id}/start`);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to start transit path.");
    }
  };

  const handleEndTrip = async (id) => {
    try {
      await api.put(`/fleet/trips/${id}/end`);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to close active transit path.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this trip record? This action will reset vehicle and shipment statuses.")) return;
    try {
      await api.delete(`/fleet/trips/${id}`);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to delete trip record.");
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case "active": return "ff-badge-emerald";
      case "completed": return "ff-badge-blue";
      case "pending": return "ff-badge-amber";
      default: return "ff-badge-blue";
    }
  };

  const filteredTrips = trips.filter(t => 
    t.driver_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.vehicle_reg?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.start_location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.destination?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.shipment_tracking?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <AppLayout title="Trip Dispatch & Logs" subtitle="Dispatch vehicles, monitor active trips, and review finished routes">
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "350px", flexDirection: "column", gap: "1rem" }}>
          <div className="ff-pulse-dot" style={{ width: "36px", height: "36px", background: "#6366f1" }} />
          <p style={{ fontSize: "0.875rem", color: "#64748b" }}>Loading operational dispatch board...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Trip Dispatch & Logs" subtitle="Dispatch vehicles, monitor active trips, and review finished routes">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* Actions header controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "250px", maxWidth: "450px" }}>
            <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)" }} />
            <input 
              type="text" 
              placeholder="Search by driver, vehicle, city or tracking #..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "0.625rem 1rem 0.625rem 2.5rem",
                borderRadius: "0.875rem",
                border: "1.5px solid rgba(15,23,42,0.08)",
                fontSize: "0.875rem",
                outline: "none",
                background: "white"
              }}
            />
          </div>

          {isOpsRole && (
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowModal(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                color: "white",
                padding: "0.625rem 1.25rem",
                borderRadius: "0.875rem",
                border: "none",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(99,102,241,0.25)"
              }}
            >
              <Plus size={16} />
              <span>Schedule Dispatch</span>
            </motion.button>
          )}
        </div>

        {/* Error Notification */}
        {error && (
          <div style={{ background: "#fef2f2", border: "1.5px solid #fecdd3", color: "#991b1b", borderRadius: "0.75rem", padding: "1rem", fontSize: "0.875rem" }}>
            {error}
          </div>
        )}

        {/* Operational logs table */}
        {filteredTrips.length === 0 ? (
          <div style={{ background: "white", borderRadius: "1.25rem", border: "1.5px solid rgba(15,23,42,0.06)", padding: "3rem", textAlign: "center" }}>
            <Route size={48} color="#94a3b8" style={{ margin: "0 auto 1rem" }} />
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>No Dispatch Logs</h3>
            <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.25rem" }}>There are no active or completed dispatches logged.</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ background: "white", border: "1.5px solid rgba(15,23,42,0.06)", borderRadius: "1.25rem", overflow: "hidden", boxShadow: "0 4px 12px rgba(15,23,42,0.01)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Trip ID", "Shipment Ref", "Driver", "Vehicle", "Route Plan", "Distance", "Status", "Control Actions"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "0.75rem 1rem", color: "#94a3b8", fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.05em", textTransform: "uppercase", borderBottom: "1.5px solid #f1f5f9" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTrips.map((trip) => (
                  <tr key={trip.trip_id} style={{ borderBottom: "1px solid #f8fafc", transition: "background 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    
                    {/* Trip ID */}
                    <td style={{ padding: "1rem", color: "#6366f1", fontWeight: 700 }}>
                      TRP-{trip.trip_id.substring(0, 4).toUpperCase()}
                    </td>
                    
                    {/* Linked Shipment */}
                    <td style={{ padding: "1rem", color: "#0f172a", fontWeight: 600 }}>
                      {trip.shipment_id ? (
                        <Link to={`/shipments/${trip.shipment_id}`} style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "#4f46e5", textDecoration: "none" }}>
                          <Package size={13} />
                          <span>{trip.shipment_tracking}</span>
                        </Link>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>N/A</span>
                      )}
                    </td>

                    {/* Driver */}
                    <td style={{ padding: "1rem", color: "#0f172a", fontWeight: 500 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <User size={14} color="#94a3b8" />
                        {trip.driver_name}
                      </div>
                    </td>

                    {/* Vehicle */}
                    <td style={{ padding: "1rem" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontFamily: "monospace", fontSize: "0.8125rem", background: "#f1f5f9", color: "#475569", padding: "0.125rem 0.5rem", borderRadius: "0.375rem" }}>
                        <Truck size={12} />
                        {trip.vehicle_reg}
                      </div>
                    </td>

                    {/* Route Plan */}
                    <td style={{ padding: "1rem", color: "#475569" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <MapPin size={14} color="#059669" />
                        <span>{trip.start_location}</span>
                        <Navigation size={12} color="#94a3b8" style={{ transform: "rotate(90deg)" }} />
                        <MapPin size={14} color="#e11d48" />
                        <span>{trip.destination}</span>
                      </div>
                    </td>

                    {/* Distance */}
                    <td style={{ padding: "1rem", color: "#475569", fontWeight: 600 }}>{trip.distance} km</td>
                    
                    {/* Status badge */}
                    <td style={{ padding: "1rem" }}>
                      <span className={`ff-badge ${getStatusBadgeClass(trip.status)}`}>
                        {trip.status === "active" && <span className="ff-pulse-dot" style={{ width: "5px", height: "5px", background: "#059669" }} />}
                        {trip.status}
                      </span>
                    </td>

                    {/* Operations Controls */}
                    <td style={{ padding: "1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {isOpsRole && trip.status === "pending" && (
                          <button
                            onClick={() => handleStartTrip(trip.trip_id)}
                            style={{
                              padding: "0.375rem 0.75rem",
                              borderRadius: "0.5rem",
                              background: "#eff6ff",
                              border: "1px solid #bfdbfe",
                              color: "#2563eb",
                              fontWeight: 600,
                              fontSize: "0.75rem",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.25rem"
                            }}
                          >
                            <Play size={12} />
                            <span>Start</span>
                          </button>
                        )}

                        {isOpsRole && trip.status === "active" && (
                          <button
                            onClick={() => handleEndTrip(trip.trip_id)}
                            style={{
                              padding: "0.375rem 0.75rem",
                              borderRadius: "0.5rem",
                              background: "#ecfdf5",
                              border: "1px solid #a7f3d0",
                              color: "#059669",
                              fontWeight: 600,
                              fontSize: "0.75rem",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.25rem"
                            }}
                          >
                            <CheckCircle2 size={12} />
                            <span>End</span>
                          </button>
                        )}

                        {isOpsRole && (
                          <button 
                            onClick={() => handleDelete(trip.trip_id)}
                            style={{ background: "transparent", border: "none", color: "#e11d48", padding: "0.375rem", borderRadius: "0.5rem", cursor: "pointer", display: "flex", alignItems: "center", transition: "background 0.2s" }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "#fff1f2"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}

                        {/* Track button links directly to shipment map */}
                        {trip.shipment_id && (
                          <Link
                            to={`/shipments/${trip.shipment_id}`}
                            style={{
                              padding: "0.375rem 0.75rem",
                              borderRadius: "0.5rem",
                              border: "1px solid rgba(15,23,42,0.08)",
                              background: "white",
                              color: "#475569",
                              fontWeight: 600,
                              fontSize: "0.75rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.25rem",
                              textDecoration: "none"
                            }}
                          >
                            <span>Map</span>
                            <ChevronRight size={12} />
                          </Link>
                        )}
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}

        {/* Schedule Dispatch Modal */}
        <AnimatePresence>
          {showModal && (
            <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowModal(false)}
                style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", backdropFilter: "blur(4px)" }}
              />
              <motion.div 
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                style={{ position: "relative", width: "100%", maxWidth: "520px", background: "white", borderRadius: "1.25rem", padding: "2rem", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", zIndex: 101, display: "flex", flexDirection: "column", gap: "1.25rem" }}
              >
                <div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a" }}>Schedule Operational Dispatch</h3>
                  <p style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.25rem" }}>
                    Select a shipment to dispatch, verify crew availability, and optimize routing options.
                  </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  
                  {/* Select Shipment */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Link Shipment</label>
                    <select 
                      name="shipment_id" 
                      required 
                      value={formData.shipment_id} 
                      onChange={handleShipmentChange} 
                      style={{
                        padding: "0.625rem 0.75rem",
                        borderRadius: "0.75rem",
                        border: "1.5px solid rgba(15,23,42,0.08)",
                        fontSize: "0.875rem",
                        background: "white"
                      }}
                    >
                      <option value="">-- Select Pending Shipment --</option>
                      {shipments.map(s => (
                        <option key={s.shipment_id} value={s.shipment_id}>
                          {s.tracking_number} - {s.customer_name} ({s.source} → {s.destination})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Assign Driver</label>
                      <select 
                        name="driver_id" 
                        required 
                        value={formData.driver_id} 
                        onChange={handleChange} 
                        style={{
                          padding: "0.625rem 0.75rem",
                          borderRadius: "0.75rem",
                          border: "1.5px solid rgba(15,23,42,0.08)",
                          fontSize: "0.875rem",
                          background: "white"
                        }}
                      >
                        <option value="">-- Choose Driver --</option>
                        {drivers.map(d => (
                          <option key={d.driver_id} value={d.driver_id}>{d.full_name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Assign Vehicle</label>
                      <select 
                        name="vehicle_id" 
                        required 
                        value={formData.vehicle_id} 
                        onChange={handleChange} 
                        style={{
                          padding: "0.625rem 0.75rem",
                          borderRadius: "0.75rem",
                          border: "1.5px solid rgba(15,23,42,0.08)",
                          fontSize: "0.875rem",
                          background: "white"
                        }}
                      >
                        <option value="">-- Choose Vehicle --</option>
                        {vehicles.map(v => (
                          <option key={v.vehicle_id} value={v.vehicle_id}>{v.registration_number} ({v.vehicle_type})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Start Location</label>
                      <input 
                        type="text" 
                        name="start_location" 
                        required 
                        readOnly
                        value={formData.start_location} 
                        style={{
                          padding: "0.625rem 0.75rem",
                          borderRadius: "0.75rem",
                          border: "1.5px solid rgba(15,23,42,0.08)",
                          fontSize: "0.875rem",
                          background: "#f1f5f9",
                          color: "#64748b"
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Destination</label>
                      <input 
                        type="text" 
                        name="destination" 
                        required 
                        readOnly
                        value={formData.destination} 
                        style={{
                          padding: "0.625rem 0.75rem",
                          borderRadius: "0.75rem",
                          border: "1.5px solid rgba(15,23,42,0.08)",
                          fontSize: "0.875rem",
                          background: "#f1f5f9",
                          color: "#64748b"
                        }}
                      />
                    </div>
                  </div>

                  {/* Route Options Selector */}
                  {routeOptions.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Select Optimized Path</label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                        {routeOptions.map((opt) => (
                          <div 
                            key={opt.id}
                            onClick={() => handleRouteSelect(opt.id)}
                            style={{
                              border: selectedRoute === opt.id ? "1.5px solid #6366f1" : "1.5px solid rgba(15,23,42,0.06)",
                              background: selectedRoute === opt.id ? "#f5f3ff" : "white",
                              borderRadius: "0.875rem",
                              padding: "0.625rem",
                              cursor: "pointer",
                              transition: "all 0.15s"
                            }}
                          >
                            <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#1e293b" }}>{opt.id.charAt(0).toUpperCase() + opt.id.slice(1)}</p>
                            <p style={{ fontSize: "0.6875rem", color: "#64748b", marginTop: "0.125rem" }}>{opt.distance} km • {Math.round(opt.duration_mins/60)} hrs</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Final Distance (km)</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      name="distance" 
                      required 
                      value={formData.distance} 
                      onChange={handleChange} 
                      style={{
                        padding: "0.625rem 0.75rem",
                        borderRadius: "0.75rem",
                        border: "1.5px solid rgba(15,23,42,0.08)",
                        fontSize: "0.875rem"
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                    <button 
                      type="button" 
                      onClick={() => setShowModal(false)} 
                      style={{
                        padding: "0.625rem 1.25rem",
                        borderRadius: "0.75rem",
                        border: "1.5px solid rgba(15,23,42,0.08)",
                        background: "transparent",
                        color: "#475569",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        cursor: "pointer"
                      }}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      style={{
                        padding: "0.625rem 1.25rem",
                        borderRadius: "0.75rem",
                        border: "none",
                        background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                        color: "white",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        cursor: "pointer",
                        boxShadow: "0 4px 12px rgba(99,102,241,0.2)"
                      }}
                    >
                      Dispatch Route
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </AppLayout>
  );
}
