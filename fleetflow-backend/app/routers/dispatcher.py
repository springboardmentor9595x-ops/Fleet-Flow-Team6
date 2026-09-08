import uuid
from datetime import date, datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc

from database import get_db
from app.core.security import require_roles, get_current_user
from app.models.user import User, RoleEnum
from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.models.trip import Trip
from app.models.shipment import Shipment
from app.models.attendance import Attendance
from app.models.notification import Notification
from app.services.audit_service import log_activity

router = APIRouter(
    prefix="/api/dispatcher",
    tags=["Dispatcher Operations"]
)


class TripAssignmentRequest(BaseModel):
    trip_id: str
    driver_id: str
    vehicle_id: str
    shipment_id: Optional[str] = None


class TripStatusUpdateRequest(BaseModel):
    trip_id: str
    status: str
    notes: Optional[str] = None


class ShipmentStatusUpdateRequest(BaseModel):
    shipment_id: str
    status: str
    notes: Optional[str] = None


# ────────────────────────────────────────────────────────────────
# GET /api/dispatcher/dashboard
# ────────────────────────────────────────────────────────────────
@router.get("/dashboard")
def get_dispatcher_dashboard(
    current_user: User = Depends(require_roles(["Admin", "FleetManager", "Dispatcher"])),
    db: Session = Depends(get_db)
):
    today = date.today()

    # Trip statistics
    active_trips_count = db.query(Trip).filter(Trip.status.in_(["Scheduled", "Assigned", "Dispatched", "In Transit"])).count()
    pending_trips_count = db.query(Trip).filter(Trip.status.in_(["Pending", "Created", "Draft"])).count()
    completed_trips_count = db.query(Trip).filter(Trip.status == "Completed").count()

    # Shipment statistics
    active_shipments_count = db.query(Shipment).filter(Shipment.status.in_(["In Transit", "Dispatched", "Assigned"])).count()
    pending_shipments_count = db.query(Shipment).filter(Shipment.status.in_(["Pending", "Created", "Processing"])).count()

    # Available drivers check
    today_present_driver_ids = [
        att.driver_id for att in db.query(Attendance).filter(
            Attendance.date == today,
            Attendance.status == "Present",
            Attendance.check_in_time.isnot(None),
            Attendance.check_out_time.is_(None)
        ).all()
    ]

    active_trip_driver_ids = [
        t.driver_id for t in db.query(Trip).filter(
            Trip.driver_id.isnot(None),
            Trip.status.in_(["Scheduled", "Assigned", "Dispatched", "In Transit"])
        ).all()
    ]

    available_drivers_count = db.query(Driver).filter(
        Driver.driver_id.in_(today_present_driver_ids) if today_present_driver_ids else False,
        ~Driver.driver_id.in_(active_trip_driver_ids) if active_trip_driver_ids else True
    ).count()

    # Fallback if no specific attendance marked yet: count drivers with status 'Available'
    if available_drivers_count == 0 and not today_present_driver_ids:
        available_drivers_count = db.query(Driver).filter(
            func.lower(Driver.status) == "available",
            ~Driver.driver_id.in_(active_trip_driver_ids) if active_trip_driver_ids else True
        ).count()

    # Available vehicles check
    active_trip_vehicle_ids = [
        t.vehicle_id for t in db.query(Trip).filter(
            Trip.vehicle_id.isnot(None),
            Trip.status.in_(["Scheduled", "Assigned", "Dispatched", "In Transit"])
        ).all()
    ]

    available_vehicles_count = db.query(Vehicle).filter(
        func.lower(Vehicle.status) == "available",
        ~Vehicle.vehicle_id.in_(active_trip_vehicle_ids) if active_trip_vehicle_ids else True
    ).count()

    # Attendance summary for today
    today_attendances = db.query(Attendance).filter(Attendance.date == today).all()
    att_present = sum(1 for a in today_attendances if a.status == "Present")
    att_absent = sum(1 for a in today_attendances if a.status == "Absent")
    att_leave = sum(1 for a in today_attendances if a.status in ["Leave", "On Leave"])
    att_off_duty = sum(1 for a in today_attendances if a.status == "Off Duty")

    # Recent active trips list
    order_col = getattr(Trip, 'start_time', Trip.trip_id)
    recent_active_trips = db.query(Trip, Driver, Vehicle, User).outerjoin(
        Driver, Trip.driver_id == Driver.driver_id
    ).outerjoin(
        User, Driver.user_id == User.user_id
    ).outerjoin(
        Vehicle, Trip.vehicle_id == Vehicle.vehicle_id
    ).filter(
        Trip.status.in_(["Scheduled", "Assigned", "Dispatched", "In Transit", "Pending"])
    ).order_by(desc(order_col)).limit(10).all()

    formatted_trips = []
    for trip, drv, veh, usr in recent_active_trips:
        start_loc = getattr(trip, 'start_location', None) or getattr(trip, 'origin', None) or "N/A"
        dest_loc = getattr(trip, 'destination', None) or getattr(trip, 'end_location', None) or "N/A"
        start_time_val = getattr(trip, 'start_time', None) or getattr(trip, 'created_at', None)

        formatted_trips.append({
            "trip_id": str(trip.trip_id),
            "trip_code": f"TRIP-{str(trip.trip_id)[:6].upper()}",
            "driver_id": str(trip.driver_id) if trip.driver_id else None,
            "driver_name": usr.full_name if usr else ("Driver" if drv else "Unassigned"),
            "vehicle_id": str(trip.vehicle_id) if trip.vehicle_id else None,
            "vehicle_name": f"{veh.make} {veh.model} ({veh.registration_number})" if veh and hasattr(veh, 'make') else (getattr(veh, 'registration_number', 'Unassigned') if veh else "Unassigned"),
            "start_location": start_loc,
            "end_location": dest_loc,
            "origin": start_loc,
            "destination": dest_loc,
            "status": trip.status,
            "created_at": start_time_val.isoformat() if start_time_val else None
        })

    return {
        "metrics": {
            "active_trips": active_trips_count,
            "pending_trips": pending_trips_count,
            "completed_trips": completed_trips_count,
            "available_drivers": available_drivers_count,
            "available_vehicles": available_vehicles_count,
            "active_shipments": active_shipments_count,
            "pending_shipments": pending_shipments_count,
            "attendance": {
                "present": att_present,
                "absent": att_absent,
                "leave": att_leave,
                "off_duty": att_off_duty
            }
        },
        "recent_trips": formatted_trips
    }


