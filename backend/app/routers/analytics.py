from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.core.deps import require_role
from app.models.user import RoleEnum, User
from app.models.vehicle import Vehicle, VehicleStatus
from app.models.driver import Driver
from app.models.shipment import Shipment, ShipmentStatus
from app.models.trip import Trip, TripStatus
from app.models.maintenance import VehicleMaintenance
from app.models.fuel_record import FuelRecord
from datetime import date, timedelta


router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
)


# ==========================================================
# FLEET UTILIZATION
# Admin + FleetManager
# ==========================================================

@router.get("/fleet-utilization")
def fleet_utilization(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    total = db.query(Vehicle).count()

    status_counts = (
        db.query(Vehicle.status, func.count(Vehicle.vehicle_id))
        .group_by(Vehicle.status)
        .all()
    )

    counts = {str(s): c for s, c in status_counts}

    active = (
        counts.get("Assigned", 0) +
        counts.get("InTransit", 0)
    )

    utilization_pct = round((active / total) * 100, 1) if total > 0 else 0.0

    return {
        "total_vehicles": total,
        "utilization_percent": utilization_pct,
        "by_status": counts,
    }


# ==========================================================
# DRIVER PERFORMANCE
# Admin + FleetManager
# ==========================================================

@router.get("/driver-performance")
def driver_performance(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    drivers = db.query(Driver).all()
    result = []

    for driver in drivers:
        user = db.query(User).filter(User.user_id == driver.user_id).first()

        total_trips = db.query(Trip).filter(
            Trip.driver_id == driver.user_id
        ).count()

        completed_trips = db.query(Trip).filter(
            Trip.driver_id == driver.user_id,
            Trip.status == TripStatus.Completed,
        ).count()

        # On-time = delivered before or at ETA
        on_time = db.query(Trip).filter(
            Trip.driver_id == driver.user_id,
            Trip.status == TripStatus.Completed,
            Trip.end_time != None,
            Trip.eta != None,
            Trip.end_time <= Trip.eta,
        ).count()

        on_time_rate = round((on_time / completed_trips) * 100, 1) if completed_trips > 0 else None

        result.append({
            "driver_id": str(driver.driver_id),
            "user_id": str(driver.user_id) if driver.user_id else None,
            "full_name": user.full_name if user else "Unknown",
            "license_number": driver.license_number,
            "status": driver.status,
            "total_trips": total_trips,
            "completed_trips": completed_trips,
            "on_time_rate_percent": on_time_rate,
        })

    return result


# ==========================================================
# SHIPMENT / DELIVERY PERFORMANCE
# Admin + FleetManager + Dispatcher
# ==========================================================

@router.get("/delivery-performance")
def delivery_performance(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(
        RoleEnum.Admin, RoleEnum.FleetManager, RoleEnum.Dispatcher
    )),
):
    total = db.query(Shipment).count()
    delivered = db.query(Shipment).filter(Shipment.status == ShipmentStatus.Delivered).count()
    delayed = db.query(Shipment).filter(Shipment.status == ShipmentStatus.Delayed).count()
    in_transit = db.query(Shipment).filter(Shipment.status == ShipmentStatus.InTransit).count()
    cancelled = db.query(Shipment).filter(Shipment.status == ShipmentStatus.Cancelled).count()
    created = db.query(Shipment).filter(Shipment.status == ShipmentStatus.Created).count()
    assigned = db.query(Shipment).filter(Shipment.status == ShipmentStatus.Assigned).count()

    # Average delivery time (hours) from completed trips
    completed_trips = db.query(Trip).filter(
        Trip.status == TripStatus.Completed,
        Trip.start_time != None,
        Trip.end_time != None,
    ).all()

    avg_delivery_hours = None
    if completed_trips:
        durations = [
            (t.end_time - t.start_time).total_seconds() / 3600
            for t in completed_trips
        ]
        avg_delivery_hours = round(sum(durations) / len(durations), 2)

    on_time_trips = sum(
        1 for t in completed_trips
        if t.eta and t.end_time and t.end_time <= t.eta
    )
    on_time_rate = round((on_time_trips / len(completed_trips)) * 100, 1) if completed_trips else None

    return {
        "total_shipments": total,
        "delivered": delivered,
        "in_transit": in_transit,
        "delayed": delayed,
        "cancelled": cancelled,
        "created": created,
        "assigned": assigned,
        "avg_delivery_hours": avg_delivery_hours,
        "on_time_rate_percent": on_time_rate,
    }


# ==========================================================
# MAINTENANCE ANALYTICS
# Admin + FleetManager
# ==========================================================

@router.get("/maintenance-analytics")
def maintenance_analytics(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    today = date.today()
    threshold = today + timedelta(days=7)

    total = db.query(VehicleMaintenance).count()
    completed = db.query(VehicleMaintenance).filter(
        VehicleMaintenance.status == "Completed"
    ).count()
    upcoming = db.query(VehicleMaintenance).filter(
        VehicleMaintenance.next_service_date != None,
        VehicleMaintenance.next_service_date <= threshold,
        VehicleMaintenance.next_service_date >= today,
        VehicleMaintenance.status != "Completed",
    ).count()
    overdue = db.query(VehicleMaintenance).filter(
        VehicleMaintenance.next_service_date != None,
        VehicleMaintenance.next_service_date < today,
        VehicleMaintenance.status != "Completed",
    ).count()

    # Cost by maintenance type
    type_costs = (
        db.query(
            VehicleMaintenance.maintenance_type,
            func.sum(VehicleMaintenance.cost).label("total_cost"),
            func.count(VehicleMaintenance.maintenance_id).label("count"),
        )
        .filter(VehicleMaintenance.maintenance_type != None)
        .group_by(VehicleMaintenance.maintenance_type)
        .all()
    )

    by_type = [
        {
            "type": r.maintenance_type,
            "total_cost": float(r.total_cost or 0),
            "count": r.count,
        }
        for r in type_costs
    ]

    return {
        "total_records": total,
        "completed": completed,
        "upcoming_7_days": upcoming,
        "overdue": overdue,
        "by_type": by_type,
    }


# ==========================================================
# ADMIN SYSTEM SUMMARY
# Admin only
# ==========================================================

@router.get("/admin-summary")
def admin_summary(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin)),
):
    total_users = db.query(User).count()

    by_role = (
        db.query(User.role, func.count(User.user_id))
        .group_by(User.role)
        .all()
    )

    total_fuel_cost = db.query(func.sum(FuelRecord.fuel_cost)).scalar() or 0
    total_maintenance_cost = db.query(func.sum(VehicleMaintenance.cost)).scalar() or 0

    return {
        "total_users": total_users,
        "users_by_role": {str(r): c for r, c in by_role},
        "total_fuel_cost": float(total_fuel_cost),
        "total_maintenance_cost": float(total_maintenance_cost),
        "total_operational_cost": float(total_fuel_cost) + float(total_maintenance_cost),
    }
