from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.driver import Driver
from app.models.user import User, RoleEnum
from app.models.vehicle import Vehicle, VehicleStatus
from app.models.trip import Trip, TripStatus
from app.models.attendance import Attendance
from app.schemas.driver import (
    DriverCreate,
    DriverOut,
    DriverUpdate,
    DriverUserInfo,
    DriverVehicleInfo,
    VehicleAssignRequest,
)
from app.core.deps import get_current_user, require_role
from app.services.notification_service import create_notification, create_broadcast_notification


router = APIRouter(
    prefix="/drivers",
    tags=["Drivers"],
)


def _build_driver_out(driver: Driver, db: Session) -> DriverOut:
    user_info = None
    if driver.user_id:
        user = db.query(User).filter(User.user_id == driver.user_id).first()
        if user:
            user_info = DriverUserInfo(
                user_id=user.user_id,
                full_name=user.full_name,
                email=user.email,
                phone_number=getattr(user, "phone_number", None),
            )

    # Check vehicle assigned to this driver (by user_id or driver_id)
    vehicle = (
        db.query(Vehicle)
        .filter(
            or_(
                Vehicle.assigned_driver == driver.user_id,
                Vehicle.assigned_driver == driver.driver_id,
            )
        )
        .first()
    )

    vehicle_info = None
    if vehicle:
        vehicle_info = DriverVehicleInfo(
            vehicle_id=vehicle.vehicle_id,
            registration_number=vehicle.registration_number,
            vehicle_type=vehicle.vehicle_type,
            brand=vehicle.brand,
            model=vehicle.model,
            status=vehicle.status.value if hasattr(vehicle.status, "value") else str(vehicle.status),
        )

    return DriverOut(
        driver_id=driver.driver_id,
        user_id=driver.user_id,
        license_number=driver.license_number,
        experience_years=driver.experience_years,
        address=driver.address,
        status=driver.status,
        created_at=driver.created_at,
        user=user_info,
        assigned_vehicle=vehicle_info,
    )


# ==========================================================
# REGISTER DRIVER PROFILE
# Admin + FleetManager
# ==========================================================

