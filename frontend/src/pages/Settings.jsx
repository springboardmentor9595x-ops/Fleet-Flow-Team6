import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { User, Bell, Shield, Sliders, Moon, Sun, Smartphone, Mail, Lock, Upload, Link as LinkIcon, CheckCircle2, AlertCircle, Save, Camera, Eye, EyeOff, Key } from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";

export default function Settings() {
  const { user, updateUser, theme, toggleTheme } = useAuth();
  const [activeTab, setActiveTab] = useState("general");
  
  // Profile form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [profilePic, setProfilePic] = useState("");
  
  // Profile picture selection mode: "url" or "file"
  const [picMode, setPicMode] = useState("url");
  const [picUrlInput, setPicUrlInput] = useState("");
  
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  // Change Password Form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwError, setPwError] = useState("");

  const [pref, setPref] = useState({
    emailAlerts: true,
    smsAlerts: false,
    speedAlerts: true,
    maintenanceAlerts: true
  });

  // Populate profile form fields when user loads
  useEffect(() => {
    if (user) {
      const nameParts = (user.full_name || "").trim().split(" ");
      const fName = nameParts[0] || "";
      const lName = nameParts.slice(1).join(" ") || "";
      
      setFirstName(fName);
      setLastName(lName);
      setPhone(user.phone || "");
      setProfilePic(user.profile_picture || "");
      setPicUrlInput(user.profile_picture || "");
    }
  }, [user]);

  const handleTogglePref = (key) => {
    setPref(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Handle local file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setProfileError("File size exceeds 5MB limit. Please choose a smaller image.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePic(reader.result);
      setProfileError("");
    };
    reader.readAsDataURL(file);
  };

  // Handle URL input change
  const handleUrlInputChange = (val) => {
    setPicUrlInput(val);
    setProfilePic(val);
  };

  // Save profile modifications
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSuccess("");
    setProfileError("");

    // Validate phone number
    const cleanPhone = phone.trim();
    const digitsOnly = cleanPhone.replace(/^\+/, "");
    if (!/^\d+$/.test(digitsOnly) || digitsOnly.length < 10 || digitsOnly.length > 15) {
      setProfileError("Please enter a valid 10 to 15 digit phone number.");
      return;
    }

    setSavingProfile(true);

    try {
      const res = await api.put("/auth/profile", {
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        profile_picture: profilePic
      });

      updateUser(res.data);
      setProfileSuccess("Profile account details updated successfully!");
    } catch (err) {
      console.error(err);
      setProfileError(err.response?.data?.detail || "Failed to update profile details.");
    } finally {
      setSavingProfile(false);
    }
  };
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");

    if (newPassword !== confirmPassword) {
      setPwError("Password mismatch: New password and Confirm new password do not match.");
      return;
    }

    setChangingPw(true);
    try {
      const res = await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword
      });
      setPwSuccess(res.data.message || "Password has been changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      setPwError(err.response?.data?.detail || "Failed to change password. Please verify your current password.");
    } finally {
      setChangingPw(false);
    }
  };

  const tabs = [
    { id: "general", label: "General Settings", icon: Sliders },
    { id: "profile", label: "Profile Account", icon: User },
    { id: "alerts", label: "Alert Preferences", icon: Bell }
  ];

  return (
    <AppLayout title="Console Settings" subtitle="Configure system parameters, manage profile details, and update preferences">
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "2rem" }} className="settings-container">
        
        {/* Left Side Tab Navigation */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  width: "100%",
                  padding: "0.75rem 1rem",
                  borderRadius: "0.75rem",
                  border: "none",
                  background: active ? "linear-gradient(135deg, #f5f3ff, #eff6ff)" : "transparent",
                  color: active ? "#6366f1" : "#475569",
                  fontWeight: active ? 600 : 500,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.2s, color 0.2s"
                }}
              >
                <Icon size={16} color={active ? "#6366f1" : "#94a3b8"} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Side Content Panel */}
        <div className="ff-card" style={{ padding: "1.75rem" }}>
          
          {/* General Tab */}
          {activeTab === "general" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div>
                <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>Display Theme</h4>
                <p style={{ fontSize: "0.75rem", color: "#64748b" }}>Choose between light mode and dark mode layouts</p>
              </div>

              <div style={{ display: "flex", gap: "1rem" }}>
                <button 
                  onClick={toggleTheme}
                  style={{
                    flex: 1,
                    maxWidth: "160px",
                    padding: "1rem",
                    borderRadius: "0.875rem",
                    border: theme === "light" ? "2px solid #6366f1" : "1.5px solid rgba(15,23,42,0.08)",
                    background: "white",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "pointer"
                  }}
                >
                  <Sun size={24} color={theme === "light" ? "#6366f1" : "#94a3b8"} />
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: theme === "light" ? "#6366f1" : "#475569" }}>Light Theme</span>
                </button>

                <button 
                  onClick={toggleTheme}
                  style={{
                    flex: 1,
                    maxWidth: "160px",
                    padding: "1rem",
                    borderRadius: "0.875rem",
                    border: theme === "dark" ? "2px solid #6366f1" : "1.5px solid rgba(15,23,42,0.08)",
                    background: "white",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "pointer"
                  }}
                >
                  <Moon size={24} color={theme === "dark" ? "#6366f1" : "#94a3b8"} />
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: theme === "dark" ? "#6366f1" : "#475569" }}>Dark Theme</span>
                </button>
              </div>

              <hr style={{ border: "none", borderTop: "1px solid rgba(15,23,42,0.06)" }} />

              <div>
                <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>System Preferences</h4>
                <p style={{ fontSize: "0.75rem", color: "#64748b" }}>Control system parameters (Units, Speed Alerts)</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label className="ff-label">Default Distance Unit</label>
                  <select className="ff-select" defaultValue="km">
                    <option value="km">Kilometres (km)</option>
                    <option value="mi">Miles (mi)</option>
                  </select>
                </div>
                <div>
                  <label className="ff-label">Default Capacity Unit</label>
                  <select className="ff-select" defaultValue="kg">
                    <option value="kg">Kilograms (kg)</option>
                    <option value="lbs">Pounds (lbs)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div>
                <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>Profile Account Details</h4>
                <p style={{ fontSize: "0.75rem", color: "#64748b" }}>Manage your logged-in profile information and avatar picture</p>
              </div>

              {/* Status Notifications */}
              {profileSuccess && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#047857", padding: "0.75rem 1rem", borderRadius: "0.75rem", fontSize: "0.875rem", fontWeight: 600 }}>
                  <CheckCircle2 size={16} />
                  <span>{profileSuccess}</span>
                </div>
              )}
              {profileError && (
                <div className="ff-error">
                  <AlertCircle size={16} />
                  <span>{profileError}</span>
                </div>
              )}

              {/* Summary Profile Header Card */}
              <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", background: "#f8fafc", padding: "1.25rem", borderRadius: "1rem", border: "1.5px solid rgba(15,23,42,0.06)" }}>
                
                {/* Profile Picture Display */}
                <div style={{ position: "relative" }}>
                  {profilePic ? (
                    <img 
                      src={profilePic} 
                      alt="Profile" 
                      style={{ width: "64px", height: "64px", borderRadius: "50%", objectFit: "cover", border: "2px solid white", boxShadow: "0 4px 12px rgba(15,23,42,0.1)" }}
                      onError={() => setProfileError("Invalid profile picture URL or format.")}
                    />
                  ) : (
                    <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: "1.375rem", boxShadow: "0 4px 12px rgba(99,102,241,0.25)" }}>
                      {user?.full_name?.substring(0, 2).toUpperCase() || "FL"}
                    </div>
                  )}
                  <div style={{ position: "absolute", bottom: "-2px", right: "-2px", background: "#6366f1", borderRadius: "50%", padding: "4px", border: "2px solid white" }}>
                    <Camera size={11} color="white" />
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0f172a" }}>{user?.full_name}</h4>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.25rem" }}>
                    <span className="ff-badge ff-badge-violet">{user?.role || "Operator"}</span>
                    <span style={{ fontSize: "0.75rem", color: "#64748b", fontFamily: "monospace" }}>ID: {user?.user_id}</span>
                  </div>
                </div>
              </div>

              {/* Profile Picture Selection Console (2 Methods) */}
              <div style={{ background: "#fafafa", border: "1.5px dashed #cbd5e1", borderRadius: "1rem", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <label className="ff-label" style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>
                  Update Profile Picture
                </label>
                
                {/* Method Switcher */}
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button
                    type="button"
                    onClick={() => setPicMode("url")}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.375rem",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.625rem",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      border: picMode === "url" ? "1.5px solid #6366f1" : "1px solid #cbd5e1",
                      background: picMode === "url" ? "#f5f3ff" : "white",
                      color: picMode === "url" ? "#6366f1" : "#475569",
                      cursor: "pointer"
                    }}
                  >
                    <LinkIcon size={14} /> Provided URL Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setPicMode("file")}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.375rem",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.625rem",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      border: picMode === "file" ? "1.5px solid #6366f1" : "1px solid #cbd5e1",
                      background: picMode === "file" ? "#f5f3ff" : "white",
                      color: picMode === "file" ? "#6366f1" : "#475569",
                      cursor: "pointer"
                    }}
                  >
                    <Upload size={14} /> From Local Device File
                  </button>
                </div>

                {/* Mode 1: URL Link */}
                {picMode === "url" && (
                  <div>
                    <input 
                      type="url" 
                      className="ff-input" 
                      placeholder="https://example.com/profile-picture.jpg" 
                      value={picUrlInput} 
                      onChange={(e) => handleUrlInputChange(e.target.value)} 
                    />
                    <p style={{ fontSize: "0.6875rem", color: "#64748b", marginTop: "0.25rem" }}>
                      Paste a direct HTTPS image URL link.
                    </p>
                  </div>
                )}

                {/* Mode 2: Local Device File Upload */}
                {picMode === "file" && (
                  <div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="ff-input" 
                      onChange={handleFileChange} 
                      style={{ padding: "0.375rem 0.75rem" }}
                    />
                    <p style={{ fontSize: "0.6875rem", color: "#64748b", marginTop: "0.25rem" }}>
                      Select an image file saved on your device (PNG, JPG, WEBP, max 5MB).
                    </p>
                  </div>
                )}
              </div>

              {/* Form Input Fields Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label className="ff-label">First Name</label>
                  <input 
                    type="text" 
                    className="ff-input" 
                    value={firstName} 
                    onChange={(e) => setFirstName(e.target.value)} 
                    required 
                  />
                </div>

                <div>
                  <label className="ff-label">Last Name</label>
                  <input 
                    type="text" 
                    className="ff-input" 
                    value={lastName} 
                    onChange={(e) => setLastName(e.target.value)} 
                    required 
                  />
                </div>

                <div>
                  <label className="ff-label">Phone Number</label>
                  <input 
                    type="text" 
                    className="ff-input" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    required 
                  />
                </div>

                <div>
                  <label className="ff-label">Email Address</label>
                  <input 
                    type="text" 
                    className="ff-input" 
                    value={user?.email || ""} 
                    readOnly 
                    disabled 
                    style={{ background: "#f8fafc", cursor: "not-allowed", color: "#64748b" }} 
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="ff-label">User ID (System)</label>
                  <input 
                    type="text" 
                    className="ff-input" 
                    value={user?.user_id || ""} 
                    readOnly 
                    disabled 
                    style={{ background: "#f8fafc", cursor: "not-allowed", fontFamily: "monospace", fontSize: "0.8125rem", color: "#64748b" }} 
                  />
                </div>
              </div>

              {/* Submit Save Changes Button */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button 
                  type="submit" 
                  className="ff-btn-primary" 
                  disabled={savingProfile}
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", fontSize: "0.875rem" }}
                >
                  <Save size={16} />
                  <span>{savingProfile ? "Saving Profile..." : "Save Profile Changes"}</span>
                </button>
              </div>

            </form>

            <hr style={{ border: "none", borderTop: "1.5px solid rgba(15,23,42,0.06)", margin: "1.5rem 0" }} />

            {/* Change Password Section Card */}
            <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Key size={18} color="#6366f1" />
                  <span>Change Password</span>
                </h4>
                <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                  Update your account password securely. Minimum 8 characters required.
                </p>
              </div>

              {/* Password Alerts */}
              {pwSuccess && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#047857", padding: "0.75rem 1rem", borderRadius: "0.75rem", fontSize: "0.875rem", fontWeight: 600 }}>
                  <CheckCircle2 size={16} />
                  <span>{pwSuccess}</span>
                </div>
              )}
              {pwError && (
                <div className="ff-error">
                  <AlertCircle size={16} />
                  <span>{pwError}</span>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                
                {/* Current Password */}
                <div>
                  <label className="ff-label" htmlFor="current-password">Current Password</label>
                  <div style={{ position: "relative" }}>
                    <Lock size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                    <input 
                      id="current-password" 
                      type={showCurrentPw ? "text" : "password"} 
                      className="ff-input" 
                      placeholder="••••••••" 
                      value={currentPassword} 
                      onChange={(e) => setCurrentPassword(e.target.value)} 
                      required 
                      style={{ paddingLeft: "2.75rem", paddingRight: "3rem" }} 
                    />
                    <button type="button" onClick={() => setShowCurrentPw(p => !p)} style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", padding: 0 }}>
                      {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* New Password & Confirm Password Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  
                  {/* New Password */}
                  <div>
                    <label className="ff-label" htmlFor="new-password">New Password</label>
                    <div style={{ position: "relative" }}>
                      <Lock size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                      <input 
                        id="new-password" 
                        type={showNewPw ? "text" : "password"} 
                        className="ff-input" 
                        placeholder="Min. 8 characters" 
                        value={newPassword} 
                        onChange={(e) => setNewPassword(e.target.value)} 
                        required 
                        style={{ paddingLeft: "2.75rem", paddingRight: "3rem" }} 
                      />
                      <button type="button" onClick={() => setShowNewPw(p => !p)} style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", padding: 0 }}>
                        {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label className="ff-label" htmlFor="confirm-password">Confirm New Password</label>
                    <div style={{ position: "relative" }}>
                      <Lock size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                      <input 
                        id="confirm-password" 
                        type={showConfirmPw ? "text" : "password"} 
                        className="ff-input" 
                        placeholder="Re-enter new password" 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        required 
                        style={{ paddingLeft: "2.75rem", paddingRight: "3rem" }} 
                      />
                      <button type="button" onClick={() => setShowConfirmPw(p => !p)} style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", padding: 0 }}>
                        {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                </div>

              </div>

              {/* Submit Change Password Button */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button 
                  type="submit" 
                  className="ff-btn-primary" 
                  disabled={changingPw}
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", fontSize: "0.875rem", background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}
                >
                  <Key size={16} />
                  <span>{changingPw ? "Updating Password..." : "Update Password"}</span>
                </button>
              </div>

            </form>
          </div>
          )}

          {/* Alerts Preferences Tab */}
          {activeTab === "alerts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>Alert Preferences</h4>
                <p style={{ fontSize: "0.75rem", color: "#64748b" }}>Choose how and when you receive system alerts</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
                
                {[
                  { key: "emailAlerts", icon: Mail, title: "Email Notifications", desc: "Receive summary reports and critical updates via registered email" },
                  { key: "smsAlerts", icon: Smartphone, title: "SMS Alerts", desc: "Receive SMS alerts on emergency dispatch and high severity warnings" },
                  { key: "speedAlerts", icon: Shield, title: "Speed Limit Violations", desc: "Alert me when any vehicle exceeds safety speed limits" },
                  { key: "maintenanceAlerts", icon: Lock, title: "Maintenance Schedules", desc: "Alert me 3 days prior to next scheduled vehicle service" }
                ].map((item) => {
                  const Icon = item.icon;
                  const enabled = pref[item.key];
                  return (
                    <div 
                      key={item.key}
                      onClick={() => handleTogglePref(item.key)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "1rem",
                        borderRadius: "0.875rem",
                        border: "1.5px solid rgba(15,23,42,0.06)",
                        cursor: "pointer",
                        background: enabled ? "#f8fafc" : "white",
                        transition: "background 0.2s"
                      }}
                    >
                      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "0.5rem", background: enabled ? "rgba(99,102,241,0.1)" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon size={16} color={enabled ? "#6366f1" : "#94a3b8"} />
                        </div>
                        <div>
                          <h5 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#1e293b" }}>{item.title}</h5>
                          <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.125rem" }}>{item.desc}</p>
                        </div>
                      </div>

                      <div 
                        style={{
                          width: "36px",
                          height: "20px",
                          borderRadius: "10px",
                          background: enabled ? "#6366f1" : "#cbd5e1",
                          position: "relative",
                          transition: "background 0.2s"
                        }}
                      >
                        <div 
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "50%",
                            background: "white",
                            position: "absolute",
                            top: "2px",
                            left: enabled ? "18px" : "2px",
                            transition: "left 0.2s"
                          }}
                        />
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>
          )}

        </div>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .settings-container { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </AppLayout>
  );
}
