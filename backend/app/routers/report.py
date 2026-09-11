"""
report.py — Fleet Report Generator
-----------------------------------
PDF reports via reportlab (falls back to JSON if not installed).
Excel reports via openpyxl (falls back to CSV if not installed).
Role-gating via require_role:
  - Admin / FleetManager: all reports
  - Dispatcher: delivery-performance only
  - Driver: 403 on all fleet reports
"""
import io
from datetime import date, timedelta, datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.core.deps import require_role, get_current_user
from app.models.user import RoleEnum, User
from app.models.vehicle import Vehicle, VehicleStatus
from app.models.driver import Driver
from app.models.shipment import Shipment, ShipmentStatus
from app.models.trip import Trip, TripStatus
from app.models.maintenance import VehicleMaintenance
from app.models.fuel_record import FuelRecord
from app.models.attendance import Attendance

router = APIRouter(
    prefix="/reports",
    tags=["Reports"],
)


# ---------------------------------------------------------------------------
# Data collectors (one per report type)
# ---------------------------------------------------------------------------

def _fleet_summary_data(db: Session) -> dict:
    """Full fleet overview — Vehicles, Drivers, Shipments, Trips, Maintenance, Fuel."""
    today = date.today()
    total_vehicles = db.query(Vehicle).count()
    by_status = db.query(Vehicle.status, func.count(Vehicle.vehicle_id)).group_by(Vehicle.status).all()
    status_map = {str(s): c for s, c in by_status}
    active = status_map.get("Assigned", 0) + status_map.get("InTransit", 0)
    utilization_pct = round((active / total_vehicles) * 100, 1) if total_vehicles > 0 else 0

    total_drivers = db.query(Driver).count()
    total_shipments = db.query(Shipment).count()
    delivered = db.query(Shipment).filter(Shipment.status == ShipmentStatus.Delivered).count()
    in_transit = db.query(Shipment).filter(Shipment.status == ShipmentStatus.InTransit).count()
    total_trips = db.query(Trip).count()
    completed_trips = db.query(Trip).filter(Trip.status == TripStatus.Completed).count()
    overdue_maint = db.query(VehicleMaintenance).filter(
        VehicleMaintenance.next_service_date != None,
        VehicleMaintenance.next_service_date < today,
        VehicleMaintenance.status != "Completed",
    ).count()
    total_maint_cost = float(db.query(func.sum(VehicleMaintenance.cost)).scalar() or 0)
    total_fuel_cost = float(db.query(func.sum(FuelRecord.fuel_cost)).scalar() or 0)

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "fleet": {"total_vehicles": total_vehicles, "by_status": status_map, "utilization_percent": utilization_pct},
        "drivers": {"total": total_drivers},
        "shipments": {"total": total_shipments, "delivered": delivered, "in_transit": in_transit},
        "trips": {"total": total_trips, "completed": completed_trips},
        "maintenance": {"overdue": overdue_maint, "total_cost": total_maint_cost},
        "fuel": {"total_cost": total_fuel_cost},
        "total_operational_cost": total_maint_cost + total_fuel_cost,
    }


def _fuel_data(db: Session) -> list[dict]:
    """Per-vehicle fuel consumption summary."""
    rows = (
        db.query(
            FuelRecord.vehicle_id,
            func.sum(FuelRecord.fuel_amount).label("total_litres"),
            func.sum(FuelRecord.fuel_cost).label("total_cost"),
            func.avg(FuelRecord.mileage).label("avg_mileage"),
            func.count(FuelRecord.fuel_id).label("refill_count"),
        )
        .group_by(FuelRecord.vehicle_id)
        .all()
    )
    result = []
    for r in rows:
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == r.vehicle_id).first()
        reg = vehicle.registration_number if vehicle else str(r.vehicle_id)
        result.append({
            "vehicle": reg,
            "total_litres": float(r.total_litres or 0),
            "total_cost": float(r.total_cost or 0),
            "avg_mileage_kmpl": float(r.avg_mileage or 0),
            "refill_count": r.refill_count,
        })
    return result


def _maintenance_cost_data(db: Session) -> list[dict]:
    """Per-vehicle maintenance cost breakdown."""
    rows = (
        db.query(
            VehicleMaintenance.vehicle_id,
            VehicleMaintenance.maintenance_type,
            func.sum(VehicleMaintenance.cost).label("total_cost"),
            func.count(VehicleMaintenance.maintenance_id).label("count"),
        )
        .group_by(VehicleMaintenance.vehicle_id, VehicleMaintenance.maintenance_type)
        .all()
    )
    result = []
    for r in rows:
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == r.vehicle_id).first()
        reg = vehicle.registration_number if vehicle else str(r.vehicle_id)
        result.append({
            "vehicle": reg,
            "maintenance_type": r.maintenance_type or "General",
            "total_cost": float(r.total_cost or 0),
            "count": r.count,
        })
    return result


