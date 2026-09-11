import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../components/auth/Auth.css";
import "./VerifyEmail.css";

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyEmail, resendOtp } = useAuth();

  // Retrieve email from state or localStorage
  const [email, setEmail] = useState(() => {
    return location.state?.email || localStorage.getItem("pending_verify_email") || "";
  });

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [countdown, setCountdown] = useState(60);

  const inputRefs = useRef([]);

  // Store email to localStorage in case page is refreshed
  useEffect(() => {
    if (email) {
      localStorage.setItem("pending_verify_email", email);
    }
  }, [email]);

  // Focus first input on mount
  useEffect(() => {
    if (inputRefs.current[0] && !success) {
      inputRefs.current[0].focus();
    }
  }, [success]);

  // 60-second cooldown countdown
  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  // Handle single digit typing in box
  const handleInputChange = (index, value) => {
    // Only accept numeric characters
    const cleanVal = value.replace(/\D/g, "");

    const newOtp = [...otp];

    if (cleanVal.length > 1) {
      // If user typed/pasted multiple numbers into one box
      const chars = cleanVal.slice(0, 6).split("");
      for (let i = 0; i < 6; i++) {
        newOtp[i] = chars[i] || "";
      }
      setOtp(newOtp);
      const nextFocus = Math.min(chars.length, 5);
      inputRefs.current[nextFocus]?.focus();
      return;
    }

    newOtp[index] = cleanVal;
    setOtp(newOtp);
    setError("");

    // Move to next input if filled
    if (cleanVal && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace navigation
  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        // Move back and clear previous box
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle paste full 6-digit OTP
  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasteData) return;

    const newOtp = [...otp];
    const chars = pasteData.split("");
    for (let i = 0; i < 6; i++) {
      newOtp[i] = chars[i] || "";
    }
    setOtp(newOtp);
    setError("");

    const nextIndex = Math.min(chars.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  // Submit OTP Verification
  const handleVerify = async (e) => {
    e?.preventDefault();
    const fullOtp = otp.join("").trim();

    if (!email.trim()) {
      setError("Please specify your email address.");
      return;
    }

    if (fullOtp.length !== 6) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }

    setError("");
    setResendMessage("");
    setLoading(true);

    try {
      await verifyEmail(email, fullOtp);
      setSuccess(true);
      localStorage.removeItem("pending_verify_email");
      localStorage.removeItem("pending_debug_otp");
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((d) => d.msg).join(", "));
      } else {
        setError("Verification failed. Please check the OTP and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    if (countdown > 0 || resending) return;

    if (!email.trim()) {
      setError("Please enter your email to resend OTP.");
      return;
    }

    setError("");
    setResendMessage("");
    setResending(true);

    try {
      const res = await resendOtp(email);
      setResendMessage(res?.message || "A new 6-digit OTP has been sent to your email.");
      setCountdown(60);
      // Clear inputs
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || "Failed to resend OTP. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-glow auth-glow-1" />
      <div className="auth-glow auth-glow-2" />

      <div className="auth-card verify-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">🚚</span>
          <span className="auth-logo-text">FleetFlow</span>
        </div>

        {success ? (
          <div className="verify-state">
            <div className="verify-icon">✅</div>
            <h2>Email Verified!</h2>
            <p>Your email has been verified successfully. Redirecting to login...</p>
            <Link to="/login" className="auth-submit-btn verify-btn" style={{ marginTop: 12 }}>
              Go to Login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="auth-title">Verify Your Email</h1>
            <p className="verify-desc">
              We've sent a 6-digit verification code to
              <br />
              <span className="verify-email-badge">
                ✉️ {email || "your email address"}
              </span>
            </p>


            {/* Email input field if missing */}
            {!email && (
              <div className="auth-field" style={{ marginBottom: 16 }}>
                <label htmlFor="verify-email-input">Email Address</label>
                <div className="field-wrapper">
                  <input
                    id="verify-email-input"
                    type="email"
                    placeholder="Enter your registered email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="auth-error">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {resendMessage && (
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  color: "#34d399",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>✓</span> {resendMessage}
              </div>
            )}

            <form onSubmit={handleVerify} className="auth-form">
              {/* 6 Digit Input Boxes */}
              <div className="otp-inputs-container" onPaste={handlePaste}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className={`otp-box-input ${digit ? "filled" : ""}`}
                    autoComplete="one-time-code"
                  />
                ))}
              </div>

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={loading || otp.join("").length !== 6}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Verifying...
                  </>
                ) : (
                  "Verify Email"
                )}
              </button>
            </form>

            <div className="resend-section">
              <p style={{ margin: "0 0 8px 0" }}>Didn't receive the code?</p>
              {countdown > 0 ? (
                <span>
                  Resend OTP in <span className="resend-countdown">{countdown}s</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="resend-btn"
                >
                  {resending ? "Sending..." : "Resend OTP"}
                </button>
              )}
            </div>

            <div>
              <Link to="/login" className="verify-back-link">
                ← Back to Login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
