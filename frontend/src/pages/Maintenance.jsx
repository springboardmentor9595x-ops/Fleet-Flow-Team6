import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wrench, Plus, Trash2, Calendar, DollarSign, PenSquare, Search, AlertCircle, AlertTriangle } from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";

export default function Maintenance() {
  const [records, setRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const defaultForm = {
    vehicle_id: "",
    maintenance_type: "",
    service_date: new Date().toISOString().split("T")[0],
    next_service_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    cost: "",
    remarks: "",
    status: "pending"
  };
  const [formData, setFormData] = useState(defaultForm);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [maintenanceRes, vehiclesRes] = await Promise.all([
        api.get("/fleet/maintenance"),
        api.get("/fleet/vehicles")
      ]);
      setRecords(maintenanceRes.data);
      setVehicles(vehiclesRes.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch maintenance registry.");
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
      await api.post("/fleet/maintenance", formData);
      setShowModal(false);
      setFormData(defaultForm);
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to submit service logs.");
    }
  };

  const handleEdit = (record) => {
    setEditRecord(record);
    setFormData({
      vehicle_id: record.vehicle_id,
      maintenance_type: record.maintenance_type,
      service_date: record.service_date.substring(0, 10),
      next_service_date: record.next_service_date.substring(0, 10),
      cost: record.cost,
      remarks: record.remarks || "",
      status: record.status
    });
    setShowModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/fleet/maintenance/${editRecord.maintenance_id}`, formData);
      setShowModal(false);
      setEditRecord(null);
      setFormData(defaultForm);
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to update maintenance record.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this maintenance entry?")) return;
    try {
      await api.delete(`/fleet/maintenance/${id}`);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to delete log entry.");
    }
  };

  const isOverdue = (dateStr, status) => {
    if (status !== "pending") return false;
    const nextDate = new Date(dateStr);
    return nextDate < new Date();
  };

  const filteredRecords = records.filter(r => 
    r.vehicle_reg?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.maintenance_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.remarks?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout title="Maintenance Scheduler" subtitle="Schedule checkups, log engine services, and track maintenance expenses">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* Controls row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: "320px" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input 
              type="text" 
              placeholder="Search by vehicle reg, service type..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ff-input"
              style={{ paddingLeft: "2.25rem" }}
            />
          </div>
          <button onClick={() => { setEditRecord(null); setFormData(defaultForm); setShowModal(true); }} className="ff-btn-primary">
            <Plus size={16} />
            Log Service
          </button>
        </div>

        {/* Maintenance records grid */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "250px", flexDirection: "column", gap: "1rem" }}>
            <div className="ff-pulse-dot" style={{ width: "36px", height: "36px", background: "#d97706" }} />
            <p style={{ fontSize: "0.875rem", color: "#64748b" }}>Loading maintenance logs...</p>
          </div>
        ) : error ? (
          <div className="ff-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ textAlignment: "center", padding: "3rem", background: "white", borderRadius: "1rem", border: "1.5px solid rgba(15,23,42,0.06)", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <Wrench size={48} color="#94a3b8" />
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>No maintenance logs</h3>
              <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.25rem" }}>No data available. Log a service to get started.</p>
            </div>
          </div>
        ) : (
          <motion.div 
            layout 
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}
          >
            <AnimatePresence>
              {filteredRecords.map((log) => {
                const overdue = isOverdue(log.next_service_date, log.status);
                return (
                  <motion.div 
                    key={log.maintenance_id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="ff-card"
                    style={{ 
                      display: "flex", 
                      flexDirection: "column", 
                      padding: "1.5rem", 
                      gap: "1rem", 
                      borderLeft: overdue ? "4px solid #e11d48" : "1.5px solid rgba(15,23,42,0.08)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                      <div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontFamily: "monospace", fontSize: "0.8125rem", background: "#f1f5f9", color: "#475569", padding: "0.125rem 0.5rem", borderRadius: "0.375rem" }}>
                          {log.vehicle_reg}
                        </div>
                        <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginTop: "0.375rem" }}>{log.maintenance_type}</h4>
                      </div>
                      
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
                        <span className={`ff-badge ${log.status === "completed" ? "ff-badge-emerald" : "ff-badge-amber"}`}>
                          {log.status}
                        </span>
                        {overdue && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "#e11d48", fontSize: "0.6875rem", fontWeight: 700 }}>
                            <AlertTriangle size={12} />
                            Overdue
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", fontSize: "0.8125rem", color: "#475569" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Calendar size={13} color="#94a3b8" />
                        <span>Serviced: {log.service_date.substring(0, 10)}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Calendar size={13} color="#94a3b8" />
                        <span>Next Check: <strong>{log.next_service_date.substring(0, 10)}</strong></span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <DollarSign size={13} color="#94a3b8" />
                        <span>Cost: <strong>₹{log.cost.toLocaleString()}</strong></span>
                      </div>
                    </div>

                    {log.remarks && (
                      <div style={{ fontSize: "0.75rem", color: "#64748b", background: "#f8fafc", padding: "0.625rem", borderRadius: "0.5rem", border: "1px dashed rgba(15,23,42,0.06)" }}>
                        {log.remarks}
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "auto", paddingTop: "0.5rem" }}>
                      <button 
                        onClick={() => handleEdit(log)}
                        title="Edit record"
                        style={{ background: "transparent", border: "none", color: "#3b82f6", padding: "0.375rem", borderRadius: "0.5rem", cursor: "pointer", display: "flex", alignItems: "center", transition: "background 0.2s" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#eff6ff"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <PenSquare size={15} />
                      </button>
                      <button 
                        onClick={() => handleDelete(log.maintenance_id)}
                        title="Delete record"
                        style={{ background: "transparent", border: "none", color: "#e11d48", padding: "0.375rem", borderRadius: "0.5rem", cursor: "pointer", display: "flex", alignItems: "center", transition: "background 0.2s" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#fff1f2"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Log Service Modal */}
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
                  <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>{editRecord ? "Edit Maintenance Record" : "Log Service Checkup"}</h3>
                  <p style={{ fontSize: "0.8125rem", color: "#64748b" }}>{editRecord ? "Update service details and status for this maintenance entry" : "Record mechanical checks, part replacements, and overall service costs"}</p>
                </div>

                <form onSubmit={editRecord ? handleEditSubmit : handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div>
                    <label className="ff-label">Select Vehicle</label>
                    <select name="vehicle_id" required value={formData.vehicle_id} onChange={handleChange} className="ff-select">
                      <option value="">-- Choose Vehicle --</option>
                      {vehicles.map(v => (
                        <option key={v.vehicle_id} value={v.vehicle_id}>{v.registration_number} - {v.brand} {v.model} ({v.status})</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="ff-label">Service Type</label>
                    <input type="text" name="maintenance_type" required value={formData.maintenance_type} onChange={handleChange} className="ff-input" placeholder="e.g. Engine Tune-up, Brake Pad Replacement" />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div>
                      <label className="ff-label">Service Date</label>
                      <input type="date" name="service_date" required value={formData.service_date} onChange={handleChange} className="ff-input" />
                    </div>
                    <div>
                      <label className="ff-label">Next Service Due</label>
                      <input type="date" name="next_service_date" required value={formData.next_service_date} onChange={handleChange} className="ff-input" />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div>
                      <label className="ff-label">Service Cost (₹)</label>
                      <input type="number" step="1" name="cost" required value={formData.cost} onChange={handleChange} className="ff-input" placeholder="4500" />
                    </div>
                    <div>
                      <label className="ff-label">Status</label>
                      <select name="status" value={formData.status} onChange={handleChange} className="ff-select">
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="ff-label">Service Remarks / Notes</label>
                    <textarea name="remarks" value={formData.remarks} onChange={handleChange} className="ff-input" style={{ minHeight: "60px", resize: "vertical" }} placeholder="e.g. Front tires replaced; brakes aligned." />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                    <button type="button" onClick={() => setShowModal(false)} className="ff-btn-ghost">Cancel</button>
                    <button type="submit" className="ff-btn-primary">Save Log</button>
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
