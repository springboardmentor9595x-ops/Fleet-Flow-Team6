import api from "./axios";

export const getVehicles = () => api.get("/vehicles/").then((r) => r.data);

export const getVehicle = (id) => api.get(`/vehicles/${id}`).then((r) => r.data);

export const addVehicle = (data) => api.post("/vehicles/", data).then((r) => r.data);

export const updateVehicle = (id, data) =>
  api.put(`/vehicles/${id}`, data).then((r) => r.data);

export const deleteVehicle = (id) =>
  api.delete(`/vehicles/${id}`).then((r) => r.data);