@router.post("/", response_model=DriverOut)
def create_driver(
    driver_in: DriverCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    existing_driver = (
        db.query(Driver)
        .filter(Driver.license_number == driver_in.license_number)
        .first()
    )
    if existing_driver:
        raise HTTPException(
            status_code=400,
            detail="License number already registered",
        )

    if driver_in.user_id:
        user = db.query(User).filter(User.user_id == driver_in.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if user.role != RoleEnum.Driver:
            raise HTTPException(status_code=400, detail="Target user does not have the 'Driver' role")

        existing_user_driver = (
            db.query(Driver)
            .filter(Driver.user_id == driver_in.user_id)
            .first()
        )
        if existing_user_driver:
            raise HTTPException(
                status_code=400,
                detail="This user is already linked to a driver profile",
            )

    driver = Driver(**driver_in.model_dump())
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return _build_driver_out(driver, db)


# ==========================================================
# LIST DRIVERS (Role-Scoped)
# Drivers see own profile only; Admin/FleetManager/Dispatcher see all
# ==========================================================

@router.get("/", response_model=list[DriverOut])
def get_drivers(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role == RoleEnum.Driver:
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver:
            return []
        return [_build_driver_out(driver, db)]

    drivers = db.query(Driver).all()
    return [_build_driver_out(d, db) for d in drivers]


# ==========================================================
# DRIVER ME PROFILE & CURRENT ASSIGNMENT
# ==========================================================

@router.get("/me", response_model=DriverOut)
def get_my_driver_profile(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found for current user")
    return _build_driver_out(driver, db)


# ==========================================================
# GET ONE DRIVER
# ==========================================================

@router.get("/{driver_id}", response_model=DriverOut)
def get_driver(
    driver_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    driver = db.query(Driver).filter(Driver.driver_id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    # Role validation
    if current_user.role == RoleEnum.Driver and driver.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access forbidden: You can only view your own profile")

    return _build_driver_out(driver, db)


# ==========================================================
# ASSIGN DRIVER TO VEHICLE
# Admin + FleetManager
# ==========================================================

@router.put("/{driver_id}/assign-vehicle", response_model=DriverOut)
def assign_vehicle(
    driver_id: UUID,
    payload: VehicleAssignRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    driver = db.query(Driver).filter(Driver.driver_id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == payload.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    if vehicle.status == VehicleStatus.Maintenance:
        raise HTTPException(
            status_code=400,
            detail="Vehicle is currently in Maintenance and cannot be assigned",
        )

    # 1. Unassign any other vehicle previously assigned to this driver
    driver_identity = driver.driver_id
    prev_vehicles = (
        db.query(Vehicle)
        .filter(
            or_(
                Vehicle.assigned_driver == driver.driver_id,
                Vehicle.assigned_driver == driver.user_id,
            ),
            Vehicle.vehicle_id != vehicle.vehicle_id,
        )
        .all()
    )
    for pv in prev_vehicles:
        pv.assigned_driver = None
        if pv.status == VehicleStatus.Assigned:
            pv.status = VehicleStatus.Available

    # 2. Assign target vehicle
    vehicle.assigned_driver = driver_identity
    if vehicle.status == VehicleStatus.Available:
        vehicle.status = VehicleStatus.Assigned

    # Update driver status
    driver.status = "Available"
    db.commit()
    db.refresh(driver)

    # --- Notification: driver assigned to vehicle ---
    if driver.user_id:
        create_notification(
            db,
            title="Vehicle Assigned",
            message=f"You have been assigned to vehicle {vehicle.registration_number} ({vehicle.vehicle_type}).",
            type="info",
            user_id=driver.user_id,
        )
    create_broadcast_notification(
        db,
        title="Driver Assignment Updated",
        message=f"Driver (license: {driver.license_number}) assigned to vehicle {vehicle.registration_number}.",
        type="info",
    )
    db.commit()

    return _build_driver_out(driver, db)


# ==========================================================
# UNASSIGN DRIVER FROM VEHICLE
# Admin + FleetManager
# ==========================================================

@router.put("/{driver_id}/unassign-vehicle", response_model=DriverOut)
def unassign_vehicle(
    driver_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    driver = db.query(Driver).filter(Driver.driver_id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    assigned_vehicles = (
        db.query(Vehicle)
        .filter(
            or_(
                Vehicle.assigned_driver == driver.user_id,
                Vehicle.assigned_driver == driver.driver_id,
            )
        )
        .all()
    )
    for v in assigned_vehicles:
        v.assigned_driver = None
        if v.status == VehicleStatus.Assigned:
            v.status = VehicleStatus.Available

    # --- Notification: driver unassigned ---
    if driver.user_id:
        create_notification(
            db,
            title="Vehicle Unassigned",
            message="Your vehicle assignment has been removed. Please contact Fleet Manager for updates.",
            type="info",
            user_id=driver.user_id,
        )
    create_broadcast_notification(
        db,
        title="Driver Unassigned from Vehicle",
        message=f"Driver (license: {driver.license_number}) has been unassigned from their vehicle.",
        type="info",
    )

    db.commit()
    db.refresh(driver)
    return _build_driver_out(driver, db)


# ==========================================================
# DRIVER ACTIVITY & PERFORMANCE LOG
# ==========================================================

@router.get("/{driver_id}/activity")
def get_driver_activity(
    driver_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    driver = db.query(Driver).filter(Driver.driver_id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    if current_user.role == RoleEnum.Driver and driver.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access forbidden: You can only view your own activity")

    # Driver trips
    trips = (
        db.query(Trip)
        .filter(or_(Trip.driver_id == driver.user_id, Trip.driver_id == driver.driver_id))
        .order_by(Trip.created_at.desc())
        .limit(20)
        .all()
    )

    total_trips = len(trips)
    completed_trips = sum(1 for t in trips if t.status == TripStatus.Completed)
    total_distance = sum(float(t.distance or 0) for t in trips if t.status == TripStatus.Completed)

    # Attendance logs
    attendance_records = (
        db.query(Attendance)
        .filter(Attendance.driver_id == driver.driver_id)
        .order_by(Attendance.attendance_date.desc())
        .limit(30)
        .all()
    )

    return {
        "driver_id": str(driver.driver_id),
        "license_number": driver.license_number,
        "status": driver.status,
        "total_trips": total_trips,
        "completed_trips": completed_trips,
        "total_distance_km": round(total_distance, 2),
        "recent_trips": [
            {
                "trip_id": str(t.trip_id),
                "start_location": t.start_location,
                "destination": t.destination,
                "distance": t.distance,
                "status": t.status.value if hasattr(t.status, "value") else str(t.status),
                "start_time": t.start_time.isoformat() if t.start_time else None,
                "end_time": t.end_time.isoformat() if t.end_time else None,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in trips
        ],
        "recent_attendance": [
            {
                "attendance_id": str(a.attendance_id),
                "date": str(a.attendance_date),
                "status": a.status,
            }
            for a in attendance_records
        ],
    }


# ==========================================================
# UPDATE DRIVER
# Admin + FleetManager
# ==========================================================

@router.put("/{driver_id}", response_model=DriverOut)
def update_driver(
    driver_id: UUID,
    driver_in: DriverUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    driver = db.query(Driver).filter(Driver.driver_id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    update_data = driver_in.model_dump(exclude_unset=True)

    if "license_number" in update_data and update_data["license_number"] != driver.license_number:
        existing = (
            db.query(Driver)
            .filter(
                Driver.license_number == update_data["license_number"],
                Driver.driver_id != driver_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="License number already exists")

    if "user_id" in update_data and update_data["user_id"] != driver.user_id:
        if update_data["user_id"]:
            existing_user = (
                db.query(Driver)
                .filter(
                    Driver.user_id == update_data["user_id"],
                    Driver.driver_id != driver_id,
                )
                .first()
            )
            if existing_user:
                raise HTTPException(status_code=400, detail="User is already linked to another driver profile")

    for field, value in update_data.items():
        setattr(driver, field, value)

    db.commit()
    db.refresh(driver)
    return _build_driver_out(driver, db)


# ==========================================================
# DELETE DRIVER
# Admin + FleetManager
# ==========================================================

@router.delete("/{driver_id}")
def delete_driver(
    driver_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    driver = db.query(Driver).filter(Driver.driver_id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    # Unassign any vehicles
    vehicles = (
        db.query(Vehicle)
        .filter(
            or_(
                Vehicle.assigned_driver == driver.user_id,
                Vehicle.assigned_driver == driver.driver_id,
            )
        )
        .all()
    )
    for v in vehicles:
        v.assigned_driver = None
        if v.status == VehicleStatus.Assigned:
            v.status = VehicleStatus.Available

    db.delete(driver)
    db.commit()
    return {"message": "Driver profile deleted successfully"}