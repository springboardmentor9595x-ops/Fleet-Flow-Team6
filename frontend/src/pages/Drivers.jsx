import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Shield, Plus, Trash2, Phone, Mail, FileText, UserPlus, Search, AlertCircle } from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    license_number: "",
    experience_years: "",
    address: "",
    status: "Active"
  });

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/fleet/drivers");
      setDrivers(res.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch drivers list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/fleet/drivers", formData);
      setShowModal(false);
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        license_number: "",
        experience_years: "",
        address: "",
        status: "Active"
      });
      fetchDrivers();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to create driver profile.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this driver? This will also delete their login account.")) return;
    try {
      await api.delete(`/fleet/drivers/${id}`);
      fetchDrivers();
    } catch (err) {
      console.error(err);
      alert("Failed to delete driver.");
    }
  };

  const filteredDrivers = drivers.filter(d => 
    d.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.license_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout title="Drivers Directory" subtitle="Manage and monitor system drivers and their credentials">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* Controls row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: "320px" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input 
              type="text" 
              placeholder="Search by name, email, license..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ff-input"
              style={{ paddingLeft: "2.25rem" }}
            />
          </div>
          <button onClick={() => setShowModal(true)} className="ff-btn-primary">
            <UserPlus size={16} />
            Add Driver
          </button>
        </div>

        {/* Driver grid */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "250px", flexDirection: "column", gap: "1rem" }}>
            <div className="ff-pulse-dot" style={{ width: "36px", height: "36px", background: "#6366f1" }} />
            <p style={{ fontSize: "0.875rem", color: "#64748b" }}>Loading drivers registry...</p>
          </div>
        ) : error ? (
          <div className="ff-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div style={{ textAlignment: "center", padding: "3rem", background: "white", borderRadius: "1rem", border: "1.5px solid rgba(15,23,42,0.06)", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <User size={48} color="#94a3b8" />
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>No Drivers Found</h3>
              <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.25rem" }}>No data available. Add a driver to get started.</p>
            </div>
          </div>
        ) : (
          <motion.div 
            layout 
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}
          >
            <AnimatePresence>
              {filteredDrivers.map((driver) => (
                <motion.div 
                  key={driver.driver_id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="ff-card"
                  style={{ display: "flex", flexDirection: "column", padding: "1.5rem", gap: "1rem" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700 }}>
                        {driver.full_name?.substring(0, 2).toUpperCase() || "DR"}
                      </div>
                      <div>
                        <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a" }}>{driver.full_name}</h4>
                        <p style={{ fontSize: "0.75rem", color: "#64748b" }}>{driver.experience_years} years exp</p>
                      </div>
                    </div>
                    <span className={`ff-badge ${driver.status === "Active" ? "ff-badge-emerald" : "ff-badge-amber"}`}>
                      {driver.status}
                    </span>
                  </div>

                  <hr style={{ border: "none", borderTop: "1px solid rgba(15,23,42,0.06)" }} />

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.8125rem", color: "#475569" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Mail size={14} color="#94a3b8" />
                      <span>{driver.email}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Phone size={14} color="#94a3b8" />
                      <span>{driver.phone}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <FileText size={14} color="#94a3b8" />
                      <span>Lic: <strong>{driver.license_number}</strong></span>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "auto", paddingTop: "0.5rem" }}>
                    <button 
                      onClick={() => handleDelete(driver.driver_id)}
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

        {/* Create driver modal */}
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
                  <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>Register New Driver</h3>
                  <p style={{ fontSize: "0.8125rem", color: "#64748b" }}>Create user credentials and system driver profile</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div>
                    <label className="ff-label">Full Name</label>
                    <input type="text" name="full_name" required value={formData.full_name} onChange={handleChange} className="ff-input" placeholder="e.g. Marcus Lee" />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div>
                      <label className="ff-label">Email Address</label>
                      <input type="email" name="email" required value={formData.email} onChange={handleChange} className="ff-input" placeholder="marcus@example.com" />
                    </div>
                    <div>
                      <label className="ff-label">Phone Number</label>
                      <input type="text" name="phone" required value={formData.phone} onChange={handleChange} className="ff-input" placeholder="9876543210" />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div>
                      <label className="ff-label">License Number</label>
                      <input type="text" name="license_number" required value={formData.license_number} onChange={handleChange} className="ff-input" placeholder="DL-TN42A..." />
                    </div>
                    <div>
                      <label className="ff-label">Experience (Years)</label>
                      <input type="number" name="experience_years" required value={formData.experience_years} onChange={handleChange} className="ff-input" placeholder="5" />
                    </div>
                  </div>
                  <div>
                    <label className="ff-label">Home Address</label>
                    <input type="text" name="address" value={formData.address} onChange={handleChange} className="ff-input" placeholder="City details, State" />
                  </div>
                  <div>
                    <label className="ff-label">Status</label>
                    <select name="status" value={formData.status} onChange={handleChange} className="ff-select">
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                    <button type="button" onClick={() => setShowModal(false)} className="ff-btn-ghost">Cancel</button>
                    <button type="submit" className="ff-btn-primary">Register Driver</button>
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
