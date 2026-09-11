import api from "./axiosInstance";

export const downloadReportPdf = async (endpoint, filename = "fleet_report.pdf") => {
  const response = await api.get(endpoint, {
    responseType: "blob",
  });

  // Check if the backend fell back to returning JSON (e.g. because ReportLab is not installed)
  if (response.headers["content-type"]?.includes("application/json")) {
    const text = await response.data.text();
    try {
      const json = JSON.parse(text);
      console.warn("Backend returned JSON instead of PDF:", json);
      alert("Failed to generate PDF. The backend server does not have the 'reportlab' package installed. Please ensure the backend is running inside the virtual environment.");
      return;
    } catch (e) {
      console.error("Failed to parse JSON response:", e);
    }
  }

  const blob = new Blob([response.data], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const downloadReportExcel = async (endpoint, filename = "fleet_report.xlsx") => {
  const response = await api.get(endpoint, {
    responseType: "blob",
  });

  // Check if the backend returned JSON (e.g. because of an error)
  if (response.headers["content-type"]?.includes("application/json")) {
    const text = await response.data.text();
    try {
      const json = JSON.parse(text);
      console.warn("Backend returned JSON instead of Excel:", json);
      alert("Failed to generate Excel sheet. The backend returned an error or JSON response.");
      return;
    } catch (e) {
      console.error("Failed to parse JSON response:", e);
    }
  }

  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// Fleet Summary
export const getFleetSummaryJson = () => api.get("/reports/fleet-summary").then(r => r.data);
export const getFleetSummaryPdf = () => downloadReportPdf("/reports/fleet-summary-pdf", "fleet_summary_report.pdf");
export const getFleetSummaryExcel = () => downloadReportExcel("/reports/fleet-summary-excel", "fleet_summary_report.xlsx");

// Fuel Consumption
export const getFuelDataJson = () => api.get("/reports/fuel-data").then(r => r.data);
export const getFuelReportPdf = () => downloadReportPdf("/reports/fuel-pdf", "fuel_consumption_report.pdf");
export const getFuelReportExcel = () => downloadReportExcel("/reports/fuel-excel", "fuel_consumption_report.xlsx");

// Maintenance Cost
export const getMaintenanceDataJson = () => api.get("/reports/maintenance-data").then(r => r.data);
export const getMaintenanceCostPdf = () => downloadReportPdf("/reports/maintenance-cost-pdf", "maintenance_cost_report.pdf");
export const getMaintenanceCostExcel = () => downloadReportExcel("/reports/maintenance-excel", "maintenance_cost_report.xlsx");

// Driver Performance
export const getDriverPerfDataJson = () => api.get("/reports/driver-performance-data").then(r => r.data);
export const getDriverPerformancePdf = () => downloadReportPdf("/reports/driver-performance-pdf", "driver_performance_report.pdf");
export const getDriverPerformanceExcel = () => downloadReportExcel("/reports/driver-performance-excel", "driver_performance_report.xlsx");

// Delivery Performance (Dispatcher-accessible)
export const getDeliveryDataJson = () => api.get("/reports/delivery-data").then(r => r.data);
export const getDeliveryPerformancePdf = () => downloadReportPdf("/reports/delivery-performance-pdf", "delivery_performance_report.pdf");
export const getDeliveryPerformanceExcel = () => downloadReportExcel("/reports/delivery-performance-excel", "delivery_performance_report.xlsx");
