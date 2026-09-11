import api from "./axios";

export const getProfile = () => api.get("/users/me").then((r) => r.data);

export const updateProfile = (data) =>
  api.put("/users/me", data).then((r) => r.data);

export const changePassword = (data) =>
  api.put("/users/change-password", data).then((r) => r.data);

// Admin User Management APIs
export const getAllUsers = () => api.get("/users/").then((r) => r.data);

export const createUserByAdmin = (data) =>
  api.post("/users/", data).then((r) => r.data);

export const updateUserByAdmin = (userId, data) =>
  api.put(`/users/${userId}`, data).then((r) => r.data);

export const updateUserRole = (userId, role) =>
  api.put(`/users/${userId}/role`, { role }).then((r) => r.data);

export const deleteUser = (userId) =>
  api.delete(`/users/${userId}`).then((r) => r.data);