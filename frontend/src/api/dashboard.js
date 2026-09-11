import api from "./axios";

export async function getDashboardStats() {
  const response = await api.get("/dashboard/summary");
  return response.data;
}