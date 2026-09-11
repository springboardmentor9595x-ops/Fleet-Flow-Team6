
import api from "./axios";

// Get all shipments
export const getShipments = () =>
  api.get("/shipments/").then((response) => response.data);

// Get one shipment
export const getShipment = (id) =>
  api.get(`/shipments/${id}`).then((response) => response.data);

// Create shipment
export const addShipment = (data) =>
  api.post("/shipments/", data).then((response) => response.data);

// Update shipment (Admin / FleetManager / Dispatcher — full edit)
export const updateShipment = (id, data) =>
  api.put(`/shipments/${id}`, data).then((response) => response.data);

// Update shipment STATUS only (all roles including Driver)
export const updateShipmentStatus = (id, newStatus) =>
  api.put(`/shipments/${id}/status`, { status: newStatus }).then((response) => response.data);

// Cancel shipment
export const cancelShipment = (id) =>
  api.delete(`/shipments/${id}`).then((response) => response.data);
