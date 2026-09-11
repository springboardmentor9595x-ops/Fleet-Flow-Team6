import React, { useEffect, useState, useCallback } from "react";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import {
  getFleetSummaryJson, getFleetSummaryPdf, getFleetSummaryExcel,
  getFuelDataJson, getFuelReportPdf, getFuelReportExcel,
  getMaintenanceDataJson, getMaintenanceCostPdf, getMaintenanceCostExcel,
  getDriverPerfDataJson, getDriverPerformancePdf, getDriverPerformanceExcel,
  getDeliveryDataJson, getDeliveryPerformancePdf, getDeliveryPerformanceExcel,
} from "../api/reportsApi";

// ─── Which reports each role can see ────────────────────────────────────────
const REPORT_ACCESS = {
  Admin: ["fleet", "fuel", "maintenance", "driver", "delivery"],
  FleetManager: ["fleet", "fuel", "maintenance", "driver", "delivery"],
  Dispatcher: ["delivery"],
  Driver: ["driver"],
};


const REPORTS = [
  {
    id: "fleet",
    title: "Fleet Summary",
    icon: "🚛",
    color: "#3b82f6",
    description: "Vehicle counts, utilisation %, fleet-wide operational costs",
    fetchJson: getFleetSummaryJson,
    fetchPdf: getFleetSummaryPdf,
    fetchExcel: getFleetSummaryExcel,
    headers: ["Metric", "Value"],
    toRows: (d) => [
      ["Total Vehicles", d.fleet?.total_vehicles ?? "—"],
      ["Fleet Utilisation %", `${d.fleet?.utilization_percent ?? 0}%`],
      ["Total Drivers", d.drivers?.total ?? "—"],
      ["Total Shipments", d.shipments?.total ?? "—"],
      ["Delivered", d.shipments?.delivered ?? "—"],
      ["Total Fuel Cost (₹)", (d.fuel?.total_cost ?? 0).toLocaleString()],
      ["Total Maint. Cost (₹)", (d.maintenance?.total_cost ?? 0).toLocaleString()],
      ["Total Operational Cost (₹)", (d.total_operational_cost ?? 0).toLocaleString()],
    ],
  },
  {
    id: "fuel",
    title: "Fuel Consumption",
    icon: "⛽",
    color: "#10b981",
    description: "Per-vehicle fuel spend, litres consumed, avg km/L efficiency",
    fetchJson: getFuelDataJson,
    fetchPdf: getFuelReportPdf,
    fetchExcel: getFuelReportExcel,
    headers: ["Vehicle", "Refills", "Litres", "Cost (₹)", "Avg km/L"],
    toRows: (rows) => rows.map((r) => [
      r.vehicle, r.refill_count, r.total_litres.toFixed(2),
      `₹${r.total_cost.toLocaleString()}`, r.avg_mileage_kmpl.toFixed(2),
    ]),
  },
  {
    id: "maintenance",
    title: "Maintenance Cost",
    icon: "🔧",
    color: "#f59e0b",
    description: "Per-vehicle maintenance spend by type, frequency",
    fetchJson: getMaintenanceDataJson,
    fetchPdf: getMaintenanceCostPdf,
    fetchExcel: getMaintenanceCostExcel,
    headers: ["Vehicle", "Type", "Count", "Cost (₹)"],
    toRows: (rows) => rows.map((r) => [
      r.vehicle, r.maintenance_type, r.count, `₹${r.total_cost.toLocaleString()}`,
    ]),
  },
  {
    id: "driver",
    title: "Driver Performance",
    icon: "👤",
    color: "#8b5cf6",
    description: "Trips completed, on-time delivery rate, monthly attendance",
    fetchJson: getDriverPerfDataJson,
    fetchPdf: getDriverPerformancePdf,
    fetchExcel: getDriverPerformanceExcel,
    headers: ["Driver", "License", "Status", "Trips", "Completed", "On-Time %", "Attendance"],
    toRows: (rows) => rows.map((r) => [
      r.driver, r.license, r.status ?? "—", r.total_trips,
      r.completed_trips, `${r.on_time_rate_percent ?? 0}%`, r.attendance_this_month,
    ]),
  },
  {
    id: "delivery",
    title: "Delivery Performance",
    icon: "📦",
    color: "#06b6d4",
    description: "Shipment pipeline, on-time rate, avg delivery hours, delays",
    fetchJson: getDeliveryDataJson,
    fetchPdf: getDeliveryPerformancePdf,
    fetchExcel: getDeliveryPerformanceExcel,
    headers: ["Metric", "Value"],
    toRows: (d) => [
      ["Total Shipments", d.total_shipments ?? "—"],
      ["Delivered", d.delivered ?? "—"],
      ["In Transit", d.in_transit ?? "—"],
      ["Delayed", d.delayed ?? "—"],
      ["Cancelled", d.cancelled ?? "—"],
      ["Avg Delivery (hrs)", d.avg_delivery_hours ?? "N/A"],
      ["On-Time Rate %", `${d.on_time_rate_percent ?? 0}%`],
    ],
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function PreviewTable({ headers, rows }) {
  if (!rows || rows.length === 0) return (
    <div style={{ padding: "24px", textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
      No data available for preview.
    </div>
  );
  return (
    <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
        <thead>
          <tr style={{ background: "rgba(99,102,241,0.18)" }}>
            {headers.map((h) => (
              <th key={h} style={{
                padding: "10px 14px", textAlign: "left",
                color: "rgba(255,255,255,0.55)", fontWeight: 700,
                borderBottom: "1px solid rgba(255,255,255,0.07)",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "9px 14px", color: j === 0 ? "#f1f5f9" : "rgba(255,255,255,0.7)" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExportBtn({ onClick, icon, label, disabled, color }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? color : `${color}22`,
        border: `1px solid ${color}55`,
        color: hover ? "#fff" : color,
        borderRadius: 8, padding: "8px 16px",
        fontSize: "0.8rem", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.2s ease", display: "flex", alignItems: "center", gap: 6,
      }}
    >
      {icon} {disabled ? "Generating..." : label}
    </button>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Reports() {
  const { user } = useAuth();
  const role = user?.role || "Driver";
  const allowedReports = REPORT_ACCESS[role] || [];
  const visibleReports = REPORTS.filter((r) => allowedReports.includes(r.id));

  const [activeId, setActiveId] = useState(visibleReports[0]?.id || null);
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (visibleReports.length > 0 && (!activeId || !visibleReports.some((r) => r.id === activeId))) {
      setActiveId(visibleReports[0].id);
    }
  }, [role, visibleReports, activeId]);

  const activeReport = REPORTS.find((r) => r.id === activeId);

  const loadPreview = useCallback(async () => {
    if (!activeReport) return;
    setLoadingPreview(true);
    setPreviewData(null);
    try {
      const data = await activeReport.fetchJson();
      setPreviewData(data);
    } catch (err) {
      console.error("Preview load failed:", err);
      setPreviewData(null);
    } finally {
      setLoadingPreview(false);
    }
  }, [activeReport]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const handleExport = async (type) => {
    if (!activeReport || exporting) return;
    setExporting(true);
    try {
      if (type === "pdf") await activeReport.fetchPdf();
      else await activeReport.fetchExcel();
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. Make sure the backend is running.");
    } finally {
      setExporting(false);
    }
  };

  const previewRows = previewData ? activeReport?.toRows(previewData) : null;

  if (allowedReports.length === 0) {
    return (
      <Layout>
        <div style={{ padding: "60px 32px", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔒</div>
          <h2 style={{ margin: 0, color: "#f1f5f9" }}>No Reports Available</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", marginTop: 8 }}>
            Your role ({role}) does not have access to any reports.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ padding: "28px 32px", minHeight: "100vh" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: "1.9rem", fontWeight: 800, letterSpacing: "-0.5px" }}>
            📊 Reports & Export
          </h1>
          <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.5)", fontSize: "0.88rem" }}>
            Generate, preview, and export fleet reports as PDF or Excel
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 24, alignItems: "start" }}>
          {/* Sidebar — report type list */}
          <div style={{
            background: "rgba(15,23,42,0.7)", borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.06)", padding: 8,
            position: "sticky", top: 24,
          }}>
            <div style={{ padding: "8px 12px 12px", fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
              Report Types
            </div>
            {visibleReports.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveId(r.id)}
                style={{
                  width: "100%", textAlign: "left", padding: "11px 14px",
                  borderRadius: 10, border: "none", cursor: "pointer",
                  background: activeId === r.id ? `${r.color}18` : "transparent",
                  borderLeft: activeId === r.id ? `3px solid ${r.color}` : "3px solid transparent",
                  color: activeId === r.id ? r.color : "rgba(255,255,255,0.65)",
                  fontWeight: activeId === r.id ? 700 : 500,
                  display: "flex", alignItems: "center", gap: 10,
                  fontSize: "0.84rem", transition: "all 0.15s ease", marginBottom: 2,
                }}
              >
                <span style={{ fontSize: "1.1rem" }}>{r.icon}</span>
                {r.title}
              </button>
            ))}
          </div>

          {/* Main panel */}
          {activeReport && (
            <div style={{
              background: "rgba(15,23,42,0.7)", borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.06)", padding: "24px 28px",
            }}>
              {/* Panel header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: `${activeReport.color}22`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "1.3rem", border: `1px solid ${activeReport.color}44`,
                    }}>
                      {activeReport.icon}
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#f1f5f9" }}>
                        {activeReport.title} Report
                      </h2>
                      <p style={{ margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.45)" }}>
                        {activeReport.description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Export buttons */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {role !== "Driver" ? (
                    <>
                      <ExportBtn
                        onClick={() => handleExport("pdf")}
                        disabled={exporting}
                        icon="📄"
                        label="Export PDF"
                        color="#ef4444"
                      />
                      <ExportBtn
                        onClick={() => handleExport("excel")}
                        disabled={exporting}
                        icon="📊"
                        label="Export Excel"
                        color="#10b981"
                      />
                    </>
                  ) : (
                    <span style={{
                      padding: "6px 12px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 700,
                      background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)"
                    }}>
                      🔒 Preview Only (Export restricted to Manager &amp; Admin)
                    </span>
                  )}
                  <button
                    onClick={loadPreview}
                    disabled={loadingPreview}
                    style={{
                      background: "rgba(99,102,241,0.15)",
                      border: "1px solid rgba(99,102,241,0.4)",
                      color: "#818cf8", borderRadius: 8, padding: "8px 14px",
                      fontSize: "0.8rem", fontWeight: 700, cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    🔄 Refresh
                  </button>
                </div>

              </div>

              {/* Divider */}
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 20 }} />

              {/* Preview */}
              <div style={{ marginBottom: 8, fontSize: "0.78rem", color: "rgba(255,255,255,0.35)", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>
                Live Preview
              </div>

              {loadingPreview ? (
                <div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>⏳</div>
                  Loading report data...
                </div>
              ) : previewRows ? (
                <PreviewTable headers={activeReport.headers} rows={previewRows} />
              ) : (
                <div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.35)" }}>
                  Failed to load preview. Check backend connection.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
