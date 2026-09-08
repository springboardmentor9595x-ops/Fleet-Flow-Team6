import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Briefcase,
  Clock,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { getDashboardRoute } from "../config/permissions";

const ROLES_LIST = [
  {
    id: "Admin",
    label: "Admin",
    icon: ShieldCheck,
    badge: "Email OTP",
    color: "#6366f1",
  },
  {
    id: "FleetManager",
    label: "Fleet Manager",
    icon: Briefcase,
    badge: "Password",
    color: "#0284c7",
  },
  {
    id: "Dispatcher",
    label: "Dispatcher",
    icon: Clock,
    badge: "Password",
    color: "#10b981",
  },
  {
    id: "Driver",
    label: "Driver",
    icon: Truck,
    badge: "Password/PIN",
    color: "#d97706",
  },
];

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [selectedRole, setSelectedRole] = useState("Admin");

  // Marketing metrics
  const [stats, setStats] = useState({
    vehicles: "24",
    onTime: "98.4%",
    activeRoutes: "12",
  });

  useEffect(() => {
    let active = true;
    async function fetchStats() {
      try {
        const response = await api.get("/dashboard/summary");
        if (active && Array.isArray(response.data)) {
          const data = response.data;
          const totalVehicles = data.find((item) => item.label === "Total Vehicles")?.value || "24";
          const activeTrips = data.find((item) => item.label === "Active Trips")?.value || "12";
          const onTimeRate = data.find((item) => item.label === "On-Time Rate")?.value || "98.4%";
          setStats({
            vehicles: totalVehicles,
            onTime: onTimeRate,
            activeRoutes: activeTrips,
          });
        }
      } catch (err) {
        // Fallback default stats
      }
    }
    fetchStats();
    return () => {
      active = false;
    };
  }, []);

  const statItems = [
    { value: stats.vehicles, label: "Vehicles tracked" },
    { value: stats.onTime, label: "On-time delivery" },
    { value: stats.activeRoutes, label: "Active routes" },
  ];

  // Common Form States
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Admin Specific OTP States
  const [adminOtpStep, setAdminOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(300);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Countdown timer effect
  useEffect(() => {
    let timer;
    if (adminOtpStep && countdown > 0) {
      timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [adminOtpStep, countdown]);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleRoleChange = (role) => {
    setSelectedRole(role);
    setError("");
    setSuccessMsg("");
    setAdminOtpStep(false);
    setOtpCode(["", "", "", "", "", ""]);
  };

  // 1. Admin: Send OTP
  const handleAdminSendOtp = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    if (!identifier.trim()) {
      setError("Please enter your admin email address.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/admin/send-otp", { email: identifier.trim() });
      setAdminOtpStep(true);
      setCountdown(300);
      setResendCooldown(60);
      setSuccessMsg(response.data.message || `Verification OTP sent to ${identifier}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send OTP. Please check email address.");
    } finally {
      setLoading(false);
    }
  };

  // 1b. Admin: Resend OTP
  const handleAdminResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await api.post("/auth/admin/send-otp", { email: identifier.trim() });
      setCountdown(300);
      setResendCooldown(60);
      setSuccessMsg("A fresh 6-digit code has been sent to your email.");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  // 1c. Admin: Verify OTP
  const handleAdminVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    const fullOtp = otpCode.join("").trim();
    if (fullOtp.length !== 6) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/admin/verify-otp", {
        email: identifier.trim(),
        otp: fullOtp,
      });

      const { access_token, user } = response.data;
      login(access_token, user);
      navigate("/admin/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid or expired OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpDigitChange = (index, value) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      if (digits.length === 6) {
        setOtpCode(digits);
        const nextInput = document.getElementById("otp-digit-5");
        if (nextInput) nextInput.focus();
        return;
      }
    }

    const cleanVal = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otpCode];
    newOtp[index] = cleanVal;
    setOtpCode(newOtp);

    if (cleanVal && index < 5) {
      const nextInput = document.getElementById(`otp-digit-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      const prevInput = document.getElementById(`otp-digit-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  // 2. Standard Role-Aware Login (Email + Role + Password/PIN)
  const handleRoleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!identifier.trim()) {
      setError("Please enter your email or identifier.");
      return;
    }
    if (!password) {
      setError("Please enter your password / PIN.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/login", {
        email: identifier.trim(),
        role: selectedRole,
        password: password,
      });

      const { access_token, user } = response.data;
      login(access_token, user);

      const targetRoute = getDashboardRoute(user?.role || selectedRole);
      navigate(targetRoute);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
      {/* ── Left marketing panel ── */}
      <div
        className="login-left-panel"
        style={{
          display: "none",
          flex: "1",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "3.5rem",
          background: "linear-gradient(145deg, #4f46e5 0%, #3b82f6 50%, #06b6d4 100%)",
          color: "white",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-90px",
            right: "-90px",
            width: "360px",
            height: "360px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.09)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-60px",
            left: "-60px",
            width: "280px",
            height: "280px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.07)",
            pointerEvents: "none",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", position: "relative" }}>
          <div
            style={{
              borderRadius: "1rem",
              background: "rgba(255,255,255,0.22)",
              padding: "0.75rem",
              display: "flex",
              backdropFilter: "blur(10px)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            }}
          >
            <Truck size={26} color="white" />
          </div>
          <div>
            <p style={{ fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.01em" }}>FleetFlow</p>
            <p style={{ fontSize: "0.8125rem", opacity: 0.85 }}>Multi-Account Cloud Platform</p>
          </div>
        </div>

        <div style={{ maxWidth: "28rem", position: "relative" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: "9999px",
              padding: "0.35rem 1rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              marginBottom: "1.5rem",
              backdropFilter: "blur(8px)",
            }}
          >
            <Sparkles size={14} />
            Unified Account Security
          </div>
          <h1
            style={{
              fontSize: "2.5rem",
              fontWeight: 800,
              lineHeight: 1.15,
              marginBottom: "1.25rem",
              letterSpacing: "-0.025em",
            }}
          >
            Smart Fleet & Logistics Management.
          </h1>
          <p style={{ opacity: 0.9, lineHeight: 1.7, fontSize: "1rem" }}>
            Multiple account profiles under a single email. Switch roles seamlessly with isolated
            permissions, dedicated dashboards, and enterprise OTP security.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "1rem",
              marginTop: "2.75rem",
            }}
          >
            {statItems.map(({ value, label }) => (
              <div
                key={label}
                style={{
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.22)",
                  borderRadius: "1.125rem",
                  padding: "1rem 0.875rem",
                  textAlign: "center",
                  backdropFilter: "blur(10px)",
                }}
              >
                <p style={{ fontSize: "1.625rem", fontWeight: 800 }}>{value}</p>
                <p style={{ fontSize: "0.75rem", opacity: 0.8, marginTop: "0.25rem" }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "1.125rem",
            padding: "1.25rem",
            position: "relative",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.375rem" }}>
            <ShieldCheck size={18} />
            <span style={{ fontWeight: 700, fontSize: "0.875rem" }}>Role-Isolated Architecture</span>
          </div>
          <p style={{ fontSize: "0.8125rem", opacity: 0.85, margin: 0, lineHeight: 1.5 }}>
            Each role maintains its own credentials, activity logs, permissions, and workspace without
            cross-account data leakage.
          </p>
        </div>
      </div>

      {/* ── Right login panel ── */}
      <div
        style={{
          flex: "1.2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2.5rem 1.5rem",
          overflowY: "auto",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ width: "100%", maxWidth: "560px" }}
        >
          {/* Mobile brand header */}
          <div
            className="mobile-brand"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              marginBottom: "1.5rem",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                borderRadius: "0.875rem",
                background: "linear-gradient(135deg,#4f46e5,#3b82f6)",
                padding: "0.625rem",
                display: "flex",
                boxShadow: "0 4px 16px rgba(79,70,229,0.3)",
              }}
            >
              <Truck size={20} color="white" />
            </div>
            <span style={{ fontWeight: 800, fontSize: "1.25rem", color: "#0f172a" }}>FleetFlow</span>
          </div>

          {/* Main Card */}
          <div
            style={{
              background: "white",
              borderRadius: "1.75rem",
              padding: "2.5rem",
              boxShadow: "0 20px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)",
              border: "1.5px solid rgba(15,23,42,0.07)",
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: "1.75rem" }}>
              <h2
                style={{
                  fontSize: "1.625rem",
                  fontWeight: 800,
                  color: "#0f172a",
                  marginBottom: "0.375rem",
                  letterSpacing: "-0.02em",
                }}
              >
                Welcome to FleetFlow
              </h2>
              <p style={{ color: "#64748b", fontSize: "0.9375rem", fontWeight: 500 }}>
                Smart Fleet & Logistics Management
              </p>
            </div>

            {/* "Login as" Selector */}
            <div style={{ marginBottom: "1.75rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#475569",
                  marginBottom: "0.75rem",
                }}
              >
                Login as
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "0.5rem",
                }}
              >
                {ROLES_LIST.map(({ id, label, icon: Icon, badge }) => {
                  const isSelected = selectedRole === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleRoleChange(id)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        padding: "0.75rem 0.875rem",
                        borderRadius: "0.875rem",
                        border: isSelected ? "2px solid #6366f1" : "1.5px solid rgba(15,23,42,0.08)",
                        background: isSelected ? "#f5f3ff" : "#ffffff",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        textAlign: "left",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <div
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "0.5rem",
                            background: isSelected ? "#6366f1" : "#f1f5f9",
                            color: isSelected ? "white" : "#64748b",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Icon size={16} />
                        </div>
                        {isSelected && (
                          <div
                            style={{
                              width: "16px",
                              height: "16px",
                              borderRadius: "50%",
                              background: "#6366f1",
                              color: "white",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <CheckCircle2 size={10} />
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: "0.8125rem",
                          color: isSelected ? "#4338ca" : "#1e293b",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          width: "100%",
                        }}
                      >
                        {label}
                      </span>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          color: isSelected ? "#6366f1" : "#94a3b8",
                          fontWeight: 500,
                        }}
                      >
                        {badge}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Error & Success alerts */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#dc2626",
                    borderRadius: "0.875rem",
                    padding: "0.75rem 1rem",
                    fontSize: "0.875rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    marginBottom: "1.25rem",
                    fontWeight: 500,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                  {error.toLowerCase().includes("not verified") && (
                    <button
                      type="button"
                      onClick={() => navigate(`/verify-email?email=${encodeURIComponent(identifier.trim())}`)}
                      style={{
                        alignSelf: "flex-start",
                        background: "#dc2626",
                        color: "white",
                        border: "none",
                        borderRadius: "0.5rem",
                        padding: "0.35rem 0.75rem",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        marginTop: "0.25rem",
                      }}
                    >
                      Verify Email Now (Enter OTP) →
                    </button>
                  )}
                </motion.div>
              )}

              {successMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    color: "#16a34a",
                    borderRadius: "0.875rem",
                    padding: "0.75rem 1rem",
                    fontSize: "0.875rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.625rem",
                    marginBottom: "1.25rem",
                    fontWeight: 500,
                  }}
                >
                  <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                  <span>{successMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── 1. ADMIN FORM (Email OTP) ── */}
            {selectedRole === "Admin" ? (
              <div>
                {!adminOtpStep ? (
                  <form onSubmit={handleAdminSendOtp}>
                    <div style={{ marginBottom: "1.25rem" }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          color: "#334155",
                          marginBottom: "0.375rem",
                        }}
                      >
                        Admin Email Address
                      </label>
                      <div style={{ position: "relative" }}>
                        <Mail
                          size={16}
                          style={{
                            position: "absolute",
                            left: "1rem",
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#94a3b8",
                            pointerEvents: "none",
                          }}
                        />
                        <input
                          type="email"
                          placeholder="admin@fleetflow.com"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          required
                          style={{
                            width: "100%",
                            padding: "0.8125rem 1rem 0.8125rem 2.75rem",
                            borderRadius: "0.75rem",
                            border: "1.5px solid rgba(15,23,42,0.12)",
                            outline: "none",
                            fontSize: "0.9375rem",
                            color: "#0f172a",
                          }}
                        />
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.375rem" }}>
                        Admin access requires 6-digit email OTP verification.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        padding: "0.875rem 1.5rem",
                        borderRadius: "0.875rem",
                        background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                        color: "white",
                        fontWeight: 600,
                        fontSize: "0.9375rem",
                        border: "none",
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.75 : 1,
                        boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
                      }}
                    >
                      {loading ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          Sending One-Time Password…
                        </>
                      ) : (
                        <>
                          Send OTP <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleAdminVerifyOtp}>
                    <div
                      style={{
                        background: "#eff6ff",
                        border: "1px solid #bfdbfe",
                        borderRadius: "0.875rem",
                        padding: "0.75rem 1rem",
                        marginBottom: "1.25rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <span style={{ fontSize: "0.75rem", color: "#1e40af", display: "block" }}>
                          Code sent to:
                        </span>
                        <strong style={{ fontSize: "0.875rem", color: "#1e3a8a" }}>{identifier}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAdminOtpStep(false);
                          setError("");
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#2563eb",
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                      >
                        <ArrowLeft size={14} /> Change
                      </button>
                    </div>

                    <div style={{ marginBottom: "1.5rem" }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          color: "#334155",
                          marginBottom: "0.625rem",
                          textAlign: "center",
                        }}
                      >
                        Enter 6-Digit Verification Code
                      </label>

                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                        {otpCode.map((digit, idx) => (
                          <input
                            key={idx}
                            id={`otp-digit-${idx}`}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                            style={{
                              width: "48px",
                              height: "56px",
                              textAlign: "center",
                              fontSize: "1.5rem",
                              fontWeight: 700,
                              color: "#0f172a",
                              borderRadius: "0.75rem",
                              border: digit ? "2px solid #6366f1" : "1.5px solid rgba(15,23,42,0.15)",
                              background: digit ? "#f5f3ff" : "#ffffff",
                              outline: "none",
                              boxShadow: digit ? "0 0 0 3px rgba(99,102,241,0.15)" : "none",
                            }}
                          />
                        ))}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: "1rem",
                          fontSize: "0.8125rem",
                          color: "#64748b",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                          <Clock size={14} />
                          <span>Code expires in: </span>
                          <strong style={{ color: countdown < 60 ? "#ef4444" : "#0f172a" }}>
                            {formatCountdown(countdown)}
                          </strong>
                        </div>

                        <button
                          type="button"
                          onClick={handleAdminResendOtp}
                          disabled={resendCooldown > 0 || loading}
                          style={{
                            background: "none",
                            border: "none",
                            color: resendCooldown > 0 ? "#94a3b8" : "#6366f1",
                            fontWeight: 600,
                            cursor: resendCooldown > 0 ? "not-allowed" : "pointer",
                          }}
                        >
                          {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : "Resend code"}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        padding: "0.875rem 1.5rem",
                        borderRadius: "0.875rem",
                        background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                        color: "white",
                        fontWeight: 600,
                        fontSize: "0.9375rem",
                        border: "none",
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.75 : 1,
                        boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
                      }}
                    >
                      {loading ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          Verifying Code…
                        </>
                      ) : (
                        <>
                          Verify & Sign In as Admin <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* ── 2. ROLE LOGIN (Email + Role + Password/PIN) ── */
              <form onSubmit={handleRoleLogin}>
                {/* Email / Identifier */}
                <div style={{ marginBottom: "1.125rem" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: "0.375rem",
                    }}
                  >
                    {selectedRole === "Driver" ? "Driver Email or Full Name" : "Email Address"}
                  </label>
                  <div style={{ position: "relative" }}>
                    <Mail
                      size={16}
                      style={{
                        position: "absolute",
                        left: "1rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#94a3b8",
                        pointerEvents: "none",
                      }}
                    />
                    <input
                      type="text"
                      placeholder={selectedRole === "Driver" ? "e.g. Marcus Lee or driver@gmail.com" : "you@company.com"}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "0.8125rem 1rem 0.8125rem 2.75rem",
                        borderRadius: "0.75rem",
                        border: "1.5px solid rgba(15,23,42,0.12)",
                        outline: "none",
                        fontSize: "0.9375rem",
                        color: "#0f172a",
                      }}
                    />
                  </div>
                </div>

                {/* Role Selector Confirm */}
                <div style={{ marginBottom: "1.125rem" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: "0.375rem",
                    }}
                  >
                    Target Account Role
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.8125rem 1rem",
                      borderRadius: "0.75rem",
                      border: "1.5px solid rgba(15,23,42,0.12)",
                      outline: "none",
                      fontSize: "0.9375rem",
                      color: "#0f172a",
                      background: "white",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {ROLES_LIST.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label} ({r.badge})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Password / PIN */}
                <div style={{ marginBottom: "1.5rem" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: "0.375rem",
                    }}
                  >
                    Password / PIN
                  </label>
                  <div style={{ position: "relative" }}>
                    <Lock
                      size={16}
                      style={{
                        position: "absolute",
                        left: "1rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#94a3b8",
                        pointerEvents: "none",
                      }}
                    />
                    <input
                      type={showPw ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "0.8125rem 3rem 0.8125rem 2.75rem",
                        borderRadius: "0.75rem",
                        border: "1.5px solid rgba(15,23,42,0.12)",
                        outline: "none",
                        fontSize: "0.9375rem",
                        color: "#0f172a",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((p) => !p)}
                      style={{
                        position: "absolute",
                        right: "1rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#94a3b8",
                        display: "flex",
                        padding: 0,
                      }}
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    padding: "0.875rem 1.5rem",
                    borderRadius: "0.875rem",
                    background: "linear-gradient(135deg, #4f46e5, #3b82f6)",
                    color: "white",
                    fontWeight: 600,
                    fontSize: "0.9375rem",
                    border: "none",
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.75 : 1,
                    boxShadow: "0 4px 14px rgba(79,70,229,0.3)",
                  }}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Authenticating…
                    </>
                  ) : (
                    <>
                      Login as {selectedRole} <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Quick help note */}
            <div
              style={{
                marginTop: "1.75rem",
                padding: "0.75rem 1rem",
                borderRadius: "0.875rem",
                background: "#f8fafc",
                border: "1px dashed rgba(15,23,42,0.12)",
                fontSize: "0.75rem",
                color: "#64748b",
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: "#334155" }}>Multi-Role Account Support:</strong>
              <p style={{ margin: "0.25rem 0 0" }}>
                You can create separate accounts with the same email address under different roles
                (Admin, Fleet Manager, Driver). Select your intended role before signing in.
              </p>
            </div>

            {/* Footer link */}
            <p
              style={{
                textAlign: "center",
                marginTop: "1.5rem",
                fontSize: "0.875rem",
                color: "#64748b",
              }}
            >
              Need a new account under another role?{" "}
              <Link to="/signup" style={{ color: "#6366f1", fontWeight: 600 }}>
                Register here
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
        @media (min-width: 1024px) {
          .login-left-panel { display: flex !important; }
          .mobile-brand     { display: none  !important; }
        }
      `}</style>
    </div>
  );
}