def _driver_performance_data(db: Session, current_user: Optional[User] = None) -> list[dict]:
    """Driver performance: trips, on-time rate, attendance."""
    if current_user and current_user.role == RoleEnum.Driver:
        drivers = db.query(Driver).filter(Driver.user_id == current_user.user_id).all()
    else:
        drivers = db.query(Driver).all()
    result = []
    for driver in drivers:
        user = db.query(User).filter(User.user_id == driver.user_id).first()
        total_trips = db.query(Trip).filter(Trip.driver_id == driver.driver_id).count()

        completed = db.query(Trip).filter(
            Trip.driver_id == driver.driver_id,
            Trip.status == TripStatus.Completed
        ).count()
        on_time = db.query(Trip).filter(
            Trip.driver_id == driver.driver_id,
            Trip.status == TripStatus.Completed,
            Trip.end_time != None,
            Trip.eta != None,
            Trip.end_time <= Trip.eta,
        ).count()
        on_time_rate = round((on_time / completed) * 100, 1) if completed > 0 else None

        # Attendance this month
        today = date.today()
        month_start = today.replace(day=1)
        present_count = db.query(Attendance).filter(
            Attendance.driver_id == driver.driver_id,
            Attendance.attendance_date >= month_start,
            Attendance.status == "Present",
        ).count()
        total_att = db.query(Attendance).filter(
            Attendance.driver_id == driver.driver_id,
            Attendance.attendance_date >= month_start,
        ).count()

        result.append({
            "driver": user.full_name if user else "Unknown",
            "license": driver.license_number,
            "status": driver.status,
            "total_trips": total_trips,
            "completed_trips": completed,
            "on_time_rate_percent": on_time_rate,
            "attendance_this_month": f"{present_count}/{total_att}" if total_att > 0 else "N/A",
        })
    return result


def _delivery_performance_data(db: Session) -> dict:
    """Delivery performance metrics."""
    total = db.query(Shipment).count()
    delivered = db.query(Shipment).filter(Shipment.status == ShipmentStatus.Delivered).count()
    delayed = db.query(Shipment).filter(Shipment.status == ShipmentStatus.Delayed).count()
    in_transit = db.query(Shipment).filter(Shipment.status == ShipmentStatus.InTransit).count()
    cancelled = db.query(Shipment).filter(Shipment.status == ShipmentStatus.Cancelled).count()

    completed_trips = db.query(Trip).filter(
        Trip.status == TripStatus.Completed,
        Trip.start_time != None,
        Trip.end_time != None,
    ).all()
    avg_hrs = None
    on_time_rate = None
    if completed_trips:
        durations = [(t.end_time - t.start_time).total_seconds() / 3600 for t in completed_trips]
        avg_hrs = round(sum(durations) / len(durations), 2)
        on_time = sum(1 for t in completed_trips if t.eta and t.end_time and t.end_time <= t.eta)
        on_time_rate = round((on_time / len(completed_trips)) * 100, 1)

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "total_shipments": total,
        "delivered": delivered,
        "delayed": delayed,
        "in_transit": in_transit,
        "cancelled": cancelled,
        "avg_delivery_hours": avg_hrs,
        "on_time_rate_percent": on_time_rate,
    }


# ---------------------------------------------------------------------------
# PDF builders
# ---------------------------------------------------------------------------

def _pdf_table(elements, data_rows, col_widths, header_color, row_color1, row_color2):
    """Helper to add a styled table to reportlab elements."""
    from reportlab.platypus import Table, TableStyle
    from reportlab.lib import colors

    t = Table(data_rows, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(header_color)),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor(row_color1), colors.white]),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(t)


