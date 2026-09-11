from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import RoleEnum
from app.schemas.fuel_record import FuelRecordCreate, FuelRecordOut
from app.crud.fuel_record import (
    create_fuel_record,
    get_all_fuel_records,
    get_fuel_record,
    get_fuel_efficiency,
    get_fuel_cost_trends,
)


router = APIRouter(
    prefix="/fuel",
    tags=["Fuel Records"],
)


# ==========================================================
# LOG A FUEL REFILL
# Admin, FleetManager, Driver (own assigned vehicle)
# ==========================================================

@router.post("/", response_model=FuelRecordOut)
def log_fuel(
    data: FuelRecordCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role == RoleEnum.Dispatcher:
        raise HTTPException(status_code=403, detail="Dispatchers cannot log fuel records")

    if current_user.role == RoleEnum.Driver:
        from app.models.driver import Driver
        from app.models.vehicle import Vehicle
        from sqlalchemy import or_
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        driver_id = driver.driver_id if driver else None
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == data.vehicle_id).first()
        if not vehicle or (vehicle.assigned_driver != driver_id and vehicle.assigned_driver != current_user.user_id):
            raise HTTPException(
                status_code=403,
                detail="Drivers can only log fuel for their own assigned vehicle"
            )

    return create_fuel_record(db, data)


# ==========================================================
# LIST FUEL RECORDS
# Admin / FleetManager → all; Driver → own assigned vehicle only; Dispatcher → 403
# ==========================================================

@router.get("/", response_model=list[FuelRecordOut])
def list_fuel(
    vehicle_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role == RoleEnum.Dispatcher:
        raise HTTPException(status_code=403, detail="Dispatchers do not have access to fuel records")

    if current_user.role == RoleEnum.Driver:
        from app.models.driver import Driver
        from app.models.vehicle import Vehicle
        from sqlalchemy import or_
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        driver_id = driver.driver_id if driver else None
        vehicle = db.query(Vehicle).filter(
            or_(Vehicle.assigned_driver == driver_id, Vehicle.assigned_driver == current_user.user_id)
        ).first()
        if not vehicle:
            return []
        return get_all_fuel_records(db, vehicle_id=vehicle.vehicle_id)

    return get_all_fuel_records(db, vehicle_id=vehicle_id)



# ==========================================================
# FUEL EFFICIENCY ANALYTICS
# Admin + FleetManager (all vehicles), Driver (assigned vehicle only)
# ==========================================================

@router.get("/analytics/efficiency")
def fuel_efficiency(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager, RoleEnum.Driver)),
):
    """km per litre per vehicle, derived from OSRM trip distances."""
    all_eff = get_fuel_efficiency(db)
    if current_user.role == RoleEnum.Driver:
        from app.models.driver import Driver
        from app.models.vehicle import Vehicle
        from sqlalchemy import or_
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        driver_id = driver.driver_id if driver else None
        vehicle = db.query(Vehicle).filter(
            or_(Vehicle.assigned_driver == driver_id, Vehicle.assigned_driver == current_user.user_id)
        ).first()
        if not vehicle:
            return []
        return [item for item in all_eff if item.get("vehicle_id") == str(vehicle.vehicle_id)]
    return all_eff


# ==========================================================
# FUEL COST TRENDS (monthly)
# Admin + FleetManager only; Driver returns empty list
# ==========================================================

@router.get("/analytics/trends")
def fuel_trends(
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager, RoleEnum.Driver)),
):
    if current_user.role == RoleEnum.Driver:
        return []
    return get_fuel_cost_trends(db)


# ==========================================================
# GET ONE RECORD
# ==========================================================

@router.get("/{fuel_id}", response_model=FuelRecordOut)
def get_one(
    fuel_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    record = get_fuel_record(db, fuel_id)
    if not record:
        raise HTTPException(status_code=404, detail="Fuel record not found")
    return record
