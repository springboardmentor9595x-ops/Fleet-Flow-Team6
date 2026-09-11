import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import { addVehicle } from "../api/vehicle";
import { getDrivers } from "../api/driversApi";
import { useAuth } from "../context/AuthContext";

const VEHICLE_TYPES = [
  "Heavy Duty Truck",
  "Medium Duty Truck (Box)",
  "Light Commercial Vehicle (LCV)",
  "Delivery Van",
  "Electric Cargo Van",
  "Refrigerated Truck (Reefer)",
  "Container Carrier",
  "Flatbed Trailer",
  "Tanker Truck",
  "Bus / Minibus",
];

const BRANDS = [
  "Tata Motors",
  "Ashok Leyland",
  "Volvo Trucks",
  "Mahindra Logistics",
  "BharatBenz",
  "Eicher Motors",
  "Scania",
  "Mercedes-Benz",
  "Isuzu",
  "Ford",
  "Freightliner",
  "MAN Trucks",
];

const MODEL_PRESETS = {
  "Tata Motors": [
    "Signa 2825.K",
    "Prima 5530.S",
    "Ace Gold Diesel",
    "Ultra T.7",
    "LPT 1613",
  ],
  "Ashok Leyland": [
    "AVTR 2820",
    "Ecomet 1615",
    "Dost+ Pickup",
    "Captain 2823 Tipper",
    "Boss 1215",
  ],
  "Volvo Trucks": [
    "FH16 750",
    "FM 420 Heavy Duty",
    "FMX 460 Tipper",
    "VNL 860",
  ],
  "Mahindra Logistics": [
    "Blazo X 28",
    "Furio 17 Cargo",
    "Supro Profit Truck",
    "Bolero Maxi Truck",
  ],
  BharatBenz: [
    "2823R Multi-Axle",
    "1923C Construction",
    "3528CM Heavy Tipper",
    "1217C",
  ],
  "Eicher Motors": [
    "Pro 6028",
    "Pro 2049 Light",
    "Pro 3019 Medium",
    "Pro 8035 Tipper",
  ],
  "Mercedes-Benz": [
    "Actros 1845",
    "Atego 1218",
    "Sprinter Cargo Van",
  ],
  Ford: [
    "Transit Custom Van",
    "F-650 Medium Duty",
    "F-750 Super Duty",
  ],
  Scania: [
    "R 580 V8 Hauler",
    "P 360 Construction",
    "G 410 Linehaul",
  ],
};

const FUEL_TYPES = [
  "Diesel",
  "Petrol",
  "Electric",
  "CNG",
  "Hybrid",
  "Hydrogen",
];

const STATUSES = [
  "Available",
  "Assigned",
  "Maintenance",
  "InTransit",
];

const CAPACITY_PRESETS = [1, 2.5, 5, 10, 15, 25, 40];

