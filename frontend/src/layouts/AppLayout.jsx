import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Menu, Moon, Search, Sun, Check, CheckCircle2, AlertTriangle, AlertCircle, Info, ExternalLink } from "lucide-react";
import { useLocation, Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

export default function AppLayout({ children, title, subtitle }) {
  const location = useLocation();
  const { user, theme, toggleTheme } = useAuth();
  const [collapsed, setCollapsed]     = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);

  // Notifications Bell Dropdown state
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [unreadCount, setUnreadCount]             = useState(0);
  const [recentNotifs, setRecentNotifs]           = useState([]);

  const fetchUnreadNotifications = async () => {
    try {
      const countRes = await api.get("/notifications/unread-count");
      setUnreadCount(countRes.data?.unread_count || 0);

      const listRes = await api.get("/notifications");
      setRecentNotifs(listRes.data?.slice(0, 5) || []);
    } catch (err) {
      console.error("Error loading notifications:", err);
    }
  };

  useEffect(() => {
    fetchUnreadNotifications();
    const interval = setInterval(fetchUnreadNotifications, 15000); // Polling every 15s
    return () => clearInterval(interval);
  }, []);

  const handleMarkRead = async (id, e) => {
    e.stopPropagation();
    try {
      await api.put(`/notifications/${id}/read`);
      fetchUnreadNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put("/notifications/mark-all-read");
      fetchUnreadNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const breadcrumbs = location.pathname
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/-/g, " "));

  const getAlertIcon = (type) => {
    switch (type?.toLowerCase()) {
      case "warning":
        return <AlertTriangle size={14} color="#d97706" />;
      case "success":
        return <CheckCircle2 size={14} color="#059669" />;
      case "error":
        return <AlertCircle size={14} color="#e11d48" />;
      default:
        return <Info size={14} color="#3b82f6" />;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex" }}>

      {/* Desktop sidebar */}
      <div style={{ display: "none", flexShrink: 0 }} className="desktop-sidebar">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((p) => !p)} />
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(15,23,42,0.35)", backdropFilter: "blur(4px)" }}
        />
      )}

      {/* Mobile sidebar */}
      <div style={{ position: "fixed", zIndex: 50, top: 0, bottom: 0, left: mobileOpen ? 0 : "-280px", transition: "left 0.25s ease" }} className="mobile-sidebar">
        <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Top header */}
        <header style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(16px)", borderBottom: "1.5px solid rgba(15,23,42,0.07)", padding: "0 1.5rem", height: "68px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", position: "sticky", top: 0, zIndex: 30, boxShadow: "0 1px 4px rgba(15,23,42,0.04)" }}>

          <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
            <button onClick={() => setMobileOpen(true)} className="mobile-menu-btn"
              style={{ borderRadius: "0.625rem", border: "1.5px solid rgba(15,23,42,0.08)", padding: "0.4375rem", color: "#64748b", background: "transparent", cursor: "pointer", display: "none" }}>
              <Menu size={18} />
            </button>
            <div>
              <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#94a3b8" }}>
                {breadcrumbs[0] || "Dashboard"}
              </p>
              <h1 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>{title}</h1>
              {subtitle && <p style={{ fontSize: "0.8125rem", color: "#64748b" }}>{subtitle}</p>}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            {/* Search */}
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.08)", background: "#f8fafc", padding: "0.5rem 0.875rem", fontSize: "0.875rem", color: "#94a3b8", cursor: "text" }} className="desktop-search">
              <Search size={15} />
              <input style={{ width: "160px", background: "transparent", border: "none", outline: "none", fontSize: "0.875rem", color: "#0f172a" }} placeholder="Search…" />
            </label>

            {/* Bell Dropdown */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowNotifDropdown((p) => !p)}
                style={{ borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.08)", padding: "0.5rem", color: "#64748b", background: showNotifDropdown ? "#f1f5f9" : "transparent", cursor: "pointer", display: "flex", position: "relative", transition: "background 0.15s, color 0.15s" }}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span style={{ position: "absolute", top: "-4px", right: "-4px", background: "#ef4444", color: "white", fontSize: "0.6875rem", fontWeight: 700, borderRadius: "50%", width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid white" }}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    style={{ position: "absolute", right: 0, top: "45px", width: "340px", background: "white", borderRadius: "1rem", boxShadow: "0 10px 25px -5px rgba(15,23,42,0.15)", border: "1.5px solid rgba(15,23,42,0.08)", zIndex: 60, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
                      <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0f172a" }}>
                        Notifications ({unreadCount} unread)
                      </h4>
                      {unreadCount > 0 && (
                        <button onClick={handleMarkAllRead} style={{ background: "none", border: "none", color: "#6366f1", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}>
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "280px", overflowY: "auto" }}>
                      {recentNotifs.length === 0 ? (
                        <p style={{ fontSize: "0.8125rem", color: "#94a3b8", textAlign: "center", padding: "1rem" }}>No notifications right now.</p>
                      ) : (
                        recentNotifs.map((n) => (
                          <div
                            key={n.notification_id}
                            style={{ display: "flex", gap: "0.625rem", alignItems: "flex-start", padding: "0.5rem 0.625rem", borderRadius: "0.625rem", background: n.is_read ? "#ffffff" : "#f8fafc", border: `1px solid ${n.is_read ? "#e2e8f0" : "#cbd5e1"}` }}
                          >
                            <div style={{ marginTop: "2px" }}>{getAlertIcon(n.type)}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#1e293b", margin: 0 }}>{n.title}</p>
                              <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.125rem 0 0 0", lineHeight: 1.3 }}>{n.message}</p>
                            </div>
                            {!n.is_read && (
                              <button onClick={(e) => handleMarkRead(n.notification_id, e)} title="Mark as read" style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}>
                                <Check size={14} />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <Link to="/notifications" onClick={() => setShowNotifDropdown(false)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem", fontSize: "0.8125rem", fontWeight: 600, color: "#6366f1", textAlign: "center", textDecoration: "none", paddingTop: "0.5rem", borderTop: "1px solid #f1f5f9" }}>
                      View all alerts <ExternalLink size={13} />
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Theme toggle */}
            <button 
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
              style={{ 
                borderRadius: "0.75rem", 
                border: theme === "dark" ? "1.5px solid rgba(255,255,255,0.12)" : "1.5px solid rgba(15,23,42,0.08)", 
                padding: "0.45rem 0.75rem", 
                color: theme === "dark" ? "#fbbf24" : "#475569", 
                background: theme === "dark" ? "rgba(251,191,36,0.12)" : "#f8fafc", 
                cursor: "pointer", 
                display: "flex", 
                alignItems: "center",
                gap: "0.375rem",
                transition: "background 0.15s, color 0.15s" 
              }}
            >
              {theme === "dark" ? <Sun size={17} color="#fbbf24" /> : <Moon size={17} color="#6366f1" />}
              <span style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                {theme === "dark" ? "Light" : "Dark"}
              </span>
            </button>

            {/* User chip */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", borderRadius: "0.875rem", border: theme === "dark" ? "1.5px solid rgba(255,255,255,0.12)" : "1.5px solid rgba(15,23,42,0.08)", background: theme === "dark" ? "#1e293b" : "#f8fafc", padding: "0.375rem 0.875rem 0.375rem 0.5rem" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "white" }}>
                  {user?.full_name?.split(" ")[0]?.[0] || "F"}
                </span>
              </div>
              <div className="user-chip-text">
                <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: theme === "dark" ? "#f8fafc" : "#0f172a", whiteSpace: "nowrap" }}>
                  {user?.full_name || "FleetFlow User"}
                </p>
                <p style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>{user?.role || "Admin"}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: "1.5rem", overflowY: "auto" }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            {children}
          </motion.div>
        </main>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .desktop-sidebar { display: block !important; }
        }
        @media (max-width: 1023px) {
          .mobile-menu-btn { display: flex !important; }
          .desktop-search  { display: none  !important; }
          .user-chip-text  { display: none  !important; }
        }
      `}</style>
    </div>
  );
}
