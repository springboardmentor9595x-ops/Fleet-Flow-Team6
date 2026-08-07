import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Truck, Plus, Trash2, Fuel, Weight, Check, Search, AlertCircle, UserCheck } from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    registration_number: "",
    vehicle_type: "Cargo Van",
    brand: "",
    model: "",
    manufacture_year: new Date().getFullYear(),
    fuel_type: "Diesel",
    capacity: "",
    assigned_driver: "",
    status: "Available"
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [vehiclesRes, driversRes] = await Promise.all([
        api.get("/fleet/vehicles"),
        api.get("/fleet/drivers")
      ]);
      setVehicles(vehiclesRes.data);
      setDrivers(driversRes.data.filter(d => d.status === "Active"));
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch vehicles details.");
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
    try {
      await api.post("/fleet/vehicles", formData);
      setShowModal(false);
      setFormData({
        registration_number: "",
        vehicle_type: "Cargo Van",
        brand: "",
        model: "",
        manufacture_year: new Date().getFullYear(),
        fuel_type: "Diesel",
        capacity: "",
        assigned_driver: "",
        status: "Available"
      });
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to register vehicle.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this vehicle?")) return;
    try {
      await api.delete(`/fleet/vehicles/${id}`);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to delete vehicle.");
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case "available": return "ff-badge-emerald";
      case "active": return "ff-badge-blue";
      case "maintenance": return "ff-badge-amber";
      default: return "ff-badge-rose";
    }
  };

  const filteredVehicles = vehicles.filter(v => 
    v.registration_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.vehicle_type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout title="Fleet Inventory" subtitle="Monitor vehicle health, assignments, and structural specifications">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* Controls row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: "320px" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input 
              type="text" 
              placeholder="Search by registration number, brand, model..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ff-input"
              style={{ paddingLeft: "2.25rem" }}
            />
          </div>
          <button onClick={() => setShowModal(true)} className="ff-btn-primary">
            <Plus size={16} />
            Add Vehicle
          </button>
        </div>

        {/* Vehicles grid */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "250px", flexDirection: "column", gap: "1rem" }}>
            <div className="ff-pulse-dot" style={{ width: "36px", height: "36px", background: "#3b82f6" }} />
            <p style={{ fontSize: "0.875rem", color: "#64748b" }}>Loading vehicle cards...</p>
          </div>
        ) : error ? (
          <div className="ff-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div style={{ textAlignment: "center", padding: "3rem", background: "white", borderRadius: "1rem", border: "1.5px solid rgba(15,23,42,0.06)", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <Truck size={48} color="#94a3b8" />
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>No Vehicles Found</h3>
              <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.25rem" }}>No data available. Add a vehicle to get started.</p>
            </div>
          </div>
        ) : (
          <motion.div 
            layout 
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}
          >
            <AnimatePresence>
              {filteredVehicles.map((vehicle) => (
                <motion.div 
                  key={vehicle.vehicle_id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="ff-card"
                  style={{ display: "flex", flexDirection: "column", padding: "1.5rem", gap: "1.25rem" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <span style={{ fontFamily: "monospace", fontSize: "0.8125rem", background: "#f1f5f9", color: "#475569", padding: "0.125rem 0.5rem", borderRadius: "0.375rem", fontWeight: 600 }}>
                        {vehicle.registration_number}
                      </span>
                      <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginTop: "0.375rem" }}>
                        {vehicle.brand} {vehicle.model}
                      </h4>
                    </div>
                    <span className={`ff-badge ${getStatusBadge(vehicle.status)}`}>
                      {vehicle.status}
                    </span>
                  </div>

                  <hr style={{ border: "none", borderTop: "1px solid rgba(15,23,42,0.06)" }} />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.8125rem", color: "#475569" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      <Fuel size={14} color="#94a3b8" />
                      <span>{vehicle.fuel_type}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      <Weight size={14} color="#94a3b8" />
                      <span>{vehicle.capacity} kg</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", gridColumn: "span 2" }}>
                      <UserCheck size={14} color="#94a3b8" />
                      <span>Driver: <strong>{vehicle.assigned_driver_name}</strong></span>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: "0.5rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 500 }}>
                      Type: {vehicle.vehicle_type}
                    </span>
                    <button 
                      onClick={() => handleDelete(vehicle.vehicle_id)}
                      style={{ background: "transparent", border: "none", color: "#e11d48", padding: "0.375rem", borderRadius: "0.5rem", cursor: "pointer", display: "flex", alignItems: "center", transition: "background 0.2s" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#fff1f2"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Create Vehicle Modal */}
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
                style={{ position: "relative", width: "100%", maxWidth: "480px", background: "white", borderRadius: "1.25rem", padding: "1.5rem", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", zIndex: 101, display: "flex", flexDirection: "column", gap: "1.25rem" }}
              >
                <div>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>Add Vehicle Profile</h3>
                  <p style={{ fontSize: "0.8125rem", color: "#64748b" }}>Register truck or van structural specs and crew assignment</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div>
                      <label className="ff-label">Registration No.</label>
                      <input type="text" name="registration_number" required value={formData.registration_number} onChange={handleChange} className="ff-input" placeholder="e.g. TRK-099" />
                    </div>
                    <div>
                      <label className="ff-label">Vehicle Type</label>
                      <select name="vehicle_type" value={formData.vehicle_type} onChange={handleChange} className="ff-select">
                        <option value="Cargo Van">Cargo Van</option>
                        <option value="Box Truck">Box Truck</option>
                        <option value="Heavy Duty">Heavy Duty</option>
                        <option value="SUV">SUV</option>
                        <option value="Sedan">Sedan</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div>
                      <label className="ff-label">Brand</label>
                      <input type="text" name="brand" required value={formData.brand} onChange={handleChange} className="ff-input" placeholder="e.g. Tata" />
                    </div>
                    <div>
                      <label className="ff-label">Model</label>
                      <input type="text" name="model" required value={formData.model} onChange={handleChange} className="ff-input" placeholder="e.g. Ultra 1918" />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div>
                      <label className="ff-label">Manufacture Year</label>
                      <input type="number" name="manufacture_year" required value={formData.manufacture_year} onChange={handleChange} className="ff-input" />
                    </div>
                    <div>
                      <label className="ff-label">Capacity (kg)</label>
                      <input type="number" name="capacity" required value={formData.capacity} onChange={handleChange} className="ff-input" placeholder="3000" />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div>
                      <label className="ff-label">Fuel Type</label>
                      <select name="fuel_type" value={formData.fuel_type} onChange={handleChange} className="ff-select">
                        <option value="Diesel">Diesel</option>
                        <option value="Petrol">Petrol</option>
                        <option value="CNG">CNG</option>
                        <option value="Electric">Electric</option>
                      </select>
                    </div>
                    <div>
                      <label className="ff-label">Status</label>
                      <select name="status" value={formData.status} onChange={handleChange} className="ff-select">
                        <option value="Available">Available</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Active">Active</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="ff-label">Assign Active Driver</label>
                    <select name="assigned_driver" value={formData.assigned_driver} onChange={handleChange} className="ff-select">
                      <option value="">-- No Assigned Driver --</option>
                      {drivers.map(d => (
                        <option key={d.driver_id} value={d.driver_id}>{d.full_name} (Lic: {d.license_number})</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                    <button type="button" onClick={() => setShowModal(false)} className="ff-btn-ghost">Cancel</button>
                    <button type="submit" className="ff-btn-primary">Register Vehicle</button>
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