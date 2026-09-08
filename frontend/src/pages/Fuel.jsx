import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fuel as FuelIcon, Plus, Trash2, TrendingUp, DollarSign, Gauge,
  Search, AlertCircle, Calendar
} from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const COLORS = ["#6366f1", "#3b82f6", "#06b6d4", "#059669", "#d97706", "#f43f5e"];

export default function FuelPage() {
  const { user } = useAuth();
  const role = user?.role || "";

  const [records, setRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [efficiency, setEfficiency] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const [formData, setFormData] = useState({
    vehicle_id: "",
    fuel_amount: "",
    fuel_cost: "",
    mileage: "",
    refill_date: today,
    notes: "",
  });

  const canManage = ["Admin", "FleetManager", "Driver"].includes(role);
  const canViewAll = ["Admin", "FleetManager"].includes(role);

  const fetchData = async () => {
    try {
      setLoading(true);
      const requests = [
        api.get("/fleet/fuel"),
        api.get("/fleet/vehicles"),
      ];
      if (canViewAll) {
        requests.push(api.get("/fleet/fuel/efficiency"));
      }
      const results = await Promise.all(requests);
      setRecords(results[0].data || []);
      setVehicles(results[1].data || []);
      if (canViewAll && results[2]) {
        setEfficiency(results[2].data || []);
      }
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load fuel records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    if (!formData.vehicle_id || !formData.fuel_amount || !formData.fuel_cost) {
      setError("Vehicle, fuel amount, and fuel cost are required.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/fleet/fuel", {
        ...formData,
        fuel_amount: parseFloat(formData.fuel_amount),
        fuel_cost: parseFloat(formData.fuel_cost),
        mileage: formData.mileage ? parseFloat(formData.mileage) : null,
      });
      setShowModal(false);
      setFormData({ vehicle_id: "", fuel_amount: "", fuel_cost: "", mileage: "", refill_date: today, notes: "" });
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save fuel record.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (fuelId) => {
    if (!window.confirm("Delete this fuel record?")) return;
    try {
      await api.delete(`/fleet/fuel/${fuelId}`);
      await fetchData();
    } catch {
      setError("Failed to delete fuel record.");
    }
  };

  const filtered = records.filter(r =>
    (r.vehicle_reg || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.notes || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Summary totals
  const totalLiters = records.reduce((s, r) => s + (r.fuel_amount || 0), 0);
  const totalCost = records.reduce((s, r) => s + (r.fuel_cost || 0), 0);
  const avgEfficiency = efficiency.length
    ? (efficiency.filter(e => e.efficiency_kmpl).reduce((s, e) => s + e.efficiency_kmpl, 0) / efficiency.filter(e => e.efficiency_kmpl).length).toFixed(1)
    : null;

  return (
    <AppLayout title="Fuel Monitoring" subtitle="Track fuel consumption, costs, and fleet efficiency">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          {[
            { label: "Total Fuel Consumed", val: `${totalLiters.toFixed(1)} L`, icon: FuelIcon, color: "#6366f1" },
            { label: "Total Fuel Cost", val: `₹${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign, color: "#059669" },
            { label: "Avg Fleet Efficiency", val: avgEfficiency ? `${avgEfficiency} km/L` : "N/A", icon: Gauge, color: "#d97706" },
            { label: "Total Refill Records", val: records.length, icon: TrendingUp, color: "#3b82f6" },
          ].map(({ label, val, icon: Icon, color }) => (
            <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="ff-stat-card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>{label}</span>
                <Icon size={16} color={color} />
              </div>
              <h3 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a" }}>{val}</h3>
            </motion.div>
          ))}
        </div>

        {/* Efficiency chart (Admin/FleetManager only) */}
        {canViewAll && efficiency.length > 0 && (
          <div className="ff-card" style={{ padding: "1.5rem" }}>
            <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.25rem" }}>Fuel Efficiency by Vehicle</h4>
            <p style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "1rem" }}>Kilometres per litre — higher is more efficient</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {efficiency.filter(e => e.efficiency_kmpl).map((e, i) => {
                const maxEff = Math.max(...efficiency.filter(x => x.efficiency_kmpl).map(x => x.efficiency_kmpl), 1);
                const pct = (e.efficiency_kmpl / maxEff) * 100;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#475569", minWidth: "70px" }}>{e.vehicle_reg}</span>
                    <div style={{ flex: 1, height: "10px", background: "#f1f5f9", borderRadius: "9999px", overflow: "hidden" }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, delay: i * 0.07 }}
                        style={{ height: "100%", background: COLORS[i % COLORS.length], borderRadius: "9999px" }} />
                    </div>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0f172a", minWidth: "64px", textAlign: "right" }}>{e.efficiency_kmpl} km/L</span>
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8", minWidth: "48px", textAlign: "right" }}>{e.total_liters} L</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Fuel Records Table */}
        <div className="ff-card" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>Fuel Records</h3>
              <p style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.125rem" }}>
                {filtered.length} record{filtered.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input
                  placeholder="Search vehicle / notes..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: "2.25rem", paddingRight: "0.875rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", border: "1.5px solid rgba(15,23,42,0.08)", borderRadius: "0.75rem", fontSize: "0.875rem", outline: "none", background: "#f8fafc", color: "#0f172a", width: "200px" }}
                />
              </div>
              {canManage && (
                <button
                  onClick={() => setShowModal(true)}
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white", border: "none", borderRadius: "0.75rem", padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}
                >
                  <Plus size={15} /> Log Refill
                </button>
              )}
            </div>
          </div>

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.875rem 1rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.75rem", marginBottom: "1rem", color: "#dc2626", fontSize: "0.875rem" }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "3rem", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
              <div className="ff-pulse-dot" style={{ width: "28px", height: "28px", background: "#6366f1" }} />
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>Loading fuel records...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
              <FuelIcon size={40} style={{ margin: "0 auto 0.75rem", opacity: 0.4 }} />
              <p style={{ fontWeight: 600 }}>No fuel records found</p>
              <p style={{ fontSize: "0.8125rem", marginTop: "0.375rem" }}>
                {canManage ? 'Click "Log Refill" to add the first record.' : "No records available."}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr>
                    {["Vehicle", "Date", "Fuel (L)", "Cost (₹)", "Mileage (km)", "Efficiency", "Notes", ...(canManage ? [""] : [])].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "0.5rem 0.75rem", color: "#94a3b8", fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.05em", textTransform: "uppercase", borderBottom: "1.5px solid #f1f5f9", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <motion.tr key={r.fuel_id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                      style={{ borderBottom: "1px solid #f8fafc" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "0.75rem", fontWeight: 600, color: "#6366f1" }}>{r.vehicle_reg}</td>
                      <td style={{ padding: "0.75rem", color: "#475569", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                          <Calendar size={13} color="#94a3b8" />
                          {r.refill_date || (r.recorded_at ? new Date(r.recorded_at).toLocaleDateString() : "—")}
                        </div>
                      </td>
                      <td style={{ padding: "0.75rem", color: "#0f172a", fontWeight: 600 }}>{r.fuel_amount?.toFixed(1)}</td>
                      <td style={{ padding: "0.75rem", color: "#059669", fontWeight: 600 }}>₹{r.fuel_cost?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td style={{ padding: "0.75rem", color: "#475569" }}>{r.mileage ? `${r.mileage} km` : "—"}</td>
                      <td style={{ padding: "0.75rem" }}>
                        {r.efficiency_kmpl ? (
                          <span style={{ padding: "0.2rem 0.6rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 600, background: r.efficiency_kmpl >= 10 ? "#ecfdf5" : "#fffbeb", color: r.efficiency_kmpl >= 10 ? "#059669" : "#d97706", border: `1px solid ${r.efficiency_kmpl >= 10 ? "#a7f3d0" : "#fde68a"}` }}>
                            {r.efficiency_kmpl} km/L
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "0.75rem", color: "#94a3b8", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.notes || "—"}</td>
                      {canManage && (
                        <td style={{ padding: "0.75rem" }}>
                          <button onClick={() => handleDelete(r.fuel_id)}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: "0.375rem", borderRadius: "0.5rem", display: "flex", alignItems: "center", color: "#94a3b8", transition: "color 0.15s, background 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "#fef2f2"; }}
                            onMouseLeave={e => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.background = "none"; }}>
                            <Trash2 size={15} />
                          </button>
                        </td>
                      )}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Fuel Record Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ background: "white", borderRadius: "1.25rem", padding: "2rem", width: "100%", maxWidth: "480px", boxShadow: "0 25px 50px rgba(15,23,42,0.25)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "0.75rem", background: "linear-gradient(135deg, #6366f1, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FuelIcon size={18} color="white" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>Log Fuel Refill</h3>
                    <p style={{ fontSize: "0.75rem", color: "#64748b" }}>Record a new fuel refill entry</p>
                  </div>
                </div>
                <button onClick={() => setShowModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "1.5rem", lineHeight: 1, padding: "0.25rem" }}>×</button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: "0.375rem" }}>Vehicle *</label>
                  <select name="vehicle_id" value={formData.vehicle_id} onChange={handleChange} required
                    style={{ width: "100%", padding: "0.625rem 0.875rem", border: "1.5px solid #e2e8f0", borderRadius: "0.75rem", fontSize: "0.875rem", background: "#f8fafc", color: "#0f172a", outline: "none" }}>
                    <option value="">Select vehicle...</option>
                    {vehicles.map(v => (
                      <option key={v.vehicle_id} value={v.vehicle_id}>{v.registration_number} — {v.vehicle_type}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: "0.375rem" }}>Fuel Amount (L) *</label>
                    <input type="number" step="0.1" min="0" name="fuel_amount" value={formData.fuel_amount} onChange={handleChange} required placeholder="e.g. 45.5"
                      style={{ width: "100%", padding: "0.625rem 0.875rem", border: "1.5px solid #e2e8f0", borderRadius: "0.75rem", fontSize: "0.875rem", background: "#f8fafc", color: "#0f172a", outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: "0.375rem" }}>Fuel Cost (₹) *</label>
                    <input type="number" step="0.01" min="0" name="fuel_cost" value={formData.fuel_cost} onChange={handleChange} required placeholder="e.g. 4050"
                      style={{ width: "100%", padding: "0.625rem 0.875rem", border: "1.5px solid #e2e8f0", borderRadius: "0.75rem", fontSize: "0.875rem", background: "#f8fafc", color: "#0f172a", outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: "0.375rem" }}>Mileage Since Last Refill (km)</label>
                    <input type="number" step="0.1" min="0" name="mileage" value={formData.mileage} onChange={handleChange} placeholder="e.g. 480"
                      style={{ width: "100%", padding: "0.625rem 0.875rem", border: "1.5px solid #e2e8f0", borderRadius: "0.75rem", fontSize: "0.875rem", background: "#f8fafc", color: "#0f172a", outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: "0.375rem" }}>Refill Date</label>
                    <input type="date" name="refill_date" value={formData.refill_date} onChange={handleChange}
                      style={{ width: "100%", padding: "0.625rem 0.875rem", border: "1.5px solid #e2e8f0", borderRadius: "0.75rem", fontSize: "0.875rem", background: "#f8fafc", color: "#0f172a", outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: "0.375rem" }}>Notes</label>
                  <input type="text" name="notes" value={formData.notes} onChange={handleChange} placeholder="Optional — e.g. highway fill, station name"
                    style={{ width: "100%", padding: "0.625rem 0.875rem", border: "1.5px solid #e2e8f0", borderRadius: "0.75rem", fontSize: "0.875rem", background: "#f8fafc", color: "#0f172a", outline: "none", boxSizing: "border-box" }} />
                </div>

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <button type="button" onClick={() => setShowModal(false)}
                    style={{ flex: 1, padding: "0.75rem", border: "1.5px solid #e2e8f0", borderRadius: "0.875rem", background: "transparent", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", color: "#64748b" }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    style={{ flex: 2, padding: "0.75rem", border: "none", borderRadius: "0.875rem", background: saving ? "#a5b4fc" : "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
                    {saving ? "Saving..." : "Log Fuel Record"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
