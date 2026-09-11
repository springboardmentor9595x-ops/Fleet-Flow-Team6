import React, { useEffect, useState } from "react";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import {
  getAllUsers,
  createUserByAdmin,
  updateUserByAdmin,
  updateUserRole,
  deleteUser,
} from "../api/userApi";

const ROLE_COLORS = {
  Admin: { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444", border: "rgba(239, 68, 68, 0.35)" },
  FleetManager: { bg: "rgba(59, 130, 246, 0.15)", text: "#3b82f6", border: "rgba(59, 130, 246, 0.35)" },
  Dispatcher: { bg: "rgba(139, 92, 246, 0.15)", text: "#8b5cf6", border: "rgba(139, 92, 246, 0.35)" },
  Driver: { bg: "rgba(16, 185, 129, 0.15)", text: "#10b981", border: "rgba(16, 185, 129, 0.35)" },
};

export default function Users() {
  const { user: currentUser, token, refreshProfile } = useAuth();
  // Determine Admin status from the live user object
  const isAdmin = currentUser?.role === "Admin";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    role: "Driver",
  });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadUsers = async () => {
    // Hard-guard: only fire if currentUser is fully loaded AND is truly Admin
    if (!currentUser || currentUser.role !== "Admin" || !token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (err) {
      if (err?.response?.status === 403) {
        console.warn("Users.jsx: 403 Forbidden — token user is not Admin. Syncing profile...");
        if (refreshProfile) {
          refreshProfile();
        }
        setLoading(false);
        return;
      }
      console.error("Failed to load users:", err);
      showToast(err?.response?.data?.detail || "Failed to load user records.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wait for both auth token AND user object to settle before deciding
    if (currentUser && token) {
      if (currentUser.role === "Admin") {
        loadUsers();
      } else {
        setLoading(false);
      }
    }
    // If still loading auth (both null), do nothing — loading stays true
  }, [currentUser, token]);


  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      await createUserByAdmin(formData);
      showToast(`User ${formData.full_name} created successfully!`);
      setShowAddModal(false);
      setFormData({ full_name: "", email: "", phone: "", password: "", role: "Driver" });
      loadUsers();
    } catch (err) {
      setFormError(err?.response?.data?.detail || "Failed to create user.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormError("");
    setFormLoading(true);
    try {
      await updateUserByAdmin(selectedUser.user_id, {
        full_name: selectedUser.full_name,
        phone: selectedUser.phone,
        role: selectedUser.role,
      });
      showToast(`User ${selectedUser.full_name} updated successfully!`);
      setShowEditModal(false);
      loadUsers();
    } catch (err) {
      setFormError(err?.response?.data?.detail || "Failed to update user.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleQuickRoleChange = async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? { ...u, role: newRole } : u))
      );
      showToast("User role updated successfully.");
    } catch (err) {
      showToast(err?.response?.data?.detail || "Failed to update role.", "error");
    }
  };

  const handleDeleteUser = async (u) => {
    if (u.user_id === currentUser.user_id) {
      alert("You cannot delete your own admin account.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete user "${u.full_name}" (${u.email})?`)) {
      return;
    }
    try {
      await deleteUser(u.user_id);
      showToast(`User ${u.full_name} deleted.`);
      setUsers((prev) => prev.filter((item) => item.user_id !== u.user_id));
    } catch (err) {
      showToast(err?.response?.data?.detail || "Failed to delete user.", "error");
    }
  };

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.phone || "").includes(search);
    const matchesRole = roleFilter === "All" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const countByRole = {
    Admin: users.filter((u) => u.role === "Admin").length,
    FleetManager: users.filter((u) => u.role === "FleetManager").length,
    Dispatcher: users.filter((u) => u.role === "Dispatcher").length,
    Driver: users.filter((u) => u.role === "Driver").length,
  };

  if (!isAdmin) {
    return (
      <Layout>
        <div style={{ padding: "80px 32px", textAlign: "center", maxWidth: 520, margin: "0 auto" }}>
          <div style={{ fontSize: "3.5rem", marginBottom: 16 }}>🔒</div>
          <h2 style={{ color: "#f1f5f9", fontSize: "1.6rem", fontWeight: 800 }}>Admin Access Required</h2>
          <p style={{ color: "rgba(255,255,255,0.6)", marginTop: 10, lineHeight: 1.6, fontSize: "0.92rem" }}>
            The User Management screen is restricted to system <strong>Administrators</strong>. You are currently logged in as:
          </p>
          <div style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            padding: "12px 18px", borderRadius: 10, margin: "16px 0 24px", color: "#818cf8", fontWeight: 600
          }}>
            {currentUser?.email || "Unknown"} &bull; <span style={{ color: "#f59e0b" }}>Role: {currentUser?.role || "Guest"}</span>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <a
              href="/dashboard"
              className="btn btn-primary"
              style={{ textDecoration: "none" }}
            >
              ← Return to Dashboard
            </a>
          </div>
        </div>
      </Layout>
    );
  }


  return (
    <Layout>
      <div style={{ padding: "28px 32px", minHeight: "100vh", maxWidth: 1320 }}>
        {/* Toast */}
        {toast && (
          <div style={{
            position: "fixed", top: 24, right: 24, zIndex: 9999,
            padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: "0.88rem",
            background: toast.type === "error" ? "rgba(239,68,68,0.9)" : "rgba(16,185,129,0.9)",
            color: "#fff", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", backdropFilter: "blur(8px)"
          }}>
            {toast.msg}
          </div>
        )}

        {/* Page Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.9rem", fontWeight: 800, letterSpacing: "-0.5px" }}>
              👥 User Management
            </h1>
            <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.5)", fontSize: "0.88rem" }}>
              Manage system access, assign roles, and administer staff &amp; driver accounts
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            style={{
              background: "var(--primary, #6366f1)", color: "#fff", border: "none",
              padding: "10px 20px", borderRadius: 10, fontWeight: 700, fontSize: "0.88rem",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 4px 14px rgba(99,102,241,0.4)", transition: "all 0.2s ease"
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>+</span> Add New User
          </button>
        </div>

        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 24 }}>
          <div className="stat-card" style={{ padding: 16 }}>
            <div className="stat-label">Total Users</div>
            <div className="stat-value" style={{ fontSize: "1.6rem" }}>{users.length}</div>
          </div>
          <div className="stat-card" style={{ padding: 16, borderLeft: "3px solid #ef4444" }}>
            <div className="stat-label">Admins</div>
            <div className="stat-value" style={{ fontSize: "1.6rem", color: "#ef4444" }}>{countByRole.Admin}</div>
          </div>
          <div className="stat-card" style={{ padding: 16, borderLeft: "3px solid #3b82f6" }}>
            <div className="stat-label">Fleet Managers</div>
            <div className="stat-value" style={{ fontSize: "1.6rem", color: "#3b82f6" }}>{countByRole.FleetManager}</div>
          </div>
          <div className="stat-card" style={{ padding: 16, borderLeft: "3px solid #8b5cf6" }}>
            <div className="stat-label">Dispatchers</div>
            <div className="stat-value" style={{ fontSize: "1.6rem", color: "#8b5cf6" }}>{countByRole.Dispatcher}</div>
          </div>
          <div className="stat-card" style={{ padding: 16, borderLeft: "3px solid #10b981" }}>
            <div className="stat-label">Drivers</div>
            <div className="stat-value" style={{ fontSize: "1.6rem", color: "#10b981" }}>{countByRole.Driver}</div>
          </div>
        </div>

        {/* Filter Controls */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 14, marginBottom: 20, padding: 14,
          background: "rgba(15,23,42,0.6)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)"
        }}>
          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 260 }}>
            <span style={{ opacity: 0.5 }}>🔍</span>
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%", background: "transparent", border: "none", color: "#fff",
                outline: "none", fontSize: "0.88rem"
              }}
            />
          </div>

          {/* Role Filter Pills */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["All", "Admin", "FleetManager", "Dispatcher", "Driver"].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                style={{
                  padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: "0.78rem", fontWeight: roleFilter === r ? 700 : 500,
                  background: roleFilter === r ? "var(--primary, #6366f1)" : "rgba(255,255,255,0.05)",
                  color: roleFilter === r ? "#fff" : "rgba(255,255,255,0.65)",
                  transition: "all 0.15s ease"
                }}
              >
                {r === "FleetManager" ? "Fleet Manager" : r}
              </button>
            ))}
          </div>
        </div>

        {/* Users Table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
              <div className="spinner" style={{ margin: "0 auto 12px" }} />
              Loading system users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>👥</div>
              No users match the search criteria.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {["User", "Contact Info", "Assigned Role", "Status", "Joined", "Actions"].map((h) => (
                      <th key={h} style={{ padding: "14px 18px", textAlign: "left", color: "rgba(255,255,255,0.45)", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const badge = ROLE_COLORS[u.role] || ROLE_COLORS.Driver;
                    const initials = (u.full_name || "User")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);

                    return (
                      <tr
                        key={u.user_id}
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        {/* Avatar & Name */}
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{
                              width: 38, height: 38, borderRadius: 10,
                              background: badge.bg, border: `1px solid ${badge.border}`,
                              color: badge.text, display: "flex", alignItems: "center",
                              justifyContent: "center", fontWeight: 700, fontSize: "0.85rem"
                            }}>
                              {initials}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: "#f1f5f9" }}>{u.full_name}</div>
                              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>ID: {String(u.user_id).slice(0, 8)}</div>
                            </div>
                          </div>
                        </td>

                        {/* Email & Phone */}
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ color: "#f1f5f9" }}>{u.email}</div>
                          <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{u.phone || "No phone listed"}</div>
                        </td>

                        {/* Role Selector */}
                        <td style={{ padding: "14px 18px" }}>
                          <select
                            value={u.role}
                            onChange={(e) => handleQuickRoleChange(u.user_id, e.target.value)}
                            disabled={u.user_id === currentUser.user_id}
                            style={{
                              background: badge.bg,
                              color: badge.text,
                              border: `1px solid ${badge.border}`,
                              borderRadius: 8,
                              padding: "4px 8px",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              cursor: u.user_id === currentUser.user_id ? "default" : "pointer",
                              outline: "none"
                            }}
                          >
                            <option value="Admin" style={{ background: "#0f172a", color: "#fff" }}>Admin</option>
                            <option value="FleetManager" style={{ background: "#0f172a", color: "#fff" }}>Fleet Manager</option>
                            <option value="Dispatcher" style={{ background: "#0f172a", color: "#fff" }}>Dispatcher</option>
                            <option value="Driver" style={{ background: "#0f172a", color: "#fff" }}>Driver</option>
                          </select>
                        </td>

                        {/* Verified Status */}
                        <td style={{ padding: "14px 18px" }}>
                          <span style={{
                            padding: "3px 10px", borderRadius: 6, fontSize: "0.74rem", fontWeight: 700,
                            background: u.email_verified ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                            color: u.email_verified ? "#10b981" : "#f59e0b"
                          }}>
                            {u.email_verified ? "✓ Verified" : "⏳ Pending"}
                          </span>
                        </td>

                        {/* Created At */}
                        <td style={{ padding: "14px 18px", color: "rgba(255,255,255,0.45)", fontSize: "0.8rem" }}>
                          {u.created_at ? new Date(u.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setShowEditModal(true);
                              }}
                              style={{
                                background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
                                color: "#818cf8", borderRadius: 6, padding: "5px 10px", fontSize: "0.75rem",
                                fontWeight: 600, cursor: "pointer"
                              }}
                            >
                              Edit
                            </button>
                            {u.user_id !== currentUser.user_id && (
                              <button
                                onClick={() => handleDeleteUser(u)}
                                style={{
                                  background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
                                  color: "#ef4444", borderRadius: 6, padding: "5px 10px", fontSize: "0.75rem",
                                  fontWeight: 600, cursor: "pointer"
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Add User */}
        {showAddModal && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(6px)"
          }}>
            <div style={{
              background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16,
              width: "100%", maxWidth: 480, padding: "28px", boxShadow: "0 20px 40px rgba(0,0,0,0.6)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: "#f1f5f9" }}>Add New User</h2>
                <button onClick={() => setShowAddModal(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "1.4rem", cursor: "pointer" }}>×</button>
              </div>

              {formError && (
                <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.15)", border: "1px solid #ef4444", borderRadius: 8, color: "#ef4444", fontSize: "0.82rem", marginBottom: 16 }}>
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateUser} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", marginBottom: 6, fontWeight: 600 }}>Full Name *</label>
                  <input
                    type="text" required placeholder="e.g. Rahul Sharma"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", marginBottom: 6, fontWeight: 600 }}>Email Address *</label>
                  <input
                    type="email" required placeholder="e.g. rahul@fleetflow.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", marginBottom: 6, fontWeight: 600 }}>Phone Number</label>
                  <input
                    type="text" placeholder="e.g. +91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", marginBottom: 6, fontWeight: 600 }}>Password *</label>
                  <input
                    type="password" required placeholder="Initial password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", marginBottom: 6, fontWeight: 600 }}>Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}
                  >
                    <option value="Admin">Admin</option>
                    <option value="FleetManager">Fleet Manager</option>
                    <option value="Dispatcher">Dispatcher</option>
                    <option value="Driver">Driver</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                  <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: "10px 16px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer" }}>Cancel</button>
                  <button type="submit" disabled={formLoading} style={{ padding: "10px 20px", borderRadius: 8, background: "var(--primary, #6366f1)", border: "none", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                    {formLoading ? "Creating..." : "Create User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit User */}
        {showEditModal && selectedUser && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(6px)"
          }}>
            <div style={{
              background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16,
              width: "100%", maxWidth: 480, padding: "28px", boxShadow: "0 20px 40px rgba(0,0,0,0.6)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: "#f1f5f9" }}>Edit User</h2>
                <button onClick={() => setShowEditModal(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "1.4rem", cursor: "pointer" }}>×</button>
              </div>

              {formError && (
                <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.15)", border: "1px solid #ef4444", borderRadius: 8, color: "#ef4444", fontSize: "0.82rem", marginBottom: 16 }}>
                  {formError}
                </div>
              )}

              <form onSubmit={handleUpdateUser} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", marginBottom: 6, fontWeight: 600 }}>Full Name</label>
                  <input
                    type="text" required
                    value={selectedUser.full_name}
                    onChange={(e) => setSelectedUser({ ...selectedUser, full_name: e.target.value })}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", marginBottom: 6, fontWeight: 600 }}>Phone Number</label>
                  <input
                    type="text"
                    value={selectedUser.phone || ""}
                    onChange={(e) => setSelectedUser({ ...selectedUser, phone: e.target.value })}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", marginBottom: 6, fontWeight: 600 }}>System Role</label>
                  <select
                    value={selectedUser.role}
                    onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value })}
                    disabled={selectedUser.user_id === currentUser.user_id}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}
                  >
                    <option value="Admin">Admin</option>
                    <option value="FleetManager">Fleet Manager</option>
                    <option value="Dispatcher">Dispatcher</option>
                    <option value="Driver">Driver</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                  <button type="button" onClick={() => setShowEditModal(false)} style={{ padding: "10px 16px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer" }}>Cancel</button>
                  <button type="submit" disabled={formLoading} style={{ padding: "10px 20px", borderRadius: 8, background: "var(--primary, #6366f1)", border: "none", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                    {formLoading ? "Saving..." : "Save Changes"}
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