# ────────────────────────────────────────────────────────────────
# GET /api/dispatcher/available-drivers
# ────────────────────────────────────────────────────────────────
@router.get("/available-drivers")
def get_available_drivers(
    current_user: User = Depends(require_roles(["Admin", "FleetManager", "Dispatcher"])),
    db: Session = Depends(get_db)
):
    today = date.today()

    # Active trip driver IDs
    active_trip_driver_ids = [
        t.driver_id for t in db.query(Trip).filter(
            Trip.driver_id.isnot(None),
            Trip.status.in_(["Scheduled", "Assigned", "Dispatched", "In Transit"])
        ).all()
    ]

    # Present & checked-in drivers today
    today_present_records = db.query(Attendance).filter(
        Attendance.date == today,
        Attendance.status == "Present",
        Attendance.check_in_time.isnot(None),
        Attendance.check_out_time.is_(None)
    ).all()
    present_driver_ids = [a.driver_id for a in today_present_records]

    # Drivers query
    drivers = db.query(Driver, User).outerjoin(User, Driver.user_id == User.user_id).all()

    available_drivers_list = []
    for drv, usr in drivers:
        is_on_active_trip = drv.driver_id in active_trip_driver_ids
        is_checked_in = drv.driver_id in present_driver_ids or func.lower(drv.status or "") == "available"
        is_available = is_checked_in and not is_on_active_trip

        if is_available:
            available_drivers_list.append({
                "driver_id": str(drv.driver_id),
                "user_id": str(drv.user_id) if drv.user_id else None,
                "name": usr.full_name if usr else "Driver",
                "email": usr.email if usr else "",
                "phone": usr.phone if usr else "",
                "license_number": drv.license_number,
                "status": "Available",
                "checked_in": drv.driver_id in present_driver_ids
            })

    return available_drivers_list


