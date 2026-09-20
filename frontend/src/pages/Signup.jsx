import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck, User, Mail, Lock, Phone, Eye, EyeOff,
  Shield, AlertCircle, CheckCircle2, ArrowRight, ChevronDown,
} from "lucide-react";
import api from "../api/axios";

const ROLES = [
  { value: "Admin",        label: "Admin",        description: "Full system access & user management",     color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe" },
  { value: "FleetManager", label: "Fleet Manager", description: "Vehicles, maintenance & driver oversight",  color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
  { value: "Dispatcher",   label: "Dispatcher",   description: "Trip assignments & live tracking",          color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
  { value: "Driver",       label: "Driver",       description: "View assigned trips & vehicle info",        color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
];

const strengthColors = ["", "#e11d48", "#d97706", "#3b82f6", "#059669"];
const strengthBgs    = ["", "#fff1f2", "#fffbeb", "#eff6ff", "#ecfdf5"];
const strengthLabels = ["", "Weak",    "Fair",    "Good",    "Strong"];

function getPasswordStrength(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", phone: "", role: "Admin" });
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(form.password);

  const parseErrorDetail = (detail) => {
    if (!detail) return "Signup failed. Please try again.";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((errItem) => {
        if (typeof errItem === "string") return errItem;
        if (errItem.msg) return errItem.msg.replace(/^value is not a valid email address:?\s*/i, "Please enter a valid email address (e.g. user@example.com): ");
        return JSON.stringify(errItem);
      }).join("; ");
    }
    if (typeof detail === "object") {
      return detail.msg || detail.message || JSON.stringify(detail);
    }
    return String(detail);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate email format on frontend before sending request
    const emailTrimmed = (form.email || "").trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(emailTrimmed)) {
      setError("Please enter a valid email address with a valid domain (e.g. user@example.com).");
      return;
    }

    // Validate phone number format on frontend before sending request
    const phoneRaw = (form.phone || "").trim();
    const phoneDigits = phoneRaw.replace(/^\+/, "");
    if (!/^\d+$/.test(phoneDigits)) {
      setError("Please enter a valid phone number (numbers only, no characters or symbols).");
      return;
    }
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      setError("Please enter a valid 10 to 15 digit phone number.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/signup", { ...form, email: emailTrimmed, phone: phoneRaw });
      setSuccess(true);
      setTimeout(() => navigate(`/verify-email?email=${encodeURIComponent(emailTrimmed)}`), 2000);
    } catch (err) {
      if (!err.response) {
        setError("Cannot reach the server. Please make sure the backend is running on port 8000.");
      } else {
        const parsedError = parseErrorDetail(err.response?.data?.detail);
        setError(parsedError);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f8fafc" }}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          style={{ background: "white", borderRadius: "1.5rem", padding: "3rem", textAlign: "center", maxWidth: "380px", boxShadow: "0 20px 60px rgba(15,23,42,0.10)", border: "1.5px solid rgba(15,23,42,0.07)" }}>
          <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "#ecfdf5", border: "1.5px solid #a7f3d0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
            <CheckCircle2 size={32} color="#059669" />
          </div>
          <h2 style={{ fontSize: "1.5rem", color: "#0f172a", marginBottom: "0.5rem" }}>Account created! OTP sent to your email.</h2>
          <p style={{ color: "#64748b" }}>Redirecting to OTP verification…</p>
        </motion.div>
      </div>
    );
  }

  const selectedRole = ROLES.find((r) => r.value === form.role);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>

      {/* Left panel */}
      <div className="signup-left-panel" style={{ display: "none", flex: "0 0 380px", flexDirection: "column", justifyContent: "center", alignItems: "flex-start", padding: "3rem", background: "white", borderRight: "1.5px solid rgba(15,23,42,0.07)", boxShadow: "4px 0 24px rgba(15,23,42,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "3rem" }}>
          <div style={{ borderRadius: "0.875rem", background: "linear-gradient(135deg,#6366f1,#3b82f6)", padding: "0.625rem", display: "flex", boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}>
            <Truck size={22} color="white" />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: "1.125rem", color: "#0f172a" }}>FleetFlow</p>
            <p style={{ fontSize: "0.75rem", color: "#64748b" }}>Ops Control Center</p>
          </div>
        </div>

        <h2 style={{ fontSize: "1.625rem", fontWeight: 700, lineHeight: 1.3, marginBottom: "0.875rem", color: "#0f172a" }}>
          Join <span className="ff-gradient-text">fleet operators</span> worldwide.
        </h2>
        <p style={{ color: "#64748b", lineHeight: 1.7, marginBottom: "2.5rem", fontSize: "0.9375rem" }}>
          Create your workspace and get your entire team managing routes, vehicles, and drivers from one premium dashboard.
        </p>

        {/* Role cards */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {ROLES.map((r) => {
            const active = form.role === r.value;
            return (
              <div key={r.value} style={{ borderRadius: "0.875rem", padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem", border: `1.5px solid ${active ? r.border : "rgba(15,23,42,0.07)"}`, background: active ? r.bg : "transparent", transition: "all 0.2s", cursor: "default" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "0.5rem", background: active ? r.bg : "#f8fafc", border: `1px solid ${active ? r.border : "rgba(15,23,42,0.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Shield size={14} color={r.color} />
                </div>
                <div>
                  <p style={{ fontSize: "0.875rem", fontWeight: 600, color: active ? r.color : "#334155" }}>{r.label}</p>
                  <p style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{r.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main form */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem" }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ width: "100%", maxWidth: "460px" }}>

          {/* Mobile brand */}
          <div className="mobile-brand" style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "2rem", justifyContent: "center" }}>
            <div style={{ borderRadius: "0.875rem", background: "linear-gradient(135deg,#6366f1,#3b82f6)", padding: "0.5rem", display: "flex", boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}>
              <Truck size={18} color="white" />
            </div>
            <span style={{ fontWeight: 700, fontSize: "1.125rem", color: "#0f172a" }}>FleetFlow</span>
          </div>

          <div style={{ background: "white", borderRadius: "1.5rem", padding: "2.5rem", boxShadow: "0 20px 60px rgba(15,23,42,0.10), 0 4px 16px rgba(15,23,42,0.05)", border: "1.5px solid rgba(15,23,42,0.07)" }}>
            <div style={{ marginBottom: "1.75rem" }}>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.375rem" }}>Create your account</h2>
              <p style={{ color: "#64748b", fontSize: "0.9375rem" }}>Get started with FleetFlow for free</p>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div className="ff-error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ marginBottom: "1.25rem" }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />{error}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>

                {/* Full Name */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="ff-label" htmlFor="signup-name">Full name</label>
                  <div style={{ position: "relative" }}>
                    <User size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                    <input id="signup-name" className="ff-input" type="text" name="full_name" placeholder="Jane Smith" value={form.full_name} onChange={handleChange} required style={{ paddingLeft: "2.75rem" }} />
                  </div>
                </div>

                {/* Email */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="ff-label" htmlFor="signup-email">Email address</label>
                  <div style={{ position: "relative" }}>
                    <Mail size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                    <input id="signup-email" className="ff-input" type="email" name="email" placeholder="you@company.com" value={form.email} onChange={handleChange} required style={{ paddingLeft: "2.75rem" }} />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="ff-label" htmlFor="signup-phone">Phone</label>
                  <div style={{ position: "relative" }}>
                    <Phone size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                    <input id="signup-phone" className="ff-input" type="text" name="phone" placeholder="+1 555 000 0000" value={form.phone} onChange={handleChange} required style={{ paddingLeft: "2.75rem" }} />
                  </div>
                </div>

                {/* Role */}
                <div>
                  <label className="ff-label" htmlFor="signup-role">Role</label>
                  <div style={{ position: "relative" }}>
                    <Shield size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                    <select id="signup-role" className="ff-select" name="role" value={form.role} onChange={handleChange} style={{ paddingLeft: "2.75rem", paddingRight: "2.5rem" }}>
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <ChevronDown size={14} style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                  </div>
                </div>

                {/* Password */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="ff-label" htmlFor="signup-password">Password</label>
                  <div style={{ position: "relative" }}>
                    <Lock size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                    <input id="signup-password" className="ff-input" type={showPw ? "text" : "password"} name="password" placeholder="Min. 8 characters" value={form.password} onChange={handleChange} required style={{ paddingLeft: "2.75rem", paddingRight: "3rem" }} />
                    <button type="button" onClick={() => setShowPw((p) => !p)} style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", padding: 0 }}>
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Strength meter */}
                  {form.password && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                        {[1,2,3,4].map((i) => (
                          <div key={i} style={{ flex: 1, height: "4px", borderRadius: "9999px", background: strength >= i ? strengthColors[strength] : "#e2e8f0", transition: "background 0.3s" }} />
                        ))}
                      </div>
                      <p style={{ fontSize: "0.75rem", color: strengthColors[strength], fontWeight: 500 }}>
                        {strengthLabels[strength]} password
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <button id="signup-submit" type="submit" className="ff-btn-primary" disabled={loading}
                style={{ width: "100%", justifyContent: "center", padding: "0.875rem 1.5rem", fontSize: "0.9375rem", marginTop: "0.5rem", opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? (
                  <><span style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> Creating account…</>
                ) : (
                  <>Create account <ArrowRight size={16} /></>
                )}
              </button>
            </form>

            <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.875rem", color: "#64748b" }}>
              Already have an account?{" "}
              <Link to="/login" style={{ color: "#6366f1", fontWeight: 600 }}>Sign in</Link>
            </p>
          </div>
        </motion.div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 1024px) {
          .signup-left-panel { display: flex !important; }
          .mobile-brand      { display: none  !important; }
        }
      `}</style>
    </div>
  );
}