import api from "./axios";

export const getTrips = () => api.get("/trips/").then((r) => r.data);

export const getTrip = (id) => api.get(`/trips/${id}`).then((r) => r.data);

export const addTrip = (data) => api.post("/trips/", data).then((r) => r.data);

export const updateTrip = (id, data) =>
  api.put(`/trips/${id}`, data).then((r) => r.data);

export const deleteTrip = (id) =>
  api.delete(`/trips/${id}`).then((r) => r.data);

export const startTrip = (id) =>
  api.put(`/trips/${id}/start`).then((r) => r.data);

export const endTrip = (id) =>
  api.put(`/trips/${id}/end`).then((r) => r.data);

export const optimizeRoute = (tripId, routeType) =>
  api
    .post(`/trips/${tripId}/route?route_type=${encodeURIComponent(routeType)}`)
    .then((r) => r.data);

/** Recalculate route from current GPS position mid-trip */
export const recalculateRoute = (tripId) =>
  api.post(`/trips/${tripId}/recalculate`).then((r) => r.data);
