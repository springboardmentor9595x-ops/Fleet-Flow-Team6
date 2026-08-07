import { motion } from "framer-motion";
import {
  BarChart3, Bell, ChevronLeft, ChevronRight, Fuel,
  LayoutDashboard, LogOut, Package2, Route, Settings,
  ShieldCheck, Truck, UserCircle2, Users, Wrench,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const linkBase = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all";

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role = user?.role || "Admin";

  const items = {
    Admin: [
      { label: "Overview",      to: "/admin",         icon: LayoutDashboard },
      { label: "Shipments",     to: "/shipments",     icon: Package2        },
      { label: "Users",         to: "/users",         icon: Users           },
      { label: "Drivers",       to: "/drivers",       icon: UserCircle2     },
      { label: "Vehicles",      to: "/vehicles",      icon: Truck           },
      { label: "Trips",         to: "/trips",         icon: Route           },
      { label: "Reports",       to: "/reports",       icon: BarChart3       },
      { label: "Maintenance",   to: "/maintenance",   icon: Wrench          },
      { label: "Notifications", to: "/notifications", icon: Bell            },
      { label: "Settings",      to: "/settings",      icon: Settings        },
    ],
    FleetManager: [
      { label: "Overview",      to: "/fleet-manager", icon: LayoutDashboard },
      { label: "Shipments",     to: "/shipments",     icon: Package2        },
      { label: "Vehicles",      to: "/vehicles",      icon: Truck           },
      { label: "Drivers",       to: "/drivers",       icon: UserCircle2     },
      { label: "Trips",         to: "/trips",         icon: Route           },
      { label: "Maintenance",   to: "/maintenance",   icon: Wrench          },
      { label: "Fuel",          to: "/reports",       icon: Fuel            },
      { label: "Notifications", to: "/notifications", icon: Bell            },
      { label: "Settings",      to: "/settings",      icon: Settings        },
    ],
    Driver: [
      { label: "Overview",      to: "/driver",        icon: LayoutDashboard },
      { label: "Shipments",     to: "/shipments",     icon: Package2        },
      { label: "Trips",         to: "/trips",         icon: Route           },
      { label: "Vehicle",       to: "/vehicles",      icon: Truck           },
      { label: "History",       to: "/reports",       icon: BarChart3       },
      { label: "Profile",       to: "/profile",       icon: UserCircle2     },
      { label: "Notifications", to: "/notifications", icon: Bell            },
    ],
    Dispatcher: [
      { label: "Overview",      to: "/dispatcher",    icon: LayoutDashboard },
      { label: "Shipments",     to: "/shipments",     icon: Package2        },
      { label: "Assign Trips",  to: "/trips",         icon: Route           },
      { label: "Live Tracking", to: "/reports",       icon: BarChart3       },
      { label: "Requests",      to: "/notifications", icon: Bell            },
      { label: "Settings",      to: "/settings",      icon: Settings        },
    ],
  };

  const currentItems = items[role] || items.Admin;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "1rem",
        background: "white",
        borderRight: "1.5px solid rgba(15,23,42,0.07)",
        boxShadow: "4px 0 16px rgba(15,23,42,0.04)",
        width: collapsed ? "72px" : "256px",
        transition: "width 0.25s ease",
        flexShrink: 0,
      }}
    >
      {/* Brand + toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", overflow: "hidden" }}>
          <div style={{ borderRadius: "0.75rem", background: "linear-gradient(135deg,#6366f1,#3b82f6)", padding: "0.5rem", display: "flex", flexShrink: 0, boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
            <Package2 size={18} color="white" />
          </div>
          {!collapsed && (
            <div style={{ overflow: "hidden" }}>
              <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>FleetFlow</p>
              <p style={{ fontSize: "0.6875rem", color: "#94a3b8", whiteSpace: "nowrap" }}>Ops Control Center</p>
            </div>
          )}
        </div>
        <button onClick={onToggle}
          style={{ borderRadius: "0.625rem", border: "1.5px solid rgba(15,23,42,0.08)", padding: "0.375rem", color: "#94a3b8", background: "transparent", cursor: "pointer", display: "flex", flexShrink: 0, transition: "background 0.15s, color 0.15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.color = "#0f172a"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; }}>
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* User card */}
      <div style={{ borderRadius: "0.875rem", background: "#f8fafc", border: "1.5px solid rgba(15,23,42,0.07)", padding: "0.75rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <div style={{ borderRadius: "0.625rem", background: "linear-gradient(135deg,#6366f1,#3b82f6)", padding: "0.5rem", display: "flex", flexShrink: 0 }}>
            <ShieldCheck size={16} color="white" />
          </div>
          {!collapsed && (
            <div style={{ overflow: "hidden" }}>
              <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.full_name || "FleetFlow User"}
              </p>
              <p style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>{role}</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", overflowY: "auto" }}>
        {currentItems.map(({ label, to, icon: Icon }) => (
          <NavLink key={label} to={to}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              borderRadius: "0.75rem",
              padding: "0.5rem 0.75rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              textDecoration: "none",
              transition: "background 0.15s, color 0.15s",
              whiteSpace: "nowrap",
              overflow: "hidden",
              ...(isActive
                ? { background: "linear-gradient(135deg, #f5f3ff, #eff6ff)", color: "#6366f1", border: "1px solid #ddd6fe" }
                : { background: "transparent", color: "#475569", border: "1px solid transparent" }),
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={16} color={isActive ? "#6366f1" : "#94a3b8"} style={{ flexShrink: 0 }} />
                {!collapsed && <span>{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <button onClick={handleLogout}
        style={{ display: "flex", alignItems: "center", gap: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid rgba(15,23,42,0.07)", padding: "0.625rem 0.75rem", fontSize: "0.875rem", fontWeight: 500, color: "#64748b", background: "transparent", cursor: "pointer", marginTop: "0.75rem", transition: "background 0.15s, color 0.15s, border-color 0.15s", overflow: "hidden", whiteSpace: "nowrap" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#fff1f2"; e.currentTarget.style.color = "#e11d48"; e.currentTarget.style.borderColor = "#fecdd3"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; e.currentTarget.style.borderColor = "rgba(15,23,42,0.07)"; }}>
        <LogOut size={16} style={{ flexShrink: 0 }} />
        {!collapsed && <span>Logout</span>}
      </button>
    </motion.aside>
  );
}