# ────────────────────────────────────────────────────────────────
# GET /api/dispatcher/available-vehicles
# ────────────────────────────────────────────────────────────────
@router.get("/available-vehicles")
def get_available_vehicles(
    current_user: User = Depends(require_roles(["Admin", "FleetManager", "Dispatcher"])),
    db: Session = Depends(get_db)
):
    active_trip_vehicle_ids = [
        t.vehicle_id for t in db.query(Trip).filter(
            Trip.vehicle_id.isnot(None),
            Trip.status.in_(["Scheduled", "Assigned", "Dispatched", "In Transit"])
        ).all()
    ]

    vehicles = db.query(Vehicle).filter(
        func.lower(Vehicle.status) == "available",
        ~Vehicle.vehicle_id.in_(active_trip_vehicle_ids) if active_trip_vehicle_ids else True
    ).all()

    return [
        {
            "vehicle_id": str(v.vehicle_id),
            "make": getattr(v, "brand", None) or getattr(v, "make", ""),
            "brand": getattr(v, "brand", None) or getattr(v, "make", ""),
            "model": v.model,
            "year": getattr(v, "manufacture_year", None) or getattr(v, "year", None),
            "manufacture_year": getattr(v, "manufacture_year", None) or getattr(v, "year", None),
            "vehicle_type": getattr(v, "vehicle_type", ""),
            "registration_number": v.registration_number,
            "capacity": v.capacity,
            "fuel_type": v.fuel_type,
            "status": v.status
        }
        for v in vehicles
    ]


