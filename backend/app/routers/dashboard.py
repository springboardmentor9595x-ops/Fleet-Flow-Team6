from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import RoleEnum, User
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.shipment import Shipment, ShipmentStatus
from app.models.trip import Trip, TripStatus
from app.models.maintenance import VehicleMaintenance
from app.models.fuel_record import FuelRecord
from app.models.attendance import Attendance


router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)


@router.get("/summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    today = date.today()
    threshold = today + timedelta(days=7)

    # ---- Vehicles ----
    total_vehicles = db.query(Vehicle).count()

    available_vehicles = (
        db.query(Vehicle)
        .filter(Vehicle.status == "Available")
        .count()
    )

    assigned_vehicles = (
        db.query(Vehicle)
        .filter(Vehicle.status == "Assigned")
        .count()
    )

    maintenance_vehicles = (
        db.query(Vehicle)
        .filter(Vehicle.status == "Maintenance")
        .count()
    )

    in_transit_vehicles = (
        db.query(Vehicle)
        .filter(Vehicle.status == "InTransit")
        .count()
    )

    # ---- Drivers ----
    total_drivers = db.query(Driver).count()

    # ---- Shipments ----
    total_shipments = db.query(Shipment).count()

    active_shipments = (
        db.query(Shipment)
        .filter(Shipment.status.in_([
            ShipmentStatus.Assigned,
            ShipmentStatus.InTransit,
        ]))
        .count()
    )

    delivered_shipments = (
        db.query(Shipment)
        .filter(Shipment.status == ShipmentStatus.Delivered)
        .count()
    )

    delayed_shipments = (
        db.query(Shipment)
        .filter(Shipment.status == ShipmentStatus.Delayed)
        .count()
    )

    # ---- Trips ----
    total_trips = db.query(Trip).count()

    active_trips = (
        db.query(Trip)
        .filter(Trip.status == TripStatus.InTransit)
        .count()
    )

    # ---- Maintenance ----
    upcoming_maintenance = (
        db.query(VehicleMaintenance)
        .filter(
            VehicleMaintenance.next_service_date != None,
            VehicleMaintenance.next_service_date <= threshold,
            VehicleMaintenance.next_service_date >= today,
            VehicleMaintenance.status != "Completed",
        )
        .count()
    )

    overdue_maintenance = (
        db.query(VehicleMaintenance)
        .filter(
            VehicleMaintenance.next_service_date != None,
            VehicleMaintenance.next_service_date < today,
            VehicleMaintenance.status != "Completed",
        )
        .count()
    )

    return {
        # Vehicles
        "total_vehicles": total_vehicles,
        "available_vehicles": available_vehicles,
        "assigned_vehicles": assigned_vehicles,
        "maintenance_vehicles": maintenance_vehicles,
        "in_transit_vehicles": in_transit_vehicles,
        # Drivers
        "total_drivers": total_drivers,
        # Shipments
        "total_shipments": total_shipments,
        "active_shipments": active_shipments,
        "delivered_shipments": delivered_shipments,
        "delayed_shipments": delayed_shipments,
        # Trips
        "total_trips": total_trips,
        "active_trips": active_trips,
        # Maintenance
        "upcoming_maintenance": upcoming_maintenance,
        "overdue_maintenance": overdue_maintenance,
    }


# ==========================================================
# FLEET DASHBOARD — Admin + FleetManager only
# ==========================================================

@router.get("/fleet")
def get_fleet_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    """Fleet Dashboard widgets: vehicles, fuel summary, upcoming maintenance."""
    today = date.today()
    threshold = today + timedelta(days=7)

    total_vehicles = db.query(Vehicle).count()
    by_status_q = db.query(Vehicle.status, func.count(Vehicle.vehicle_id)).group_by(Vehicle.status).all()
    by_status = {str(s): c for s, c in by_status_q}
    active = by_status.get("Assigned", 0) + by_status.get("InTransit", 0)
    utilization_pct = round((active / total_vehicles) * 100, 1) if total_vehicles > 0 else 0

    # Vehicle type breakdown
    by_type_q = db.query(Vehicle.vehicle_type, func.count(Vehicle.vehicle_id)).group_by(Vehicle.vehicle_type).all()
    by_type = {t: c for t, c in by_type_q}

    # Fuel summary
    total_fuel_cost = float(db.query(func.sum(FuelRecord.fuel_cost)).scalar() or 0)
    avg_mileage = float(db.query(func.avg(FuelRecord.mileage)).scalar() or 0)

    # Top 5 vehicles by fuel cost with vehicle details
    top_fuel = (
        db.query(FuelRecord.vehicle_id, func.sum(FuelRecord.fuel_cost).label("cost"))
        .group_by(FuelRecord.vehicle_id)
        .order_by(func.sum(FuelRecord.fuel_cost).desc())
        .limit(5)
        .all()
    )
    top_fuel_list = []
    for r in top_fuel:
        veh = db.query(Vehicle).filter(Vehicle.vehicle_id == r.vehicle_id).first()
        top_fuel_list.append({
            "vehicle_id": str(r.vehicle_id),
            "registration_number": veh.registration_number if veh else str(r.vehicle_id)[:8],
            "vehicle_type": veh.vehicle_type if veh else "Unknown",
            "cost": float(r.cost or 0)
        })

    # Maintenance with vehicle info
    upcoming_maint = (
        db.query(VehicleMaintenance)
        .filter(
            VehicleMaintenance.next_service_date != None,
            VehicleMaintenance.next_service_date <= threshold,
            VehicleMaintenance.next_service_date >= today,
            VehicleMaintenance.status != "Completed",
        )
        .all()
    )
    overdue_maint = (
        db.query(VehicleMaintenance)
        .filter(
            VehicleMaintenance.next_service_date != None,
            VehicleMaintenance.next_service_date < today,
            VehicleMaintenance.status != "Completed",
        )
        .all()
    )

    upcoming_list = []
    for m in upcoming_maint:
        veh = db.query(Vehicle).filter(Vehicle.vehicle_id == m.vehicle_id).first()
        upcoming_list.append({
            "vehicle_id": str(m.vehicle_id),
            "registration": veh.registration_number if veh else "N/A",
            "type": m.maintenance_type or "General",
            "due": str(m.next_service_date),
            "cost": float(m.cost or 0)
        })

    overdue_list = []
    for m in overdue_maint:
        veh = db.query(Vehicle).filter(Vehicle.vehicle_id == m.vehicle_id).first()
        overdue_list.append({
            "vehicle_id": str(m.vehicle_id),
            "registration": veh.registration_number if veh else "N/A",
            "type": m.maintenance_type or "General",
            "due": str(m.next_service_date),
            "cost": float(m.cost or 0)
        })

    return {
        "total_vehicles": total_vehicles,
        "by_status": by_status,
        "by_type": by_type,
        "utilization_percent": utilization_pct,
        "fuel_summary": {
            "total_cost_this_month": total_fuel_cost,
            "avg_mileage_kmpl": round(avg_mileage, 2),
            "top_consumers": top_fuel_list,
        },
        "maintenance": {
            "upcoming_count": len(upcoming_maint),
            "overdue_count": len(overdue_maint),
            "upcoming_list": upcoming_list,
            "overdue_list": overdue_list,
        },
    }


# ==========================================================
# LOGISTICS DASHBOARD — Admin + FleetManager + Dispatcher
# ==========================================================

@router.get("/logistics")
def get_logistics_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager, RoleEnum.Dispatcher)),
):
    """Logistics Dashboard: shipment pipeline, ETA analytics, delivery metrics, active trips snapshot."""
    total_shipments = db.query(Shipment).count()
    by_status_q = (
        db.query(Shipment.status, func.count(Shipment.shipment_id))
        .group_by(Shipment.status)
        .all()
    )
    by_status = {str(s): c for s, c in by_status_q}

    active_shipments = (
        by_status.get("Assigned", 0) + by_status.get("In Transit", 0) + by_status.get("ShipmentStatus.Assigned", 0) + by_status.get("ShipmentStatus.InTransit", 0)
    )

    # ETA analytics & Delivery metrics
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

    # Route mode usage
    route_modes_q = (
        db.query(Trip.route_type, func.count(Trip.trip_id))
        .filter(Trip.route_type != None)
        .group_by(Trip.route_type)
        .all()
    )
    route_modes = {str(rt): c for rt, c in route_modes_q}

    # Live active trips snapshot
    active_trips_q = (
        db.query(Trip)
        .filter(Trip.status == TripStatus.InTransit)
        .order_by(Trip.created_at.desc())
        .limit(10)
        .all()
    )
    live_trips = []
    for t in active_trips_q:
        veh = db.query(Vehicle).filter(Vehicle.vehicle_id == t.vehicle_id).first() if t.vehicle_id else None
        driver = db.query(Driver).filter(Driver.driver_id == t.driver_id).first() if t.driver_id else None
        driver_user = db.query(User).filter(User.user_id == driver.user_id).first() if driver else None
        shipment = db.query(Shipment).filter(Shipment.shipment_id == t.shipment_id).first() if t.shipment_id else None
        live_trips.append({
            "trip_id": str(t.trip_id),
            "destination": t.destination,
            "origin": t.start_location,
            "eta": t.eta.isoformat() if t.eta else None,
            "vehicle_reg": veh.registration_number if veh else "N/A",
            "driver_name": driver_user.full_name if driver_user else "Unassigned",
            "tracking_number": shipment.tracking_number if shipment else "N/A",
            "route_type": t.route_type or "Fastest",
            "status": str(t.status),
        })

    return {
        "total_shipments": total_shipments,
        "active_shipments": active_shipments,
        "by_status": by_status,
        "delivery_metrics": {
            "avg_delivery_hours": avg_hrs,
            "on_time_rate_percent": on_time_rate,
            "delayed_count": by_status.get("Delayed", 0) + by_status.get("ShipmentStatus.Delayed", 0),
            "delivered_count": by_status.get("Delivered", 0) + by_status.get("ShipmentStatus.Delivered", 0),
        },
        "route_mode_usage": route_modes,
        "live_trips": live_trips,
    }


