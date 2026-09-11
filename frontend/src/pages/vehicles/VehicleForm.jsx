import { useState, useEffect } from "react";
import { addVehicle, updateVehicle } from "../../api/vehicleApi";
import "../../styles/vehicle.css";
import { useAuth } from "../../context/AuthContext";

export default function VehicleForm({
  selectedVehicle,
  onSuccess,
  clearSelection,
}) {
    const { user } = useAuth();
  const [vehicle, setVehicle] = useState({
    registration_number: "",
    vehicle_type: "",
    brand: "",
    model: "",
    manufacture_year: "",
    fuel_type: "Diesel",
    capacity: "",
    assigned_driver: null,
    status: "Available",
  });

  useEffect(() => {
    if (selectedVehicle) {
      setVehicle({
        ...selectedVehicle,
      });
    }
  }, [selectedVehicle]);

  const handleChange = (e) => {
    setVehicle({
      ...vehicle,
      [e.target.name]: e.target.value,
    });
  };

  const resetForm = () => {
    setVehicle({
      registration_number: "",
      vehicle_type: "",
      brand: "",
      model: "",
      manufacture_year: "",
      fuel_type: "Diesel",
      capacity: "",
      assigned_driver: null,
      status: "Available",
    });

    if (clearSelection) clearSelection();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = {
      ...vehicle,
      manufacture_year: Number(vehicle.manufacture_year),
      capacity: Number(vehicle.capacity),
    };

    try {
      if (selectedVehicle) {
        await updateVehicle(selectedVehicle.vehicle_id, data);
        alert("Vehicle Updated Successfully!");
      } else {
        await addVehicle(data);
        alert("Vehicle Added Successfully!");
      }

      resetForm();

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error(err);
      alert("Operation Failed");
    }
  };


  if (
  user?.role === "Driver" ||
  user?.role === "Dispatcher"
) {
  return null;
}  

  return (
    <div className="vehicle-form">
      <h2>
        {selectedVehicle ? "Edit Vehicle" : "Add Vehicle"}
      </h2>

      <form onSubmit={handleSubmit}>
        <input
          name="registration_number"
          placeholder="Registration Number"
          value={vehicle.registration_number}
          onChange={handleChange}
          required
        />

        <input
          name="vehicle_type"
          placeholder="Vehicle Type"
          value={vehicle.vehicle_type}
          onChange={handleChange}
          required
        />

        <input
          name="brand"
          placeholder="Brand"
          value={vehicle.brand}
          onChange={handleChange}
          required
        />

        <input
          name="model"
          placeholder="Model"
          value={vehicle.model}
          onChange={handleChange}
          required
        />

        <input
          type="number"
          name="manufacture_year"
          placeholder="Manufacture Year"
          value={vehicle.manufacture_year}
          onChange={handleChange}
          required
        />

        <select
          name="fuel_type"
          value={vehicle.fuel_type}
          onChange={handleChange}
        >
          <option>Diesel</option>
          <option>Petrol</option>
          <option>Electric</option>
          <option>CNG</option>
        </select>

        <input
          type="number"
          name="capacity"
          placeholder="Capacity"
          value={vehicle.capacity}
          onChange={handleChange}
          required
        />

        <button type="submit">
          {selectedVehicle ? "Update Vehicle" : "Add Vehicle"}
        </button>

        {selectedVehicle && (
          <button
            type="button"
            onClick={resetForm}
            style={{
              marginTop: "10px",
              background: "#6b7280",
              color: "#fff",
              padding: "10px",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        )}
      </form>
    </div>
  );
}