# ────────────────────────────────────────────────────────────────
# POST /api/dispatcher/trips/assign
# ────────────────────────────────────────────────────────────────
@router.post("/trips/assign")
def assign_trip(
    payload: TripAssignmentRequest,
    current_user: User = Depends(require_roles(["Admin", "FleetManager", "Dispatcher"])),
    db: Session = Depends(get_db)
):
    # 1. Validate Trip
    try:
        trip_uuid = uuid.UUID(payload.trip_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid trip_id format")

    trip = db.query(Trip).filter(Trip.trip_id == trip_uuid).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # 2. Validate Driver & Driver Availability
    try:
        driver_uuid = uuid.UUID(payload.driver_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid driver_id format")

    driver = db.query(Driver).filter(Driver.driver_id == driver_uuid).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    # Check driver attendance for today
    today = date.today()
    att = db.query(Attendance).filter(
        Attendance.driver_id == driver_uuid,
        Attendance.date == today
    ).order_by(desc(Attendance.check_in_time)).first()

    # Rule: Driver must be Present and checked in, OR driver status must be Available
    if att and att.status in ["Absent", "Off Duty", "Leave", "On Leave"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Driver is currently unavailable for assignment (Attendance status: {att.status})."
        )

    # Check if driver is already on an active trip
    existing_trip = db.query(Trip).filter(
        Trip.driver_id == driver_uuid,
        Trip.trip_id != trip_uuid,
        Trip.status.in_(["Scheduled", "Assigned", "Dispatched", "In Transit"])
    ).first()

    if existing_trip:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Driver is currently unavailable for assignment (Already assigned to an active trip)."
        )

    # 3. Validate Vehicle & Vehicle Availability
    try:
        vehicle_uuid = uuid.UUID(payload.vehicle_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid vehicle_id format")

    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_uuid).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    if vehicle.status and vehicle.status.lower() not in ["available", "assigned"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vehicle is currently unavailable for assignment (Status: {vehicle.status})."
        )

    existing_v_trip = db.query(Trip).filter(
        Trip.vehicle_id == vehicle_uuid,
        Trip.trip_id != trip_uuid,
        Trip.status.in_(["Scheduled", "Assigned", "Dispatched", "In Transit"])
    ).first()

    if existing_v_trip:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vehicle is currently unavailable for assignment (Already assigned to an active trip)."
        )

    # 4. Perform Assignment
    trip.driver_id = driver_uuid
    trip.vehicle_id = vehicle_uuid
    trip.status = "Assigned"

    if payload.shipment_id:
        try:
            shipment_uuid = uuid.UUID(payload.shipment_id)
            shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_uuid).first()
            if shipment:
                trip.shipment_id = shipment_uuid
                shipment.status = "Assigned"
        except ValueError:
            pass

    driver.status = "On Duty"
    vehicle.status = "In Use"

    db.commit()
    db.refresh(trip)

    # 5. Create Notification for Driver
    driver_user = db.query(User).filter(User.user_id == driver.user_id).first() if driver.user_id else None
    if driver_user:
        t_origin = getattr(trip, 'start_location', None) or getattr(trip, 'origin', None) or "N/A"
        t_dest = getattr(trip, 'destination', None) or getattr(trip, 'end_location', None) or "N/A"
        notification = Notification(
            notification_id=uuid.uuid4(),
            user_id=driver_user.user_id,
            title="New Trip Assignment",
            message=f"You have been assigned to Trip from {t_origin} to {t_dest} with Vehicle {vehicle.registration_number}.",
            is_read=False
        )
        db.add(notification)
        db.commit()

    # 6. Create Audit Log
    log_activity(
        db, current_user, action="Assign Trip", module="Dispatch",
        description=f"Dispatcher {current_user.full_name} assigned Driver ({driver.license_number}) and Vehicle ({vehicle.registration_number}) to Trip #{str(trip.trip_id)[:8]}",
        entity_type="Trip", entity_id=str(trip.trip_id)
    )

    return {
        "message": "Trip assigned successfully",
        "trip_id": str(trip.trip_id),
        "driver_id": str(driver.driver_id),
        "vehicle_id": str(vehicle.vehicle_id),
        "status": trip.status
    }


# ────────────────────────────────────────────────────────────────
# PUT /api/dispatcher/trips/status
# ────────────────────────────────────────────────────────────────
@router.put("/trips/status")
def update_trip_status(
    payload: TripStatusUpdateRequest,
    current_user: User = Depends(require_roles(["Admin", "FleetManager", "Dispatcher", "Driver"])),
    db: Session = Depends(get_db)
):
    try:
        trip_uuid = uuid.UUID(payload.trip_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid trip_id format")

    trip = db.query(Trip).filter(Trip.trip_id == trip_uuid).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    old_status = trip.status
    trip.status = payload.status

    # If completed, free driver and vehicle
    if payload.status.title() == "Completed":
        if trip.driver_id:
            drv = db.query(Driver).filter(Driver.driver_id == trip.driver_id).first()
            if drv:
                drv.status = "Available"
        if trip.vehicle_id:
            veh = db.query(Vehicle).filter(Vehicle.vehicle_id == trip.vehicle_id).first()
            if veh:
                veh.status = "Available"
        if trip.shipment_id:
            shp = db.query(Shipment).filter(Shipment.shipment_id == trip.shipment_id).first()
            if shp:
                shp.status = "Delivered"

    db.commit()

    log_activity(
        db, current_user, action="Update Trip Status", module="Trips",
        description=f"Updated status of Trip #{str(trip.trip_id)[:8]} from '{old_status}' to '{payload.status}'",
        entity_type="Trip", entity_id=str(trip.trip_id)
    )

    return {
        "message": "Trip status updated successfully",
        "trip_id": str(trip.trip_id),
        "status": trip.status
    }
