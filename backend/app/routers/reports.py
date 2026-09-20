import io
import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from database import get_db

from app.models.user import User, RoleEnum
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.shipment import Shipment
from app.models.trip import Trip
from app.models.fuel_record import FuelRecord
from app.models.maintenance import VehicleMaintenance
from app.models.attendance import Attendance
from app.core.security import get_current_user, require_roles

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

router = APIRouter(
    prefix="/reports",
    tags=["Reports & Export"]
)


# Helper to check report permissions per role
def check_report_permission(current_user: User, report_type: str):
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_str == "Driver":
        if report_type != "driver-performance":
            raise HTTPException(status_code=403, detail="Access denied: Drivers can only view their own personal performance summary.")
    elif role_str == "Dispatcher":
        if report_type != "delivery-performance":
            raise HTTPException(status_code=403, detail="Access denied: Dispatchers can only access Delivery Performance Reports.")


# ---------------------------------------------------------
# 1. Fleet Utilization Report
# ---------------------------------------------------------
@router.get("/fleet-utilization")
def get_fleet_utilization_report(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_report_permission(current_user, "fleet-utilization")
    vehicles = db.query(Vehicle).all()
    total_vehicles = len(vehicles)
    
    breakdown = {"Available": 0, "Assigned": 0, "In Transit": 0, "Maintenance": 0}
    details = []

    d_start = datetime.datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else None
    d_end = datetime.datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else None

    for v in vehicles:
        st = v.status or "Available"
        if st in breakdown:
            breakdown[st] += 1
        else:
            breakdown["Available"] += 1

        t_query = db.query(Trip).filter(Trip.vehicle_id == v.vehicle_id)
        if d_start:
            t_query = t_query.filter(Trip.start_time >= d_start)
        if d_end:
            t_query = t_query.filter(Trip.start_time <= d_end + datetime.timedelta(days=1))
        trips_count = t_query.count()

        details.append({
            "vehicle_id": str(v.vehicle_id),
            "registration_number": v.registration_number,
            "type": v.vehicle_type,
            "status": v.status,
            "model": v.model or "N/A",
            "capacity_tonnes": float(v.capacity or 0.0),
            "total_trips": trips_count
        })

    active_count = breakdown["Assigned"] + breakdown["In Transit"]
    rate = round((active_count / total_vehicles) * 100.0, 1) if total_vehicles > 0 else 0.0

    return {
        "report_title": "Fleet Utilization Report",
        "generated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "date_range": f"{start_date or 'All time'} to {end_date or 'Present'}",
        "total_vehicles": total_vehicles,
        "active_vehicles": active_count,
        "utilization_rate_pct": rate,
        "status_breakdown": breakdown,
        "details": details
    }


# ---------------------------------------------------------
# 2. Fuel Consumption Report
# ---------------------------------------------------------
@router.get("/fuel-consumption")
def get_fuel_consumption_report(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_report_permission(current_user, "fuel-consumption")
    query = db.query(FuelRecord)

    if start_date:
        try:
            d_start = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
            query = query.filter(FuelRecord.refill_date >= d_start)
        except ValueError:
            pass

    if end_date:
        try:
            d_end = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()
            query = query.filter(FuelRecord.refill_date <= d_end)
        except ValueError:
            pass

    records = query.order_by(FuelRecord.recorded_at.desc()).all()
    
    total_cost = sum(float(r.cost or 0.0) for r in records)
    total_liters = sum(float(r.amount or 0.0) for r in records)

    details = []
    for r in records:
        v = db.query(Vehicle).filter(Vehicle.vehicle_id == r.vehicle_id).first()
        d_name = "Unassigned"
        if r.driver_id:
            d = db.query(Driver).filter(Driver.driver_id == r.driver_id).first()
            if d and d.user_id:
                u = db.query(User).filter(User.user_id == d.user_id).first()
                if u:
                    d_name = u.full_name

        details.append({
            "fuel_id": str(r.fuel_id),
            "vehicle_reg": v.registration_number if v else "Unknown",
            "driver_name": d_name,
            "refill_date": r.refill_date.isoformat() if r.refill_date else "N/A",
            "fuel_amount_liters": float(r.amount or 0.0),
            "cost_inr": float(r.cost or 0.0),
            "mileage": float(r.mileage or 0.0)
        })

    return {
        "report_title": "Fuel Consumption Report",
        "generated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "date_range": f"{start_date or 'All time'} to {end_date or 'Present'}",
        "total_records": len(records),
        "total_fuel_liters": round(total_liters, 2),
        "total_cost_inr": round(total_cost, 2),
        "details": details
    }


# ---------------------------------------------------------
# 3. Driver Performance Report
# ---------------------------------------------------------
@router.get("/driver-performance")
def get_driver_performance_report(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    driver_id: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_report_permission(current_user, "driver-performance")
    
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    drivers_query = db.query(Driver, User).join(User, Driver.user_id == User.user_id)

    if role_str == "Driver":
        drivers_query = drivers_query.filter(Driver.user_id == current_user.user_id)
    elif driver_id and isinstance(driver_id, str):
        try:
            d_uuid = uuid.UUID(driver_id)
            drivers_query = drivers_query.filter(Driver.driver_id == d_uuid)
        except ValueError:
            pass

    results = drivers_query.all()
    details = []

    d_start = datetime.datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else None
    d_end = datetime.datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else None

    for d, u in results:
        t_query = db.query(Trip).filter(Trip.driver_id == d.driver_id)
        if d_start:
            t_query = t_query.filter(Trip.start_time >= d_start)
        if d_end:
            t_query = t_query.filter(Trip.start_time <= d_end + datetime.timedelta(days=1))
        total_trips = t_query.count()
        completed_trips = t_query.filter(Trip.status == "Completed").count()
        
        # Attendance calculation
        att_query = db.query(Attendance).filter(Attendance.driver_id == d.driver_id)
        if d_start:
            att_query = att_query.filter(Attendance.date >= d_start)
        if d_end:
            att_query = att_query.filter(Attendance.date <= d_end)
        
        present_count = att_query.filter(Attendance.status == "Present").count()
        
        if d_start and d_end:
            period_days = max(1, (d_end - d_start).days + 1)
        elif d_start:
            period_days = max(1, (datetime.date.today() - d_start).days + 1)
        else:
            total_records = att_query.count()
            period_days = max(1, total_records) if total_records > 0 else 7

        attendance_pct = round((present_count / period_days) * 100.0, 1) if period_days > 0 else 100.0
        attendance_str = f"{present_count}/{period_days} days present ({min(100.0, attendance_pct)}%)"

        # On-time delivery rate
        s_query = db.query(Shipment).filter(Shipment.driver_id == d.driver_id)
        if d_start:
            s_query = s_query.filter(Shipment.created_at >= d_start)
        if d_end:
            s_query = s_query.filter(Shipment.created_at <= d_end + datetime.timedelta(days=1))
        total_shipments = s_query.filter(Shipment.status == "Delivered").count()
        delayed_shipments = s_query.filter(Shipment.status == "Delayed").count()
        on_time_rate = round(((total_shipments - delayed_shipments) / total_shipments) * 100.0, 1) if total_shipments > 0 else 100.0

        details.append({
            "driver_id": str(d.driver_id),
            "driver_name": u.full_name,
            "license_number": d.license_number or "N/A",
            "phone": u.phone or "N/A",
            "status": d.status or "Active",
            "total_trips": total_trips,
            "completed_trips": completed_trips,
            "days_present": present_count,
            "period_days": period_days,
            "attendance_rate": attendance_str,
            "attendance_rate_pct": min(100.0, attendance_pct),
            "on_time_rate_pct": max(0.0, on_time_rate)
        })

    return {
        "report_title": "Driver Performance Report",
        "generated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "date_range": f"{start_date or 'All time'} to {end_date or 'Present'}",
        "total_drivers": len(details),
        "details": details
    }


# ---------------------------------------------------------
# 4. Delivery Performance Report
# ---------------------------------------------------------
@router.get("/delivery-performance")
def get_delivery_performance_report(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_report_permission(current_user, "delivery-performance")
    query = db.query(Shipment)

    if start_date:
        try:
            d_start = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
            query = query.filter(Shipment.created_at >= d_start)
        except ValueError:
            pass

    if end_date:
        try:
            d_end = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()
            query = query.filter(Shipment.created_at <= d_end + datetime.timedelta(days=1))
        except ValueError:
            pass

    shipments = query.order_by(Shipment.created_at.desc()).all()
    total_shipments = len(shipments)

    breakdown = {"Created": 0, "Assigned": 0, "In Transit": 0, "Delivered": 0, "Delayed": 0, "Cancelled": 0}
    details = []

    for s in shipments:
        st = s.status or "Created"
        if st in breakdown:
            breakdown[st] += 1

        v_reg = "Unassigned"
        if s.vehicle_id:
            v = db.query(Vehicle).filter(Vehicle.vehicle_id == s.vehicle_id).first()
            if v:
                v_reg = v.registration_number

        details.append({
            "shipment_id": str(s.shipment_id),
            "tracking_number": s.tracking_number,
            "customer_name": s.customer_name,
            "source": s.source,
            "destination": s.destination,
            "weight": float(s.shipment_weight or 0.0),
            "vehicle_reg": v_reg,
            "status": s.status
        })

    delivered = breakdown["Delivered"]
    delayed = breakdown["Delayed"]
    on_time_rate = round(((delivered - delayed) / delivered) * 100.0, 1) if delivered > 0 else 100.0

    return {
        "report_title": "Delivery Performance Report",
        "generated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "date_range": f"{start_date or 'All time'} to {end_date or 'Present'}",
        "total_shipments": total_shipments,
        "delivered_shipments": delivered,
        "delayed_shipments": delayed,
        "on_time_rate_pct": max(0.0, on_time_rate),
        "status_breakdown": breakdown,
        "details": details
    }


# ---------------------------------------------------------
# 5. Maintenance Report
# ---------------------------------------------------------
@router.get("/maintenance")
def get_maintenance_report(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_report_permission(current_user, "maintenance")
    query = db.query(VehicleMaintenance)

    if start_date:
        try:
            d_start = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
            query = query.filter(VehicleMaintenance.service_date >= d_start)
        except ValueError:
            pass

    if end_date:
        try:
            d_end = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()
            query = query.filter(VehicleMaintenance.service_date <= d_end)
        except ValueError:
            pass

    records = query.order_by(VehicleMaintenance.service_date.desc()).all()
    
    total_cost = sum(float(r.cost or 0.0) for r in records)
    type_counts = {}
    details = []

    for r in records:
        c = float(r.cost or 0.0)
        t = r.maintenance_type or "General Service"
        type_counts[t] = type_counts.get(t, 0) + 1

        v_reg = "Unknown"
        if r.vehicle_id:
            v = db.query(Vehicle).filter(Vehicle.vehicle_id == r.vehicle_id).first()
            if v:
                v_reg = v.registration_number

        details.append({
            "maintenance_id": str(r.maintenance_id),
            "vehicle_reg": v_reg,
            "maintenance_type": t,
            "service_date": r.service_date.isoformat() if hasattr(r.service_date, "isoformat") else str(r.service_date),
            "next_service_date": r.next_service_date.isoformat() if hasattr(r.next_service_date, "isoformat") else str(r.next_service_date),
            "cost_inr": c,
            "resolution_status": getattr(r, "resolution_status", "Unresolved") or "Unresolved",
            "status": r.status or "Completed",
            "remarks": r.remarks or ""
        })

    return {
        "report_title": "Vehicle Maintenance Report",
        "generated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "date_range": f"{start_date or 'All time'} to {end_date or 'Present'}",
        "total_records": len(records),
        "total_maintenance_cost_inr": round(total_cost, 2),
        "type_counts": type_counts,
        "details": details
    }


# ---------------------------------------------------------
# PDF Export Endpoint
# ---------------------------------------------------------
@router.get("/{report_type}/export/pdf")
def export_report_pdf(
    report_type: str,
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_report_permission(current_user, report_type)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
    styles = getSampleStyleSheet()
    story = []

    # Title
    title_style = ParagraphStyle(
        'ReportTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=12
    )
    
    rep_title = f"{report_type.replace('-', ' ').title()} Report"
    story.append(Paragraph(f"<b>FleetFlow Management System</b>", styles['Normal']))
    story.append(Paragraph(f"<b>{rep_title}</b>", title_style))
    date_str_banner = f"Period: {start_date or 'Start'} to {end_date or 'End'}" if (start_date or end_date) else "Period: All Time"
    story.append(Paragraph(f"Generated On: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | {date_str_banner}", styles['Normal']))
    story.append(Spacer(1, 15))

    # Fetch Data
    if report_type == "fleet-utilization":
        data = get_fleet_utilization_report(start_date=start_date, end_date=end_date, current_user=current_user, db=db)
        headers = ["Vehicle Reg", "Type", "Status", "Capacity", "Trips"]
        rows = [[d["registration_number"], d["type"], d["status"], f"{d['capacity_tonnes']} T", str(d["total_trips"])] for d in data["details"]]
    elif report_type == "fuel-consumption":
        data = get_fuel_consumption_report(start_date=start_date, end_date=end_date, current_user=current_user, db=db)
        headers = ["Vehicle Reg", "Driver", "Date", "Liters", "Cost (INR)"]
        rows = [[d["vehicle_reg"], d["driver_name"], d["refill_date"], f"{d['fuel_amount_liters']} L", f"₹{d['cost_inr']:,.2f}"] for d in data["details"]]
    elif report_type == "driver-performance":
        data = get_driver_performance_report(start_date=start_date, end_date=end_date, current_user=current_user, db=db)
        headers = ["Driver Name", "Licence Number", "Trips Completed", "Attendance Rate (Days Present)", "On-Time Rate (%)"]
        rows = [[d["driver_name"], d["license_number"], str(d["completed_trips"]), d["attendance_rate"], f"{d['on_time_rate_pct']}%"] for d in data["details"]]
    elif report_type == "delivery-performance":
        data = get_delivery_performance_report(start_date=start_date, end_date=end_date, current_user=current_user, db=db)
        headers = ["Tracking #", "Customer", "Source → Dest", "Vehicle", "Status"]
        rows = [[d["tracking_number"], d["customer_name"], f"{d['source']} → {d['destination']}", d["vehicle_reg"], d["status"]] for d in data["details"]]
    elif report_type == "maintenance":
        data = get_maintenance_report(start_date=start_date, end_date=end_date, current_user=current_user, db=db)
        headers = ["Vehicle Reg", "Type", "Service Date", "Cost (INR)", "Resolution"]
        rows = [[d["vehicle_reg"], d["maintenance_type"], d["service_date"], f"₹{d['cost_inr']:,.2f}", d["resolution_status"]] for d in data["details"]]
    else:
        raise HTTPException(status_code=400, detail="Invalid report type")

    table_data = [headers] + rows
    t = Table(table_data)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0284c7')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
    ]))

    story.append(t)
    doc.build(story)

    buffer.seek(0)
    pdf_bytes = buffer.getvalue()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={report_type}_report.pdf"}
    )


# ---------------------------------------------------------
# Excel Export Endpoint
# ---------------------------------------------------------
@router.get("/{report_type}/export/excel")
def export_report_excel(
    report_type: str,
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_report_permission(current_user, report_type)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = report_type.replace('-', ' ').title()

    # Header styling
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    align_center = Alignment(horizontal="center", vertical="center")

    if report_type == "fleet-utilization":
        data = get_fleet_utilization_report(start_date=start_date, end_date=end_date, current_user=current_user, db=db)
        headers = ["Vehicle Registration", "Vehicle Type", "Status", "Capacity (Tonnes)", "Total Trips"]
        ws.append(headers)
        for d in data["details"]:
            ws.append([d["registration_number"], d["type"], d["status"], d["capacity_tonnes"], d["total_trips"]])

    elif report_type == "fuel-consumption":
        data = get_fuel_consumption_report(start_date=start_date, end_date=end_date, current_user=current_user, db=db)
        headers = ["Vehicle Registration", "Driver Name", "Refill Date", "Fuel Amount (Liters)", "Cost (INR)", "Mileage (km/l)"]
        ws.append(headers)
        for d in data["details"]:
            ws.append([d["vehicle_reg"], d["driver_name"], d["refill_date"], d["fuel_amount_liters"], d["cost_inr"], d["mileage"]])

    elif report_type == "driver-performance":
        data = get_driver_performance_report(start_date=start_date, end_date=end_date, current_user=current_user, db=db)
        headers = ["Driver Name", "Licence Number", "Trips Completed", "Days Present", "Period Total Days", "Attendance Rate", "On-Time Rate (%)"]
        ws.append(headers)
        for d in data["details"]:
            ws.append([d["driver_name"], d["license_number"], d["completed_trips"], d["days_present"], d["period_days"], d["attendance_rate"], f"{d['on_time_rate_pct']}%"])

    elif report_type == "delivery-performance":
        data = get_delivery_performance_report(start_date=start_date, end_date=end_date, current_user=current_user, db=db)
        headers = ["Tracking Number", "Customer Name", "Source", "Destination", "Weight (kg)", "Vehicle Registration", "Status"]
        ws.append(headers)
        for d in data["details"]:
            ws.append([d["tracking_number"], d["customer_name"], d["source"], d["destination"], d["weight"], d["vehicle_reg"], d["status"]])

    elif report_type == "maintenance":
        data = get_maintenance_report(start_date=start_date, end_date=end_date, current_user=current_user, db=db)
        headers = ["Vehicle Registration", "Maintenance Type", "Service Date", "Next Service Date", "Cost (INR)", "Resolution Status", "Remarks"]
        ws.append(headers)
        for d in data["details"]:
            ws.append([d["vehicle_reg"], d["maintenance_type"], d["service_date"], d["next_service_date"], d["cost_inr"], d["resolution_status"], d["remarks"]])
    else:
        raise HTTPException(status_code=400, detail="Invalid report type")

    # Apply header formatting
    for cell in ws[1]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = align_center

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    excel_bytes = buffer.getvalue()

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={report_type}_report.xlsx"}
    )
