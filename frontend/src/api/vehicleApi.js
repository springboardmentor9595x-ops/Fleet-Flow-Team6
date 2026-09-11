import api from "./axios";

export const getVehicles = () => api.get("/vehicles");

export const getVehicle = (id) => api.get(`/vehicles/${id}`);

export const addVehicle = (data) => api.post("/vehicles", data);

export const updateVehicle = (id, data) =>
  api.put(`/vehicles/${id}`, data);

export const deleteVehicle = (id) =>
  api.delete(`/vehicles/${id}`);