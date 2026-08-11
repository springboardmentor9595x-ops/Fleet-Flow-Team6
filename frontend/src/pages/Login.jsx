import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck, Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, Sparkles, Key, RefreshCw, CheckCircle2
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [stats, setStats] = useState({
    vehicles: "0",
    onTime: "0%",
    activeRoutes: "0",
  });

  useEffect(() => {
    let active = true;
    async function fetchStats() {
      try {
        const response = await api.get("/dashboard/summary");
        if (active) {
          const data = response.data;
          const totalVehicles = data.find(item => item.label === "Total Vehicles")?.value || "0";
          const activeTrips = data.find(item => item.label === "Active Trips")?.value || "0";
          const onTimeRate = data.find(item => item.label === "On-Time Rate")?.value || "0%";
          setStats({
            vehicles: totalVehicles,
            onTime: onTimeRate,
            activeRoutes: activeTrips,
          });
        }
      } catch (err) {
        console.error("Failed to fetch login stats", err);
      }
    }
    fetchStats();
    return () => { active = false; };
  }, []);

  const statItems = [
    { value: stats.vehicles, label: "Vehicles tracked" },
    { value: stats.onTime, label: "On-time delivery" },
    { value: stats.activeRoutes,    label: "Active routes" },
  ];

  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);
      const response = await api.post("/auth/login", formData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (response.data.requires_otp) {
        navigate(`/verify-email?email=${encodeURIComponent(email)}`);
      } else {
        const userData = response.data.user || null;
        login(response.data.access_token, userData);
        navigate("/dashboard");
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || "Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>

      {/* ── Left brand panel ── */}
      <div
        className="login-left-panel"
        style={{
          display: "none",
          flex: "1",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "3rem",
          background: "linear-gradient(145deg, #6366f1 0%, #4f46e5 50%, #3b82f6 100%)",
          color: "white",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative circles */}
        <div style={{
          position: "absolute", top: "-80px", right: "-80px",
          width: "320px", height: "320px", borderRadius: "50%",
          background: "rgba(255,255,255,0.07)", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "-60px", left: "-60px",
          width: "240px", height: "240px", borderRadius: "50%",
          background: "rgba(255,255,255,0.07)", pointerEvents: "none",
        }} />

        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", position: "relative" }}>
          <div style={{ borderRadius: "0.875rem", background: "rgba(255,255,255,0.2)", padding: "0.625rem", display: "flex", backdropFilter: "blur(8px)" }}>
            <Truck size={22} color="white" />
          </div>
          <div>
            <p style={{ fontSize: "1.125rem", fontWeight: 700 }}>FleetFlow</p>
            <p style={{ fontSize: "0.75rem", opacity: 0.75 }}>Ops Control Center</p>
          </div>
        </div>

        {/* Hero copy */}
        <div style={{ maxWidth: "26rem", position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "9999px", padding: "0.25rem 0.875rem", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "1.25rem" }}>
            <Sparkles size={12} />
            AI-powered fleet intelligence
          </div>
          <h1 style={{ fontSize: "2.25rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "1rem", letterSpacing: "-0.02em" }}>
            Run your fleet with precision & speed.
          </h1>
          <p style={{ opacity: 0.8, lineHeight: 1.7, fontSize: "0.9375rem" }}>
            FleetFlow gives your team a premium command center for dispatching,
            maintenance, and real-time fleet visibility — all in one place.
          </p>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.875rem", marginTop: "2.5rem" }}>
            {statItems.map(({ value, label }) => (
              <div key={label} style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "1rem", padding: "1rem", textAlign: "center", backdropFilter: "blur(8px)" }}>
                <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{value}</p>
                <p style={{ fontSize: "0.75rem", opacity: 0.75, marginTop: "0.25rem" }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "1rem", padding: "1.25rem", position: "relative" }}>
          <p style={{ fontSize: "0.9375rem", fontStyle: "italic", opacity: 0.9 }}>
            "FleetFlow gave us a beautiful command center in days. It feels as polished as our best SaaS tools."
          </p>
          <p style={{ fontWeight: 600, fontSize: "0.875rem", marginTop: "0.75rem" }}>Alicia Gomez</p>
          <p style={{ fontSize: "0.8125rem", opacity: 0.65 }}>Operations Lead, VelocityX</p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{ flex: "1", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem" }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ width: "100%", maxWidth: "420px" }}
        >
          {/* Mobile brand */}
          <div className="mobile-brand" style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "2rem", justifyContent: "center" }}>
            <div style={{ borderRadius: "0.875rem", background: "linear-gradient(135deg,#6366f1,#3b82f6)", padding: "0.5rem", display: "flex", boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}>
              <Truck size={18} color="white" />
            </div>
            <span style={{ fontWeight: 700, fontSize: "1.125rem", color: "#0f172a" }}>FleetFlow</span>
          </div>

          {/* Card */}
          <div style={{ background: "white", borderRadius: "1.5rem", padding: "2.5rem", boxShadow: "0 20px 60px rgba(15,23,42,0.10), 0 4px 16px rgba(15,23,42,0.06)", border: "1.5px solid rgba(15,23,42,0.07)" }}>
            <div style={{ marginBottom: "2rem" }}>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.375rem" }}>Welcome back</h2>
              <p style={{ color: "#64748b", fontSize: "0.9375rem" }}>Sign in to your FleetFlow account</p>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div className="ff-error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ marginBottom: "1.25rem" }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div style={{ marginBottom: "1.125rem" }}>
                <label className="ff-label" htmlFor="login-email">Email address</label>
                <div style={{ position: "relative" }}>
                  <Mail size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                  <input id="login-email" className="ff-input" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ paddingLeft: "2.75rem" }} />
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem" }}>
                  <label className="ff-label" htmlFor="login-password" style={{ margin: 0 }}>Password</label>
                  <a href="#" style={{ fontSize: "0.8125rem", color: "#6366f1", fontWeight: 500 }}>Forgot password?</a>
                </div>
                <div style={{ position: "relative" }}>
                  <Lock size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                  <input id="login-password" className="ff-input" type={showPw ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ paddingLeft: "2.75rem", paddingRight: "3rem" }} />
                  <button type="button" onClick={() => setShowPw((p) => !p)} style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", padding: 0 }}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button id="login-submit" type="submit" className="ff-btn-primary" disabled={loading}
                style={{ width: "100%", justifyContent: "center", padding: "0.875rem 1.5rem", fontSize: "0.9375rem", opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? (
                  <><span style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> Signing in…</>
                ) : (
                  <>Sign in <ArrowRight size={16} /></>
                )}
              </button>
            </form>

            <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.875rem", color: "#64748b" }}>
              Don't have an account?{" "}
              <Link to="/signup" style={{ color: "#6366f1", fontWeight: 600 }}>Create one free</Link>
            </p>
          </div>
        </motion.div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 1024px) {
          .login-left-panel { display: flex !important; }
          .mobile-brand     { display: none  !important; }
        }
      `}</style>
    </div>
  );
}