import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, DollarSign, Route, FileText, Download, Calendar, FileSpreadsheet, Lock, Filter } from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

export default function Reports() {
  const { user } = useAuth();
  const roleClean = (user?.role || "").toString().toUpperCase().replace(/[^A-Z]/g, "");

  // Available tabs based on role (Fleet Manager has full access to all 5 report types)
  const allTabs = [
    { id: "fleet-utilization", label: "Fleet Utilization", roles: ["ADMIN", "FLEETMANAGER"] },
    { id: "fuel-consumption", label: "Fuel Consumption", roles: ["ADMIN", "FLEETMANAGER"] },
    { id: "driver-performance", label: "Driver Performance", roles: ["ADMIN", "FLEETMANAGER", "DRIVER"] },
    { id: "delivery-performance", label: "Delivery Performance", roles: ["ADMIN", "FLEETMANAGER", "DISPATCHER"] },
    { id: "maintenance", label: "Maintenance Report", roles: ["ADMIN", "FLEETMANAGER"] }
  ];

  const visibleTabs = allTabs.filter(t => t.roles.includes(roleClean));
  const initialTab = visibleTabs[0]?.id || "delivery-performance";

  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Category selection mode: "week", "monthly", "custom"
  const [filterMode, setFilterMode] = useState("week");
  const [weekSubOption, setWeekSubOption] = useState("current"); // "current", "previous"
  
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth().toString()); // 0-11
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading]     = useState(true);

  const monthsList = [
    { value: "0", label: "January" },
    { value: "1", label: "February" },
    { value: "2", label: "March" },
    { value: "3", label: "April" },
    { value: "4", label: "May" },
    { value: "5", label: "June" },
    { value: "6", label: "July" },
    { value: "7", label: "August" },
    { value: "8", label: "September" },
    { value: "9", label: "October" },
    { value: "10", label: "November" },
    { value: "11", label: "December" }
  ];

  const yearsList = ["2024", "2025", "2026", "2027"];

  // Helper date formatter
  const formatDateStr = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Recalculate start_date and end_date based on selected mode
  const calculateDates = (mode, weekOpt, monthVal, yearVal) => {
    const today = new Date();
    
    if (mode === "week") {
      const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday
      const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
      
      const mondayCurrentWeek = new Date(today);
      mondayCurrentWeek.setDate(today.getDate() - distanceToMonday);

      if (weekOpt === "previous") {
        const mondayPrevWeek = new Date(mondayCurrentWeek);
        mondayPrevWeek.setDate(mondayCurrentWeek.getDate() - 7);

        const sundayPrevWeek = new Date(mondayPrevWeek);
        sundayPrevWeek.setDate(mondayPrevWeek.getDate() + 6);

        return {
          start: formatDateStr(mondayPrevWeek),
          end: formatDateStr(sundayPrevWeek)
        };
      } else {
        const sundayCurrentWeek = new Date(mondayCurrentWeek);
        sundayCurrentWeek.setDate(mondayCurrentWeek.getDate() + 6);

        return {
          start: formatDateStr(mondayCurrentWeek),
          end: formatDateStr(sundayCurrentWeek)
        };
      }
    } else if (mode === "monthly") {
      const y = parseInt(yearVal, 10);
      const m = parseInt(monthVal, 10);
      const firstDay = new Date(y, m, 1);
      const lastDay = new Date(y, m + 1, 0);

      return {
        start: formatDateStr(firstDay),
        end: formatDateStr(lastDay)
      };
    }
    
    return { start: startDate, end: endDate };
  };

  const fetchReportData = async (overrideStart, overrideEnd) => {
    try {
      setLoading(true);
      const sDate = overrideStart !== undefined ? overrideStart : startDate;
      const eDate = overrideEnd !== undefined ? overrideEnd : endDate;

      const params = {};
      if (sDate) params.start_date = sDate;
      if (eDate) params.end_date = eDate;

      const res = await api.get(`/reports/${activeTab}`, { params });
      setReportData(res.data);
    } catch (err) {
      console.error("Report fetch error:", err);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  // Sync date calculation when mode or filters change
  useEffect(() => {
    if (filterMode === "week") {
      const { start, end } = calculateDates("week", weekSubOption, selectedMonth, selectedYear);
      setStartDate(start);
      setEndDate(end);
      fetchReportData(start, end);
    } else if (filterMode === "monthly") {
      const { start, end } = calculateDates("monthly", weekSubOption, selectedMonth, selectedYear);
      setStartDate(start);
      setEndDate(end);
      fetchReportData(start, end);
    } else {
      fetchReportData();
    }
  }, [activeTab, filterMode, weekSubOption, selectedMonth, selectedYear]);

  const handleApplyFilter = () => {
    fetchReportData();
  };

  const handleExportPDF = async () => {
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await api.get(`/reports/${activeTab}/export/pdf`, {
        params,
        responseType: "blob"
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${activeTab}_${startDate || 'all'}_to_${endDate || 'all'}_report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("PDF export error:", err);
    }
  };

  const handleExportExcel = async () => {
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await api.get(`/reports/${activeTab}/export/excel`, {
        params,
        responseType: "blob"
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${activeTab}_${startDate || 'all'}_to_${endDate || 'all'}_report.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Excel export error:", err);
    }
  };

  return (
    <AppLayout title="Reports & Export Hub" subtitle="Generate, filter by specific period category, preview, and download reports in PDF and Excel formats.">
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        
        {/* Role-gated Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", borderBottom: "2px solid #e2e8f0", paddingBottom: "0.5rem", overflowX: "auto" }}>
          {visibleTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: "0.625rem 1.25rem",
                borderRadius: "0.75rem",
                border: "none",
                background: activeTab === t.id ? "#3b82f6" : "transparent",
                color: activeTab === t.id ? "white" : "#64748b",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap"
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Enhanced Report Filter Category Console */}
        <div className="ff-card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            
            {/* Filter Category Selector Tabs */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Filter size={16} color="#6366f1" />
              <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0f172a", textTransform: "uppercase" }}>Filter Category:</span>
              <div style={{ display: "flex", gap: "0.375rem", background: "#f8fafc", padding: "0.25rem", borderRadius: "0.625rem", border: "1px solid #e2e8f0" }}>
                
                <button
                  type="button"
                  onClick={() => setFilterMode("week")}
                  style={{
                    padding: "0.375rem 0.875rem",
                    borderRadius: "0.5rem",
                    border: "none",
                    background: filterMode === "week" ? "#ffffff" : "transparent",
                    color: filterMode === "week" ? "#2563eb" : "#64748b",
                    fontWeight: 700,
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                    boxShadow: filterMode === "week" ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
                  }}
                >
                  📅 Weekly
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode("monthly")}
                  style={{
                    padding: "0.375rem 0.875rem",
                    borderRadius: "0.5rem",
                    border: "none",
                    background: filterMode === "monthly" ? "#ffffff" : "transparent",
                    color: filterMode === "monthly" ? "#2563eb" : "#64748b",
                    fontWeight: 700,
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                    boxShadow: filterMode === "monthly" ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
                  }}
                >
                  🗓️ Monthly Dropdown
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode("custom")}
                  style={{
                    padding: "0.375rem 0.875rem",
                    borderRadius: "0.5rem",
                    border: "none",
                    background: filterMode === "custom" ? "#ffffff" : "transparent",
                    color: filterMode === "custom" ? "#2563eb" : "#64748b",
                    fontWeight: 700,
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                    boxShadow: filterMode === "custom" ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
                  }}
                >
                  ⚙️ Custom Range
                </button>

              </div>
            </div>

            {/* Export Action Buttons */}
            <div style={{ display: "flex", gap: "0.625rem" }}>
              <button onClick={handleExportPDF} style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1rem", background: "#e11d48", color: "white", border: "none", borderRadius: "0.625rem", fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer" }}>
                <FileText size={15} /> Export PDF
              </button>
              <button onClick={handleExportExcel} style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1rem", background: "#059669", color: "white", border: "none", borderRadius: "0.625rem", fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer" }}>
                <FileSpreadsheet size={15} /> Export Excel
              </button>
            </div>

          </div>

          {/* Dynamic Controls per Selected Category */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.75rem", padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            
            {/* Mode 1: Week Selector */}
            {filterMode === "week" && (
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#475569" }}>Select Week Period:</span>
                <select
                  value={weekSubOption}
                  onChange={(e) => setWeekSubOption(e.target.value)}
                  style={{ padding: "0.4375rem 0.875rem", borderRadius: "0.5rem", border: "1.5px solid #cbd5e1", fontSize: "0.8125rem", fontWeight: 600, background: "white" }}
                >
                  <option value="current">Current Week (Mon - Sun)</option>
                  <option value="previous">Previous Week (Last Mon - Sun)</option>
                </select>
              </div>
            )}

            {/* Mode 2: Monthly Dropdown Selector */}
            {filterMode === "monthly" && (
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#475569" }}>Select Month & Year:</span>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    style={{ padding: "0.4375rem 0.875rem", borderRadius: "0.5rem", border: "1.5px solid #cbd5e1", fontSize: "0.8125rem", fontWeight: 600, background: "white" }}
                  >
                    {monthsList.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>

                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    style={{ padding: "0.4375rem 0.875rem", borderRadius: "0.5rem", border: "1.5px solid #cbd5e1", fontSize: "0.8125rem", fontWeight: 600, background: "white" }}
                  >
                    {yearsList.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Mode 3: Custom Date Range Pickers */}
            {filterMode === "custom" && (
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#475569" }}>Start Date:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ padding: "0.4375rem 0.625rem", borderRadius: "0.5rem", border: "1.5px solid #cbd5e1", fontSize: "0.8125rem", background: "white" }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#475569" }}>End Date:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ padding: "0.4375rem 0.625rem", borderRadius: "0.5rem", border: "1.5px solid #cbd5e1", fontSize: "0.8125rem", background: "white" }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleApplyFilter}
                  style={{ padding: "0.4375rem 0.875rem", background: "#2563eb", color: "white", border: "none", borderRadius: "0.5rem", fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer" }}
                >
                  Apply Custom Range
                </button>
              </div>
            )}

            {/* Active Period Display Banner */}
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#6366f1", background: "#eff6ff", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #bfdbfe" }}>
              Active Period: {startDate || "Start"} → {endDate || "End"}
            </div>

          </div>

        </div>

        {/* Report Preview */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "250px", flexDirection: "column", gap: "1rem" }}>
            <div className="ff-pulse-dot" style={{ width: "36px", height: "36px", background: "#3b82f6" }} />
            <p style={{ fontSize: "0.875rem", color: "#64748b" }}>Generating report preview for {startDate} to {endDate}...</p>
          </div>
        ) : !reportData ? (
          <div style={{ textAlign: "center", padding: "3rem", background: "white", borderRadius: "1rem", border: "1.5px solid #e2e8f0" }}>
            <Lock size={36} color="#94a3b8" />
            <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.5rem" }}>Failed or unauthorized to view this report.</p>
          </div>
        ) : (
          <div className="ff-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            
            {/* Header & Meta */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "1rem" }}>
              <div>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>{reportData.report_title}</h3>
                <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.125rem" }}>Period: {reportData.date_range} | Generated at {reportData.generated_at}</p>
              </div>
              <span style={{ padding: "0.25rem 0.75rem", background: "#eff6ff", color: "#1d4ed8", borderRadius: "0.5rem", fontSize: "0.75rem", fontWeight: 700 }}>
                Live Preview
              </span>
            </div>

            {/* Metric Summaries */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
              {activeTab === "fleet-utilization" && (
                <>
                  <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Total Vehicles</span>
                    <h4 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>{reportData.total_vehicles}</h4>
                  </div>
                  <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Utilization Rate</span>
                    <h4 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#059669" }}>{reportData.utilization_rate_pct}%</h4>
                  </div>
                </>
              )}

              {activeTab === "fuel-consumption" && (
                <>
                  <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Total Fuel Consumed</span>
                    <h4 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>{reportData.total_fuel_liters} L</h4>
                  </div>
                  <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Total Cost</span>
                    <h4 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#059669" }}>₹{reportData.total_cost_inr?.toLocaleString()}</h4>
                  </div>
                </>
              )}

              {activeTab === "delivery-performance" && (
                <>
                  <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Total Shipments</span>
                    <h4 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>{reportData.total_shipments}</h4>
                  </div>
                  <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>On-Time Rate</span>
                    <h4 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#059669" }}>{reportData.on_time_rate_pct}%</h4>
                  </div>
                </>
              )}
            </div>

            {/* Table Preview */}
            <div className="ff-table-container">
              <table className="ff-table">
                <thead>
                  {activeTab === "fleet-utilization" && (
                    <tr>
                      <th style={{ paddingLeft: "1.5rem" }}>Vehicle Reg</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Capacity (Tonnes)</th>
                      <th style={{ paddingRight: "1.5rem" }}>Trips in Period</th>
                    </tr>
                  )}
                  {activeTab === "fuel-consumption" && (
                    <tr>
                      <th style={{ paddingLeft: "1.5rem" }}>Vehicle Reg</th>
                      <th>Driver</th>
                      <th>Refill Date</th>
                      <th>Fuel (Liters)</th>
                      <th style={{ paddingRight: "1.5rem" }}>Cost (₹)</th>
                    </tr>
                  )}
                  {activeTab === "driver-performance" && (
                    <tr>
                      <th style={{ paddingLeft: "1.5rem" }}>Driver Name</th>
                      <th>Licence Number</th>
                      <th>Trips Completed</th>
                      <th>Attendance Rate (Days Present)</th>
                      <th style={{ paddingRight: "1.5rem" }}>On-Time Rate</th>
                    </tr>
                  )}
                  {activeTab === "delivery-performance" && (
                    <tr>
                      <th style={{ paddingLeft: "1.5rem" }}>Tracking #</th>
                      <th>Customer Name</th>
                      <th>Route</th>
                      <th>Vehicle</th>
                      <th style={{ paddingRight: "1.5rem" }}>Status</th>
                    </tr>
                  )}
                  {activeTab === "maintenance" && (
                    <tr>
                      <th style={{ paddingLeft: "1.5rem" }}>Vehicle Reg</th>
                      <th>Maintenance Type</th>
                      <th>Service Date</th>
                      <th>Cost (₹)</th>
                      <th style={{ paddingRight: "1.5rem" }}>Resolution Status</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {reportData.details?.map((row, idx) => (
                    <tr key={idx}>
                      {activeTab === "fleet-utilization" && (
                        <>
                          <td style={{ paddingLeft: "1.5rem", fontWeight: 700, color: "#2563eb" }}>{row.registration_number}</td>
                          <td>{row.type}</td>
                          <td><span className={`ff-badge ${row.status?.toLowerCase()}`}>{row.status}</span></td>
                          <td style={{ fontWeight: 600 }}>{row.capacity_tonnes} T</td>
                          <td style={{ paddingRight: "1.5rem", fontWeight: 700, color: "#0f172a" }}>{row.total_trips}</td>
                        </>
                      )}
                      {activeTab === "fuel-consumption" && (
                        <>
                          <td style={{ paddingLeft: "1.5rem", fontWeight: 700, color: "#2563eb" }}>{row.vehicle_reg}</td>
                          <td>{row.driver_name}</td>
                          <td>{row.refill_date}</td>
                          <td style={{ fontWeight: 600 }}>{row.fuel_amount_liters} L</td>
                          <td style={{ paddingRight: "1.5rem", fontWeight: 700, color: "#059669" }}>₹{row.cost_inr?.toLocaleString()}</td>
                        </>
                      )}
                      {activeTab === "driver-performance" && (
                        <>
                          <td style={{ paddingLeft: "1.5rem", fontWeight: 700, color: "#0f172a" }}>{row.driver_name}</td>
                          <td style={{ fontFamily: "monospace", fontWeight: 600 }}>{row.license_number}</td>
                          <td style={{ fontWeight: 700, color: "#2563eb" }}>{row.completed_trips}</td>
                          <td>
                            <span style={{ fontWeight: 700, color: "#059669" }}>
                              {row.attendance_rate || `${row.attendance_rate_pct}%`}
                            </span>
                          </td>
                          <td style={{ paddingRight: "1.5rem" }}>
                            <span style={{ fontWeight: 700, color: "#6366f1" }}>
                              {row.on_time_rate_pct}%
                            </span>
                          </td>
                        </>
                      )}
                      {activeTab === "delivery-performance" && (
                        <>
                          <td style={{ paddingLeft: "1.5rem", fontWeight: 700, color: "#6366f1", fontFamily: "monospace" }}>#{row.tracking_number}</td>
                          <td style={{ fontWeight: 600, color: "#0f172a" }}>{row.customer_name}</td>
                          <td>{row.source} → {row.destination}</td>
                          <td>{row.vehicle_reg}</td>
                          <td style={{ paddingRight: "1.5rem" }}><span className={`ff-badge ${row.status?.toLowerCase()}`}>{row.status}</span></td>
                        </>
                      )}
                      {activeTab === "maintenance" && (
                        <>
                          <td style={{ paddingLeft: "1.5rem", fontWeight: 700, color: "#2563eb" }}>{row.vehicle_reg}</td>
                          <td>{row.maintenance_type}</td>
                          <td>{row.service_date}</td>
                          <td style={{ fontWeight: 700, color: "#e11d48" }}>₹{row.cost_inr?.toLocaleString()}</td>
                          <td style={{ paddingRight: "1.5rem" }}><span className={`ff-badge ${row.resolution_status === "Resolved" ? "completed" : "pending"}`}>{row.resolution_status}</span></td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}

      </div>
    </AppLayout>
  );
}