export default function AddVehicle() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [customBrand, setCustomBrand] = useState(false);
  const [customType, setCustomType] = useState(false);

  const [formData, setFormData] = useState({
    registration_number: "",
    vehicle_type: "Heavy Duty Truck",
    brand: "Tata Motors",
    model: "Signa 2825.K",
    manufacture_year: "2024",
    fuel_type: "Diesel",
    capacity: "15",
    assigned_driver: "",
    status: "Available",
  });

  // --------------------------------------------------
  // ROLE CHECK
  // --------------------------------------------------

  const role = user?.role;

  const isAuthorized =
    role === "Admin" || role === "FleetManager";

  // --------------------------------------------------
  // LOAD DRIVERS
  // --------------------------------------------------

  useEffect(() => {
    getDrivers()
      .then((res) => {
        setDrivers(res || []);
      })
      .catch((err) => {
        console.log("Drivers fetch notice:", err);
      });
  }, []);

  // --------------------------------------------------
  // HANDLE FORM CHANGE
  // --------------------------------------------------

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (
        name === "brand" &&
        MODEL_PRESETS[value] &&
        MODEL_PRESETS[value].length > 0
      ) {
        next.model = MODEL_PRESETS[value][0];
      }

      return next;
    });
  };

  // --------------------------------------------------
  // SUBMIT
  // --------------------------------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Extra frontend security check
    if (!isAuthorized) {
      setError(
        `Permission denied. Vehicle registration requires Admin or FleetManager credentials. Your role is ${role || "Unknown"}.`
      );
      return;
    }

    setError("");
    setLoading(true);

    try {
      await addVehicle({
        registration_number: formData.registration_number,
        vehicle_type: formData.vehicle_type,
        brand: formData.brand,
        model: formData.model,
        manufacture_year: Number(formData.manufacture_year),
        fuel_type: formData.fuel_type,
        capacity: Number(formData.capacity),
        assigned_driver: formData.assigned_driver || null,
        status: formData.status,
      });

      navigate("/vehicles");
    } catch (err) {
      console.error("CREATE VEHICLE ERROR:", err);

      const detail = err?.response?.data?.detail;

      if (Array.isArray(detail)) {
        setError(
          detail.map((item) => item.msg).join(", ")
        );
      } else {
        setError(
          detail || "Failed to create vehicle."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const currentModels =
    MODEL_PRESETS[formData.brand] || [];

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <Layout>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Vehicle Registration</h1>

          <p>
            Register and configure a new vehicle for the fleet
          </p>
        </div>

        <button
          className="btn btn-ghost"
          onClick={() => navigate("/vehicles")}
        >
          ← Back to Vehicles
        </button>
      </div>

      <div
        className="card"
        style={{ maxWidth: 900 }}
      >

        {/* --------------------------------------------- */}
        {/* DRIVER READ-ONLY NOTICE */}
        {/* --------------------------------------------- */}

        {!isAuthorized && (
          <div
            style={{
              background: "rgba(245, 158, 11, 0.15)",
              border:
                "1px solid rgba(245, 158, 11, 0.35)",
              color: "#f59e0b",
              padding: "16px 18px",
              borderRadius: "var(--radius-md)",
              marginBottom: 24,
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              lineHeight: 1.6,
            }}
          >
            <span style={{ fontSize: "1.2rem" }}>
              ⚠️
            </span>

            <div>
              <strong>
                Read-Only Access
              </strong>

              <div>
                Your logged-in role is{" "}
                <strong>
                  {role || "Unknown"}
                </strong>
                .
              </div>

              <div>
                Vehicle registration requires{" "}
                <strong>Admin</strong> or{" "}
                <strong>FleetManager</strong>{" "}
                credentials.
              </div>
            </div>
          </div>
        )}

        {/* --------------------------------------------- */}
        {/* ERROR */}
        {/* --------------------------------------------- */}

        {error && (
          <div
            style={{
              background:
                "rgba(239, 68, 68, 0.15)",
              border:
                "1px solid rgba(239, 68, 68, 0.3)",
              color: "var(--accent-red)",
              padding: "12px 16px",
              borderRadius: "var(--radius-md)",
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          <div className="form-grid">

            {/* REGISTRATION NUMBER */}

            <div className="form-group">
              <label className="form-label">
                Registration Number *
              </label>

              <input
                name="registration_number"
                className="form-control"
                placeholder="e.g. TN05JK7890"
                value={formData.registration_number}
                onChange={handleChange}
                disabled={!isAuthorized}
                required
              />
            </div>

            {/* VEHICLE TYPE */}

            <div className="form-group">

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <label className="form-label">
                  Vehicle Type *
                </label>

                {isAuthorized && (
                  <button
                    type="button"
                    style={{
                      background: "none",
                      border: "none",
                      color:
                        "var(--accent-blue)",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      textDecoration:
                        "underline",
                    }}
                    onClick={() =>
                      setCustomType(
                        !customType
                      )
                    }
                  >
                    {customType
                      ? "Select Preset"
                      : "Custom Type"}
                  </button>
                )}
              </div>

              {customType ? (
                <input
                  name="vehicle_type"
                  className="form-control"
                  value={formData.vehicle_type}
                  onChange={handleChange}
                  disabled={!isAuthorized}
                  required
                />
              ) : (
                <select
                  name="vehicle_type"
                  className="form-control"
                  value={formData.vehicle_type}
                  onChange={handleChange}
                  disabled={!isAuthorized}
                  required
                >
                  {VEHICLE_TYPES.map((type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {type}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* BRAND */}

            <div className="form-group">

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <label className="form-label">
                  Brand / Manufacturer *
                </label>

                {isAuthorized && (
                  <button
                    type="button"
                    style={{
                      background: "none",
                      border: "none",
                      color:
                        "var(--accent-blue)",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      textDecoration:
                        "underline",
                    }}
                    onClick={() =>
                      setCustomBrand(
                        !customBrand
                      )
                    }
                  >
                    {customBrand
                      ? "Select Brand"
                      : "Custom Brand"}
                  </button>
                )}
              </div>

              {customBrand ? (
                <input
                  name="brand"
                  className="form-control"
                  value={formData.brand}
                  onChange={handleChange}
                  disabled={!isAuthorized}
                  required
                />
              ) : (
                <select
                  name="brand"
                  className="form-control"
                  value={formData.brand}
                  onChange={handleChange}
                  disabled={!isAuthorized}
                  required
                >
                  {BRANDS.map((brand) => (
                    <option
                      key={brand}
                      value={brand}
                    >
                      {brand}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* MODEL */}

            <div className="form-group">

              <label className="form-label">
                Vehicle Model
              </label>

              {currentModels.length > 0 &&
              !customBrand ? (
                <select
                  name="model"
                  className="form-control"
                  value={formData.model}
                  onChange={handleChange}
                  disabled={!isAuthorized}
                >
                  {currentModels.map((model) => (
                    <option
                      key={model}
                      value={model}
                    >
                      {model}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name="model"
                  className="form-control"
                  placeholder="e.g. Signa 2825.K"
                  value={formData.model}
                  onChange={handleChange}
                  disabled={!isAuthorized}
                />
              )}
            </div>

            {/* YEAR */}

            <div className="form-group">
              <label className="form-label">
                Manufacture Year *
              </label>

              <select
                name="manufacture_year"
                className="form-control"
                value={formData.manufacture_year}
                onChange={handleChange}
                disabled={!isAuthorized}
                required
              >
                {[
                  2026,
                  2025,
                  2024,
                  2023,
                  2022,
                  2021,
                  2020,
                  2019,
                  2018,
                  2017,
                  2016,
                  2015,
                ].map((year) => (
                  <option
                    key={year}
                    value={year}
                  >
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* FUEL */}

            <div className="form-group">
              <label className="form-label">
                Fuel Type *
              </label>

              <select
                name="fuel_type"
                className="form-control"
                value={formData.fuel_type}
                onChange={handleChange}
                disabled={!isAuthorized}
                required
              >
                {FUEL_TYPES.map((fuel) => (
                  <option
                    key={fuel}
                    value={fuel}
                  >
                    {fuel}
                  </option>
                ))}
              </select>
            </div>

            {/* CAPACITY */}

            <div className="form-group">
              <label className="form-label">
                Capacity (Tonnes) *
              </label>

              <input
                name="capacity"
                type="number"
                step="0.5"
                className="form-control"
                value={formData.capacity}
                onChange={handleChange}
                disabled={!isAuthorized}
                required
              />

              {isAuthorized && (
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    marginTop: 6,
                    flexWrap: "wrap",
                  }}
                >
                  {CAPACITY_PRESETS.map(
                    (capacity) => (
                      <button
                        key={capacity}
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{
                          padding:
                            "2px 6px",
                          fontSize:
                            "0.7rem",
                          borderColor:
                            Number(
                              formData.capacity
                            ) === capacity
                              ? "var(--accent-blue)"
                              : "var(--border)",
                        }}
                        onClick={() =>
                          setFormData({
                            ...formData,
                            capacity:
                              String(
                                capacity
                              ),
                          })
                        }
                      >
                        {capacity} T
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            {/* STATUS */}

            <div className="form-group">
              <label className="form-label">
                Initial Status
              </label>

              <select
                name="status"
                className="form-control"
                value={formData.status}
                onChange={handleChange}
                disabled={!isAuthorized}
              >
                {STATUSES.map((status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status}
                  </option>
                ))}
              </select>
            </div>

            {/* DRIVER */}

            <div className="form-group full-width">
              <label className="form-label">
                Assign Driver (Optional)
              </label>

              <select
                name="assigned_driver"
                className="form-control"
                value={formData.assigned_driver}
                onChange={handleChange}
                disabled={!isAuthorized}
              >
                <option value="">
                  -- No Driver Assigned --
                </option>

                {drivers.map((driver) => (
                  <option
                    key={
                      driver.driver_id ||
                      driver.user_id
                    }
                    value={
                      driver.driver_id ||
                      driver.user_id
                    }
                  >
                    License:{" "}
                    {driver.license_number ||
                      "N/A"}{" "}
                    (
                    {driver.experience_years
                      ? `${driver.experience_years} yrs exp`
                      : "Driver"}
                    )
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* --------------------------------------------- */}
          {/* ACTION BUTTONS */}
          {/* --------------------------------------------- */}

          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 24,
            }}
          >

            {/* ONLY ADMIN / FLEET MANAGER SEE REGISTER */}

            {isAuthorized && (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Creating Vehicle...
                  </>
                ) : (
                  "Register Vehicle"
                )}
              </button>
            )}

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                navigate("/vehicles")
              }
            >
              {isAuthorized
                ? "Cancel"
                : "Back to Vehicles"}
            </button>
          </div>

        </form>
      </div>
    </Layout>
  );
}