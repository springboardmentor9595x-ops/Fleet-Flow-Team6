import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import "../components/auth/Auth.css";
import "./VerifyEmail.css";

export default function ResendVerification() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await axios.post("http://localhost:8000/auth/resend-verification", { email });
      setSent(true);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
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

        {sent ? (
          <div className="verify-state">
            <div className="verify-icon success">📧</div>
            <h2>Check your inbox</h2>
            <p>
              If <strong>{email}</strong> is registered and unverified, we've
              sent a new verification link.
            </p>
            <Link to="/login" className="auth-submit-btn verify-btn">
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="auth-title">Resend Verification</h1>
            <p className="auth-subtitle">
              Enter your email address and we'll send you a new verification link.
            </p>

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
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label htmlFor="resend-email">Email Address</label>
                <div className="field-wrapper">
                  <svg
                    className="field-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <input
                    id="resend-email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Sending…
                  </>
                ) : (
                  "Resend Verification Email"
                )}
              </button>
            </form>

            <p className="auth-switch">
              Already verified? <Link to="/login">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
