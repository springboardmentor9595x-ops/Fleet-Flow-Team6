import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HardHat,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Plus,
  Edit2,
  RefreshCw,
  Calendar,
  Layers,
  ArrowRight,
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

export default function WorkerDashboard() {
  const { user, workerType } = useAuth();

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  // Quick update form
  const [selectedTask, setSelectedTask] = useState("");
  const [workStatus, setWorkStatus] = useState("In Progress");
  const [description, setDescription] = useState("");

  // Edit modal state
  const [editingUpdate, setEditingUpdate] = useState(null);
  const [editStatus, setEditStatus] = useState("In Progress");
  const [editDesc, setEditDesc] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, updatesRes] = await Promise.all([
        api.get("/work-updates/tasks").catch(() => ({ data: [] })),
        api.get("/work-updates").catch(() => ({ data: [] })),
      ]);
      setTasks(tasksRes.data || []);
      setUpdates(updatesRes.data || []);
      if (tasksRes.data && tasksRes.data.length > 0) {
        setSelectedTask(tasksRes.data[0].task_id);
      }
    } catch (err) {
      console.error("Failed to load worker data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateUpdate = async (e) => {
    e.preventDefault();
    if (!selectedTask) return;
    setSubmitting(true);
    setMessage({ text: "", type: "" });

    const currentTaskObj = tasks.find((t) => t.task_id === selectedTask);
    const taskTitle = currentTaskObj ? currentTaskObj.title : selectedTask;

    try {
      await api.post("/work-updates", {
        task_id: selectedTask,
        task_title: taskTitle,
        work_status: workStatus,
        description: description.trim(),
      });
      setMessage({ text: "Work update logged successfully!", type: "success" });
      setDescription("");
      // Refresh list
      const updatesRes = await api.get("/work-updates");
      setUpdates(updatesRes.data || []);
    } catch (err) {
      setMessage({
        text: err.response?.data?.detail || "Failed to submit work update.",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickTaskSelect = (task) => {
    setSelectedTask(task.task_id);
    window.scrollTo({ top: 300, behavior: "smooth" });
  };

  const handleOpenEdit = (update) => {
    setEditingUpdate(update);
    setEditStatus(update.work_status);
    setEditDesc(update.description || "");
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingUpdate) return;
    setUpdating(true);
    try {
      await api.put(`/work-updates/${editingUpdate.update_id}`, {
        work_status: editStatus,
        description: editDesc.trim(),
      });
      setEditingUpdate(null);
      setMessage({ text: "Update saved successfully!", type: "success" });
      const updatesRes = await api.get("/work-updates");
      setUpdates(updatesRes.data || []);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update record.");
    } finally {
      setUpdating(false);
    }
  };

  // Metrics
  const completedCount = updates.filter((u) => u.work_status === "Completed").length;
  const inProgressCount = updates.filter((u) => u.work_status === "In Progress").length;

  return (
    <AppLayout
      title="Worker Operations Station"
      subtitle={`Welcome, ${user?.full_name || "Worker"} — ${workerType || "Operations Team"}`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Worker Shift Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
            borderRadius: "1.25rem",
            padding: "1.5rem 2rem",
            color: "white",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            boxShadow: "0 8px 24px rgba(16,185,129,0.25)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "1rem",
                background: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(6px)",
              }}
            >
              <HardHat size={28} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
                  {user?.full_name}
                </h2>
                <span
                  style={{
                    background: "rgba(255,255,255,0.25)",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  {workerType || "Operations Specialist"}
                </span>
              </div>
              <p style={{ margin: "0.25rem 0 0", opacity: 0.9, fontSize: "0.875rem" }}>
                Active Shift • Station Bay 4 • Shift started today
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "1rem" }}>
            <div
              style={{
                background: "rgba(255,255,255,0.18)",
                borderRadius: "0.875rem",
                padding: "0.625rem 1.25rem",
                textAlign: "center",
              }}
            >
              <span style={{ display: "block", fontSize: "0.75rem", opacity: 0.85 }}>
                Shift Status
              </span>
              <strong style={{ fontSize: "1rem" }}>🟢 On Duty</strong>
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.18)",
                borderRadius: "0.875rem",
                padding: "0.625rem 1.25rem",
                textAlign: "center",
              }}
            >
              <span style={{ display: "block", fontSize: "0.75rem", opacity: 0.85 }}>
                Compliance
              </span>
              <strong style={{ fontSize: "1rem" }}>100% Passed</strong>
            </div>
          </div>
        </motion.div>

        {/* Metric Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
          }}
        >
          <div
            style={{
              background: "white",
              padding: "1.25rem",
              borderRadius: "1rem",
              border: "1.5px solid rgba(15,23,42,0.07)",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "0.75rem",
                background: "#eff6ff",
                color: "#3b82f6",
              }}
            >
              <Layers size={22} />
            </div>
            <div>
              <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>Available Tasks</p>
              <h3 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.15rem 0 0", color: "#0f172a" }}>
                {tasks.length}
              </h3>
            </div>
          </div>

          <div
            style={{
              background: "white",
              padding: "1.25rem",
              borderRadius: "1rem",
              border: "1.5px solid rgba(15,23,42,0.07)",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "0.75rem",
                background: "#fef3c7",
                color: "#d97706",
              }}
            >
              <Clock size={22} />
            </div>
            <div>
              <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>In Progress</p>
              <h3 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.15rem 0 0", color: "#0f172a" }}>
                {inProgressCount}
              </h3>
            </div>
          </div>

          <div
            style={{
              background: "white",
              padding: "1.25rem",
              borderRadius: "1rem",
              border: "1.5px solid rgba(15,23,42,0.07)",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "0.75rem",
                background: "#ecfdf5",
                color: "#10b981",
              }}
            >
              <CheckCircle2 size={22} />
            </div>
            <div>
              <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>Completed Updates</p>
              <h3 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.15rem 0 0", color: "#0f172a" }}>
                {completedCount}
              </h3>
            </div>
          </div>

          <div
            style={{
              background: "white",
              padding: "1.25rem",
              borderRadius: "1rem",
              border: "1.5px solid rgba(15,23,42,0.07)",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "0.75rem",
                background: "#f5f3ff",
                color: "#8b5cf6",
              }}
            >
              <ClipboardList size={22} />
            </div>
            <div>
              <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>Total Logs Logged</p>
              <h3 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0.15rem 0 0", color: "#0f172a" }}>
                {updates.length}
              </h3>
            </div>
          </div>
        </div>

        {/* Main Grid: Submit Form (left) + Available Tasks (right) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {/* Quick Submit Card */}
          <div
            style={{
              background: "white",
              borderRadius: "1.25rem",
              padding: "1.5rem",
              border: "1.5px solid rgba(15,23,42,0.07)",
              boxShadow: "0 4px 16px rgba(15,23,42,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1.25rem" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "0.75rem",
                  background: "#eff6ff",
                  color: "#3b82f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Send size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                  Submit Work Status Update
                </h3>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                  Report real-time task progress to dispatch & operations
                </p>
              </div>
            </div>

            {message.text && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "0.75rem",
                  marginBottom: "1rem",
                  fontSize: "0.875rem",
                  background: message.type === "success" ? "#ecfdf5" : "#fef2f2",
                  color: message.type === "success" ? "#059669" : "#dc2626",
                  border: `1px solid ${message.type === "success" ? "#a7f3d0" : "#fecaca"}`,
                }}
              >
                {message.text}
              </div>
            )}

            <form onSubmit={handleCreateUpdate}>
              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: "0.375rem",
                  }}
                >
                  Select Active Task
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
                    color: "#0f172a",
                    background: "white",
                  }}
                >
                  {tasks.map((t) => (
                    <option key={t.task_id} value={t.task_id}>
                      [{t.task_id}] {t.title} ({t.category})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: "0.375rem",
                  }}
                >
                  Work Status
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {Object.keys(STATUS_CONFIG).map((status) => {
                    const isSel = workStatus === status;
                    const conf = STATUS_CONFIG[status];
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setWorkStatus(status)}
                        style={{
                          padding: "0.4rem 0.8rem",
                          borderRadius: "0.6rem",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          border: `1.5px solid ${isSel ? conf.color : conf.border}`,
                          background: isSel ? conf.color : conf.bg,
                          color: isSel ? "white" : conf.color,
                          transition: "all 0.15s",
                        }}
                      >
                        {status}
                      </button>
                    );
                  })}
                </div>
              </div>

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
                  Description & Operational Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. 14 of 16 pallets securely loaded, inspection checklist completed..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    borderRadius: "0.75rem",
                    border: "1.5px solid rgba(15,23,42,0.12)",
                    fontSize: "0.875rem",
                    color: "#0f172a",
                    resize: "vertical",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: "100%",
                  padding: "0.75rem 1.5rem",
                  borderRadius: "0.75rem",
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  color: "white",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: submitting ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
                }}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Submitting…
                  </>
                ) : (
                  <>
                    <Plus size={16} /> Log Status Update
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Operational Tasks Catalog */}
          <div
            style={{
              background: "white",
              borderRadius: "1.25rem",
              padding: "1.5rem",
              border: "1.5px solid rgba(15,23,42,0.07)",
              boxShadow: "0 4px 16px rgba(15,23,42,0.02)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div>
                <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                  Operational Tasks Catalog
                </h3>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                  Click any task to load it into the status updater
                </p>
              </div>
              <button
                onClick={fetchData}
                style={{
                  padding: "0.4rem 0.75rem",
                  borderRadius: "0.6rem",
                  border: "1px solid rgba(15,23,42,0.1)",
                  background: "#f8fafc",
                  color: "#64748b",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", overflowY: "auto", flex: 1 }}>
              {tasks.map((task) => (
                <div
                  key={task.task_id}
                  onClick={() => handleQuickTaskSelect(task)}
                  style={{
                    padding: "0.875rem 1rem",
                    borderRadius: "0.875rem",
                    border: selectedTask === task.task_id ? "2px solid #10b981" : "1px solid rgba(15,23,42,0.07)",
                    background: selectedTask === task.task_id ? "#f0fdf4" : "#f8fafc",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0f172a" }}>
                        {task.task_id}
                      </span>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          padding: "0.15rem 0.5rem",
                          borderRadius: "0.375rem",
                          background: task.priority === "Urgent" ? "#fee2e2" : "#e0e7ff",
                          color: task.priority === "Urgent" ? "#dc2626" : "#4338ca",
                          fontWeight: 600,
                        }}
                      >
                        {task.priority}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "#334155" }}>
                      {task.title}
                    </p>
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{task.category}</span>
                  </div>

                  <ArrowRight size={16} color={selectedTask === task.task_id ? "#10b981" : "#cbd5e1"} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* My Work Updates Table */}
        <div
          style={{
            background: "white",
            borderRadius: "1.25rem",
            padding: "1.5rem",
            border: "1.5px solid rgba(15,23,42,0.07)",
            boxShadow: "0 4px 16px rgba(15,23,42,0.02)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                My Recent Work Updates
              </h3>
              <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: 0 }}>
                Historical log of task updates submitted by you
              </p>
            </div>
            <span style={{ fontSize: "0.8125rem", color: "#64748b", fontWeight: 600 }}>
              {updates.length} Updates Logged
            </span>
          </div>

          {updates.length === 0 ? (
            <div
              style={{
                padding: "2.5rem 1rem",
                textAlign: "center",
                color: "#94a3b8",
                fontSize: "0.875rem",
              }}
            >
              No updates logged yet. Use the form above to record your first task status.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1.5px solid #f1f5f9", textAlign: "left", color: "#64748b" }}>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>Task ID</th>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>Task Title</th>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>Status</th>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>Notes / Description</th>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>Logged At</th>
                    <th style={{ padding: "0.75rem 1rem", fontWeight: 600, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {updates.map((up) => {
                    const conf = STATUS_CONFIG[up.work_status] || STATUS_CONFIG["In Progress"];
                    const dateStr = up.created_at ? new Date(up.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently";
                    return (
                      <tr
                        key={up.update_id}
                        style={{ borderBottom: "1px solid #f8fafc", transition: "background 0.1s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "0.875rem 1rem", fontWeight: 700, color: "#0f172a" }}>
                          {up.task_id}
                        </td>
                        <td style={{ padding: "0.875rem 1rem", color: "#334155", fontWeight: 500 }}>
                          {up.task_title || up.task_id}
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
                        <td style={{ padding: "0.875rem 1rem", color: "#64748b", maxWidth: "260px" }}>
                          {up.description || "—"}
                        </td>
                        <td style={{ padding: "0.875rem 1rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                          {dateStr}
                        </td>
                        <td style={{ padding: "0.875rem 1rem", textAlign: "right" }}>
                          <button
                            onClick={() => handleOpenEdit(up)}
                            style={{
                              padding: "0.35rem 0.65rem",
                              borderRadius: "0.5rem",
                              border: "1px solid rgba(15,23,42,0.1)",
                              background: "white",
                              color: "#475569",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.25rem",
                            }}
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
                      disabled={updating}
                      style={{
                        padding: "0.625rem 1.25rem",
                        borderRadius: "0.75rem",
                        background: "#10b981",
                        color: "white",
                        border: "none",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        cursor: "pointer",
                      }}
                    >
                      {updating ? "Saving…" : "Save Changes"}
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

