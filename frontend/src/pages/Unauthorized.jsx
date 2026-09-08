import { motion } from "framer-motion";
import { ShieldAlert, ArrowLeft, LayoutDashboard, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getDashboardRoute } from "../config/permissions";

export default function Unauthorized() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role || "User";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
        padding: "1.5rem",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "white",
          borderRadius: "1.5rem",
          padding: "2.5rem 2rem",
          boxShadow: "0 20px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)",
          border: "1.5px solid rgba(15,23,42,0.08)",
          textAlign: "center",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "1.25rem",
            background: "linear-gradient(135deg, #fef2f2, #fee2e2)",
            border: "1.5px solid #fecaca",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.5rem",
            color: "#dc2626",
            boxShadow: "0 8px 20px rgba(220,38,38,0.12)",
          }}
        >
          <ShieldAlert size={32} />
        </div>

        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#dc2626",
            borderRadius: "9999px",
            padding: "0.25rem 0.75rem",
            fontSize: "0.75rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "1rem",
          }}
        >
          <Lock size={12} />
          HTTP 403 Forbidden
        </div>

        {/* Heading */}
        <h1
          style={{
            fontSize: "1.625rem",
            fontWeight: 700,
            color: "#0f172a",
            marginBottom: "0.5rem",
            letterSpacing: "-0.02em",
          }}
        >
          Access Restricted
        </h1>

        <p
          style={{
            fontSize: "0.9375rem",
            color: "#64748b",
            lineHeight: 1.6,
            marginBottom: "1.5rem",
          }}
        >
          You do not have administrative or operational privileges to access this page.
          Please return to your authorized workstation dashboard.
        </p>

        {/* Role card */}
        {user && (
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid rgba(15,23,42,0.07)",
              borderRadius: "0.875rem",
              padding: "0.875rem 1rem",
              marginBottom: "1.75rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.875rem",
            }}
          >
            <div style={{ textAlign: "left" }}>
              <span style={{ color: "#94a3b8", display: "block", fontSize: "0.75rem", fontWeight: 500 }}>
                Signed in as
              </span>
              <span style={{ fontWeight: 600, color: "#0f172a" }}>{user.full_name || user.email}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ color: "#94a3b8", display: "block", fontSize: "0.75rem", fontWeight: 500 }}>
                Current Role
              </span>
              <span
                style={{
                  background: "#eff6ff",
                  color: "#3b82f6",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "0.375rem",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  border: "1px solid #bfdbfe",
                }}
              >
                {role} {user.worker_type ? `(${user.worker_type})` : ""}
              </span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <button
            onClick={() => navigate(getDashboardRoute(user?.role))}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              width: "100%",
              padding: "0.875rem 1.5rem",
              borderRadius: "0.875rem",
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              color: "white",
              fontWeight: 600,
              fontSize: "0.9375rem",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(99,102,241,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 14px rgba(99,102,241,0.3)";
            }}
          >
            <LayoutDashboard size={18} />
            Go to My Dashboard
          </button>

          <button
            onClick={() => navigate(-1)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              width: "100%",
              padding: "0.75rem 1.5rem",
              borderRadius: "0.875rem",
              background: "transparent",
              color: "#64748b",
              fontWeight: 500,
              fontSize: "0.875rem",
              border: "1.5px solid rgba(15,23,42,0.1)",
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f1f5f9";
              e.currentTarget.style.color = "#0f172a";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#64748b";
            }}
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
        </div>
      </motion.div>
    </div>
  );
}

