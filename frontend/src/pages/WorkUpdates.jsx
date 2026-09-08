import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  User,
  Lock,
  Layers,
} from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const STATUS_CONFIG = {
  "In Progress": { color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
  "Completed": { color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0" },
  "Delayed": { color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
  "Under Review": { color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
  "Issue Reported": { color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe" },
};

export default function WorkUpdates() {
  const { user, role } = useAuth();

  const [loading, setLoading] = useState(true);
  const [updates, setUpdates] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState("");
  const [customTaskId, setCustomTaskId] = useState("");
  const [customTaskTitle, setCustomTaskTitle] = useState("");
  const [createStatus, setCreateStatus] = useState("In Progress");
  const [createDesc, setCreateDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit Modal
  const [editingUpdate, setEditingUpdate] = useState(null);
  const [editStatus, setEditStatus] = useState("In Progress");
  const [editDesc, setEditDesc] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Error / Notification Banner
  const [errorBanner, setErrorBanner] = useState("");
  const [successBanner, setSuccessBanner] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorBanner("");
    try {
      const [updatesRes, tasksRes] = await Promise.all([
        api.get("/work-updates").catch(() => ({ data: [] })),
        api.get("/work-updates/tasks").catch(() => ({ data: [] })),
      ]);
      setUpdates(updatesRes.data || []);
      setTasks(tasksRes.data || []);
      if (tasksRes.data && tasksRes.data.length > 0) {
        setSelectedTask(tasksRes.data[0].task_id);
      }
    } catch (err) {
      console.error("Failed to fetch work updates", err);
      setErrorBanner("Failed to retrieve work updates. Please check backend connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create handler
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorBanner("");

    let taskId = selectedTask;
    let taskTitle = "";

    if (selectedTask === "custom") {
      taskId = customTaskId.trim() || "CUSTOM-TASK";
      taskTitle = customTaskTitle.trim() || taskId;
    } else {
      const found = tasks.find((t) => t.task_id === selectedTask);
      taskTitle = found ? found.title : selectedTask;
    }

    try {
      await api.post("/work-updates", {
        task_id: taskId,
        task_title: taskTitle,
        work_status: createStatus,
        description: createDesc.trim(),
      });
      setShowCreateModal(false);
      setCreateDesc("");
      setCustomTaskId("");
      setCustomTaskTitle("");
      setSuccessBanner("Work status update recorded successfully.");
      setTimeout(() => setSuccessBanner(""), 4000);
      loadData();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setErrorBanner(detail || "Failed to create work update.");
    } finally {
      setSubmitting(false);
    }
  };

  // Edit handler
  const handleOpenEdit = (up) => {
    const isOwner = user?.user_id === up.user_id;
    const isAdmin = role === "Admin";
    if (!isOwner && !isAdmin) {
      setErrorBanner("Access Denied: You do not have permission to edit another worker's update.");
      setTimeout(() => setErrorBanner(""), 5000);
      return;
    }

    setEditingUpdate(up);
    setEditStatus(up.work_status);
    setEditDesc(up.description || "");
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingUpdate) return;
    setSavingEdit(true);
    setErrorBanner("");

    try {
      await api.put(`/work-updates/${editingUpdate.update_id}`, {
        work_status: editStatus,
        description: editDesc.trim(),
      });
      setEditingUpdate(null);
      setSuccessBanner("Work update modified successfully.");
      setTimeout(() => setSuccessBanner(""), 4000);
      loadData();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setErrorBanner(detail || "Failed to edit work update. Ownership verification failed.");
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete handler
  const handleDelete = async (up) => {
    const isOwner = user?.user_id === up.user_id;
    const isAdmin = role === "Admin";
    if (!isOwner && !isAdmin) {
      setErrorBanner("Access Denied: You cannot delete another worker's update.");
      setTimeout(() => setErrorBanner(""), 5000);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete update for ${up.task_id}?`)) {
      return;
    }

    try {
      await api.delete(`/work-updates/${up.update_id}`);
      setSuccessBanner("Work update removed.");
      setTimeout(() => setSuccessBanner(""), 4000);
      loadData();
    } catch (err) {
      setErrorBanner(err.response?.data?.detail || "Failed to delete record.");
    }
  };

  // Filter updates
  const filteredUpdates = updates.filter((u) => {
    const matchesStatus = statusFilter === "All" || u.work_status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      u.task_id?.toLowerCase().includes(q) ||
      u.task_title?.toLowerCase().includes(q) ||
      u.user_name?.toLowerCase().includes(q) ||
      u.description?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <AppLayout
      title="Work Status Updates"
      subtitle="Operational progress reporting, milestone verification, and shift logs"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Banner messages */}
        <AnimatePresence>
          {errorBanner && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{
                background: "#fef2f2",
                border: "1.5px solid #fecaca",
                color: "#dc2626",
                padding: "0.875rem 1.25rem",
                borderRadius: "0.875rem",
                fontSize: "0.875rem",
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                fontWeight: 500,
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>{errorBanner}</span>
            </motion.div>
          )}

          {successBanner && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{
                background: "#f0fdf4",
                border: "1.5px solid #bbf7d0",
                color: "#16a34a",
                padding: "0.875rem 1.25rem",
                borderRadius: "0.875rem",
                fontSize: "0.875rem",
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                fontWeight: 500,
              }}
            >
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <span>{successBanner}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Header Card */}
        <div
          style={{
            background: "white",
            borderRadius: "1.25rem",
            padding: "1.25rem 1.5rem",
            border: "1.5px solid rgba(15,23,42,0.07)",
            boxShadow: "0 4px 16px rgba(15,23,42,0.02)",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          {/* Search and filter controls */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem", flex: 1 }}>
            <div style={{ position: "relative", minWidth: "240px", flex: 1, maxWidth: "360px" }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: "0.875rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                  pointerEvents: "none",
                }}
              />
              <input
                type="text"
                placeholder="Search by task, title, worker or notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.625rem 1rem 0.625rem 2.5rem",
                  borderRadius: "0.75rem",
                  border: "1.5px solid rgba(15,23,42,0.1)",
                  fontSize: "0.875rem",
                  color: "#0f172a",
                  outline: "none",
                }}
              />
            </div>

            {/* Status pills */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap" }}>
              {["All", ...Object.keys(STATUS_CONFIG)].map((status) => {
                const isSel = statusFilter === status;
                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    style={{
                      padding: "0.4rem 0.75rem",
                      borderRadius: "0.625rem",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: isSel ? "1.5px solid #6366f1" : "1.5px solid rgba(15,23,42,0.08)",
                      background: isSel ? "#f5f3ff" : "#ffffff",
                      color: isSel ? "#4f46e5" : "#64748b",
                      transition: "all 0.15s",
                    }}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={loadData}
              style={{
                padding: "0.625rem 0.875rem",
                borderRadius: "0.75rem",
                border: "1.5px solid rgba(15,23,42,0.1)",
                background: "white",
                color: "#64748b",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              <RefreshCw size={14} /> Refresh
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: "0.625rem 1.25rem",
                borderRadius: "0.75rem",
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                color: "white",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                boxShadow: "0 4px 12px rgba(99,102,241,0.25)",
              }}
            >
              <Plus size={16} /> New Work Update
            </button>
          </div>
        </div>

        {/* Updates Table */}
        <div
          style={{
            background: "white",
            borderRadius: "1.25rem",
            padding: "1.5rem",
            border: "1.5px solid rgba(15,23,42,0.07)",
            boxShadow: "0 4px 16px rgba(15,23,42,0.02)",
          }}
        >
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 0.75rem" }} />
              Loading work updates...
            </div>
          ) : filteredUpdates.length === 0 ? (
            <div style={{ padding: "3.5rem 1rem", textAlign: "center", color: "#94a3b8" }}>
              <ClipboardList size={36} style={{ margin: "0 auto 0.75rem", opacity: 0.5 }} />
              <p style={{ fontSize: "1rem", fontWeight: 600, color: "#64748b", margin: 0 }}>
                No work updates found
              </p>
              <p style={{ fontSize: "0.8125rem", margin: "0.25rem 0 0" }}>
                Click "New Work Update" to record your first operational status.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1.5px solid #f1f5f9", textAlign: "left", color: "#64748b" }}>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>Task</th>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>Worker / Reporter</th>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>Status</th>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>Description & Details</th>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>Updated At</th>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 600, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUpdates.map((up) => {
                    const isOwner = user?.user_id === up.user_id;
                    const isAdmin = role === "Admin";
                    const canEdit = isOwner || isAdmin;
                    const conf = STATUS_CONFIG[up.work_status] || STATUS_CONFIG["In Progress"];
                    const dateFormatted = up.updated_at
                      ? new Date(up.updated_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Recently";

                    return (
                      <tr
                        key={up.update_id}
                        style={{ borderBottom: "1px solid #f8fafc", transition: "background 0.1s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "0.875rem 1rem" }}>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>{up.task_id}</div>
                          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{up.task_title}</div>
                        </td>

                        <td style={{ padding: "0.875rem 1rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div
                              style={{
                                width: "24px",
                                height: "24px",
                                borderRadius: "50%",
                                background: isOwner ? "#eff6ff" : "#f1f5f9",
                                color: isOwner ? "#3b82f6" : "#64748b",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                              }}
                            >
                              <User size={12} />
                            </div>
                            <div>
                              <span style={{ fontWeight: 600, color: "#1e293b" }}>
                                {up.user_name || "Unknown"}
                              </span>
                              {isOwner && (
                                <span
                                  style={{
                                    marginLeft: "0.375rem",
                                    fontSize: "0.6875rem",
                                    background: "#eff6ff",
                                    color: "#3b82f6",
                                    padding: "0.1rem 0.35rem",
                                    borderRadius: "0.25rem",
                                    fontWeight: 600,
                                  }}
                                >
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: "0.875rem 1rem" }}>
                          <span
                            style={{
                              padding: "0.25rem 0.625rem",
                              borderRadius: "9999px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              background: conf.bg,
                              color: conf.color,
                              border: `1px solid ${conf.border}`,
                            }}
                          >
                            {up.work_status}
                          </span>
                        </td>

                        <td style={{ padding: "0.875rem 1rem", color: "#475569", maxWidth: "320px" }}>
                          {up.description || "—"}
                        </td>

                        <td style={{ padding: "0.875rem 1rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                          {dateFormatted}
                        </td>

                        <td style={{ padding: "0.875rem 1rem", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "0.375rem" }}>
                            <button
                              onClick={() => handleOpenEdit(up)}
                              disabled={!canEdit}
                              title={canEdit ? "Edit work update" : "Only author or Admin can edit this update"}
                              style={{
                                padding: "0.35rem 0.65rem",
                                borderRadius: "0.5rem",
                                border: "1px solid rgba(15,23,42,0.1)",
                                background: canEdit ? "white" : "#f1f5f9",
                                color: canEdit ? "#475569" : "#94a3b8",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor: canEdit ? "pointer" : "not-allowed",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                              }}
                            >
                              {canEdit ? <Edit2 size={12} /> : <Lock size={12} />}
                              Edit
                            </button>

                            {canEdit && (
                              <button
                                onClick={() => handleDelete(up)}
                                title="Delete update"
                                style={{
                                  padding: "0.35rem 0.5rem",
                                  borderRadius: "0.5rem",
                                  border: "1px solid #fee2e2",
                                  background: "white",
                                  color: "#ef4444",
                                  fontSize: "0.75rem",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 50,
                background: "rgba(15,23,42,0.4)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "1rem",
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={{
                  background: "white",
                  borderRadius: "1.25rem",
                  padding: "1.75rem",
                  maxWidth: "480px",
                  width: "100%",
                  boxShadow: "0 20px 60px rgba(15,23,42,0.15)",
                }}
              >
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem", color: "#0f172a" }}>
                  Record Work Status Update
                </h3>
                <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "0 0 1.25rem" }}>
                  Select an existing operational task or define a custom milestone.
                </p>

                <form onSubmit={handleCreateSubmit}>
                  <div style={{ marginBottom: "1rem" }}>
                    <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.375rem" }}>
                      Task Selection
                    </label>
                    <select
                      value={selectedTask}
                      onChange={(e) => setSelectedTask(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        borderRadius: "0.75rem",
                        border: "1.5px solid rgba(15,23,42,0.12)",
                        fontSize: "0.875rem",
                        background: "white",
                      }}
                    >
                      {tasks.map((t) => (
                        <option key={t.task_id} value={t.task_id}>
                          [{t.task_id}] {t.title}
                        </option>
                      ))}
                      <option value="custom">+ Enter Custom Task ID</option>
                    </select>
                  </div>

                  {selectedTask === "custom" && (
                    <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                          Custom Task ID
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. TSK-SPECIAL"
                          value={customTaskId}
                          onChange={(e) => setCustomTaskId(e.target.value)}
                          required
                          style={{
                            width: "100%",
                            padding: "0.625rem",
                            borderRadius: "0.6rem",
                            border: "1.5px solid rgba(15,23,42,0.12)",
                            fontSize: "0.875rem",
                          }}
                        />
                      </div>
                      <div style={{ flex: 2 }}>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                          Custom Task Title
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Emergency Bay Clearance"
                          value={customTaskTitle}
                          onChange={(e) => setCustomTaskTitle(e.target.value)}
                          required
                          style={{
                            width: "100%",
                            padding: "0.625rem",
                            borderRadius: "0.6rem",
                            border: "1.5px solid rgba(15,23,42,0.12)",
                            fontSize: "0.875rem",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ marginBottom: "1rem" }}>
                    <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.375rem" }}>
                      Status
                    </label>
                    <select
                      value={createStatus}
                      onChange={(e) => setCreateStatus(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        borderRadius: "0.75rem",
                        border: "1.5px solid rgba(15,23,42,0.12)",
                        fontSize: "0.875rem",
                        background: "white",
                      }}
                    >
                      {Object.keys(STATUS_CONFIG).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: "1.25rem" }}>
                    <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.375rem" }}>
                      Progress Description & Notes
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Detail current status, blockers or completion notes..."
                      value={createDesc}
                      onChange={(e) => setCreateDesc(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        borderRadius: "0.75rem",
                        border: "1.5px solid rgba(15,23,42,0.12)",
                        fontSize: "0.875rem",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      style={{
                        padding: "0.625rem 1.25rem",
                        borderRadius: "0.75rem",
                        border: "1.5px solid rgba(15,23,42,0.1)",
                        background: "transparent",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      style={{
                        padding: "0.625rem 1.25rem",
                        borderRadius: "0.75rem",
                        background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                        color: "white",
                        border: "none",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        cursor: "pointer",
                      }}
                    >
                      {submitting ? "Submitting…" : "Record Update"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Edit Modal */}
        <AnimatePresence>
          {editingUpdate && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 50,
                background: "rgba(15,23,42,0.4)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "1rem",
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={{
                  background: "white",
                  borderRadius: "1.25rem",
                  padding: "1.75rem",
                  maxWidth: "460px",
                  width: "100%",
                  boxShadow: "0 20px 60px rgba(15,23,42,0.15)",
                }}
              >
                <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0 0 0.5rem", color: "#0f172a" }}>
                  Edit Work Update ({editingUpdate.task_id})
                </h3>
                <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "0 0 1.25rem" }}>
                  Modify the work status or add further operational notes.
                </p>

                <form onSubmit={handleSaveEdit}>
                  <div style={{ marginBottom: "1rem" }}>
                    <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.375rem" }}>
                      Work Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        borderRadius: "0.75rem",
                        border: "1.5px solid rgba(15,23,42,0.12)",
                        fontSize: "0.875rem",
                        background: "white",
                      }}
                    >
                      {Object.keys(STATUS_CONFIG).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: "1.25rem" }}>
                    <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.375rem" }}>
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        borderRadius: "0.75rem",
                        border: "1.5px solid rgba(15,23,42,0.12)",
                        fontSize: "0.875rem",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => setEditingUpdate(null)}
                      style={{
                        padding: "0.625rem 1.25rem",
                        borderRadius: "0.75rem",
                        border: "1.5px solid rgba(15,23,42,0.1)",
                        background: "transparent",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingEdit}
                      style={{
                        padding: "0.625rem 1.25rem",
                        borderRadius: "0.75rem",
                        background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                        color: "white",
                        border: "none",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        cursor: "pointer",
                      }}
                    >
                      {savingEdit ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}

