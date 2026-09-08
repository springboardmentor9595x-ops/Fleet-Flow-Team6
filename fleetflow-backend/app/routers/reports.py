"""
Operational analytics endpoints for FleetFlow.
All metrics are computed from the internal PostgreSQL database — no external APIs required.
"""

import datetime
import csv
import io
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import func, case, text

from database import get_db
from app.core.security import require_roles, get_current_user
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.trip import Trip
from app.models.shipment import Shipment
from app.models.maintenance import VehicleMaintenance
from app.models.fuel_record import FuelRecord
from app.models.notification import Notification
from app.models.attendance import Attendance

router = APIRouter(
    prefix="/reports",
    tags=["Analytics & Reports"],
)


# ----------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------

def _on_time_stats(db: Session):
    """Return (on_time_count, total_completed, on_time_rate%) from trips table."""
    completed = db.query(Trip).filter(Trip.status == "completed").all()
    on_time = sum(
        1 for t in completed
        if t.start_time and t.end_time and t.distance
        and (t.end_time - t.start_time).total_seconds() / 3600.0 <= float(t.distance) / 30.0
    ) if completed else 0
    total = len(completed)
    rate = round((on_time / total) * 100, 1) if total else 100.0
    return on_time, total, rate


# ----------------------------------------------------------------
# GET /reports/operational-summary
# ----------------------------------------------------------------
@router.get("/operational-summary")
def get_operational_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Single aggregated endpoint that powers the Reports page."""
    # Vehicles
    total_vehicles = db.query(Vehicle).count()
    available = db.query(Vehicle).filter(Vehicle.status == "Available").count()
    in_transit = db.query(Vehicle).filter(Vehicle.status == "In Transit").count()
    maintenance_count = db.query(Vehicle).filter(Vehicle.status == "Maintenance").count()
    assigned = db.query(Vehicle).filter(Vehicle.status == "Assigned").count()
    utilization_pct = round(((total_vehicles - available) / total_vehicles * 100), 1) if total_vehicles else 0.0

    # Trips / distance
    all_trips = db.query(Trip).all()
    completed_trips = [t for t in all_trips if t.status == "completed"]
    total_distance = sum(float(t.distance or 0) for t in completed_trips)
    avg_trip_distance = round(total_distance / len(completed_trips), 1) if completed_trips else 0.0
    active_trips_count = sum(1 for t in all_trips if t.status == "active")
    pending_trips_count = sum(1 for t in all_trips if t.status == "pending")

    # On-time rate
    _, total_completed, on_time_rate = _on_time_stats(db)

    # Shipments
    total_shipments = db.query(Shipment).count()
    delivered = db.query(Shipment).filter(Shipment.status == "Delivered").count()
    delayed = db.query(Shipment).filter(Shipment.status == "Delayed").count()
    in_transit_ship = db.query(Shipment).filter(Shipment.status == "In Transit").count()
    delivery_rate = round((delivered / total_shipments * 100), 1) if total_shipments else 0.0

    # Maintenance
    overdue_count = 0
    try:
        overdue_count = db.execute(
            text("SELECT COUNT(*) FROM vehicle_maintenance WHERE status = 'pending' AND next_service_date < CURRENT_DATE")
        ).scalar() or 0
    except Exception:
        pass

    total_maintenance_cost = db.query(func.sum(VehicleMaintenance.cost)).scalar() or 0.0

    # Fuel
    total_fuel_liters = db.query(func.sum(FuelRecord.fuel_amount)).scalar() or 0.0
    total_fuel_cost = db.query(func.sum(FuelRecord.fuel_cost)).scalar() or 0.0

    # Drivers
    total_drivers = db.query(Driver).count()
    active_drivers = db.query(Driver).filter(Driver.status == "Active").count()

    # Build per-vehicle trip stats (for charts)
    trip_stats = []
    vehicles = db.query(Vehicle).all()
    for v in vehicles:
        v_trips = [t for t in completed_trips if t.vehicle_id == v.vehicle_id]
        v_dist = sum(float(t.distance or 0) for t in v_trips)
        trip_stats.append({
            "vehicle_reg": v.registration_number,
            "trips_completed": len(v_trips),
            "total_distance_km": round(v_dist, 1),
        })

    # Fuel efficiency per vehicle (km ÷ litres)
    fuel_efficiency = []
    fuel_records = db.query(FuelRecord).all()
    vehicle_fuel_map = {}
    for fr in fuel_records:
        key = str(fr.vehicle_id)
        if key not in vehicle_fuel_map:
            vehicle_fuel_map[key] = {"liters": 0.0, "cost": 0.0, "mileage": 0.0}
        vehicle_fuel_map[key]["liters"] += fr.fuel_amount or 0.0
        vehicle_fuel_map[key]["cost"] += fr.fuel_cost or 0.0
        vehicle_fuel_map[key]["mileage"] += fr.mileage or 0.0

    for v in vehicles:
        key = str(v.vehicle_id)
        fm = vehicle_fuel_map.get(key)
        if fm and fm["liters"] > 0:
            eff = round(fm["mileage"] / fm["liters"], 2) if fm["mileage"] else None
            fuel_efficiency.append({
                "vehicle_reg": v.registration_number,
                "total_liters": round(fm["liters"], 1),
                "total_cost": round(fm["cost"], 2),
                "total_mileage_km": round(fm["mileage"], 1),
                "efficiency_kmpl": eff,
            })

    return {
        # Fleet utilization
        "total_vehicles": total_vehicles,
        "available_vehicles": available,
        "in_transit_vehicles": in_transit,
        "maintenance_vehicles": maintenance_count,
        "assigned_vehicles": assigned,
        "fleet_utilization_pct": utilization_pct,

        # Trips / routes
        "active_trips": active_trips_count,
        "pending_trips": pending_trips_count,
        "completed_trips": total_completed,
        "total_distance_km": round(total_distance, 1),
        "avg_trip_distance_km": avg_trip_distance,

        # Deliveries
        "total_shipments": total_shipments,
        "delivered_shipments": delivered,
        "delayed_shipments": delayed,
        "in_transit_shipments": in_transit_ship,
        "delivery_success_rate_pct": delivery_rate,
        "on_time_rate_pct": on_time_rate,

        # Maintenance
        "overdue_maintenance": overdue_count,
        "total_maintenance_cost": float(total_maintenance_cost),

        # Fuel (summary)
        "total_fuel_liters": round(total_fuel_liters, 1),
        "total_fuel_cost": round(total_fuel_cost, 2),
        "fuel_expenses": round(total_fuel_cost, 2),

        # Drivers
        "total_drivers": total_drivers,
        "active_drivers": active_drivers,

        # Chart data
        "trip_stats": trip_stats,
        "fuel_efficiency": fuel_efficiency,
    }


# ----------------------------------------------------------------
# GET /reports/fleet-utilization
# ----------------------------------------------------------------
@router.get("/fleet-utilization")
def get_fleet_utilization(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    total = db.query(Vehicle).count()
    breakdown = {}
    for status_val in ("Available", "Assigned", "In Transit", "Maintenance"):
        breakdown[status_val] = db.query(Vehicle).filter(Vehicle.status == status_val).count()
    utilization_pct = round(((total - breakdown.get("Available", 0)) / total * 100), 1) if total else 0.0
    return {
        "total_vehicles": total,
        "breakdown": breakdown,
        "utilization_pct": utilization_pct,
    }


# ----------------------------------------------------------------
# GET /reports/driver-performance
# ----------------------------------------------------------------
@router.get("/driver-performance")
def get_driver_performance(
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db),
):
    drivers = db.query(Driver, User).join(User, Driver.user_id == User.user_id).all()
    result = []
    for driver, user in drivers:
        trips = db.query(Trip).filter(Trip.driver_id == driver.driver_id).all()
        completed = [t for t in trips if t.status == "completed"]
        on_time = sum(
            1 for t in completed
            if t.start_time and t.end_time and t.distance
            and (t.end_time - t.start_time).total_seconds() / 3600.0 <= float(t.distance) / 30.0
        )
        on_time_rate = round((on_time / len(completed) * 100), 1) if completed else 100.0
        result.append({
            "driver_id": str(driver.driver_id),
            "driver_name": user.full_name,
            "status": driver.status or "Active",
            "experience_years": driver.experience_years,
            "trips_total": len(trips),
            "trips_completed": len(completed),
            "trips_active": sum(1 for t in trips if t.status == "active"),
            "on_time_rate_pct": on_time_rate,
        })
    return result


# ----------------------------------------------------------------
# GET /reports/delivery-performance
# ----------------------------------------------------------------
@router.get("/delivery-performance")
def get_delivery_performance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    all_shipments = db.query(Shipment).all()
    delivered = [s for s in all_shipments if s.status == "Delivered"]
    delayed = [s for s in all_shipments if s.status == "Delayed"]
    in_transit = [s for s in all_shipments if s.status == "In Transit"]

    avg_delivery_hours = None
    delivery_times = []
    for s in delivered:
        if s.created_at and s.updated_at:
            diff = (s.updated_at - s.created_at).total_seconds() / 3600.0
            delivery_times.append(diff)
    if delivery_times:
        avg_delivery_hours = round(sum(delivery_times) / len(delivery_times), 1)

    total = len(all_shipments)
    delivery_rate = round((len(delivered) / total * 100), 1) if total else 0.0
    delay_rate = round((len(delayed) / total * 100), 1) if total else 0.0

    return {
        "total_shipments": total,
        "delivered": len(delivered),
        "delayed": len(delayed),
        "in_transit": len(in_transit),
        "delivery_success_rate_pct": delivery_rate,
        "delay_rate_pct": delay_rate,
        "avg_delivery_hours": avg_delivery_hours,
    }


# ----------------------------------------------------------------
# GET /reports/maintenance-analytics
# ----------------------------------------------------------------
@router.get("/maintenance-analytics")
def get_maintenance_analytics(
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db),
):
    records = db.query(VehicleMaintenance, Vehicle).join(
        Vehicle, VehicleMaintenance.vehicle_id == Vehicle.vehicle_id
    ).all()

    cost_by_type: dict[str, float] = {}
    cost_by_vehicle: dict[str, dict] = {}

    for record, vehicle in records:
        m_type = record.maintenance_type or "Other"
        cost = float(record.cost or 0)
        cost_by_type[m_type] = cost_by_type.get(m_type, 0) + cost

        reg = vehicle.registration_number
        if reg not in cost_by_vehicle:
            cost_by_vehicle[reg] = {"total_cost": 0.0, "record_count": 0}
        cost_by_vehicle[reg]["total_cost"] += cost
        cost_by_vehicle[reg]["record_count"] += 1

    # Overdue / upcoming
    today = datetime.date.today()
    upcoming_cutoff = today + datetime.timedelta(days=7)
    overdue = sum(
        1 for r, _ in records
        if r.status != "completed" and r.next_service_date and r.next_service_date < today
    )
    upcoming = sum(
        1 for r, _ in records
        if r.status != "completed" and r.next_service_date
        and today <= r.next_service_date <= upcoming_cutoff
    )

    return {
        "total_records": len(records),
        "overdue": overdue,
        "upcoming_7_days": upcoming,
        "total_cost": sum(cost_by_type.values()),
        "cost_by_type": [
            {"type": k, "cost": round(v, 2)} for k, v in sorted(cost_by_type.items(), key=lambda x: -x[1])
        ],
        "cost_by_vehicle": [
            {"vehicle_reg": k, **v} for k, v in sorted(cost_by_vehicle.items(), key=lambda x: -x[1]["total_cost"])
        ],
    }


# ----------------------------------------------------------------
# GET /reports/fuel-analytics
# ----------------------------------------------------------------
@router.get("/fuel-analytics")
def get_fuel_analytics(
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db),
):
    fuel_records = db.query(FuelRecord, Vehicle).join(
        Vehicle, FuelRecord.vehicle_id == Vehicle.vehicle_id
    ).order_by(FuelRecord.recorded_at.asc()).all()

    vehicle_map: dict[str, dict] = {}
    monthly_costs: dict[str, float] = {}

    for fr, vehicle in fuel_records:
        reg = vehicle.registration_number
        if reg not in vehicle_map:
            vehicle_map[reg] = {"liters": 0.0, "cost": 0.0, "mileage": 0.0, "entries": 0}
        vehicle_map[reg]["liters"] += fr.fuel_amount or 0.0
        vehicle_map[reg]["cost"] += fr.fuel_cost or 0.0
        vehicle_map[reg]["mileage"] += fr.mileage or 0.0
        vehicle_map[reg]["entries"] += 1

        # Monthly grouping
        month_key = fr.recorded_at.strftime("%Y-%m") if fr.recorded_at else "Unknown"
        monthly_costs[month_key] = monthly_costs.get(month_key, 0.0) + (fr.fuel_cost or 0.0)

    efficiency_data = []
    for reg, data in vehicle_map.items():
        eff = round(data["mileage"] / data["liters"], 2) if data["liters"] and data["mileage"] else None
        efficiency_data.append({
            "vehicle_reg": reg,
            "total_liters": round(data["liters"], 1),
            "total_cost": round(data["cost"], 2),
            "total_mileage_km": round(data["mileage"], 1),
            "efficiency_kmpl": eff,
            "refill_count": data["entries"],
        })

    return {
        "efficiency_by_vehicle": efficiency_data,
        "monthly_cost_trend": [
            {"month": k, "cost": round(v, 2)}
            for k, v in sorted(monthly_costs.items())
        ],
        "total_fuel_cost": round(sum(d["cost"] for d in vehicle_map.values()), 2),
        "total_fuel_liters": round(sum(d["liters"] for d in vehicle_map.values()), 1),
    }


# ────────────────────────────────────────────────────────────────
# EXPORT ENDPOINTS (Milestone 4 Section C)
# ────────────────────────────────────────────────────────────────

@router.get("/export/fleet-utilization")
def export_fleet_utilization(
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db),
):
    """Export fleet utilization and vehicle inventory as CSV."""
    vehicles = db.query(Vehicle).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Registration Number", "Vehicle Type", "Brand", "Model", "Year", "Fuel Type", "Capacity (kg)", "Status"])
    for v in vehicles:
        writer.writerow([
            v.registration_number,
            v.vehicle_type or "N/A",
            v.brand or "N/A",
            v.model or "N/A",
            v.manufacture_year or "N/A",
            v.fuel_type or "Diesel",
            v.capacity or "N/A",
            v.status or "Available",
        ])
    output.seek(0)
    filename = f"fleet_utilization_{datetime.date.today()}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/fuel-consumption")
def export_fuel_consumption(
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db),
):
    """Export fuel consumption logs as CSV."""
    records = db.query(FuelRecord, Vehicle).join(
        Vehicle, FuelRecord.vehicle_id == Vehicle.vehicle_id
    ).order_by(FuelRecord.recorded_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Vehicle", "Fuel Amount (L)", "Fuel Cost", "Mileage (km)", "Notes"])
    for fr, v in records:
        writer.writerow([
            str(fr.refill_date or (fr.recorded_at.date() if fr.recorded_at else "N/A")),
            v.registration_number,
            fr.fuel_amount or 0.0,
            fr.fuel_cost or 0.0,
            fr.mileage or 0.0,
            fr.notes or "",
        ])
    output.seek(0)
    filename = f"fuel_consumption_{datetime.date.today()}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/driver-performance")
def export_driver_performance(
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db),
):
    """Export driver performance and attendance leaderboard as CSV."""
    drivers = db.query(Driver, User).join(User, Driver.user_id == User.user_id).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Driver Name", "Email", "License Number", "Experience (Years)", "Status", "Total Trips", "Completed Trips", "On-Time Rate %", "Attendance Rate %"])

    for driver, user in drivers:
        trips = db.query(Trip).filter(Trip.driver_id == driver.driver_id).all()
        completed = [t for t in trips if t.status == "completed"]
        on_time = sum(
            1 for t in completed
            if t.start_time and t.end_time and t.distance
            and (t.end_time - t.start_time).total_seconds() / 3600.0 <= float(t.distance) / 30.0
        )
        on_time_rate = round((on_time / len(completed) * 100), 1) if completed else 100.0

        # Attendance calculation
        att_records = db.query(Attendance).filter(Attendance.driver_id == driver.driver_id).all()
        present = sum(1 for a in att_records if a.status == "Present")
        att_rate = round((present / len(att_records) * 100), 1) if att_records else 100.0

        writer.writerow([
            user.full_name,
            user.email,
            driver.license_number,
            driver.experience_years or 0,
            driver.status or "Active",
            len(trips),
            len(completed),
            f"{on_time_rate}%",
            f"{att_rate}%",
        ])

    output.seek(0)
    filename = f"driver_performance_{datetime.date.today()}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/delivery-performance")
def export_delivery_performance(
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db),
):
    """Export delivery performance and shipment logs as CSV."""
    shipments = db.query(Shipment, Vehicle, Driver).outerjoin(
        Vehicle, Shipment.vehicle_id == Vehicle.vehicle_id
    ).outerjoin(
        Driver, Shipment.driver_id == Driver.driver_id
    ).order_by(Shipment.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Tracking Number", "Customer", "Source", "Destination", "Weight (kg)", "Vehicle", "Status", "Created At"])
    for s, v, d in shipments:
        writer.writerow([
            s.tracking_number,
            s.customer_name,
            s.source or "",
            s.destination or "",
            s.shipment_weight or 0.0,
            v.registration_number if v else "Unassigned",
            s.status or "Created",
            s.created_at.strftime("%Y-%m-%d %H:%M") if s.created_at else "N/A",
        ])

    output.seek(0)
    filename = f"delivery_performance_{datetime.date.today()}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/maintenance")
def export_maintenance_report(
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db),
):
    """Export maintenance service records as CSV."""
    records = db.query(VehicleMaintenance, Vehicle).join(
        Vehicle, VehicleMaintenance.vehicle_id == Vehicle.vehicle_id
    ).order_by(VehicleMaintenance.service_date.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Vehicle", "Service Type", "Service Date", "Next Service Date", "Cost", "Status", "Remarks"])
    for m, v in records:
        writer.writerow([
            v.registration_number,
            m.maintenance_type or "General Inspection",
            str(m.service_date) if m.service_date else "N/A",
            str(m.next_service_date) if m.next_service_date else "N/A",
            m.cost or 0.0,
            m.status or "pending",
            m.remarks or "",
        ])

    output.seek(0)
    filename = f"maintenance_report_{datetime.date.today()}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

