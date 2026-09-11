import React, { useEffect, useState, useCallback } from "react";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

// ============================================================
// API helpers
// ============================================================
const getFuelRecords = (vehicleId) => {
  const params = vehicleId ? `?vehicle_id=${vehicleId}` : "";
  return api.get(`/fuel/${params}`).then((r) => r.data);
};
const logFuelRecord = (data) => api.post("/fuel/", data).then((r) => r.data);
const getFuelEfficiency = () => api.get("/fuel/analytics/efficiency").then((r) => r.data);
const getFuelTrends = () => api.get("/fuel/analytics/trends").then((r) => r.data);
const getVehicles = () => api.get("/vehicles/").then((r) => r.data);

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const emptyForm = {
  vehicle_id: "",
  fuel_amount: "",
  fuel_cost: "",
  mileage: "",
  refill_date: new Date().toISOString().split("T")[0],
};

// ============================================================
// Simple bar chart component
// ============================================================
function BarChart({ data, labelKey, valueKey, color, unit = "" }) {
  if (!data || data.length === 0) return (
    <div style={{ color: "rgba(255,255,255,0.3)", textAlign: "center", padding: 20 }}>
      No data yet
    </div>
  );
  const max = Math.max(...data.map((d) => d[valueKey] || 0), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map((row, i) => {
        const pct = ((row[valueKey] || 0) / max) * 100;
        return (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.8rem" }}>
                {row[labelKey]}
              </span>
              <span style={{ color, fontWeight: 700, fontSize: "0.82rem" }}>
                {typeof row[valueKey] === "number" ? row[valueKey].toFixed(2) : "—"}{unit}
              </span>
            </div>
            <div style={{ height: 8, background: "rgba(255,255,255,0.07)", borderRadius: 99 }}>
              <div style={{
                height: "100%", width: `${pct}%`,
                background: color, borderRadius: 99,
                transition: "width 0.6s ease",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function FuelRecords() {
  const { user } = useAuth();
  const isDriver = user?.role === "Driver";
  const isManagerOrAdmin = user?.role === "Admin" || user?.role === "FleetManager";

  const [records, setRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [efficiency, setEfficiency] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterVehicle, setFilterVehicle] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("records"); // records | analytics

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    try {
      const [recs, vs] = await Promise.all([
        getFuelRecords(filterVehicle || null),
        getVehicles(),
      ]);
      setRecords(recs);
      setVehicles(vs);

      // Load analytics based on user role
      try {
        if (isDriver) {
          const eff = await getFuelEfficiency();
          setEfficiency(eff || []);
          setTrends([]);
        } else if (isManagerOrAdmin) {
          const [eff, tr] = await Promise.all([getFuelEfficiency(), getFuelTrends()]);
          setEfficiency(eff || []);
          setTrends(tr || []);
        }
      } catch (err) {
        console.warn("Fuel analytics not available:", err);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filterVehicle, isDriver, isManagerOrAdmin]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.vehicle_id || !form.fuel_amount || !form.fuel_cost || !form.refill_date) {
      setFormError("Vehicle, amount, cost and date are required.");
      return;
    }
    setSaving(true);
    try {
      await logFuelRecord({
        vehicle_id: form.vehicle_id,
        fuel_amount: parseFloat(form.fuel_amount),
        fuel_cost: parseFloat(form.fuel_cost),
        mileage: form.mileage ? parseFloat(form.mileage) : null,
        refill_date: form.refill_date,
      });
      showToast("Fuel record logged!");
      setShowModal(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ') : (detail || "Failed to save.");
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const getVehicleLabel = (id) => {
    const v = vehicles.find((x) => x.vehicle_id === id);
    return v ? `${v.registration_number}` : id?.substring(0, 8) + "...";
  };

  const totalFuel = records.reduce((s, r) => s + (parseFloat(r.fuel_amount) || 0), 0);
  const totalCost = records.reduce((s, r) => s + (parseFloat(r.fuel_cost) || 0), 0);
  const avgCostPerLitre = totalFuel > 0 ? totalCost / totalFuel : 0;

  return (
    <Layout>
      <div style={{ padding: "24px 32px", minHeight: "100vh" }}>

        {/* Toast */}
        {toast && (
          <div style={{
            position: "fixed", top: 24, right: 24, zIndex: 9999,
            background: toast.type === "error" ? "#ef4444" : "#10b981",
            color: "#fff", padding: "12px 20px", borderRadius: 10,
            fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          }}>
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 800, color: "#f1f5f9" }}>
              ⛽ Fuel Records
            </h1>
            <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.5)", fontSize: "0.9rem" }}>
              Log refills, track consumption and fuel efficiency
            </p>
          </div>
          <button
            onClick={() => { setShowModal(true); setForm(emptyForm); setFormError(""); }}
            style={{
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#fff", border: "none", borderRadius: 10,
              padding: "12px 22px", fontWeight: 700, fontSize: "0.9rem",
              cursor: "pointer", boxShadow: "0 4px 16px rgba(16,185,129,0.4)",
            }}
          >
            + Log Refill
          </button>
        </div>

        {/* Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
          {[
            { label: "Total Fuel (L)", value: totalFuel.toFixed(1), color: "#10b981" },
            { label: "Total Cost (₹)", value: totalCost.toLocaleString("en-IN", { maximumFractionDigits: 0 }), color: "#f59e0b" },
            { label: "Avg Cost/Litre (₹)", value: avgCostPerLitre.toFixed(2), color: "#6366f1" },
          ].map((card) => (
            <div key={card.label} style={{
              background: "rgba(30,41,59,0.8)",
              border: `1px solid ${card.color}33`,
              borderRadius: 14, padding: "18px 22px",
            }}>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", marginBottom: 6 }}>{card.label}</div>
              <div style={{ color: card.color, fontSize: "2rem", fontWeight: 800 }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          {["records", "analytics"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? "#10b981" : "rgba(30,41,59,0.8)",
                color: activeTab === tab ? "#fff" : "rgba(255,255,255,0.6)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                padding: "9px 20px", cursor: "pointer", fontWeight: 700,
                fontSize: "0.85rem", textTransform: "capitalize",
              }}
            >
              {tab === "records" ? "📋 Records" : "📊 Analytics"}
            </button>
          ))}
          {activeTab === "records" && (
            <select
              value={filterVehicle}
              onChange={(e) => setFilterVehicle(e.target.value)}
              style={{
                background: "rgba(30,41,59,0.8)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, color: "#f1f5f9", padding: "8px 12px", fontSize: "0.82rem",
                marginLeft: "auto",
              }}
            >
              <option value="">All Vehicles</option>
              {vehicles.map((v) => (
                <option key={v.vehicle_id} value={v.vehicle_id}>{v.registration_number}</option>
              ))}
            </select>
          )}
        </div>

        {/* Records Tab */}
        {activeTab === "records" && (
          loading ? (
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: 60 }}>Loading...</div>
          ) : records.length === 0 ? (
            <div style={{
              textAlign: "center", color: "rgba(255,255,255,0.3)", padding: 60,
              background: "rgba(30,41,59,0.4)", borderRadius: 16,
              border: "1px dashed rgba(255,255,255,0.1)",
            }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>⛽</div>
              <div>No fuel records yet. Log a refill to get started.</div>
            </div>
          ) : (
            <div style={{
              background: "rgba(30,41,59,0.85)", borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden",
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    {["Vehicle", "Date", "Amount (L)", "Cost (₹)", "Mileage"].map((h) => (
                      <th key={h} style={{
                        textAlign: "left", padding: "14px 16px",
                        color: "rgba(255,255,255,0.4)", fontWeight: 600, fontSize: "0.78rem",
                        textTransform: "uppercase", letterSpacing: "0.06em",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => (
                    <tr key={rec.fuel_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={tdStyle}>{getVehicleLabel(rec.vehicle_id)}</td>
                      <td style={tdStyle}>{fmtDate(rec.refill_date)}</td>
                      <td style={{ ...tdStyle, color: "#10b981", fontWeight: 700 }}>
                        {parseFloat(rec.fuel_amount || 0).toFixed(1)} L
                      </td>
                      <td style={{ ...tdStyle, color: "#f59e0b", fontWeight: 700 }}>
                        ₹{parseFloat(rec.fuel_cost || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </td>
                      <td style={tdStyle}>
                        {rec.mileage ? `${parseFloat(rec.mileage).toLocaleString()} km` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <div style={{ display: "grid", gridTemplateColumns: isDriver ? "1fr" : "1fr 1fr", gap: 20 }}>

            {/* Efficiency per vehicle */}
            <div style={{
              background: "rgba(30,41,59,0.85)", borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.07)", padding: "20px 24px",
            }}>
              <h3 style={{ margin: "0 0 16px", color: "#f1f5f9", fontWeight: 700, fontSize: "1rem" }}>
                {isDriver ? "🏎️ My Vehicle Fuel Efficiency (km/L)" : "🏎️ Fuel Efficiency (km/L)"}
              </h3>
              <BarChart
                data={efficiency}
                labelKey="vehicle_id"
                valueKey="km_per_litre"
                color="#10b981"
                unit=" km/L"
              />
            </div>

            {/* Monthly trends (Admin & FleetManager only) */}
            {!isDriver && (
              <div style={{
                background: "rgba(30,41,59,0.85)", borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.07)", padding: "20px 24px",
              }}>
                <h3 style={{ margin: "0 0 16px", color: "#f1f5f9", fontWeight: 700, fontSize: "1rem" }}>
                  📅 Monthly Fuel Cost (₹)
                </h3>
                <BarChart
                  data={trends}
                  labelKey="month"
                  valueKey="total_cost"
                  color="#f59e0b"
                  unit=""
                />
              </div>
            )}
          </div>
        )}

        {/* Log Refill Modal */}
        {showModal && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, backdropFilter: "blur(6px)", padding: 24,
          }}>
            <div style={{
              background: "#1e293b", borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.1)",
              padding: "32px", width: "100%", maxWidth: 480,
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
            }}>
              <h2 style={{ margin: "0 0 24px", color: "#f1f5f9", fontWeight: 800 }}>
                ⛽ Log Fuel Refill
              </h2>
              <form onSubmit={handleSave}>
                {formError && (
                  <div style={{
                    background: "rgba(239,68,68,0.15)", color: "#ef4444",
                    border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8,
                    padding: "10px 14px", marginBottom: 16, fontSize: "0.85rem",
                  }}>{formError}</div>
                )}
                <label style={labelStyle}>Vehicle *</label>
                <select
                  value={form.vehicle_id}
                  onChange={(e) => setForm((p) => ({ ...p, vehicle_id: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">Select vehicle...</option>
                  {vehicles.map((v) => (
                    <option key={v.vehicle_id} value={v.vehicle_id}>
                      {v.registration_number} — {v.vehicle_type}
                    </option>
                  ))}
                </select>
                <label style={labelStyle}>Refill Date *</label>
                <input
                  type="date"
                  value={form.refill_date}
                  onChange={(e) => setForm((p) => ({ ...p, refill_date: e.target.value }))}
                  style={inputStyle}
                />
                <label style={labelStyle}>Fuel Amount (Litres) *</label>
                <input
                  type="number" min="0" step="0.1"
                  value={form.fuel_amount}
                  onChange={(e) => setForm((p) => ({ ...p, fuel_amount: e.target.value }))}
                  placeholder="e.g. 45.5"
                  style={inputStyle}
                />
                <label style={labelStyle}>Total Cost (₹) *</label>
                <input
                  type="number" min="0" step="0.01"
                  value={form.fuel_cost}
                  onChange={(e) => setForm((p) => ({ ...p, fuel_cost: e.target.value }))}
                  placeholder="e.g. 3500"
                  style={inputStyle}
                />
                <label style={labelStyle}>Odometer Reading (km, optional)</label>
                <input
                  type="number" min="0"
                  value={form.mileage}
                  onChange={(e) => setForm((p) => ({ ...p, mileage: e.target.value }))}
                  placeholder="e.g. 45230"
                  style={inputStyle}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                  <button
                    type="submit" disabled={saving}
                    style={{
                      flex: 1, background: "linear-gradient(135deg, #10b981, #059669)",
                      color: "#fff", border: "none", borderRadius: 10,
                      padding: "13px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? "Logging..." : "Log Refill"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    style={{
                      flex: 1, background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 10, padding: "13px", fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

const tdStyle = {
  padding: "14px 16px",
  color: "rgba(255,255,255,0.75)",
  fontSize: "0.85rem",
  verticalAlign: "middle",
};
const labelStyle = {
  display: "block",
  color: "rgba(255,255,255,0.6)",
  fontSize: "0.8rem",
  fontWeight: 600,
  marginBottom: 6,
  marginTop: 14,
};
const inputStyle = {
  width: "100%",
  background: "rgba(15,23,42,0.6)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  color: "#f1f5f9",
  padding: "10px 12px",
  fontSize: "0.88rem",
  boxSizing: "border-box",
};
