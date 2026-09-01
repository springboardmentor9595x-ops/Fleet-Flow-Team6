import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from database import get_db

from app.models.user import User, RoleEnum
from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.models.trip import Trip
from app.models.shipment import Shipment
from app.models.attendance import Attendance
from app.models.maintenance import VehicleMaintenance
from app.core.security import hash_password, get_current_user, require_roles

router = APIRouter(
    prefix="/drivers",
    tags=["Driver Management & Assignment"]
)


def build_driver_response(driver: Driver, user: User, db: Session) -> dict:
    assigned_v = db.query(Vehicle).filter(Vehicle.assigned_driver == driver.driver_id).first()
    v_info = None
    if assigned_v:
        v_info = {
            "vehicle_id": str(assigned_v.vehicle_id),
            "registration_number": assigned_v.registration_number,
            "vehicle_type": assigned_v.vehicle_type,
            "status": assigned_v.status
        }

    # Trips count
    trips_completed = db.query(Trip).filter(Trip.driver_id == driver.driver_id, Trip.status == "Completed").count()
    trips_total = db.query(Trip).filter(Trip.driver_id == driver.driver_id).count()

    return {
        "driver_id": str(driver.driver_id),
        "user_id": str(user.user_id),
        "full_name": user.full_name,
        "email": user.email,
        "phone": user.phone,
        "license_number": driver.license_number,
        "experience_years": driver.experience_years,
        "address": driver.address,
        "status": driver.status or "Active",
        "assigned_vehicle": v_info,
        "trips_completed": trips_completed,
        "trips_total": trips_total,
        "created_at": driver.created_at.isoformat() if driver.created_at else None
    }


# ---------------------------------------------------------
# Get Driver's Own Profile & Assignment (Driver Only)
# ---------------------------------------------------------
@router.get("/me")
def get_driver_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found for current user.")

    res = build_driver_response(driver, current_user, db)

    # Add active shipment and recent trip details for Driver Dashboard
    active_shipment = db.query(Shipment).filter(
        Shipment.driver_id == driver.driver_id,
        Shipment.status.in_(["Assigned", "In Transit"])
    ).first()
    
    res["active_shipment"] = {
        "shipment_id": str(active_shipment.shipment_id),
        "tracking_number": active_shipment.tracking_number,
        "source": active_shipment.source,
        "destination": active_shipment.destination,
        "status": active_shipment.status
    } if active_shipment else None

    # Attendance summary for current month
    today = datetime.date.today()
    first_day = today.replace(day=1)
    monthly_att = db.query(Attendance).filter(
        Attendance.driver_id == driver.driver_id,
        Attendance.date >= first_day
    ).all()
    present_days = sum(1 for a in monthly_att if a.status == "Present")
    total_marked_days = len(monthly_att)
    res["attendance_summary"] = f"{present_days}/{total_marked_days if total_marked_days > 0 else 1} days present this month"

    today_att = db.query(Attendance).filter(Attendance.driver_id == driver.driver_id, Attendance.date == today).first()
    res["today_attendance"] = today_att.status if today_att else "Not Marked"

    # Recent Completed Trips
    recent_trips = db.query(Trip).filter(
        Trip.driver_id == driver.driver_id
    ).order_by(Trip.start_time.desc()).limit(5).all()

    res["recent_trips"] = [
        {
            "trip_id": str(t.trip_id),
            "route": f"{t.start_location} → {t.destination}",
            "distance_km": float(t.actual_distance or t.distance or 0.0),
            "status": t.status,
            "start_time": t.start_time.isoformat() if t.start_time else None
        }
        for t in recent_trips
    ]

    # Assigned Vehicle Maintenance Status
    assigned_v = db.query(Vehicle).filter(Vehicle.assigned_driver == driver.driver_id).first()
    res["vehicle_maintenance_status"] = "No Vehicle Assigned"
    if assigned_v:
        maint = db.query(VehicleMaintenance).filter(
            VehicleMaintenance.vehicle_id == assigned_v.vehicle_id
        ).order_by(VehicleMaintenance.next_service_date.asc()).first()

        if maint and maint.next_service_date:
            res_st = getattr(maint, "resolution_status", "Unresolved") or "Unresolved"
            if maint.next_service_date < today and res_st != "Resolved":
                res["vehicle_maintenance_status"] = f"OVERDUE since {maint.next_service_date.isoformat()} ({maint.maintenance_type})"
            else:
                res["vehicle_maintenance_status"] = f"Next service due: {maint.next_service_date.isoformat()} ({maint.maintenance_type})"
        else:
            res["vehicle_maintenance_status"] = "Vehicle service up to date ✓"

    return res


# ---------------------------------------------------------
# List All Drivers (Admin, FleetManager, Dispatcher read-only)
# ---------------------------------------------------------
@router.get("")
@router.get("/")
def list_drivers(
    current_user: User = Depends(require_roles(["Admin", "FleetManager", "Dispatcher"])),
    db: Session = Depends(get_db)
):
    results = db.query(Driver, User).join(User, Driver.user_id == User.user_id).all()
    return [build_driver_response(d, u, db) for d, u in results]


