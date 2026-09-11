import api from "./axios";

export const getFleetUtilization = () => api.get("/analytics/fleet-utilization").then((r) => r.data);

export const getDriverPerformance = () => api.get("/analytics/driver-performance").then((r) => r.data);

export const getDeliveryPerformance = () => api.get("/analytics/delivery-performance").then((r) => r.data);

export const getMaintenanceAnalytics = () => api.get("/analytics/maintenance-analytics").then((r) => r.data);

export const getAdminSummary = () => api.get("/analytics/admin-summary").then((r) => r.data);