def _build_fleet_pdf(data: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("T", parent=styles["Title"], fontSize=20, textColor=colors.HexColor("#1a237e"), spaceAfter=10)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=13, textColor=colors.HexColor("#283593"), spaceBefore=14, spaceAfter=6)
    body = styles["BodyText"]
    elements = []

    elements.append(Paragraph("FleetFlow — Fleet Summary Report", title_style))
    elements.append(Paragraph(f"Generated: {data['generated_at']}", body))
    elements.append(Spacer(1, 10))

    # Fleet
    elements.append(Paragraph("Fleet Overview", h2))
    fleet_rows = [
        ["Metric", "Value"],
        ["Total Vehicles", str(data["fleet"]["total_vehicles"])],
        ["Utilization %", f"{data['fleet'].get('utilization_percent', round(sum(data['fleet']['by_status'].values()) / data['fleet']['total_vehicles'] * 100, 2))}%"],
        ["Total Drivers", str(data["drivers"]["total"])]
    ]
    for s, c in data["fleet"]["by_status"].items():
        fleet_rows.append([f"  {s}", str(c)])
    _pdf_table(elements, fleet_rows, [130 * mm, 40 * mm], "#3949ab", "#e8eaf6", "#ffffff")
    elements.append(Spacer(1, 8))

    # Shipments
    elements.append(Paragraph("Shipments & Trips", h2))
    st_rows = [["Metric", "Value"],
               ["Total Shipments", str(data["shipments"]["total"])],
               ["Delivered", str(data["shipments"]["delivered"])],
               ["In Transit", str(data["shipments"]["in_transit"])],
               ["Total Trips", str(data["trips"]["total"])],
               ["Completed Trips", str(data["trips"]["completed"])]]
    _pdf_table(elements, st_rows, [130 * mm, 40 * mm], "#00695c", "#e0f2f1", "#ffffff")
    elements.append(Spacer(1, 8))

    # Costs
    elements.append(Paragraph("Operational Costs", h2))
    cost_rows = [["Metric", "Value"],
                 ["Total Fuel Cost", f"₹{data['fuel']['total_cost']:,.2f}"],
                 ["Total Maintenance Cost", f"₹{data['maintenance']['total_cost']:,.2f}"],
                 ["Total Operational Cost", f"₹{data['total_operational_cost']:,.2f}"]]
    _pdf_table(elements, cost_rows, [130 * mm, 40 * mm], "#4a148c", "#f3e5f5", "#ffffff")

    doc.build(elements)
    return buf.getvalue()


_build_pdf = _build_fleet_pdf


def _build_fuel_pdf(rows: list) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("T", parent=styles["Title"], fontSize=20, textColor=colors.HexColor("#1a237e"), spaceAfter=10)
    elements = []
    elements.append(Paragraph("FleetFlow — Fuel Consumption Report", title_style))
    elements.append(Paragraph(f"Generated: {datetime.utcnow().isoformat()}", styles["BodyText"]))
    elements.append(Spacer(1, 10))

    table_data = [["Vehicle", "Refills", "Total Litres", "Total Cost (₹)", "Avg km/L"]]
    for r in rows:
        table_data.append([
            r["vehicle"], str(r["refill_count"]),
            f"{r['total_litres']:.2f}", f"₹{r['total_cost']:,.2f}",
            f"{r['avg_mileage_kmpl']:.2f}",
        ])
    _pdf_table(elements, table_data, [50*mm, 20*mm, 30*mm, 40*mm, 30*mm], "#00695c", "#e0f2f1", "#ffffff")
    doc.build(elements)
    return buf.getvalue()


def _build_maintenance_pdf(rows: list) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("T", parent=styles["Title"], fontSize=20, textColor=colors.HexColor("#1a237e"), spaceAfter=10)
    elements = []
    elements.append(Paragraph("FleetFlow — Maintenance Cost Report", title_style))
    elements.append(Paragraph(f"Generated: {datetime.utcnow().isoformat()}", styles["BodyText"]))
    elements.append(Spacer(1, 10))

    table_data = [["Vehicle", "Maintenance Type", "Count", "Total Cost (₹)"]]
    for r in rows:
        table_data.append([r["vehicle"], r["maintenance_type"], str(r["count"]), f"₹{r['total_cost']:,.2f}"])
    _pdf_table(elements, table_data, [50*mm, 60*mm, 20*mm, 40*mm], "#e65100", "#fff3e0", "#ffffff")
    doc.build(elements)
    return buf.getvalue()


def _build_driver_performance_pdf(rows: list) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("T", parent=styles["Title"], fontSize=20, textColor=colors.HexColor("#1a237e"), spaceAfter=10)
    elements = []
    elements.append(Paragraph("FleetFlow — Driver Performance Report", title_style))
    elements.append(Paragraph(f"Generated: {datetime.utcnow().isoformat()}", styles["BodyText"]))
    elements.append(Spacer(1, 10))

    table_data = [["Driver", "License", "Status", "Trips", "Completed", "On-Time %", "Attendance"]]
    for r in rows:
        table_data.append([
            r["driver"], r["license"], r["status"] or "N/A",
            str(r["total_trips"]), str(r["completed_trips"]),
            f"{r['on_time_rate_percent'] or 0}%",
            r["attendance_this_month"],
        ])
    _pdf_table(elements, table_data, [35*mm, 30*mm, 20*mm, 15*mm, 25*mm, 20*mm, 25*mm], "#283593", "#e8eaf6", "#ffffff")
    doc.build(elements)
    return buf.getvalue()


