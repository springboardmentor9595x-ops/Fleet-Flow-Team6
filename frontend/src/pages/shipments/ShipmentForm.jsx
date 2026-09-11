import { useState } from "react";
import { addShipment } from "../../api/shipmentApi";

export default function ShipmentForm({ onSuccess }) {
  const [shipment, setShipment] = useState({
    tracking_number: "",
    source: "",
    destination: "",
    customer_name: "",
    shipment_weight: "",
    vehicle_id: null,
    driver_id: null,
    status: "Created",
  });

  const handleChange = (e) => {
    setShipment({
      ...shipment,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await addShipment({
        ...shipment,
        shipment_weight: Number(shipment.shipment_weight),
      });

      alert("Shipment Created!");

      setShipment({
        tracking_number: "",
        source: "",
        destination: "",
        customer_name: "",
        shipment_weight: "",
        vehicle_id: null,
        driver_id: null,
        status: "Created",
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to create shipment");
    }
  };

  return (
    <div className="vehicle-form">
      <h2>Create Shipment</h2>

      <form onSubmit={handleSubmit}>
        <input
          name="tracking_number"
          placeholder="Tracking Number"
          value={shipment.tracking_number}
          onChange={handleChange}
          required
        />

        <input
          name="source"
          placeholder="Source"
          value={shipment.source}
          onChange={handleChange}
          required
        />

        <input
          name="destination"
          placeholder="Destination"
          value={shipment.destination}
          onChange={handleChange}
          required
        />

        <input
          name="customer_name"
          placeholder="Customer Name"
          value={shipment.customer_name}
          onChange={handleChange}
          required
        />

        <input
          type="number"
          name="shipment_weight"
          placeholder="Weight"
          value={shipment.shipment_weight}
          onChange={handleChange}
          required
        />

        <button type="submit">
          Create Shipment
        </button>
      </form>
    </div>
  );
}
