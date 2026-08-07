import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, CheckCircle2, AlertTriangle, AlertCircle, Info, Trash } from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get("/fleet/notifications");
      setNotifications(res.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await api.put(`/fleet/notifications/${id}/read`);
      // Update local state directly
      setNotifications(prev => 
        prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n)
      );
    } catch (err) {
      console.error(err);
    }
  };

  const getAlertConfig = (type) => {
    switch (type?.toLowerCase()) {
      case "warning":
        return { icon: AlertTriangle, color: "#d97706", bg: "#fffbeb", border: "#fde68a" };
      case "success":
        return { icon: CheckCircle2, color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" };
      case "error":
        return { icon: AlertCircle, color: "#e11d48", bg: "#fff1f2", border: "#fecdd3" };
      default:
        return { icon: Info, color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" };
    }
  };

  return (
    <AppLayout title="System Alerts & Feed" subtitle="Track live operational warnings, notifications, and logs">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "800px", margin: "0 auto" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
            Alert Logs ({notifications.filter(n => !n.is_read).length} unread)
          </h3>
          <button 
            onClick={fetchNotifications}
            className="ff-btn-ghost"
            style={{ padding: "0.5rem 1rem", fontSize: "0.8125rem" }}
          >
            Refresh Feed
          </button>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px", flexDirection: "column", gap: "1rem" }}>
            <div className="ff-pulse-dot" style={{ width: "36px", height: "36px", background: "#6366f1" }} />
            <p style={{ fontSize: "0.875rem", color: "#64748b" }}>Loading alerts feed...</p>
          </div>
        ) : error ? (
          <div className="ff-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlignment: "center", padding: "4rem 2rem", background: "white", borderRadius: "1rem", border: "1.5px solid rgba(15,23,42,0.06)", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <Bell size={48} color="#94a3b8" />
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>All caught up!</h3>
              <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.25rem" }}>No notifications found.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <AnimatePresence>
              {notifications.map((n) => {
                const { icon: AlertIcon, color, bg, border } = getAlertConfig(n.type);
                return (
                  <motion.div
                    key={n.notification_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "1rem",
                      padding: "1rem",
                      borderRadius: "0.875rem",
                      background: bg,
                      border: `1.5px solid ${border}`,
                      boxShadow: "0 2px 4px rgba(15,23,42,0.02)",
                      opacity: n.is_read ? 0.65 : 1,
                      transition: "opacity 0.2s"
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", minWidth: 0, flex: 1 }}>
                      <div style={{ flexShrink: 0, width: "36px", height: "36px", borderRadius: "0.625rem", background: "white", border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <AlertIcon size={16} color={color} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#1e293b" }}>{n.title || "Notification"}</h4>
                        <p style={{ fontSize: "0.8125rem", color: "#475569", marginTop: "0.125rem", lineHeight: 1.4 }}>{n.message}</p>
                        <span style={{ fontSize: "0.6875rem", color: "#94a3b8", display: "block", marginTop: "0.375rem" }}>
                          {n.created_at ? new Date(n.created_at).toLocaleTimeString() : "Just now"}
                        </span>
                      </div>
                    </div>

                    {!n.is_read && (
                      <button
                        onClick={() => handleMarkAsRead(n.notification_id)}
                        style={{
                          flexShrink: 0,
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          background: "white",
                          border: `1px solid ${border}`,
                          color: color,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 1px 3px rgba(15,23,42,0.05)",
                          transition: "background 0.2s, transform 0.15s"
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.transform = "scale(1.05)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.transform = "scale(1)"; }}
                        title="Mark as read"
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