# ==========================================================
# ADMIN DASHBOARD — Admin only
# ==========================================================

@router.get("/admin")
def get_admin_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin)),
):
    """Admin Dashboard: system KPIs, driver leaderboard, shipment monitoring, financial & system health."""
    today = date.today()
    month_start = today.replace(day=1)

    # Users
    total_users = db.query(User).count()
    by_role_q = db.query(User.role, func.count(User.user_id)).group_by(User.role).all()
    by_role = {str(r.value if hasattr(r, 'value') else r): c for r, c in by_role_q}

    # Fleet KPIs
    total_vehicles = db.query(Vehicle).count()
    active_vehicles = db.query(Vehicle).filter(Vehicle.status.in_(["Assigned", "InTransit"])).count()
    utilization_pct = round((active_vehicles / total_vehicles) * 100, 1) if total_vehicles > 0 else 0

    # Shipments KPIs
    total_shipments = db.query(Shipment).count()
    active_shipments = db.query(Shipment).filter(Shipment.status.in_([ShipmentStatus.Assigned, ShipmentStatus.InTransit])).count()
    delivered_shipments = db.query(Shipment).filter(Shipment.status == ShipmentStatus.Delivered).count()

    # Costs
    total_fuel_cost = float(db.query(func.sum(FuelRecord.fuel_cost)).scalar() or 0)
    total_maint_cost = float(db.query(func.sum(VehicleMaintenance.cost)).scalar() or 0)

    # Driver Performance Leaderboard
    drivers = db.query(Driver).all()
    driver_leaderboard = []
    for driver in drivers:
        d_user = db.query(User).filter(User.user_id == driver.user_id).first()
        total_trips = db.query(Trip).filter(Trip.driver_id == driver.driver_id).count()
        completed = db.query(Trip).filter(Trip.driver_id == driver.driver_id, Trip.status == TripStatus.Completed).count()
        on_time = db.query(Trip).filter(
            Trip.driver_id == driver.driver_id,
            Trip.status == TripStatus.Completed,
            Trip.end_time != None,
            Trip.eta != None,
            Trip.end_time <= Trip.eta,
        ).count()
        on_time_rate = round((on_time / completed) * 100, 1) if completed > 0 else 100.0

        # Attendance rate this month
        present_count = db.query(Attendance).filter(
            Attendance.driver_id == driver.driver_id,
            Attendance.attendance_date >= month_start,
            Attendance.status == "Present",
        ).count()
        total_marked = db.query(Attendance).filter(
            Attendance.driver_id == driver.driver_id,
            Attendance.attendance_date >= month_start,
        ).count()
        att_rate = round((present_count / total_marked) * 100, 1) if total_marked > 0 else 100.0

        driver_leaderboard.append({
            "driver_id": str(driver.driver_id),
            "name": d_user.full_name if d_user else "Driver",
            "license": driver.license_number,
            "status": driver.status,
            "trips_completed": completed,
            "total_trips": total_trips,
            "on_time_rate": on_time_rate,
            "attendance_rate": att_rate,
            "attendance_summary": f"{present_count}/{total_marked} days" if total_marked > 0 else "N/A",
        })

    # Sort leaderboard by completed trips descending
    driver_leaderboard.sort(key=lambda x: (x["trips_completed"], x["on_time_rate"]), reverse=True)

    # Delayed/Cancelled shipments needing attention
    attention_shipments = db.query(Shipment).filter(
        Shipment.status.in_([ShipmentStatus.Delayed, ShipmentStatus.Cancelled])
    ).order_by(Shipment.created_at.desc()).limit(10).all()

    attention_list = [
        {
            "tracking_number": s.tracking_number,
            "status": str(s.status.value if hasattr(s.status, 'value') else s.status),
            "destination": s.destination,
            "origin": s.source,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in attention_shipments
    ]

    # Maintenance alerts overview
    overdue_maint_count = db.query(VehicleMaintenance).filter(
        VehicleMaintenance.next_service_date != None,
        VehicleMaintenance.next_service_date < today,
        VehicleMaintenance.status != "Completed",
    ).count()

    # Fuel cost trends
    from app.crud.fuel_record import get_fuel_cost_trends
    fuel_trends = get_fuel_cost_trends(db)

    # Maintenance by type
    maint_by_type_q = (
        db.query(
            VehicleMaintenance.maintenance_type,
            func.sum(VehicleMaintenance.cost).label("cost"),
            func.count(VehicleMaintenance.maintenance_id).label("count")
        )
        .group_by(VehicleMaintenance.maintenance_type)
        .all()
    )
    maintenance_by_type = [
        {"type": r.maintenance_type or "General Inspection", "cost": float(r.cost or 0), "count": r.count}
        for r in maint_by_type_q
    ]

    # Vehicle status distribution
    veh_status_q = db.query(Vehicle.status, func.count(Vehicle.vehicle_id)).group_by(Vehicle.status).all()
    vehicle_distribution = [
        {"name": str(s.value if hasattr(s, "value") else s), "value": c}
        for s, c in veh_status_q
    ]

    # Shipment delivery distribution
    ship_status_q = db.query(Shipment.status, func.count(Shipment.shipment_id)).group_by(Shipment.status).all()
    delivery_distribution = [
        {"name": str(s.value if hasattr(s, "value") else s), "value": c}
        for s, c in ship_status_q
    ]

    return {
        "kpis": {
            "total_users": total_users,
            "total_vehicles": total_vehicles,
            "utilization_percent": utilization_pct,
            "total_shipments": total_shipments,
            "active_shipments": active_shipments,
            "delivered_shipments": delivered_shipments,
        },
        "users_by_role": by_role,
        "operational_costs": {
            "total_fuel": total_fuel_cost,
            "total_maintenance": total_maint_cost,
            "total": total_fuel_cost + total_maint_cost,
        },
        "fuel_trends": fuel_trends,
        "maintenance_by_type": maintenance_by_type,
        "vehicle_distribution": vehicle_distribution,
        "delivery_distribution": delivery_distribution,
        "driver_leaderboard": driver_leaderboard,
        "shipments_needing_attention": attention_list,
        "system_health": {
            "overdue_maintenance": overdue_maint_count,
            "status": "Healthy" if overdue_maint_count == 0 else f"{overdue_maint_count} Overdue Maintenance",
        },
    }




# ==========================================================
# DRIVER PERSONAL DASHBOARD — Driver only
# ==========================================================

@router.get("/driver")
def get_driver_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Driver personal dashboard: current assignment, recent trips, attendance, vehicle maintenance."""
    driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
    if not driver:
        return {
            "current_assignment": None,
            "assigned_vehicle": None,
            "recent_trips": [],
            "performance": {"total_trips": 0, "completed_trips": 0, "on_time_rate": 100.0},
            "attendance": {"present_days": 0, "total_days": 0},
            "vehicle_maintenance": None,
        }


    # Current shipment assignment
    active_trip = (
        db.query(Trip)
        .filter(
            Trip.driver_id == driver.driver_id,
            Trip.status == TripStatus.InTransit,
        )
        .order_by(Trip.created_at.desc())
        .first()
    )
    current_assignment = None
    if active_trip:
        shipment = db.query(Shipment).filter(Shipment.shipment_id == active_trip.shipment_id).first()
        current_assignment = {
            "trip_id": str(active_trip.trip_id),
            "destination": active_trip.destination,
            "eta": active_trip.eta.isoformat() if active_trip.eta else None,
            "shipment_tracking": shipment.tracking_number if shipment else None,
        }

    # Assigned vehicle
    from sqlalchemy import or_
    vehicle = db.query(Vehicle).filter(
        or_(Vehicle.assigned_driver == driver.driver_id, Vehicle.assigned_driver == driver.user_id)
    ).first()

    # Recent trips (last 5)
    recent_trips = (
        db.query(Trip)
        .filter(Trip.driver_id == driver.driver_id)
        .order_by(Trip.created_at.desc())
        .limit(5)
        .all()
    )
    recent_list = [
        {"trip_id": str(t.trip_id), "destination": t.destination,
         "status": str(t.status), "start_time": t.start_time.isoformat() if t.start_time else None}
        for t in recent_trips
    ]

    # Performance
    total_trips = db.query(Trip).filter(Trip.driver_id == driver.driver_id).count()
    completed_trips = db.query(Trip).filter(
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
    on_time_rate = round((on_time / completed_trips) * 100, 1) if completed_trips > 0 else None

    # Attendance this month
    today = date.today()
    month_start = today.replace(day=1)
    present = db.query(Attendance).filter(
        Attendance.driver_id == driver.driver_id,
        Attendance.attendance_date >= month_start,
        Attendance.status == "Present",
    ).count()
    total_att = db.query(Attendance).filter(
        Attendance.driver_id == driver.driver_id,
        Attendance.attendance_date >= month_start,
    ).count()

    # Vehicle maintenance
    vehicle_maintenance = None
    if vehicle:
        maint = db.query(VehicleMaintenance).filter(
            VehicleMaintenance.vehicle_id == vehicle.vehicle_id,
            VehicleMaintenance.status != "Completed",
        ).order_by(VehicleMaintenance.next_service_date).first()
        if maint:
            vehicle_maintenance = {
                "type": maint.maintenance_type,
                "next_service_date": str(maint.next_service_date),
                "is_overdue": maint.next_service_date < today if maint.next_service_date else False,
            }

    return {
        "driver_id": str(driver.driver_id),
        "current_assignment": current_assignment,
        "assigned_vehicle": {
            "registration": vehicle.registration_number if vehicle else None,
            "type": vehicle.vehicle_type if vehicle else None,
            "status": str(vehicle.status) if vehicle else None,
        } if vehicle else None,
        "recent_trips": recent_list,
        "performance": {
            "total_trips": total_trips,
            "completed_trips": completed_trips,
            "on_time_rate_percent": on_time_rate,
        },
        "attendance_this_month": {
            "present": present,
            "total_marked": total_att,
            "summary": f"{present}/{total_att} days present" if total_att > 0 else "No records yet",
        },
        "vehicle_maintenance": vehicle_maintenance,
    }