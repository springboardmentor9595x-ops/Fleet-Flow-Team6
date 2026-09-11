import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";

import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();

  const [token, setToken] = useState(
    localStorage.getItem("token")
  );

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");

    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  // Sync user profile from backend whenever token exists
  const refreshProfile = async () => {
    const curToken = localStorage.getItem("token");
    if (!curToken) return null;
    try {
      const res = await api.get("/users/me");
      setUser(res.data);
      localStorage.setItem("user", JSON.stringify(res.data));
      return res.data;
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        console.warn("Session invalid or role changed, logging out...");
        logout();
      }
      return null;
    }
  };

  useEffect(() => {
    if (token) {
      refreshProfile();
    }
  }, [token]);

  // =========================
  // LOGIN
  // =========================
  const login = async (email, password) => {
    try {
      const formData = new URLSearchParams();

      formData.append("username", email.trim());
      formData.append("password", password);

      const response = await api.post(
        "/auth/login",
        formData,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      console.log("LOGIN RESPONSE:", response.data);

      const accessToken = response.data.access_token;

      if (!accessToken) {
        alert("Login successful, but access token was not received.");
        return;
      }

      // Save JWT token in localStorage first so api interceptor can attach it
      localStorage.setItem("token", accessToken);

      // Get logged-in user's details before setting state to guarantee role alignment
      const profileResponse = await api.get("/users/me");

      console.log(
        "USER PROFILE:",
        profileResponse.data
      );

      const loggedInUser = profileResponse.data;

      localStorage.setItem(
        "user",
        JSON.stringify(loggedInUser)
      );

      // Clean up temporary OTP storage
      localStorage.removeItem("pending_debug_otp");
      localStorage.removeItem("pending_verify_email");

      // Atomically update token and user state together
      setToken(accessToken);
      setUser(loggedInUser);

      // Go to dashboard
      navigate("/dashboard");

    } catch (error) {
      console.error("LOGIN ERROR:", error);
      // Clean up token if profile fetch failed
      localStorage.removeItem("token");
      // Re-throw so LoginForm can handle 403 and other errors
      throw error;
    }
  };

  // =========================
  // SIGNUP
  // =========================
  const signup = async (data) => {
    const response = await api.post("/auth/signup", data);
    console.log("SIGNUP RESPONSE:", response.data);
    return response.data;
  };

  // =========================
  // VERIFY EMAIL (OTP)
  // =========================
  const verifyEmail = async (email, otp) => {
    const response = await api.post("/auth/verify-email", {
      email: email.trim(),
      otp: otp.trim(),
    });
    localStorage.removeItem("pending_debug_otp");
    localStorage.removeItem("pending_verify_email");
    return response.data;
  };

  // =========================
  // RESEND OTP
  // =========================
  const resendOtp = async (email) => {
    const response = await api.post("/auth/resend-otp", {
      email: email.trim(),
    });
    return response.data;
  };

  // =========================
  // LOGOUT
  // =========================
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("pending_debug_otp");
    localStorage.removeItem("pending_verify_email");

    setToken(null);
    setUser(null);

    navigate("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        signup,
        verifyEmail,
        resendOtp,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// =========================
// useAuth HOOK
// =========================
export const useAuth = () => {
  return useContext(AuthContext);
};