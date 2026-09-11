
import React, { useEffect, useState } from "react";
import Layout from "../components/layout/Layout";

import {
  getShipments,
  addShipment,
  updateShipment,
  updateShipmentStatus,
  cancelShipment,
} from "../api/shipmentApi";

import { getVehicles } from "../api/vehicle";
import { getDrivers } from "../api/driversApi";
import { useAuth } from "../context/AuthContext";

const STAGES = [
  "Created",
  "Assigned",
  "In Transit",
  "Delivered",
];

function StatusStepper({ currentStatus }) {
  const currentIndex = STAGES.indexOf(currentStatus);
  const isCancelled = currentStatus === "Cancelled";

  if (isCancelled) {
    return (
      <div
        style={{
          color: "var(--accent-red)",
          fontSize: "0.8rem",
          fontWeight: 600,
        }}
      >
        ⚠️ Shipment Cancelled
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {STAGES.map((stage, idx) => {
        const isPassed = idx <= currentIndex;
        const isCurrent = idx === currentIndex;

        return (
          <React.Fragment key={stage}>
            <div
              title={stage}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: isPassed
                  ? isCurrent
                    ? "#8b5cf6"
                    : "#10b981"
                  : "rgba(255,255,255,0.15)",
                boxShadow: isCurrent
                  ? "0 0 8px #8b5cf6"
                  : "none",
                transition: "all 0.3s",
              }}
            />

            {idx < STAGES.length - 1 && (
              <div
                style={{
                  width: 14,
                  height: 2,
                  background:
                    idx < currentIndex
                      ? "#10b981"
                      : "rgba(255,255,255,0.1)",
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function Shipment() {
  const { user } = useAuth();
  const userRole = user?.role || "";

  // Roles that can create / cancel / full-edit shipments
  const canEdit = ["Admin", "FleetManager", "Dispatcher"].includes(userRole);

  // Driver can advance their own shipment status only
  const isDriver = userRole === "Driver";
  
  const [shipments, setShipments] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showModal, setShowModal] = useState(false);

  const [toast, setToast] = useState(null);

  const [formData, setFormData] = useState({
    tracking_number: "",
    source: "",
    destination: "",
    customer_name: "",
    shipment_weight: "",
    vehicle_id: "",
    driver_id: "",
    status: "Created",
  });

  // =========================================================
  // LOAD DATA
  // =========================================================

  const loadData = async () => {
    try {
      setLoading(true);

      // Drivers don't use the vehicle/driver dropdowns (they can't create shipments)
      // so skip those calls to avoid noisy console errors
      if (!isDriver) {
        const [vehRes, drvRes] = await Promise.all([
          getVehicles().catch(() => []),
          getDrivers().catch(() => []),
        ]);
        setVehicles(Array.isArray(vehRes) ? vehRes : []);
        setDrivers(Array.isArray(drvRes) ? drvRes : []);
      }

      // Fetch shipments (scoped by role on the backend)
      let shipRes = [];
      try {
        shipRes = await getShipments();
      } catch (err) {
        console.error("LOAD SHIPMENTS ERROR:", err);
        showToast(
          err.response?.data?.detail || "Failed to load shipments",
          "error"
        );
      }

      setShipments(Array.isArray(shipRes) ? shipRes : []);
    } catch (err) {
      console.error("LOAD SHIPMENT DATA ERROR:", err);
      showToast(
        err.response?.data?.detail || "Failed to load shipment data",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // =========================================================
  // TOAST
  // =========================================================

  const showToast = (msg, type = "success") => {
    setToast({
      msg,
      type,
    });

    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // =========================================================
  // OPEN CREATE MODAL
  // =========================================================

  const handleOpenModal = () => {
    const autoTracking =
      "TRK-" +
      Math.floor(100000 + Math.random() * 900000);

    setFormData({
      tracking_number: autoTracking,
      source: "",
      destination: "",
      customer_name: "",
      shipment_weight: "",
      vehicle_id: "",
      driver_id: "",
      status: "Created",
    });

    setShowModal(true);
  };

  // =========================================================
  // CREATE SHIPMENT
  // =========================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        tracking_number:
          formData.tracking_number.trim(),

        source:
          formData.source.trim(),

        destination:
          formData.destination.trim(),

        customer_name:
          formData.customer_name.trim(),

        shipment_weight:
          Number(formData.shipment_weight),

        vehicle_id:
          formData.vehicle_id || null,

        driver_id:
          formData.driver_id || null,

        status: "Created",
      };

      console.log(
        "CREATE SHIPMENT PAYLOAD:",
        payload
      );

      await addShipment(payload);

      showToast(
        "Shipment created successfully!"
      );

      setShowModal(false);

      await loadData();
    } catch (err) {
      console.error(
        "CREATE SHIPMENT ERROR:",
        err
      );

      const message =
        err.response?.data?.detail;

      if (Array.isArray(message)) {
        showToast(
          message
            .map((item) => item.msg)
            .join(", "),
          "error"
        );
      } else {
        showToast(
          message ||
            "Failed to create shipment",
          "error"
        );
      }
    }
  };

  // =========================================================
  // PROGRESS STATUS
  // =========================================================

  const handleProgressStatus = async (shipment) => {
    const currentIndex = STAGES.indexOf(shipment.status);

    if (
      currentIndex < 0 ||
      currentIndex >= STAGES.length - 1
    ) {
      return;
    }

    const nextStatus = STAGES[currentIndex + 1];

    try {
      // Drivers use the /status endpoint; others use the full PUT endpoint
      if (isDriver) {
        await updateShipmentStatus(shipment.shipment_id, nextStatus);
      } else {
        await updateShipment(shipment.shipment_id, { status: nextStatus });
      }

      showToast(`Shipment updated to ${nextStatus}`);
      await loadData();
    } catch (err) {
      console.error("UPDATE SHIPMENT ERROR:", err);
      showToast(
        err.response?.data?.detail || "Failed to update shipment status",
        "error"
      );
    }
  };

  // =========================================================
  // CANCEL SHIPMENT
  // =========================================================

  const handleCancel = async (
    shipmentId,
    trackingNumber
  ) => {
    const confirmed = window.confirm(
      `Cancel shipment ${trackingNumber}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await cancelShipment(shipmentId);

      showToast(
        "Shipment cancelled successfully"
      );

      await loadData();
    } catch (err) {
      console.error(
        "CANCEL SHIPMENT ERROR:",
        err
      );

      showToast(
        err.response?.data?.detail ||
          "Failed to cancel shipment",
        "error"
      );
    }
  };

  // =========================================================
  // FILTER
  // =========================================================

  const filtered = shipments.filter((shipment) => {
    const q = (search || "").toLowerCase().trim();

    const matchSearch =
      !q ||
      (shipment.tracking_number || "").toLowerCase().includes(q) ||
      (shipment.customer_name || "").toLowerCase().includes(q) ||
      (shipment.source || "").toLowerCase().includes(q) ||
      (shipment.destination || "").toLowerCase().includes(q);

    const matchStatus =
      statusFilter === "All" ||
      shipment.status === statusFilter;

    return matchSearch && matchStatus;
  });

  // =========================================================
  // UI
  // =========================================================

  return (
    <Layout>

      {/* Toast */}
      {toast && (
        <div
          className={`toast toast-${toast.type}`}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Shipment Tracking</h1>

          <p>
            Create, assign, and track shipments
            through their delivery lifecycle
          </p>
        </div>

        {canEdit && (
          <button
            className="btn btn-primary"
            onClick={handleOpenModal}
            id="add-shipment-btn"
          >
            + Add Shipment
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="filter-bar">

        <div className="search-box">

          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle
              cx="11"
              cy="11"
              r="8"
            />

            <line
              x1="21"
              y1="21"
              x2="16.65"
              y2="16.65"
            />
          </svg>

          <input
            type="text"
            placeholder="Search tracking #, customer, source, destination..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />
        </div>

        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value)
          }
        >
          <option value="All">
            All Statuses
          </option>

          <option value="Created">
            Created
          </option>

          <option value="Assigned">
            Assigned
          </option>

          <option value="In Transit">
            In Transit
          </option>

          <option value="Delayed">
            Delayed
          </option>

          <option value="Delivered">
            Delivered
          </option>

          <option value="Cancelled">
            Cancelled
          </option>
        </select>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="loading-screen">
          <div className="spinner" />

          <span>
            Loading shipments...
          </span>
        </div>
      ) : filtered.length === 0 ? (

        /* Empty */
        <div className="empty-state">

          <h3>
            No shipments found
          </h3>

          <p>
            Create a new shipment to
            start tracking deliveries.
          </p>

        </div>

      ) : (

        /* Table */
        <div className="table-wrapper">

          <table className="data-table">

            <thead>
              <tr>
                <th>Tracking #</th>
                <th>Customer</th>
                <th>
                  Route
                </th>
                <th>Weight</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>

              {filtered.map((shipment) => (

                <tr
                  key={
                    shipment.shipment_id
                  }
                >

                  {/* Tracking */}
                  <td>
                    <span
                      style={{
                        fontWeight: 600,
                        color:
                          "var(--accent-cyan)",
                        fontFamily:
                          "monospace",
                      }}
                    >
                      {
                        shipment.tracking_number
                      }
                    </span>
                  </td>

                  {/* Customer */}
                  <td>
                    <span
                      style={{
                        fontWeight: 500,
                      }}
                    >
                      {
                        shipment.customer_name
                      }
                    </span>
                  </td>

                  {/* Route */}
                  <td>
                    <div
                      style={{
                        fontSize:
                          "0.85rem",
                      }}
                    >
                      <span>
                        {shipment.source}
                      </span>

                      <span
                        style={{
                          color:
                            "var(--accent-blue)",
                          margin:
                            "0 6px",
                        }}
                      >
                        →
                      </span>

                      <span>
                        {
                          shipment.destination
                        }
                      </span>
                    </div>
                  </td>

                  {/* Weight */}
                  <td>
                    {
                      shipment.shipment_weight
                    }{" "}
                    kg
                  </td>

                  {/* Progress */}
                  <td>
                    <StatusStepper
                      currentStatus={
                        shipment.status
                      }
                    />
                  </td>

                  {/* Status */}
                  <td>

                    <span
                      className={`badge badge-${shipment.status
                        ?.toLowerCase()
                        .replace(
                          /\s+/g,
                          "-"
                        )}`}
                    >
                      {
                        shipment.status
                      }
                    </span>

                  </td>

                  {/* Actions */}
                  <td>

                    <div className="action-btns">

                      {/* Next Step — Admin/FleetManager/Dispatcher/Driver (own shipment) */}
                      {(canEdit || isDriver) &&
                        STAGES.indexOf(shipment.status) >= 0 &&
                        STAGES.indexOf(shipment.status) < STAGES.length - 1 && (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleProgressStatus(shipment)}
                          >
                            Next Step ▶
                          </button>
                        )}

                      {/* Cancel — Admin/FleetManager/Dispatcher only */}
                      {canEdit &&
                        shipment.status !== "Cancelled" &&
                        shipment.status !== "Delivered" && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() =>
                              handleCancel(
                                shipment.shipment_id,
                                shipment.tracking_number
                              )
                            }
                          >
                            Cancel
                          </button>
                        )}

                      {/* View Only label for roles with no actions */}
                      {!canEdit && !isDriver && (
                        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem" }}>View Only</span>
                      )}

                    </div>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>
      )}

      {/* =====================================================
          CREATE SHIPMENT MODAL
      ===================================================== */}

      {showModal && (

        <div
          className="modal-overlay"
          onClick={() =>
            setShowModal(false)
          }
        >

          <div
            className="modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="modal-header">

              <h2>
                New Shipment Registration
              </h2>

              <button
                className="modal-close"
                onClick={() =>
                  setShowModal(false)
                }
              >
                ×
              </button>

            </div>

            <form
              onSubmit={handleSubmit}
            >

              {/* Tracking */}
              <div className="form-group">

                <label>
                  Tracking Number
                </label>

                <input
                  className="form-control"
                  value={
                    formData.tracking_number
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tracking_number:
                        e.target.value,
                    })
                  }
                  required
                />

              </div>

              {/* Customer + Weight */}
              <div className="form-grid">

                <div className="form-group">

                  <label>
                    Customer Name
                  </label>

                  <input
                    className="form-control"
                    placeholder="e.g. Acme Logistics"
                    value={
                      formData.customer_name
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customer_name:
                          e.target.value,
                      })
                    }
                    required
                  />

                </div>

                <div className="form-group">

                  <label>
                    Weight (kg)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control"
                    placeholder="e.g. 500"
                    value={
                      formData.shipment_weight
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        shipment_weight:
                          e.target.value,
                      })
                    }
                    required
                  />

                </div>

              </div>

              {/* Source + Destination */}
              <div className="form-grid">

                <div className="form-group">

                  <label>
                    Source Address
                  </label>

                  <input
                    className="form-control"
                    placeholder="Origin City / Address"
                    value={
                      formData.source
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        source:
                          e.target.value,
                      })
                    }
                    required
                  />

                </div>

                <div className="form-group">

                  <label>
                    Destination Address
                  </label>

                  <input
                    className="form-control"
                    placeholder="Destination City / Address"
                    value={
                      formData.destination
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        destination:
                          e.target.value,
                      })
                    }
                    required
                  />

                </div>

              </div>

              {/* Vehicle + Driver */}
              <div className="form-grid">

                <div className="form-group">

                  <label>
                    Assign Vehicle
                  </label>

                  <select
                    className="form-control"
                    value={
                      formData.vehicle_id
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        vehicle_id:
                          e.target.value,
                      })
                    }
                  >

                    <option value="">
                      -- Select Vehicle --
                    </option>

                    {vehicles.map(
                      (vehicle) => (

                        <option
                          key={
                            vehicle.vehicle_id
                          }
                          value={
                            vehicle.vehicle_id
                          }
                        >
                          {vehicle.registration_number ||
                            vehicle.vehicle_id}
                        </option>

                      )
                    )}

                  </select>

                </div>

                <div className="form-group">

                  <label>
                    Assign Driver
                  </label>

                  <select
                    className="form-control"
                    value={
                      formData.driver_id
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        driver_id:
                          e.target.value,
                      })
                    }
                  >

                    <option value="">
                      -- Select Driver --
                    </option>

                    {drivers.map(
                      (driver) => (

                        <option
                          key={
                            driver.user_id ||
                            driver.driver_id
                          }
                          value={
                            driver.user_id ||
                            driver.driver_id
                          }
                        >
                          {driver.full_name ||
                            driver.name ||
                            driver.email ||
                            "Driver"}
                        </option>

                      )
                    )}

                  </select>

                </div>

              </div>

              {/* Footer */}
              <div className="modal-footer">

                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    setShowModal(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Create Shipment
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </Layout>
  );
}

