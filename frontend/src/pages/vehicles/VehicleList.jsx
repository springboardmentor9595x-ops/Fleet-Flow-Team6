import { useState } from "react";
import { deleteVehicle } from "../../api/vehicleApi";
import "../../styles/vehicle.css";
import { useAuth } from "../../context/AuthContext";
export default function VehicleList({
  vehicles,
  loadVehicles,
  onEdit,
}) {
    
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this vehicle?"
    );

    if (!confirmDelete) return;

    try {
      await deleteVehicle(id);
      alert("Vehicle deleted successfully");
      loadVehicles();
    } catch (error) {
      console.error(error);
      alert("Delete failed");
    }
  };

  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesSearch =
      vehicle.registration_number
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      vehicle.brand
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      vehicle.model
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "All" ||
      vehicle.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="vehicle-table">
      <h2>Fleet Vehicles</h2>

      <div
        style={{
          display: "flex",
          gap: "15px",
          marginBottom: "20px",
        }}
      >
        <input
          type="text"
          placeholder="Search by Registration, Brand or Model"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "6px",
            border: "1px solid #ccc",
          }}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: "10px",
            borderRadius: "6px",
          }}
        >
          <option value="All">All Status</option>
          <option value="Available">Available</option>
          <option value="Assigned">Assigned</option>
          <option value="Maintenance">Maintenance</option>
          <option value="In Transit">In Transit</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>Registration</th>
            <th>Type</th>
            <th>Brand</th>
            <th>Model</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {filteredVehicles.length > 0 ? (
            filteredVehicles.map((vehicle) => (
              <tr key={vehicle.vehicle_id}>
                <td>{vehicle.registration_number}</td>
                <td>{vehicle.vehicle_type}</td>
                <td>{vehicle.brand}</td>
                <td>{vehicle.model}</td>

                <td>
                  <span
                    className={`status ${vehicle.status
                      .toLowerCase()
                      .replace(/\s/g, "-")}`}
                  >
                    {vehicle.status}
                  </span>
                </td>

                <td>
  {(user?.role === "Admin" ||
    user?.role === "FleetManager") ? (
    <>
      <button
        className="edit-btn"
        onClick={() => onEdit && onEdit(vehicle)}
      >
        Edit
      </button>

      <button
        className="delete-btn"
        onClick={() =>
          handleDelete(vehicle.vehicle_id)
        }
      >
        Delete
      </button>
    </>
  ) : (
    <span style={{ color: "#666" }}>
      Read Only
    </span>
  )}
</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" style={{ textAlign: "center" }}>
                No vehicles found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}