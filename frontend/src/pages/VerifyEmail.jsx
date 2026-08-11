import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck, AlertCircle, CheckCircle2, ArrowLeft, RefreshCw, Key
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState("");
  const [countdown, setCountdown] = useState(300); // 5 minutes in seconds
  const [resending, setResending] = useState(false);

  // Countdown timer effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError("Please enter a 6-digit OTP code.");
      return;
    }
    setError("");
    setOtpSuccess("");
    setLoading(true);
    try {
      const response = await api.post("/auth/verify-otp", {
        email,
        otp
      });
      setOtpSuccess("Code verified successfully! Redirecting...");
      const userData = response.data.user || null;
      login(response.data.access_token, userData);
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    if (!email) {
      setError("Email address is missing. Please sign up or log in again.");
      return;
    }
    setError("");
    setOtpSuccess("");
    setResending(true);
    try {
      await api.post("/auth/send-otp", { email });
      setOtpSuccess("A new verification code has been sent to your email.");
      setCountdown(300); // Reset countdown to 5 minutes
      setOtp("");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to resend code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem" }}>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ width: "100%", maxWidth: "460px" }}>
        
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "2rem", justifyContent: "center" }}>
          <div style={{ borderRadius: "0.875rem", background: "linear-gradient(135deg,#6366f1,#3b82f6)", padding: "0.5rem", display: "flex", boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}>
            <Truck size={18} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: "1.125rem", color: "#0f172a" }}>FleetFlow</span>
        </div>

        {/* Verification Card */}
        <div style={{ background: "white", borderRadius: "1.5rem", padding: "2.5rem", boxShadow: "0 20px 60px rgba(15,23,42,0.10), 0 4px 16px rgba(15,23,42,0.05)", border: "1.5px solid rgba(15,23,42,0.07)" }}>
          
          <div style={{ marginBottom: "2rem", textAlign: "center" }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" }}>Enter Verification Code</h2>
            <p style={{ color: "#64748b", fontSize: "0.9375rem", lineHeight: 1.5 }}>
              We've sent a 6-digit OTP code to:
            </p>
            <p style={{ fontWeight: 600, color: "#334155", fontSize: "0.9375rem", margin: "0.25rem 0 1rem", wordBreak: "break-all" }}>
              {email || "your email address"}
            </p>
            <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
              The code will expire in <strong style={{ color: "#3b82f6" }}>{formatTime(countdown)}</strong>
            </p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div className="ff-error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ marginBottom: "1.5rem" }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                {error}
              </motion.div>
            )}
            {otpSuccess && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} 
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#047857", padding: "0.75rem 1rem", borderRadius: "0.75rem", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                {otpSuccess}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleVerify}>
            {/* OTP Code Input */}
            <div style={{ marginBottom: "1.75rem" }}>
              <label className="ff-label" htmlFor="otp-code">One-Time Password (OTP)</label>
              <div style={{ position: "relative" }}>
                <Key size={16} style={{ position: "absolute", left: "1.25rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                <input
                  id="otp-code"
                  className="ff-input"
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  required
                  style={{ paddingLeft: "3rem", letterSpacing: "0.5rem", fontWeight: "bold", fontSize: "1.25rem", textAlign: "center" }}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Verify Button */}
            <button type="submit" className="ff-btn-primary" disabled={loading} style={{ width: "100%", justifyContent: "center", padding: "0.875rem", fontSize: "0.9375rem" }}>
              {loading ? (
                <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                "Verify & Proceed"
              )}
            </button>
          </form>

          {/* Resend Link Section */}
          <div style={{ textAlign: "center", margin: "1.75rem 0 0 0", fontSize: "0.875rem", color: "#64748b" }}>
            Didn't receive the code?{" "}
            {countdown > 0 ? (
              <span style={{ fontWeight: 600, color: "#64748b" }}>Resend code in {formatTime(countdown)}</span>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6366f1",
                  fontWeight: 600,
                  cursor: resending ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: 0
                }}
              >
                {resending ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : null}
                Resend verification code
              </button>
            )}
          </div>

          <hr style={{ margin: "1.5rem 0", border: "0", borderTop: "1px solid rgba(15,23,42,0.07)" }} />

          <div style={{ textAlign: "center" }}>
            <Link to="/login" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "#64748b", textDecoration: "none", hover: { color: "#0f172a" }, transition: "color 0.2s" }}>
              <ArrowLeft size={16} /> Back to Sign In
            </Link>
          </div>

        </div>
      </motion.div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
