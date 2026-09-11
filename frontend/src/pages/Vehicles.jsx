import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import { getVehicles, deleteVehicle } from "../api/vehicle";

function statusBadge(status) {
  const map = {
    Available: "badge-available",
    Assigned: "badge-assigned",
    Maintenance: "badge-maintenance",
    InTransit: "badge-in-transit",
    "In Transit": "badge-in-transit",
  };
  return `badge ${map[status] || "badge-created"}`;
}

function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`toast toast-${type}`}>
      {msg}
    </div>
  );
}

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const data = await getVehicles();
      setVehicles(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id, reg) => {
    if (!window.confirm(`Delete vehicle ${reg}?`)) return;
    try {
      await deleteVehicle(id);
      setToast({ msg: "Vehicle deleted.", type: "success" });
      load();
    } catch {
      setToast({ msg: "Failed to delete vehicle.", type: "error" });
    }
  };

  const filtered = vehicles.filter((v) => {
    const q = search.toLowerCase();
    const matchSearch =
      v.registration_number?.toLowerCase().includes(q) ||
      v.brand?.toLowerCase().includes(q) ||
      v.model?.toLowerCase().includes(q) ||
      v.vehicle_type?.toLowerCase().includes(q);
    const matchStatus =
      statusFilter === "All" ||
      v.status === statusFilter ||
      (statusFilter === "InTransit" && v.status === "In Transit");
    return matchSearch && matchStatus;
  });

  return (
    <Layout>
      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="page-header">
        <div className="page-header-left">
          <h1>Vehicles</h1>
          <p>Manage and monitor your fleet vehicles</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate("/vehicles/add")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Vehicle
        </button>
      </div>

      <div className="filter-bar">
        <div className="search-box">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search by registration, brand, model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">All Status</option>
          <option value="Available">Available</option>
          <option value="Assigned">Assigned</option>
          <option value="Maintenance">Maintenance</option>
          <option value="InTransit">In Transit</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-screen">
          <div className="spinner" />
          <span>Loading vehicles...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
            <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
          <h3>No vehicles found</h3>
          <p>Try adjusting your search or filter, or add a new vehicle.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Registration</th>
                <th>Type</th>
                <th>Brand / Model</th>
                <th>Year</th>
                <th>Fuel</th>
                <th>Capacity</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.vehicle_id}>
                  <td>
                    <span style={{ fontWeight: 600, color: "var(--accent-blue)", fontFamily: "monospace", letterSpacing: "0.04em" }}>
                      {v.registration_number}
                    </span>
                  </td>
                  <td>{v.vehicle_type}</td>
                  <td>
                    <span style={{ fontWeight: 500 }}>{v.brand}</span>
                    {v.model && (
                      <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>
                        {v.model}
                      </span>
                    )}
                  </td>
                  <td>{v.manufacture_year ?? "—"}</td>
                  <td>{v.fuel_type ?? "—"}</td>
                  <td>{v.capacity ? `${v.capacity} T` : "—"}</td>
                  <td>
                    <span className={statusBadge(v.status)}>{v.status}</span>
                  </td>
                  <td>
                    <div className="action-btns">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/vehicles/add?edit=${v.vehicle_id}`)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(v.vehicle_id, v.registration_number)}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 12, color: "var(--text-muted)", fontSize: "0.8rem" }}>
        Showing {filtered.length} of {vehicles.length} vehicles
      </div>
    </Layout>
  );
}