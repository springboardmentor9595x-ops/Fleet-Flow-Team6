import { useState } from "react";
import { motion } from "framer-motion";
import { Bell, Menu, Moon, Search, Sun } from "lucide-react";
import { useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";

export default function AppLayout({ children, title, subtitle }) {
  const location = useLocation();
  const { user, theme, toggleTheme } = useAuth();
  const [collapsed, setCollapsed]     = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);

  const breadcrumbs = location.pathname
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/-/g, " "));

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

            {/* Bell */}
            <button style={{ borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.08)", padding: "0.5rem", color: "#64748b", background: "transparent", cursor: "pointer", display: "flex", transition: "background 0.15s, color 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.color = "#0f172a"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; }}>
              <Bell size={18} />
            </button>

            {/* Theme toggle */}
            <button onClick={toggleTheme}
              style={{ borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.08)", padding: "0.5rem", color: "#64748b", background: "transparent", cursor: "pointer", display: "flex", transition: "background 0.15s, color 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.color = "#0f172a"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; }}>
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* User chip */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", borderRadius: "0.875rem", border: "1.5px solid rgba(15,23,42,0.08)", background: "#f8fafc", padding: "0.375rem 0.875rem 0.375rem 0.5rem" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "white" }}>
                  {user?.full_name?.split(" ")[0]?.[0] || "F"}
                </span>
              </div>
              <div className="user-chip-text">
                <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>
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
