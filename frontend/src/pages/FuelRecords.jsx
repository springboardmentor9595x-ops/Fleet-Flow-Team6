import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Fuel, TrendingUp, DollarSign, Zap, AlertCircle } from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import FuelPanel from "../components/FuelPanel";

export default function FuelRecords() {
  const { user } = useAuth();
  const [fuelLogs, setFuelLogs] = useState([]);
  const [efficiency, setEfficiency] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [logsRes, effRes] = await Promise.all([
          api.get("/fuel"),
          api.get("/fuel/efficiency").catch(() => ({ data: [] }))
        ]);

        setFuelLogs(Array.isArray(logsRes.data) ? logsRes.data : []);
        setEfficiency(Array.isArray(effRes.data) ? effRes.data : []);
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Failed to load fuel monitoring analytics.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalFuelCost = fuelLogs.reduce((acc, curr) => acc + (curr.cost || 0), 0);
  const totalLiters = fuelLogs.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  return (
    <AppLayout title="Fuel Monitoring & Efficiency Control Center" subtitle="Track fuel refill entries, compute vehicle efficiency (km/L), analyze cost trends, and manage fleet fuel registers.">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem" }}>
          
          <div style={{ background: "white", borderRadius: "1.25rem", border: "1.5px solid rgba(15,23,42,0.06)", padding: "1.25rem", boxShadow: "0 4px 12px rgba(15,23,42,0.02)", display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "0.875rem", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Fuel size={20} color="#2563eb" />
            </div>
            <div>
              <p style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Total Fuel Consumed</p>
              <h4 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a" }}>{totalLiters.toFixed(1)} L</h4>
            </div>
          </div>

          <div style={{ background: "white", borderRadius: "1.25rem", border: "1.5px solid rgba(15,23,42,0.06)", padding: "1.25rem", boxShadow: "0 4px 12px rgba(15,23,42,0.02)", display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "0.875rem", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DollarSign size={20} color="#16a34a" />
            </div>
            <div>
              <p style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Total Fuel Expenditure</p>
              <h4 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a" }}>₹{totalFuelCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h4>
            </div>
          </div>

          <div style={{ background: "white", borderRadius: "1.25rem", border: "1.5px solid rgba(15,23,42,0.06)", padding: "1.25rem", boxShadow: "0 4px 12px rgba(15,23,42,0.02)", display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "0.875rem", background: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={20} color="#7c3aed" />
            </div>
            <div>
              <p style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Avg Fleet Efficiency</p>
              <h4 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a" }}>
                {efficiency.length > 0
                  ? (efficiency.reduce((acc, curr) => acc + curr.fuel_efficiency_kml, 0) / efficiency.length).toFixed(1)
                  : "0.0"} km/L
              </h4>
            </div>
          </div>

        </div>

        {/* Stack Note Disclaimer Banner */}
        <div style={{ background: "#fffbe6", border: "1px solid #ffe58f", borderRadius: "0.875rem", padding: "0.875rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <AlertCircle size={18} color="#d48806" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: "0.8125rem", color: "#873800", margin: 0 }}>
            <strong>Stack Note:</strong> Distance per trip is calculated reliably using OSRM geometry. Comparison against the "Fuel-Efficient Route" mode is presented as an illustrative simulated heuristic.
          </p>
        </div>

        {/* Efficiency Table */}
        {efficiency.length > 0 && (
          <div style={{ background: "white", borderRadius: "1.25rem", border: "1.5px solid rgba(15,23,42,0.06)", padding: "1.25rem", boxShadow: "0 4px 12px rgba(15,23,42,0.01)" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginBottom: "1rem" }}>Vehicle Fuel Efficiency Metrics</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Vehicle Reg", "Type", "Distance (OSRM)", "Fuel Consumed", "Efficiency (km/L)"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "0.625rem 0.875rem", color: "#94a3b8", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {efficiency.map(e => (
                  <tr key={e.vehicle_id} style={{ borderBottom: "1px solid #f8fafc" }}>
                    <td style={{ padding: "0.875rem", fontWeight: 700, color: "#0f172a" }}>{e.registration_number}</td>
                    <td style={{ padding: "0.875rem", color: "#64748b", fontSize: "0.8125rem" }}>{e.vehicle_type}</td>
                    <td style={{ padding: "0.875rem", color: "#475569", fontWeight: 600 }}>{e.total_distance_km} km</td>
                    <td style={{ padding: "0.875rem", color: "#475569", fontWeight: 600 }}>{e.total_fuel_liters} L</td>
                    <td style={{ padding: "0.875rem" }}>
                      <span style={{ background: "#f0fdf4", color: "#16a34a", padding: "0.25rem 0.625rem", borderRadius: "0.5rem", fontWeight: 800, fontSize: "0.8125rem" }}>
                        {e.fuel_efficiency_kml} km/L
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Full Control Fuel Management Console */}
        <FuelPanel />

      </div>
    </AppLayout>
  );
}
