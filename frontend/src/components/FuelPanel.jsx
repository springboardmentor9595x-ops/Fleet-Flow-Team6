import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function FuelPanel() {
  const { user } = useAuth();

  const roleUpper = (user?.role?.value || user?.role || '').toUpperCase();
  const isManagerOrAdmin = roleUpper === 'ADMIN' || roleUpper === 'FLEETMANAGER';
  const canManageFuel = roleUpper === 'ADMIN' || roleUpper === 'FLEETMANAGER' || roleUpper === 'DRIVER';

  const [refills, setRefills] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [trends, setTrends] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  const [activeSubTab, setActiveSubTab] = useState('list'); // list, log, edit, trends
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [editingFuelId, setEditingFuelId] = useState(null);

  // Form state
  const [form, setForm] = useState({
    vehicle_id: '',
    fuel_amount: '',
    fuel_cost: '',
    mileage: '',
    refill_date: new Date().toISOString().substring(0, 10)
  });

  const showToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      const refillsRes = await api.get('/fuel');
      setRefills(Array.isArray(refillsRes.data) ? refillsRes.data : []);

      const [vehiclesRes, trendsRes] = await Promise.all([
        api.get('/fleet/vehicles').catch(() => api.get('/vehicles')),
        api.get('/fuel/trends').catch(() => ({ data: null }))
      ]);
      const vData = Array.isArray(vehiclesRes.data) ? vehiclesRes.data : [];
      setVehicles(vData);

      // Auto select driver's assigned vehicle if driver
      if (roleUpper === 'DRIVER' && vData.length > 0 && !form.vehicle_id) {
        setForm(prev => ({ ...prev, vehicle_id: vData[0].vehicle_id }));
      }

      if (trendsRes.data) {
        setTrends(trendsRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch fuel records:', err);
      showToast('❌ ERROR: Could not retrieve fuel registers.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitRefill = async (e) => {
    e.preventDefault();

    if (!canManageFuel) {
      showToast('❌ ACCESS DENIED: Dispatchers cannot log fuel records.', 'error');
      return;
    }

    if (!form.vehicle_id) {
      showToast('❌ VALIDATION: Please select a vehicle.', 'error');
      return;
    }

    try {
      const payload = {
        vehicle_id: form.vehicle_id,
        fuel_amount: parseFloat(form.fuel_amount) || 0,
        fuel_cost: parseFloat(form.fuel_cost) || 0,
        mileage: parseFloat(form.mileage) || 0,
        refill_date: form.refill_date
      };

      if (editingFuelId) {
        const res = await api.put(`/fuel/${editingFuelId}`, payload);
        setRefills(prev => prev.map(r => r.fuel_id === editingFuelId ? res.data : r));
        showToast('⛽ SUCCESS: Fuel refill record updated successfully.', 'success');
        setEditingFuelId(null);
      } else {
        const res = await api.post('/fuel', payload);
        setRefills(prev => [res.data, ...prev]);
        showToast('⛽ SUCCESS: Fuel refill logged successfully.', 'success');
      }
      
      // Reset form
      setForm(prev => ({
        ...prev,
        fuel_amount: '',
        fuel_cost: '',
        mileage: ''
      }));

      // Reload trends
      const trendsRes = await api.get('/fuel/trends').catch(() => null);
      if (trendsRes?.data) setTrends(trendsRes.data);

      setActiveSubTab('list');
    } catch (err) {
      console.error('Failed to save fuel refill:', err);
      const detail = err.response?.data?.detail || 'Could not save fuel refill.';
      showToast(`❌ ERROR: ${detail}`, 'error');
    }
  };

  const handleEditInit = (record) => {
    setEditingFuelId(record.fuel_id);
    setForm({
      vehicle_id: record.vehicle_id,
      fuel_amount: record.fuel_amount || record.amount || '',
      fuel_cost: record.fuel_cost || record.cost || '',
      mileage: record.mileage || '',
      refill_date: record.refill_date || new Date().toISOString().substring(0, 10)
    });
    setActiveSubTab('log');
  };

  const handleDeleteFuel = async (fuelId) => {
    if (!canManageFuel) {
      showToast('❌ ACCESS DENIED: Dispatchers cannot delete fuel records.', 'error');
      return;
    }

    if (!window.confirm("Are you sure you want to delete this fuel record? This action cannot be undone.")) return;

    try {
      await api.delete(`/fuel/${fuelId}`);
      setRefills(prev => prev.filter(r => r.fuel_id !== fuelId));
      showToast('🗑️ SUCCESS: Fuel record deleted cleanly.', 'success');
      
      const trendsRes = await api.get('/fuel/trends').catch(() => null);
      if (trendsRes?.data) setTrends(trendsRes.data);
    } catch (err) {
      console.error("Failed to delete fuel record:", err);
      const detail = err.response?.data?.detail || "Could not delete fuel record.";
      showToast(`❌ ERROR: ${detail}`, 'error');
    }
  };

  // Filter records
  const filteredRefills = selectedVehicleId
    ? refills.filter(r => r.vehicle_id === selectedVehicleId)
    : refills;

  const getVehicleRegNumber = (vehicleId) => {
    const matched = vehicles.find(v => v.vehicle_id === vehicleId);
    return matched ? matched.registration_number : (vehicleId ? `VEH-${vehicleId.substring(0, 6).toUpperCase()}` : 'MOCK-VEH');
  };

  return (
    <div style={{ background: "white", borderRadius: "1.25rem", border: "1.5px solid rgba(15,23,42,0.08)", padding: "1.5rem", boxShadow: "0 2px 8px rgba(15,23,42,0.06)" }}>
      
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div style={{
          marginBottom: "1rem",
          padding: "0.75rem 1rem",
          borderRadius: "0.75rem",
          fontSize: "0.8125rem",
          fontWeight: 600,
          background: toastMessage.type === 'error' ? '#fef2f2' : '#f0fdf4',
          color: toastMessage.type === 'error' ? '#991b1b' : '#166534',
          border: `1px solid ${toastMessage.type === 'error' ? '#fecaca' : '#bbf7d0'}`
        }}>
          {toastMessage.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "1rem", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Fleet Fuel Activity & Logs</h3>
            {!canManageFuel && (
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, background: "#f1f5f9", color: "#64748b", padding: "0.2rem 0.5rem", borderRadius: "0.375rem", border: "1px solid #e2e8f0" }}>
                🔒 Read-Only
              </span>
            )}
          </div>
          <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.25rem 0 0 0" }}>
            {canManageFuel
              ? '// Fuel Management & Refill Register (Editable by Admin, Fleet Manager & Assigned Driver)'
              : '// Fleet Fuel Logs & Cost Overview (Read-Only View for Dispatcher)'}
          </p>
        </div>

        {/* Sub-tab navigation */}
        <div style={{ display: "flex", gap: "0.5rem", background: "#f8fafc", padding: "0.25rem", border: "1px solid #e2e8f0", borderRadius: "0.75rem" }}>
          <button
            type="button"
            onClick={() => { setActiveSubTab('list'); setEditingFuelId(null); }}
            style={{
              padding: "0.375rem 0.875rem",
              borderRadius: "0.5rem",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
              border: "none",
              background: activeSubTab === 'list' ? "#ffffff" : "transparent",
              color: activeSubTab === 'list' ? "#2563eb" : "#64748b",
              boxShadow: activeSubTab === 'list' ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
            }}
          >
            📋 Logs
          </button>
          
          {canManageFuel && (
            <button
              type="button"
              onClick={() => { setActiveSubTab('log'); }}
              style={{
                padding: "0.375rem 0.875rem",
                borderRadius: "0.5rem",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
                border: "none",
                background: activeSubTab === 'log' ? "#ffffff" : "transparent",
                color: activeSubTab === 'log' ? "#2563eb" : "#64748b",
                boxShadow: activeSubTab === 'log' ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
              }}
            >
              {editingFuelId ? '✏️ Edit Refill' : '⛽ Log Refill'}
            </button>
          )}

          <button
            type="button"
            onClick={() => { setActiveSubTab('trends'); setEditingFuelId(null); }}
            style={{
              padding: "0.375rem 0.875rem",
              borderRadius: "0.5rem",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
              border: "none",
              background: activeSubTab === 'trends' ? "#ffffff" : "transparent",
              color: activeSubTab === 'trends' ? "#2563eb" : "#64748b",
              boxShadow: activeSubTab === 'trends' ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
            }}
          >
            📊 Trends
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "3rem 0", color: "#64748b", fontSize: "0.875rem" }}>
          Loading fuel data...
        </div>
      ) : (
        <div>
          
          {/* TAB 1: LIST / LOGS */}
          {activeSubTab === 'list' && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Filter */}
              {vehicles.length > 0 && (
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.75rem", background: "#f8fafc", padding: "0.75rem 1rem", borderRadius: "0.75rem", border: "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Filter Vehicle:</span>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    style={{ padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1.5px solid #cbd5e1", fontSize: "0.8125rem", background: "white", outline: "none" }}
                  >
                    <option value="">[ All Vehicles ]</option>
                    {vehicles.map(v => (
                      <option key={v.vehicle_id} value={v.vehicle_id}>{v.registration_number}</option>
                    ))}
                  </select>
                </div>
              )}

              {filteredRefills.length === 0 ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "#64748b", fontSize: "0.875rem", background: "#f8fafc", borderRadius: "0.875rem", border: "1px dashed #cbd5e1" }}>
                  NO FUEL REFILL LOGS REGISTERED YET.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        <th style={{ padding: "0.75rem 1rem", color: "#94a3b8", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Refill Date</th>
                        <th style={{ padding: "0.75rem 1rem", color: "#94a3b8", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Vehicle</th>
                        <th style={{ padding: "0.75rem 1rem", color: "#94a3b8", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", textAlign: "center" }}>Amount (Liters)</th>
                        <th style={{ padding: "0.75rem 1rem", color: "#94a3b8", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", textAlign: "center" }}>Cost (₹)</th>
                        <th style={{ padding: "0.75rem 1rem", color: "#94a3b8", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", textAlign: "center" }}>Mileage (KM)</th>
                        <th style={{ padding: "0.75rem 1rem", color: "#94a3b8", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", textAlign: "right" }}>Avg Rate</th>
                        {canManageFuel && (
                          <th style={{ padding: "0.75rem 1rem", color: "#94a3b8", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", textAlign: "center" }}>Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRefills.map((r) => {
                        const amount = r.fuel_amount || r.amount || 0;
                        const cost = r.fuel_cost || r.cost || 0;
                        const pricePerL = amount > 0 ? (cost / amount).toFixed(2) : '0.00';
                        return (
                          <tr key={r.fuel_id} style={{ borderBottom: "1px solid #f8fafc" }}>
                            <td style={{ padding: "0.875rem 1rem", fontWeight: 700, color: "#2563eb", fontSize: "0.8125rem" }}>{r.refill_date}</td>
                            <td style={{ padding: "0.875rem 1rem", fontWeight: 700, color: "#0f172a", textTransform: "uppercase", fontSize: "0.8125rem" }}>{r.registration_number || getVehicleRegNumber(r.vehicle_id)}</td>
                            <td style={{ padding: "0.875rem 1rem", textAlign: "center", fontWeight: 600, color: "#475569", fontSize: "0.8125rem" }}>{amount} L</td>
                            <td style={{ padding: "0.875rem 1rem", textAlign: "center", fontWeight: 700, color: "#16a34a", fontSize: "0.8125rem" }}>₹{cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: "0.875rem 1rem", textAlign: "center", color: "#64748b", fontSize: "0.8125rem" }}>{r.mileage || 0} KM</td>
                            <td style={{ padding: "0.875rem 1rem", textAlign: "right", color: "#64748b", fontSize: "0.8125rem" }}>₹{pricePerL}/L</td>
                            {canManageFuel && (
                              <td style={{ padding: "0.875rem 1rem", textAlign: "center", display: "flex", gap: "0.375rem", justifyContent: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => handleEditInit(r)}
                                  style={{ padding: "0.375rem 0.625rem", borderRadius: "0.5rem", border: "1px solid #bfdbfe", background: "#eff6ff", color: "#2563eb", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteFuel(r.fuel_id)}
                                  style={{ padding: "0.375rem 0.625rem", borderRadius: "0.5rem", border: "1px solid #fee2e2", background: "#fef2f2", color: "#ef4444", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
                                >
                                  Delete
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LOG / EDIT REFILL FORM (Admin, FleetManager, Driver) */}
          {activeSubTab === 'log' && canManageFuel && (
            <div style={{ maxWidth: "550px", margin: "0 auto", background: "#f8fafc", border: "1.5px solid #e2e8f0", padding: "1.5rem", borderRadius: "1rem" }}>
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#0f172a", textTransform: "uppercase", borderBottom: "1px solid #cbd5e1", paddingBottom: "0.75rem", marginBottom: "1.25rem" }}>
                {editingFuelId ? '[ Edit Fuel Record ]' : '[ Submit Fuel Record ]'}
              </h3>
              
              <form onSubmit={handleSubmitRefill} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "0.375rem" }}>[ Select Vehicle * ]</label>
                  <select
                    name="vehicle_id"
                    value={form.vehicle_id}
                    onChange={handleFormChange}
                    style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid #cbd5e1", background: "white", outline: "none", fontSize: "0.8125rem" }}
                    required
                  >
                    <option value="">-- Choose Vehicle --</option>
                    {vehicles.map(v => (
                      <option key={v.vehicle_id} value={v.vehicle_id}>{v.registration_number} ({v.vehicle_type})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "0.375rem" }}>[ Fuel Amount (Liters) * ]</label>
                    <input
                      name="fuel_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.fuel_amount}
                      onChange={handleFormChange}
                      placeholder="e.g. 80.5"
                      style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid #cbd5e1", background: "white", outline: "none", fontSize: "0.8125rem" }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "0.375rem" }}>[ Total Refill Cost (₹) * ]</label>
                    <input
                      name="fuel_cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.fuel_cost}
                      onChange={handleFormChange}
                      placeholder="e.g. 1400"
                      style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid #cbd5e1", background: "white", outline: "none", fontSize: "0.8125rem" }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "0.375rem" }}>[ Current Mileage (KM) * ]</label>
                    <input
                      name="mileage"
                      type="number"
                      step="0.1"
                      min="0"
                      value={form.mileage}
                      onChange={handleFormChange}
                      placeholder="e.g. 120500"
                      style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid #cbd5e1", background: "white", outline: "none", fontSize: "0.8125rem" }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "0.375rem" }}>[ Date of Refill ]</label>
                    <input
                      name="refill_date"
                      type="date"
                      value={form.refill_date}
                      onChange={handleFormChange}
                      style={{ width: "100%", padding: "0.625rem", borderRadius: "0.75rem", border: "1.5px solid #cbd5e1", background: "white", outline: "none", fontSize: "0.8125rem" }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                  {editingFuelId && (
                    <button
                      type="button"
                      onClick={() => { setEditingFuelId(null); setActiveSubTab('list'); }}
                      style={{ flex: 1, padding: "0.75rem", borderRadius: "0.75rem", border: "1px solid #cbd5e1", background: "#f1f5f9", color: "#475569", fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!form.vehicle_id}
                    style={{
                      flex: 2,
                      padding: "0.75rem",
                      borderRadius: "0.75rem",
                      border: "none",
                      background: form.vehicle_id ? "linear-gradient(135deg, #2563eb, #1d4ed8)" : "#cbd5e1",
                      color: "white",
                      fontWeight: 700,
                      fontSize: "0.8125rem",
                      cursor: form.vehicle_id ? "pointer" : "not-allowed",
                      boxShadow: form.vehicle_id ? "0 4px 12px rgba(37,99,235,0.2)" : "none"
                    }}
                  >
                    {editingFuelId ? '💾 Save Changes' : '🚀 Log Refill Record'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: TRENDS / ANALYTICS */}
          {activeSubTab === 'trends' && trends && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {/* Metrics Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
                <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1.25rem" }}>
                  <span style={{ fontSize: "0.6875rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>TOTAL FUEL COST</span>
                  <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#16a34a", margin: 0 }}>
                    ₹{(trends.total_cost || 0).toLocaleString('en-IN')}
                  </h3>
                  <span style={{ fontSize: "0.6875rem", color: "#94a3b8", display: "block", marginTop: "0.375rem" }}>// Lifetime Refill Cost</span>
                </div>

                <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1.25rem" }}>
                  <span style={{ fontSize: "0.6875rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>TOTAL VOLUME CONSUMED</span>
                  <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#2563eb", margin: 0 }}>
                    {(trends.total_liters || 0).toLocaleString()} L
                  </h3>
                  <span style={{ fontSize: "0.6875rem", color: "#94a3b8", display: "block", marginTop: "0.375rem" }}>// Lifetime Fuel Liters</span>
                </div>

                <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1.25rem" }}>
                  <span style={{ fontSize: "0.6875rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>AVERAGE FUEL COST RATE</span>
                  <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#d97706", margin: 0 }}>
                    ₹{trends.total_liters > 0 ? (trends.total_cost / trends.total_liters).toFixed(2) : '0.00'} / L
                  </h3>
                  <span style={{ fontSize: "0.6875rem", color: "#94a3b8", display: "block", marginTop: "0.375rem" }}>// Avg cost per liter</span>
                </div>
              </div>

              {/* Monthly breakdown */}
              <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1.25rem" }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 800, color: "#0f172a", textTransform: "uppercase", borderBottom: "1px solid #cbd5e1", paddingBottom: "0.625rem", marginBottom: "1rem" }}>
                  📈 Monthly Cost Distribution
                </h3>
                {!trends.monthly_cost || Object.keys(trends.monthly_cost).length === 0 ? (
                  <div style={{ textAlign: "center", color: "#94a3b8", padding: "1.5rem 0", fontSize: "0.8125rem" }}>No historical monthly data recorded.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                    {Object.entries(trends.monthly_cost).map(([month, cost]) => (
                      <div key={month} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", padding: "0.75rem 1rem", border: "1px solid #e2e8f0", borderRadius: "0.75rem" }}>
                        <span style={{ color: "#475569", fontWeight: 600, fontSize: "0.8125rem" }}>{month}</span>
                        <span style={{ color: "#2563eb", fontWeight: 800, fontSize: "0.8125rem" }}>₹{cost.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