# ---------------------------------------------------------
# Register Driver Profile (Admin & FleetManager Only)
# ---------------------------------------------------------
@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
def register_driver(
    data: dict = Body(...),
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db)
):
    email = data.get("email")
    lic_num = data.get("license_number", "LIC-DEFAULT")

    if not email or db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered or invalid")

    if db.query(Driver).filter(Driver.license_number == lic_num).first():
        raise HTTPException(status_code=400, detail="License number already registered")

    user_id = uuid.uuid4()
    raw_pwd = data.get("password", "Driver123!")
    new_user = User(
        user_id=user_id,
        full_name=data.get("full_name"),
        email=email,
        password=hash_password(raw_pwd),
        phone=data.get("phone", ""),
        role=RoleEnum.Driver
    )
    db.add(new_user)
    db.flush()

    new_driver = Driver(
        driver_id=uuid.uuid4(),
        user_id=user_id,
        license_number=data.get("license_number", "LIC-DEFAULT"),
        experience_years=int(data.get("experience_years", 0)),
        address=data.get("address", ""),
        status="Active"
    )
    db.add(new_driver)
    db.flush()

    # Optional vehicle assignment on creation
    if data.get("vehicle_id"):
        try:
            v_uuid = uuid.UUID(data["vehicle_id"])
            vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == v_uuid).first()
            if vehicle:
                vehicle.assigned_driver = new_driver.driver_id
                vehicle.status = "Assigned"
                new_driver.status = "Assigned"
        except ValueError:
            pass

    try:
        db.commit()
        db.refresh(new_driver)
        return build_driver_response(new_driver, new_user, db)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"CRITICAL REGISTER DRIVER ERROR: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Driver Registration Error: {str(e)}")


# ---------------------------------------------------------
# Assign Driver to Vehicle (Admin & FleetManager Only)
# ---------------------------------------------------------
@router.put("/{driver_id}/assign-vehicle")
def assign_driver_to_vehicle(
    driver_id: str,
    data: dict = Body(...),
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db)
):
    try:
        d_uuid = uuid.UUID(driver_id)
        v_uuid = uuid.UUID(str(data.get("vehicle_id")))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid driver_id or vehicle_id UUID format")

    driver = db.query(Driver).filter(Driver.driver_id == d_uuid).first()
    user = db.query(User).filter(User.user_id == driver.user_id).first() if driver else None
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == v_uuid).first()

    if not driver or not vehicle:
        raise HTTPException(status_code=404, detail="Driver or Vehicle not found")

    # Unassign existing driver from vehicle if present
    if vehicle.assigned_driver and vehicle.assigned_driver != driver.driver_id:
        old_d = db.query(Driver).filter(Driver.driver_id == vehicle.assigned_driver).first()
        if old_d:
            old_d.status = "Active"

    vehicle.assigned_driver = driver.driver_id
    vehicle.status = "Assigned"
    driver.status = "Assigned"

    # Trigger Notifications
    from app.services.notification_service import notify_roles, notify_user
    if user:
        notify_user(db, user.user_id, "Vehicle Assignment", f"You have been assigned to vehicle {vehicle.registration_number}.", "info")
    notify_roles(db, ["Admin", "FleetManager", "Dispatcher"], "Driver Assignment", f"Driver {user.full_name if user else 'Driver'} assigned to vehicle {vehicle.registration_number}.", "info")

    db.commit()
    return build_driver_response(driver, user, db)


# ---------------------------------------------------------
# Unassign Driver from Vehicle (Admin & FleetManager Only)
# ---------------------------------------------------------
@router.put("/{driver_id}/unassign")
def unassign_driver(
    driver_id: str,
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db)
):
    try:
        d_uuid = uuid.UUID(driver_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid driver_id UUID format")

    driver = db.query(Driver).filter(Driver.driver_id == d_uuid).first()
    user = db.query(User).filter(User.user_id == driver.user_id).first() if driver else None
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    vehicles = db.query(Vehicle).filter(Vehicle.assigned_driver == driver.driver_id).all()
    for v in vehicles:
        v.assigned_driver = None
        if v.status == "Assigned":
            v.status = "Available"

    driver.status = "Active"
    db.commit()
    return build_driver_response(driver, user, db)


# ---------------------------------------------------------
# Log Driver Attendance
# ---------------------------------------------------------
@router.post("/attendance")
def log_attendance(
    data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    
    if role_str == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver:
            raise HTTPException(status_code=404, detail="Driver profile not found.")
        driver_id = driver.driver_id
    else:
        try:
            driver_id = uuid.UUID(str(data.get("driver_id")))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid driver_id UUID format")

    today = datetime.date.today()
    status_val = data.get("status", "Present")

    att = db.query(Attendance).filter(Attendance.driver_id == driver_id, Attendance.date == today).first()
    if att:
        att.status = status_val
    else:
        att = Attendance(
            attendance_id=uuid.uuid4(),
            driver_id=driver_id,
            date=today,
            status=status_val
        )
        db.add(att)

    db.commit()
    return {"message": "Attendance marked successfully", "date": today.isoformat(), "status": status_val}
