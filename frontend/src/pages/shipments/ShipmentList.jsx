import { deleteShipment } from "../../api/shipmentApi";

export default function ShipmentList({
  shipments,
  loadShipments,
}) {
  const handleDelete = async (id) => {
    if (!window.confirm("Delete shipment?")) return;

    try {
      await deleteShipment(id);
      alert("Shipment Deleted");
      loadShipments();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="vehicle-table">
      <h2>Shipments</h2>

      <table>
        <thead>
          <tr>
            <th>Tracking No.</th>
            <th>Customer</th>
            <th>Source</th>
            <th>Destination</th>
            <th>Weight</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {shipments.map((shipment) => (
            <tr key={shipment.shipment_id}>
              <td>{shipment.tracking_number}</td>
              <td>{shipment.customer_name}</td>
              <td>{shipment.source}</td>
              <td>{shipment.destination}</td>
              <td>{shipment.shipment_weight}</td>
              <td>{shipment.status}</td>

              <td>
                <button
                  className="delete-btn"
                  onClick={() =>
                    handleDelete(shipment.shipment_id)
                  }
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}