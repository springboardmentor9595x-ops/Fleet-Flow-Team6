import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Package, Plus, Search, MapPin, Truck, User, ArrowRight, 
  AlertTriangle, Trash2, Calendar, Eye 
} from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

// Comprehensive list of major cities & logistics hubs across all states in India for autocomplete suggestions
const MAJOR_INDIAN_CITIES = [
  "Agra", "Ahmedabad", "Aizawl", "Ajmer", "Akola", "Aligarh", "Allahabad (Prayagraj)",
  "Amravati", "Amritsar", "Anantapur", "Asansol", "Aurangabad", "Bangalore (Bengaluru)",
  "Bareilly", "Belgaum", "Berhampur", "Bhagalpur", "Bhilai", "Bhiwandi", "Bhopal",
  "Bhubaneswar", "Bikaner", "Bokaro", "Calicut (Kozhikode)", "Chandigarh", "Chennai",
  "Coimbatore", "Cuttack", "Dehradun", "Delhi", "Dhanbad", "Dhule", "Dibrugarh",
  "Durgapur", "Eluru", "Erode", "Faridabad", "Firozabad", "Gandhinagar", "Gaya",
  "Ghaziabad", "Gorakhpur", "Gulbarga", "Guntur", "Gurgaon (Gurugram)", "Guwahati",
  "Gwalior", "Haridwar", "Hubballi-Dharwad", "Hyderabad", "Imphal", "Indore", "Itanagar",
  "Jabalpur", "Jaipur", "Jalandhar", "Jalgaon", "Jammu", "Jamnagar", "Jamshedpur",
  "Jhansi", "Jodhpur", "Kakinada", "Kalyan-Dombivli", "Kanpur", "Karimnagar", "Karnal",
  "Kochi", "Kolhapur", "Kolkata", "Kota", "Kottayam", "Kurnool", "Latur", "Lucknow",
  "Ludhiana", "Madurai", "Malegaon", "Mangalore", "Mathura", "Meerut", "Moradabad",
  "Mumbai", "Muzaffarnagar", "Muzaffarpur", "Mysore", "Nagpur", "Nanded", "Nashik",
  "Navi Mumbai", "Nellore", "Noida", "Panaji", "Patiala", "Patna", "Pondicherry (Puducherry)",
  "Pune", "Raipur", "Rajahmundry", "Rajkot", "Ranchi", "Rourkela", "Salem", "Sangli",
  "Shillong", "Shimla", "Siliguri", "Solapur", "Srinagar", "Surat", "Thane", "Thanjavur",
  "Thiruvananthapuram", "Thrissur", "Tiruchirappalli", "Tirunelveli", "Tirupati",
  "Udaipur", "Ujjain", "Vadodara", "Varanasi", "Vasai-Virar", "Vellore", "Vijayawada",
  "Visakhapatnam", "Warangal"
];

