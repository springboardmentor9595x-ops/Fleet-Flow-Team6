"""
Fuel record CRUD endpoints.
Drivers can log refills for their own vehicle.
Admin/FleetManager can view trends and analytics across the fleet.
"""

import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from app.core.security import require_roles, get_current_user
from app.models.user import User
from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.models.fuel_record import FuelRecord

router = APIRouter(
    prefix="/fleet/fuel",
    tags=["Fuel Records"],
)


def _vehicle_reg(db: Session, vehicle_id) -> str:
    v = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id).first()
    return v.registration_number if v else "Unknown"


# ----------------------------------------------------------------
# GET /fleet/fuel  — list all (Admin/FleetManager) or own vehicle's (Driver)
# ----------------------------------------------------------------
@router.get("")
def get_fuel_records(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)

    if role_str == "Driver":
        # Driver sees only their own assigned vehicle's records
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver:
            return []
        # Get the vehicle assigned to this driver
        vehicle = db.query(Vehicle).filter(Vehicle.assigned_driver == driver.driver_id).first()
        if not vehicle:
            return []
        records = db.query(FuelRecord).filter(
            FuelRecord.vehicle_id == vehicle.vehicle_id
        ).order_by(FuelRecord.recorded_at.desc()).all()
    else:
        records = db.query(FuelRecord).order_by(FuelRecord.recorded_at.desc()).all()

    result = []
    for r in records:
        result.append({
            "fuel_id": str(r.fuel_id),
            "vehicle_id": str(r.vehicle_id),
            "vehicle_reg": _vehicle_reg(db, r.vehicle_id),
            "fuel_amount": r.fuel_amount,
            "fuel_cost": r.fuel_cost,
            "mileage": r.mileage,
            "refill_date": r.refill_date.isoformat() if r.refill_date else None,
            "notes": r.notes,
            "recorded_at": r.recorded_at.isoformat() if r.recorded_at else None,
            "efficiency_kmpl": round(r.mileage / r.fuel_amount, 2) if (r.mileage and r.fuel_amount) else None,
        })
    return result


# ----------------------------------------------------------------
# POST /fleet/fuel  — log a fuel refill
# ----------------------------------------------------------------
@router.post("", status_code=status.HTTP_201_CREATED)
def create_fuel_record(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)

    vehicle_id_str = data.get("vehicle_id")
    if not vehicle_id_str:
        raise HTTPException(status_code=400, detail="vehicle_id is required")

    vehicle_uuid = uuid.UUID(vehicle_id_str)

    # Drivers can only log for their assigned vehicle
    if role_str == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver:
            raise HTTPException(status_code=403, detail="No driver profile found for this user")
        vehicle = db.query(Vehicle).filter(Vehicle.assigned_driver == driver.driver_id).first()
        if not vehicle or vehicle.vehicle_id != vehicle_uuid:
            raise HTTPException(status_code=403, detail="You can only log fuel for your assigned vehicle")

    fuel_amount = float(data.get("fuel_amount", 0))
    fuel_cost = float(data.get("fuel_cost", 0))
    mileage = float(data.get("mileage")) if data.get("mileage") else None
    notes = data.get("notes", "")

    refill_date = None
    if data.get("refill_date"):
        try:
            refill_date = datetime.date.fromisoformat(data["refill_date"])
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid refill_date format. Use YYYY-MM-DD")

    new_record = FuelRecord(
        fuel_id=uuid.uuid4(),
        vehicle_id=vehicle_uuid,
        fuel_amount=fuel_amount,
        fuel_cost=fuel_cost,
        mileage=mileage,
        refill_date=refill_date,
        notes=notes,
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)

    return {
        "fuel_id": str(new_record.fuel_id),
        "vehicle_id": str(new_record.vehicle_id),
        "vehicle_reg": _vehicle_reg(db, new_record.vehicle_id),
        "fuel_amount": new_record.fuel_amount,
        "fuel_cost": new_record.fuel_cost,
        "mileage": new_record.mileage,
        "refill_date": new_record.refill_date.isoformat() if new_record.refill_date else None,
        "notes": new_record.notes,
        "recorded_at": new_record.recorded_at.isoformat() if new_record.recorded_at else None,
        "efficiency_kmpl": round(new_record.mileage / new_record.fuel_amount, 2)
            if (new_record.mileage and new_record.fuel_amount) else None,
    }