def _build_delivery_pdf(data: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("T", parent=styles["Title"], fontSize=20, textColor=colors.HexColor("#1a237e"), spaceAfter=10)
    elements = []
    elements.append(Paragraph("FleetFlow — Delivery Performance Report", title_style))
    elements.append(Paragraph(f"Generated: {data['generated_at']}", styles["BodyText"]))
    elements.append(Spacer(1, 10))

    table_data = [
        ["Metric", "Value"],
        ["Total Shipments", str(data["total_shipments"])],
        ["Delivered", str(data["delivered"])],
        ["In Transit", str(data["in_transit"])],
        ["Delayed", str(data["delayed"])],
        ["Cancelled", str(data["cancelled"])],
        ["Avg Delivery (hrs)", str(data["avg_delivery_hours"] or "N/A")],
        ["On-Time Rate", f"{data['on_time_rate_percent'] or 0}%"],
    ]
    _pdf_table(elements, table_data, [130*mm, 40*mm], "#00695c", "#e0f2f1", "#ffffff")
    doc.build(elements)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Excel builders
# ---------------------------------------------------------------------------

def _build_excel(sheet_name: str, headers: list, rows: list) -> bytes:
    """Generic Excel builder using openpyxl."""
    try:
        from openpyxl import Workbook
        from openpyxl.styles import PatternFill, Font, Alignment
        wb = Workbook()
        ws = wb.active
        ws.title = sheet_name

        header_fill = PatternFill("solid", fgColor="1A237E")
        header_font = Font(color="FFFFFF", bold=True)
        ws.append(headers)
        for cell in ws[1]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center")

        for row in rows:
            ws.append(row)

        # Auto-width
        for col in ws.columns:
            max_len = max(len(str(c.value or "")) for c in col) + 4
            ws.column_dimensions[col[0].column_letter].width = min(max_len, 40)

        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()
    except ImportError:
        # Fallback: CSV bytes
        import csv
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(headers)
        writer.writerows(rows)
        return buf.getvalue().encode()


# ---------------------------------------------------------------------------
# Helper: streaming response
# ---------------------------------------------------------------------------

def _pdf_response(pdf_bytes: bytes, filename: str) -> StreamingResponse:
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _excel_response(excel_bytes: bytes, filename: str) -> StreamingResponse:
    media_type = (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if filename.endswith(".xlsx") else "text/csv"
    )
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Fleet Summary
# ---------------------------------------------------------------------------

@router.get("/fleet-summary")
@router.get("/json")
def fleet_summary_json(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    """Fleet summary as JSON — used by frontend report preview."""
    return _fleet_summary_data(db)


@router.get("/fleet-summary-pdf")
@router.get("/pdf")
def fleet_summary_pdf(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    """Generate and stream the fleet summary PDF."""
    data = _fleet_summary_data(db)
    try:
        pdf_bytes = _build_fleet_pdf(data)
    except ImportError:
        return data
    return _pdf_response(pdf_bytes, f"FleetFlow_Fleet_Report_{date.today()}.pdf")


@router.get("/fleet-summary-excel")
def fleet_summary_excel(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    data = _fleet_summary_data(db)
    headers = ["Metric", "Value"]
    rows = [
        ["Total Vehicles", data["fleet"]["total_vehicles"]],
        ["Fleet Utilization %", data["fleet"]["utilization_percent"]],
        ["Total Drivers", data["drivers"]["total"]],
        ["Total Shipments", data["shipments"]["total"]],
        ["Delivered", data["shipments"]["delivered"]],
        ["Total Fuel Cost (₹)", data["fuel"]["total_cost"]],
        ["Total Maintenance Cost (₹)", data["maintenance"]["total_cost"]],
        ["Total Operational Cost (₹)", data["total_operational_cost"]],
    ]
    excel_bytes = _build_excel("Fleet Summary", headers, rows)
    return _excel_response(excel_bytes, f"FleetFlow_Fleet_{date.today()}.xlsx")


# ---------------------------------------------------------------------------
# Fuel Consumption
# ---------------------------------------------------------------------------

@router.get("/fuel-data")
def fuel_data_json(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    return _fuel_data(db)


@router.get("/fuel-pdf")
def fuel_pdf(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    rows = _fuel_data(db)
    try:
        pdf_bytes = _build_fuel_pdf(rows)
    except ImportError:
        return rows
    return _pdf_response(pdf_bytes, f"FleetFlow_Fuel_{date.today()}.pdf")


@router.get("/fuel-excel")
def fuel_excel(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    rows = _fuel_data(db)
    headers = ["Vehicle", "Refills", "Total Litres", "Total Cost (₹)", "Avg km/L"]
    data_rows = [[r["vehicle"], r["refill_count"], r["total_litres"], r["total_cost"], r["avg_mileage_kmpl"]] for r in rows]
    excel_bytes = _build_excel("Fuel Consumption", headers, data_rows)
    return _excel_response(excel_bytes, f"FleetFlow_Fuel_{date.today()}.xlsx")


# ---------------------------------------------------------------------------
# Maintenance Cost
# ---------------------------------------------------------------------------

@router.get("/maintenance-data")
def maintenance_data_json(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    return _maintenance_cost_data(db)


@router.get("/maintenance-cost-pdf")
def maintenance_cost_pdf(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    rows = _maintenance_cost_data(db)
    try:
        pdf_bytes = _build_maintenance_pdf(rows)
    except ImportError:
        return rows
    return _pdf_response(pdf_bytes, f"FleetFlow_Maintenance_{date.today()}.pdf")


@router.get("/maintenance-excel")
def maintenance_excel(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    rows = _maintenance_cost_data(db)
    headers = ["Vehicle", "Maintenance Type", "Count", "Total Cost (₹)"]
    data_rows = [[r["vehicle"], r["maintenance_type"], r["count"], r["total_cost"]] for r in rows]
    excel_bytes = _build_excel("Maintenance Cost", headers, data_rows)
    return _excel_response(excel_bytes, f"FleetFlow_Maintenance_{date.today()}.xlsx")


# ---------------------------------------------------------------------------
# Driver Performance
# ---------------------------------------------------------------------------

@router.get("/driver-performance-data")
def driver_perf_json(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager, RoleEnum.Driver)),
):
    return _driver_performance_data(db, current_user=current_user)



@router.get("/driver-performance-pdf")
def driver_performance_pdf(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    rows = _driver_performance_data(db)
    try:
        pdf_bytes = _build_driver_performance_pdf(rows)
    except ImportError:
        return rows
    return _pdf_response(pdf_bytes, f"FleetFlow_DriverPerf_{date.today()}.pdf")


@router.get("/driver-performance-excel")
def driver_performance_excel(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    rows = _driver_performance_data(db)
    headers = ["Driver", "License", "Status", "Total Trips", "Completed", "On-Time %", "Attendance (Month)"]
    data_rows = [[r["driver"], r["license"], r["status"], r["total_trips"], r["completed_trips"], r["on_time_rate_percent"], r["attendance_this_month"]] for r in rows]
    excel_bytes = _build_excel("Driver Performance", headers, data_rows)
    return _excel_response(excel_bytes, f"FleetFlow_DriverPerf_{date.today()}.xlsx")


# ---------------------------------------------------------------------------
# Delivery Performance (Dispatcher can access this one)
# ---------------------------------------------------------------------------

@router.get("/delivery-data")
def delivery_data_json(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager, RoleEnum.Dispatcher)),
):
    return _delivery_performance_data(db)


@router.get("/delivery-performance-pdf")
def delivery_performance_pdf(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager, RoleEnum.Dispatcher)),
):
    data = _delivery_performance_data(db)
    try:
        pdf_bytes = _build_delivery_pdf(data)
    except ImportError:
        return data
    return _pdf_response(pdf_bytes, f"FleetFlow_Delivery_{date.today()}.pdf")


@router.get("/delivery-performance-excel")
def delivery_performance_excel(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager, RoleEnum.Dispatcher)),
):
    data = _delivery_performance_data(db)
    headers = ["Metric", "Value"]
    rows_data = [
        ["Total Shipments", data["total_shipments"]],
        ["Delivered", data["delivered"]],
        ["In Transit", data["in_transit"]],
        ["Delayed", data["delayed"]],
        ["Cancelled", data["cancelled"]],
        ["Avg Delivery (hrs)", data["avg_delivery_hours"]],
        ["On-Time Rate %", data["on_time_rate_percent"]],
    ]
    excel_bytes = _build_excel("Delivery Performance", headers, rows_data)
    return _excel_response(excel_bytes, f"FleetFlow_Delivery_{date.today()}.xlsx")
