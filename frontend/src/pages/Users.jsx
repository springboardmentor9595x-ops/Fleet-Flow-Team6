import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Plus, Trash2, Mail, Phone, Shield, Search, AlertCircle } from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "Driver",
    password: "password123"
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/fleet/users");
      setUsers(res.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load user accounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/fleet/users", formData);
      setShowModal(false);
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        role: "Driver",
        password: "password123"
      });
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to create user account.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await api.delete(`/fleet/users/${id}`);
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert("Failed to delete user.");
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role?.toLowerCase()) {
      case "admin": return "ff-badge-rose";
      case "fleetmanager": return "ff-badge-violet";
      case "dispatcher": return "ff-badge-blue";
      default: return "ff-badge-emerald";
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout title="Users Directory" subtitle="View and manage corporate roles, system operators, and permissions">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* Controls row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: "320px" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input 
              type="text" 
              placeholder="Search by name, email, role..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ff-input"
              style={{ paddingLeft: "2.25rem" }}
            />
          </div>
          <button onClick={() => setShowModal(true)} className="ff-btn-primary">
            <Plus size={16} />
            Create User
          </button>
        </div>

        {/* Users Table */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "250px", flexDirection: "column", gap: "1rem" }}>
            <div className="ff-pulse-dot" style={{ width: "36px", height: "36px", background: "#6366f1" }} />
            <p style={{ fontSize: "0.875rem", color: "#64748b" }}>Loading system operators registry...</p>
          </div>
        ) : error ? (
          <div className="ff-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ textAlignment: "center", padding: "3rem", background: "white", borderRadius: "1rem", border: "1.5px solid rgba(15,23,42,0.06)", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <User size={48} color="#94a3b8" />
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>No Users Found</h3>
              <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.25rem" }}>No data available. Create a user to get started.</p>
            </div>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 12 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="ff-card" 
            style={{ padding: "1.5rem", overflowX: "auto" }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr>
                  {["User Details", "Contact", "System Role", "Actions"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "0.75rem 1rem", color: "#94a3b8", fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.05em", textTransform: "uppercase", borderBottom: "1.5px solid #f1f5f9" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.user_id} style={{ borderBottom: "1px solid #f8fafc", transition: "background 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700 }}>
                          {u.full_name?.substring(0, 2).toUpperCase() || "US"}
                        </div>
                        <div>
                          <p style={{ fontWeight: 700, color: "#0f172a" }}>{u.full_name}</p>
                          <span style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>ID: {u.user_id.substring(0, 8)}...</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "1rem", color: "#475569" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.8125rem" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}><Mail size={12} color="#94a3b8" /> {u.email}</span>
                        {u.phone && <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}><Phone size={12} color="#94a3b8" /> {u.phone}</span>}
                      </div>
                    </td>
                    <td style={{ padding: "1rem" }}>
                      <span className={`ff-badge ${getRoleBadgeClass(u.role)}`}>
                        <Shield size={10} style={{ marginRight: "2px" }} />
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: "1rem" }}>
                      <button 
                        onClick={() => handleDelete(u.user_id)}
                        style={{ background: "transparent", border: "none", color: "#e11d48", padding: "0.375rem", borderRadius: "0.5rem", cursor: "pointer", display: "flex", alignItems: "center", transition: "background 0.2s" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#fff1f2"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}

        {/* Create User Modal */}
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
                style={{ position: "relative", width: "100%", maxWidth: "440px", background: "white", borderRadius: "1.25rem", padding: "1.5rem", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", zIndex: 101, display: "flex", flexDirection: "column", gap: "1.25rem" }}
              >
                <div>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>Register System User</h3>
                  <p style={{ fontSize: "0.8125rem", color: "#64748b" }}>Create an administrative or driver profile credential</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div>
                    <label className="ff-label">Full Name</label>
                    <input type="text" name="full_name" required value={formData.full_name} onChange={handleChange} className="ff-input" placeholder="e.g. Prajwal R" />
                  </div>
                  
                  <div>
                    <label className="ff-label">Email Address</label>
                    <input type="email" name="email" required value={formData.email} onChange={handleChange} className="ff-input" placeholder="praj@example.com" />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div>
                      <label className="ff-label">Phone Number</label>
                      <input type="text" name="phone" required value={formData.phone} onChange={handleChange} className="ff-input" placeholder="9876543210" />
                    </div>
                    <div>
                      <label className="ff-label">Role</label>
                      <select name="role" value={formData.role} onChange={handleChange} className="ff-select">
                        <option value="Admin">Admin</option>
                        <option value="FleetManager">FleetManager</option>
                        <option value="Driver">Driver</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="ff-label">Password</label>
                    <input type="password" name="password" required value={formData.password} onChange={handleChange} className="ff-input" />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                    <button type="button" onClick={() => setShowModal(false)} className="ff-btn-ghost">Cancel</button>
                    <button type="submit" className="ff-btn-primary">Register User</button>
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