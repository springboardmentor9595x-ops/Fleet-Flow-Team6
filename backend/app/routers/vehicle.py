from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.deps import require_roles, get_current_user
from app.database import get_db
from app.schemas.vehicle import VehicleCreate, VehicleUpdate, VehicleOut
from app.crud.vehicle import (
    create_vehicle,
    get_all_vehicles,
    get_vehicle,
    update_vehicle,
    delete_vehicle,
)
from app.models.user import User, RoleEnum
from app.models.driver import Driver
from app.models.vehicle import Vehicle


router = APIRouter()


# Admin & Fleet Manager only
@router.post("/", response_model=VehicleOut)
def add_vehicle(
    vehicle: VehicleCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles("Admin", "FleetManager")),
):
    return create_vehicle(db, vehicle)


# Any logged-in user (Drivers can only view their own assigned vehicle)
@router.get("/", response_model=list[VehicleOut])
def list_vehicles(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if user.role == RoleEnum.Driver:
        driver = db.query(Driver).filter(Driver.user_id == user.user_id).first()
        driver_id = driver.driver_id if driver else None
        return db.query(Vehicle).filter(
            (Vehicle.assigned_driver == user.user_id) |
            (Vehicle.assigned_driver == driver_id)
        ).all()
    return get_all_vehicles(db)


# Any logged-in user (Drivers can only view their own assigned vehicle)
@router.get("/{vehicle_id}", response_model=VehicleOut)
def vehicle_details(
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    vehicle = get_vehicle(db, vehicle_id)

    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    if user.role == RoleEnum.Driver:
        driver = db.query(Driver).filter(Driver.user_id == user.user_id).first()
        driver_id = driver.driver_id if driver else None
        if vehicle.assigned_driver != user.user_id and vehicle.assigned_driver != driver_id:
            raise HTTPException(
                status_code=403,
                detail="Access forbidden: You can only view your assigned vehicle"
            )

    return vehicle


# Admin & Fleet Manager only
@router.put("/{vehicle_id}", response_model=VehicleOut)
def edit_vehicle(
    vehicle_id: UUID,
    vehicle: VehicleUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_roles("Admin", "FleetManager")),
):
    updated = update_vehicle(db, vehicle_id, vehicle)

    if not updated:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    return updated


# Admin & Fleet Manager only
@router.delete("/{vehicle_id}")
def remove_vehicle(
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    user=Depends(require_roles("Admin", "FleetManager")),
):
    deleted = delete_vehicle(db, vehicle_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    return {"message": "Vehicle deleted successfully"}


# ==========================================================
# ASSIGN DRIVER TO VEHICLE
# Admin & Fleet Manager only
# ==========================================================

from pydantic import BaseModel

class AssignDriverBody(BaseModel):
    driver_id: UUID | None = None  # None = unassign


@router.put("/{vehicle_id}/assign-driver", response_model=VehicleOut)
def assign_driver(
    vehicle_id: UUID,
    body: AssignDriverBody,
    db: Session = Depends(get_db),
    user=Depends(require_roles("Admin", "FleetManager")),
):
    vehicle = get_vehicle(db, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    vehicle.assigned_driver = body.driver_id
    db.commit()
    db.refresh(vehicle)
    return vehicle