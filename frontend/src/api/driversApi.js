import api from "./axios";

export const getDrivers = () => api.get("/drivers/").then((r) => r.data);

export const getDriver = (id) => api.get(`/drivers/${id}`).then((r) => r.data);

export const getMyDriverProfile = () => api.get("/drivers/me").then((r) => r.data);

export const addDriver = (data) => api.post("/drivers/", data).then((r) => r.data);

export const updateDriver = (id, data) =>
  api.put(`/drivers/${id}`, data).then((r) => r.data);

export const deleteDriver = (id) => api.delete(`/drivers/${id}`).then((r) => r.data);

export const assignVehicle = (driverId, vehicleId) =>
  api.put(`/drivers/${driverId}/assign-vehicle`, { vehicle_id: vehicleId }).then((r) => r.data);

export const unassignVehicle = (driverId) =>
  api.put(`/drivers/${driverId}/unassign-vehicle`).then((r) => r.data);

export const getDriverActivity = (driverId) =>
  api.get(`/drivers/${driverId}/activity`).then((r) => r.data);

export const getEligibleUsers = () =>
  api.get("/users/eligible-drivers").then((r) => r.data || []);


export const getVehicles = () => api.get("/vehicles/").then((r) => r.data);
