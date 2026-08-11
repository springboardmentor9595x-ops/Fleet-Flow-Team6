import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { User, Bell, Shield, Sliders, Moon, Sun, Smartphone, Mail, Lock } from "lucide-react";
import AppLayout from "../layouts/AppLayout";

export default function Settings() {
  const { user, theme, toggleTheme } = useAuth();
  const [activeTab, setActiveTab] = useState("general");
  const [pref, setPref] = useState({
    emailAlerts: true,
    smsAlerts: false,
    speedAlerts: true,
    maintenanceAlerts: true
  });

  const handleTogglePref = (key) => {
    setPref(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const tabs = [
    { id: "general", label: "General Settings", icon: Sliders },
    { id: "profile", label: "Profile Account", icon: User },
    { id: "alerts", label: "Alert Preferences", icon: Bell }
  ];

  return (
    <AppLayout title="Console Settings" subtitle="Configure system parameters, manage permissions, and update preferences">
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
              <div>
                <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>Account Information</h4>
                <p style={{ fontSize: "0.75rem", color: "#64748b" }}>Details of the currently logged-in account</p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "1rem", background: "#f8fafc", padding: "1rem", borderRadius: "0.875rem", border: "1px solid rgba(15,23,42,0.06)" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "1.125rem" }}>
                  {user?.full_name?.substring(0, 2).toUpperCase() || "FL"}
                </div>
                <div>
                  <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a" }}>{user?.full_name}</h4>
                  <span className="ff-badge ff-badge-violet" style={{ marginTop: "0.25rem" }}>{user?.role || "Admin"}</span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label className="ff-label">Full Name</label>
                  <input type="text" className="ff-input" value={user?.full_name || ""} readOnly disabled style={{ background: "#f8fafc", cursor: "not-allowed" }} />
                </div>
                <div>
                  <label className="ff-label">Email Address</label>
                  <input type="text" className="ff-input" value={user?.email || ""} readOnly disabled style={{ background: "#f8fafc", cursor: "not-allowed" }} />
                </div>
                <div>
                  <label className="ff-label">Phone Number</label>
                  <input type="text" className="ff-input" value={user?.phone || ""} readOnly disabled style={{ background: "#f8fafc", cursor: "not-allowed" }} />
                </div>
                <div>
                  <label className="ff-label">User ID (System)</label>
                  <input type="text" className="ff-input" value={user?.user_id || ""} readOnly disabled style={{ background: "#f8fafc", cursor: "not-allowed", fontFamily: "monospace", fontSize: "0.75rem" }} />
                </div>
              </div>
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