# ----------------------------------------------------------------
# GET /fleet/fuel/vehicle/{vehicle_id}  — fuel history for one vehicle
# ----------------------------------------------------------------
@router.get("/vehicle/{vehicle_id}")
def get_vehicle_fuel_records(
    vehicle_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Admin/FleetManager: fuel records for any vehicle.
    Driver: only for their assigned vehicle.
    """
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    vehicle_uuid = uuid.UUID(vehicle_id)

    # Drivers may only fetch their own vehicle's records
    if role_str == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver:
            raise HTTPException(status_code=403, detail="No driver profile found")
        assigned = db.query(Vehicle).filter(Vehicle.assigned_driver == driver.driver_id).first()
        if not assigned or assigned.vehicle_id != vehicle_uuid:
            raise HTTPException(status_code=403, detail="You can only view fuel records for your assigned vehicle")

    records = db.query(FuelRecord).filter(
        FuelRecord.vehicle_id == vehicle_uuid
    ).order_by(FuelRecord.recorded_at.desc()).all()

    result = []
    for r in records:
        result.append({
            "fuel_id": str(r.fuel_id),
            "vehicle_id": str(r.vehicle_id),
            "fuel_amount": r.fuel_amount,
            "fuel_cost": r.fuel_cost,
            "mileage": r.mileage,
            "refill_date": r.refill_date.isoformat() if r.refill_date else None,
            "notes": r.notes,
            "recorded_at": r.recorded_at.isoformat() if r.recorded_at else None,
            "efficiency_kmpl": round(r.mileage / r.fuel_amount, 2) if (r.mileage and r.fuel_amount) else None,
        })
    return result



# ----------------------------------------------------------------
# GET /fleet/fuel/efficiency  — fuel efficiency summary per vehicle
# ----------------------------------------------------------------
@router.get("/efficiency")
def get_fuel_efficiency(
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db),
):
    rows = db.query(
        FuelRecord.vehicle_id,
        func.sum(FuelRecord.fuel_amount).label("total_liters"),
        func.sum(FuelRecord.fuel_cost).label("total_cost"),
        func.sum(FuelRecord.mileage).label("total_mileage"),
        func.count(FuelRecord.fuel_id).label("refill_count"),
    ).group_by(FuelRecord.vehicle_id).all()

    result = []
    for row in rows:
        reg = _vehicle_reg(db, row.vehicle_id)
        eff = round(row.total_mileage / row.total_liters, 2) if (row.total_liters and row.total_mileage) else None
        result.append({
            "vehicle_id": str(row.vehicle_id),
            "vehicle_reg": reg,
            "total_liters": round(float(row.total_liters), 1),
            "total_cost": round(float(row.total_cost), 2),
            "total_mileage_km": round(float(row.total_mileage or 0), 1),
            "efficiency_kmpl": eff,
            "refill_count": row.refill_count,
        })
    return result


# ----------------------------------------------------------------
# GET /fleet/fuel/trends  — monthly fuel cost trends
# ----------------------------------------------------------------
@router.get("/trends")
def get_fuel_trends(
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db),
):
    records = db.query(FuelRecord).order_by(FuelRecord.recorded_at.asc()).all()
    monthly: dict[str, dict] = {}
    for r in records:
        if not r.recorded_at:
            continue
        key = r.recorded_at.strftime("%Y-%m")
        if key not in monthly:
            monthly[key] = {"cost": 0.0, "liters": 0.0}
        monthly[key]["cost"] += r.fuel_cost or 0.0
        monthly[key]["liters"] += r.fuel_amount or 0.0
    return [
        {"month": k, "cost": round(v["cost"], 2), "liters": round(v["liters"], 1)}
        for k, v in sorted(monthly.items())
    ]


# ----------------------------------------------------------------
# DELETE /fleet/fuel/{fuel_id}
# ----------------------------------------------------------------
@router.delete("/{fuel_id}", status_code=status.HTTP_200_OK)
def delete_fuel_record(
    fuel_id: str,
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db),
):
    fuel_uuid = uuid.UUID(fuel_id)
    record = db.query(FuelRecord).filter(FuelRecord.fuel_id == fuel_uuid).first()
    if not record:
        raise HTTPException(status_code=404, detail="Fuel record not found")
    db.delete(record)
    db.commit()
    return {"message": "Fuel record deleted successfully"}
