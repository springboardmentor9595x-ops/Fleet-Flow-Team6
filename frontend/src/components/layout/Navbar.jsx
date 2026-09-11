import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import "./Navbar.css";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const dropdownRef = useRef(null);

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "FF";

  const roleBadge = {
    Admin: "#ef4444",
    FleetManager: "#3b82f6",
    Dispatcher: "#8b5cf6",
    Driver: "#10b981",
  };

  const roleColor = roleBadge[user?.role] || "#64748b";

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get("/notifications/unread-count");
      setUnreadCount(res.data.unread_count || 0);
    } catch {
      // ignore
    }
  };

  const fetchNotifications = async () => {
    setLoadingNotifs(true);
    try {
      const res = await api.get("/notifications/");
      setNotifications(res.data || []);
      const unread = (res.data || []).filter((n) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error("Failed to load notifications", err);
    } finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Polling every 30s
    return () => clearInterval(interval);
  }, []);

  const toggleDropdown = () => {
    if (!showDropdown) {
      fetchNotifications();
    }
    setShowDropdown(!showDropdown);
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  const markAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.notification_id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.put("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const diffMin = Math.round((now - d) / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  };

  const getNotifIcon = (type) => {
    switch (type?.toLowerCase()) {
      case "warning":
        return "⚠️";
      case "error":
        return "🚨";
      case "success":
        return "✅";
      case "info":
      default:
        return "🔔";
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="brand-icon">🚚</div>
        <span className="brand-name">FleetFlow</span>
      </div>

      <div className="navbar-right">
        {/* Notification Bell */}
        <div className="notif-container" ref={dropdownRef}>
          <button
            className={`notif-bell-btn ${showDropdown ? "active" : ""}`}
            onClick={toggleDropdown}
            title="Notifications & Alerts"
            aria-label="Notifications"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
            )}
          </button>

          {/* Notification Dropdown */}
          {showDropdown && (
            <div className="notif-dropdown">
              <div className="notif-header">
                <div className="notif-title-row">
                  <span className="notif-title">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="notif-unread-pill">{unreadCount} new</span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button className="notif-mark-all" onClick={markAllRead}>
                    Mark all read
                  </button>
                )}
              </div>

              <div className="notif-body">
                {loadingNotifs ? (
                  <div className="notif-loading">Loading alerts...</div>
                ) : notifications.length === 0 ? (
                  <div className="notif-empty">
                    <span style={{ fontSize: "1.8rem" }}>🎉</span>
                    <span>No notifications right now</span>
                  </div>
                ) : (
                  <div className="notif-list">
                    {notifications.map((n) => (
                      <div
                        key={n.notification_id}
                        className={`notif-item ${n.is_read ? "read" : "unread"}`}
                        onClick={(e) => !n.is_read && markAsRead(n.notification_id, e)}
                      >
                        <span className="notif-icon">{getNotifIcon(n.type)}</span>
                        <div className="notif-content">
                          <div className="notif-item-title">{n.title}</div>
                          <div className="notif-item-msg">{n.message}</div>
                          <div className="notif-item-time">{formatTime(n.created_at)}</div>
                        </div>
                        {!n.is_read && (
                          <div className="notif-unread-dot" title="Unread" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="user-info">
          <div className="user-details">
            <span className="user-name">{user?.full_name || "User"}</span>
            <span
              className="user-role"
              style={{ color: roleColor }}
            >
              {user?.role || "Staff"}
            </span>
          </div>
          <div className="user-avatar" style={{ background: `${roleColor}22`, borderColor: `${roleColor}44`, color: roleColor }}>
            {initials}
          </div>
        </div>

        <button className="logout-btn" onClick={logout} title="Logout">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </nav>
  );
}