export default function Shipments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [shipments, setShipments] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  
  const [formData, setFormData] = useState({
    source: "",
    destination: "",
    customer_name: "",
    shipment_weight: "",
    vehicle_id: "",
    driver_id: "",
    status: "Created"
  });

  const isOpsRole = user && ["Admin", "FleetManager", "Dispatcher"].includes(user.role);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [shipmentsRes, driversRes, vehiclesRes] = await Promise.all([
        api.get("/shipments"),
        api.get("/fleet/drivers"),
        api.get("/fleet/vehicles")
      ]);
      setShipments(Array.isArray(shipmentsRes.data) ? shipmentsRes.data : []);
      setDrivers(Array.isArray(driversRes.data) ? driversRes.data : []);
      setVehicles(Array.isArray(vehiclesRes.data) ? vehiclesRes.data : []);
      setError(null);
    } catch (err) {
      console.error("Failed to load shipment data", err);
      setError("Unable to connect to the operational logistics backend.");
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.source.trim().toLowerCase() === formData.destination.trim().toLowerCase()) {
      alert("Source and Destination cannot be the same city or location.");
      return;
    }
    try {
      const payload = {
        source: formData.source.trim(),
        destination: formData.destination.trim(),
        customer_name: formData.customer_name,
        shipment_weight: parseFloat(formData.shipment_weight),
        vehicle_id: formData.vehicle_id || null,
        driver_id: formData.driver_id || null,
        status: formData.status
      };
      await api.post("/shipments", payload);
      setShowModal(false);
      setFormData({
        source: "",
        destination: "",
        customer_name: "",
        shipment_weight: "",
        vehicle_id: "",
        driver_id: "",
        status: "Created"
      });
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to register shipment record.");
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation(); // Prevent card navigation click
    if (!window.confirm("Are you sure you want to delete this shipment? This action cannot be undone.")) return;
    try {
      await api.delete(`/shipments/${id}`);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to delete shipment registry.");
    }
  };

  const getStatusBadge = (status) => {
    const s = status?.toLowerCase() || "created";
    switch (s) {
      case "created": return { class: "ff-badge-blue", label: "Created" };
      case "assigned": return { class: "ff-badge-emerald", label: "Assigned" };
      case "in transit": return { class: "ff-badge-blue", label: "In Transit" };
      case "delayed": return { class: "ff-badge-amber", label: "Delayed" };
      case "delivered": return { class: "ff-badge-emerald", label: "Delivered" };
      case "cancelled": return { class: "ff-badge-rose", label: "Cancelled" };
      default: return { class: "ff-badge-blue", label: status };
    }
  };

  const filteredShipments = shipments.filter(s => 
    s.tracking_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.source?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.destination?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const delayedShipments = shipments.filter(s => s.status?.toLowerCase() === "delayed");

  if (loading) {
    return (
      <AppLayout title="Shipment Registry & Tracking" subtitle="Manage customer shipments, track real-time deliveries, and view logistics alerts">
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "350px", flexDirection: "column", gap: "1rem" }}>
          <div className="ff-pulse-dot" style={{ width: "36px", height: "36px", background: "#6366f1" }} />
          <p style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: 500 }}>Fetching logistics data...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Shipment Registry & Tracking" subtitle="Manage customer shipments, track real-time deliveries, and view logistics alerts across India">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* Delayed shipments warning banner */}
        {delayedShipments.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }}
            style={{ 
              background: "#fffbeb", 
              border: "1.5px solid #fde68a", 
              borderRadius: "1rem", 
              padding: "1rem 1.25rem", 
              display: "flex", 
              alignItems: "center", 
              gap: "0.75rem",
              boxShadow: "0 4px 12px rgba(217, 119, 6, 0.05)"
            }}
          >
            <AlertTriangle color="#d97706" size={20} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#92400e" }}>Delayed Shipment Alerts</h4>
              <p style={{ fontSize: "0.8125rem", color: "#b45309", marginTop: "0.125rem" }}>
                There are {delayedShipments.length} shipment(s) currently experiencing transit delays. Check active routes to recalculate ETAs.
              </p>
            </div>
          </motion.div>
        )}

        {/* Action controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "250px", maxWidth: "450px" }}>
            <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)" }} />
            <input 
              type="text" 
              placeholder="Search by tracking #, source, destination, customer..." 
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
              <span>Register Shipment</span>
            </motion.button>
          )}
        </div>

        {/* Error notification */}
        {error && (
          <div style={{ background: "#fef2f2", border: "1.5px solid #fecdd3", color: "#991b1b", borderRadius: "0.75rem", padding: "1rem", fontSize: "0.875rem" }}>
            {error}
          </div>
        )}

        {/* Shipments Grid */}
        {filteredShipments.length === 0 ? (
          <div style={{ background: "white", borderRadius: "1.25rem", border: "1.5px solid rgba(15,23,42,0.06)", padding: "3rem", textAlign: "center" }}>
            <Package size={48} color="#94a3b8" style={{ margin: "0 auto 1rem" }} />
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>No Shipments Found</h3>
            <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.25rem" }}>There are no registered shipments matching your filters.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
            {filteredShipments.map((s) => {
              const badge = getStatusBadge(s.status);
              return (
                <motion.div
                  key={s.shipment_id}
                  whileHover={{ y: -3, boxShadow: "0 8px 24px rgba(15,23,42,0.08)" }}
                  onClick={() => navigate(`/shipments/${s.shipment_id}`)}
                  style={{
                    background: "white",
                    border: "1.5px solid rgba(15,23,42,0.06)",
                    borderRadius: "1.25rem",
                    padding: "1.25rem",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    boxShadow: "0 2px 8px rgba(15,23,42,0.02)",
                    transition: "box-shadow 0.2s"
                  }}
                >
                  <div>
                    {/* Header: Tracking # & Status */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a" }}>
                        {s.tracking_number}
                      </span>
                      <span className={`ff-badge ${badge.class}`} style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem" }}>
                        {badge.label}
                      </span>
                    </div>

                    {/* Customer */}
                    <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#334155", marginBottom: "1rem" }}>
                      {s.customer_name}
                    </h3>

                    {/* Routing parameters */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "#f8fafc", padding: "0.625rem 0.875rem", borderRadius: "0.875rem", border: "1px dashed rgba(15,23,42,0.06)", fontSize: "0.8125rem", color: "#64748b", marginBottom: "1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <MapPin size={13} color="#6366f1" />
                        <span style={{ fontWeight: 600, color: "#475569" }}>{s.source}</span>
                      </div>
                      <ArrowRight size={12} color="#94a3b8" />
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <MapPin size={13} color="#ef4444" />
                        <span style={{ fontWeight: 600, color: "#475569" }}>{s.destination}</span>
                      </div>
                    </div>

                    {/* Details: weight, driver, vehicle */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.8125rem", color: "#64748b" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Cargo Weight:</span>
                        <span style={{ fontWeight: 600, color: "#334155" }}>{s.shipment_weight} kg</span>
                      </div>
                      
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <Truck size={13} />
                          <span>Vehicle:</span>
                        </span>
                        <span style={{ fontWeight: 600, color: s.vehicle_reg ? "#334155" : "#94a3b8" }}>
                          {s.vehicle_reg || "Unassigned"}
                        </span>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <User size={13} />
                          <span>Driver:</span>
                        </span>
                        <span style={{ fontWeight: 600, color: s.driver_name ? "#334155" : "#94a3b8" }}>
                          {s.driver_name || "Unassigned"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.25rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(15,23,42,0.06)" }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/shipments/${s.shipment_id}`); }}
                      style={{
                        padding: "0.375rem 0.75rem",
                        borderRadius: "0.5rem",
                        border: "1.5px solid rgba(15,23,42,0.08)",
                        background: "transparent",
                        color: "#475569",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        transition: "background 0.15s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <Eye size={12} />
                      <span>Track</span>
                    </button>
                    
                    {isOpsRole && (
                      <button
                        onClick={(e) => handleDelete(s.shipment_id, e)}
                        style={{
                          padding: "0.375rem 0.75rem",
                          borderRadius: "0.5rem",
                          border: "1.5px solid #fee2e2",
                          background: "transparent",
                          color: "#ef4444",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          transition: "background 0.15s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#fee2e2"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <Trash2 size={12} />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Register Shipment Modal */}
        <AnimatePresence>
          {showModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(15, 23, 42, 0.4)",
                backdropFilter: "blur(4px)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "1rem",
                zIndex: 100
              }}
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                style={{
                  background: "white",
                  borderRadius: "1.5rem",
                  border: "1.5px solid rgba(15,23,42,0.08)",
                  padding: "2rem",
                  width: "100%",
                  maxWidth: "500px",
                  boxShadow: "0 20px 48px rgba(15,23,42,0.15)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.5rem"
                }}
              >
                <div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a" }}>Register New Shipment</h3>
                  <p style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.25rem" }}>
                    Select or type any source and destination in India.
                  </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Source City / Location</label>
                      <input
                        type="text"
                        name="source"
                        list="india-cities-source"
                        required
                        placeholder="e.g. Mumbai, Surat, any city..."
                        value={formData.source}
                        onChange={handleChange}
                        style={{
                          padding: "0.625rem 0.75rem",
                          borderRadius: "0.75rem",
                          border: "1.5px solid rgba(15,23,42,0.08)",
                          fontSize: "0.875rem",
                          background: "white"
                        }}
                      />
                      <datalist id="india-cities-source">
                        {MAJOR_INDIAN_CITIES.map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Destination City / Location</label>
                      <input
                        type="text"
                        name="destination"
                        list="india-cities-dest"
                        required
                        placeholder="e.g. Delhi, Jaipur, any city..."
                        value={formData.destination}
                        onChange={handleChange}
                        style={{
                          padding: "0.625rem 0.75rem",
                          borderRadius: "0.75rem",
                          border: "1.5px solid rgba(15,23,42,0.08)",
                          fontSize: "0.875rem",
                          background: "white"
                        }}
                      />
                      <datalist id="india-cities-dest">
                        {MAJOR_INDIAN_CITIES.map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Customer Name</label>
                    <input
                      type="text"
                      name="customer_name"
                      required
                      placeholder="e.g. Acme Corporation"
                      value={formData.customer_name}
                      onChange={handleChange}
                      style={{
                        padding: "0.625rem 0.75rem",
                        borderRadius: "0.75rem",
                        border: "1.5px solid rgba(15,23,42,0.08)",
                        fontSize: "0.875rem"
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Shipment Weight (kg)</label>
                    <input
                      type="number"
                      name="shipment_weight"
                      required
                      min="1"
                      placeholder="e.g. 500"
                      value={formData.shipment_weight}
                      onChange={handleChange}
                      style={{
                        padding: "0.625rem 0.75rem",
                        borderRadius: "0.75rem",
                        border: "1.5px solid rgba(15,23,42,0.08)",
                        fontSize: "0.875rem"
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Assign Vehicle (Optional)</label>
                    <select
                      name="vehicle_id"
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
                      <option value="">Leave Unassigned</option>
                      {vehicles.map(v => (
                        <option key={v.vehicle_id} value={v.vehicle_id}>
                          {v.registration_number} - {v.brand} {v.model} ({v.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Assign Driver (Optional)</label>
                    <select
                      name="driver_id"
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
                      <option value="">Leave Unassigned</option>
                      {drivers.map(d => (
                        <option key={d.driver_id} value={d.driver_id}>
                          {d.full_name} ({d.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Actions buttons */}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
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
                      Create Shipment
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </AppLayout>
  );
}
