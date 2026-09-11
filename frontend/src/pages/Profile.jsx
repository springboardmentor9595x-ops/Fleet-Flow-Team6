import React, { useEffect, useState } from "react";
import Layout from "../components/layout/Layout";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, setUser } = useAuth();
  const [profileData, setProfileData] = useState({
    full_name: "",
    phone: "",
    email: "",
    role: "",
  });

  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
  });

  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    api.get("/users/me")
      .then((res) => {
        setProfileData(res.data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put("/users/me", {
        full_name: profileData.full_name,
        phone: profileData.phone,
      });
      showToast("Profile updated successfully!");
      if (setUser) {
        setUser(res.data);
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to update profile", "error");
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.put("/users/change-password", passwordData);
      showToast("Password updated successfully!");
      setPasswordData({ current_password: "", new_password: "" });
    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.detail || "Failed to update password", "error");
    }
  };

  return (
    <Layout>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div className="page-header">
        <div className="page-header-left">
          <h1>Account & Profile Settings</h1>
          <p>Manage your user account details, phone number, and security credentials</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen">
          <div className="spinner" />
          <span>Loading user profile...</span>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Profile Form */}
          <div className="card">
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 20 }}>Personal Information</h2>
            <form onSubmit={handleProfileSubmit}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  className="form-control"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Email Address (Read-only)</label>
                <input
                  className="form-control"
                  value={profileData.email}
                  disabled
                  style={{ opacity: 0.6, cursor: "not-allowed" }}
                />
              </div>

              <div className="form-group">
                <label>Phone Number</label>
                <input
                  className="form-control"
                  placeholder="+1 (555) 000-0000"
                  value={profileData.phone || ""}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>User Role</label>
                <input
                  className="form-control"
                  value={profileData.role}
                  disabled
                  style={{ opacity: 0.6, cursor: "not-allowed", textTransform: "capitalize" }}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>
                Save Profile Changes
              </button>
            </form>
          </div>

          {/* Change Password Form */}
          <div className="card">
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 20 }}>Security & Password</h2>
            <form onSubmit={handlePasswordSubmit}>
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Enter current password"
                  value={passwordData.current_password}
                  onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Enter new password"
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  required
                />
              </div>

              <button type="submit" className="btn btn-ghost" style={{ marginTop: 12, borderColor: "var(--accent-blue)", color: "var(--accent-blue)" }}>
                Update Password
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}