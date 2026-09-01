import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from database import get_db

from app.models.user import User
from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.models.fuel_record import FuelRecord
from app.models.trip import Trip
from app.core.security import get_current_user, require_roles

router = APIRouter(
    prefix="/fuel",
    tags=["Fuel Monitoring & Analytics"]
)


def build_fuel_response(f: FuelRecord, db: Session) -> dict:
    v_reg = "Unknown"
    v_model = "Unknown"
    if f.vehicle_id:
        v = db.query(Vehicle).filter(Vehicle.vehicle_id == f.vehicle_id).first()
        if v:
            v_reg = v.registration_number
            v_model = f"{v.brand} {v.model}"

    return {
        "fuel_id": str(f.fuel_id),
        "vehicle_id": str(f.vehicle_id),
        "registration_number": v_reg,
        "vehicle_model": v_model,
        "driver_id": str(f.driver_id) if f.driver_id else None,
        "amount": float(f.amount),
        "fuel_amount": float(f.amount),
        "cost": float(f.cost),
        "fuel_cost": float(f.cost),
        "mileage": float(f.mileage or 0.0),
        "refill_date": f.refill_date.isoformat() if f.refill_date else f.recorded_at.strftime("%Y-%m-%d") if f.recorded_at else None,
        "recorded_at": f.recorded_at.isoformat() if f.recorded_at else None
    }


# ---------------------------------------------------------
# Log Fuel Refill Entry (Admin, FleetManager, Driver assigned; Dispatcher: 403)
# ---------------------------------------------------------
@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
def log_fuel_refill(
    data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_str == "Dispatcher":
        raise HTTPException(status_code=403, detail="Access denied: Dispatchers can view fuel records but cannot create or log fuel entries.")

    try:
        vehicle_uuid = uuid.UUID(str(data.get("vehicle_id")))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid vehicle_id UUID format")

    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_uuid).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    driver_uuid = None
    if role_str == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver or vehicle.assigned_driver != driver.driver_id:
            raise HTTPException(status_code=403, detail="Access denied: You can only log fuel for your assigned vehicle.")
        driver_uuid = driver.driver_id
    elif data.get("driver_id"):
        try:
            driver_uuid = uuid.UUID(str(data["driver_id"]))
        except ValueError:
            pass

    refill_d = None
    if data.get("refill_date"):
        try:
            refill_d = datetime.datetime.strptime(str(data["refill_date"]), "%Y-%m-%d").date()
        except ValueError:
            pass
    if not refill_d:
        refill_d = datetime.date.today()

    amount_val = float(data.get("amount") if data.get("amount") is not None else data.get("fuel_amount", 0.0))
    cost_val = float(data.get("cost") if data.get("cost") is not None else data.get("fuel_cost", 0.0))

    new_fuel = FuelRecord(
        fuel_id=uuid.uuid4(),
        vehicle_id=vehicle_uuid,
        driver_id=driver_uuid,
        amount=amount_val,
        cost=cost_val,
        mileage=float(data.get("mileage", 0.0)),
        refill_date=refill_d
    )
    db.add(new_fuel)
    db.commit()
    db.refresh(new_fuel)
    return build_fuel_response(new_fuel, db)


# ---------------------------------------------------------
# List Fuel Records (Admin, FleetManager, Dispatcher: Read-Only All; Driver: Assigned only)
# ---------------------------------------------------------
@router.get("")
@router.get("/")
def list_fuel_records(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)

    if role_str == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver:
            return []
        assigned_vehicles = db.query(Vehicle).filter(Vehicle.assigned_driver == driver.driver_id).all()
        v_ids = [v.vehicle_id for v in assigned_vehicles]
        records = db.query(FuelRecord).filter(FuelRecord.vehicle_id.in_(v_ids)).order_by(FuelRecord.recorded_at.desc()).all() if v_ids else []
    else:
        # Admin, FleetManager, and Dispatcher can view all fuel records
        records = db.query(FuelRecord).order_by(FuelRecord.recorded_at.desc()).all()

    return [build_fuel_response(f, db) for f in records]


# ---------------------------------------------------------
# Update Fuel Record (Admin, FleetManager, Driver; Dispatcher: 403)
# ---------------------------------------------------------
@router.put("/{fuel_id}")
def update_fuel_record(
    fuel_id: str,
    data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_str == "Dispatcher":
        raise HTTPException(status_code=403, detail="Access denied: Dispatchers can view fuel records but cannot edit or modify them.")

    try:
        fuel_uuid = uuid.UUID(fuel_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid fuel_id UUID format")

    fuel = db.query(FuelRecord).filter(FuelRecord.fuel_id == fuel_uuid).first()
    if not fuel:
        raise HTTPException(status_code=404, detail="Fuel record not found")

    if role_str == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver:
            raise HTTPException(status_code=403, detail="Access denied: Driver profile not found.")
        assigned_v = db.query(Vehicle).filter(Vehicle.assigned_driver == driver.driver_id).all()
        v_ids = [v.vehicle_id for v in assigned_v]
        if fuel.driver_id != driver.driver_id and fuel.vehicle_id not in v_ids:
            raise HTTPException(status_code=403, detail="Access denied: You can only update fuel records for your assigned vehicle.")

    if "vehicle_id" in data and data["vehicle_id"]:
        try:
            fuel.vehicle_id = uuid.UUID(str(data["vehicle_id"]))
        except ValueError:
            pass

    if "amount" in data or "fuel_amount" in data:
        fuel.amount = float(data.get("amount") if data.get("amount") is not None else data.get("fuel_amount", fuel.amount))

    if "cost" in data or "fuel_cost" in data:
        fuel.cost = float(data.get("cost") if data.get("cost") is not None else data.get("fuel_cost", fuel.cost))

    if "mileage" in data:
        fuel.mileage = float(data.get("mileage", fuel.mileage))

    if "refill_date" in data and data["refill_date"]:
        try:
            fuel.refill_date = datetime.datetime.strptime(str(data["refill_date"]), "%Y-%m-%d").date()
        except ValueError:
            pass

    db.commit()
    db.refresh(fuel)
    return build_fuel_response(fuel, db)


# ---------------------------------------------------------
# Delete Fuel Record (Admin, FleetManager, Driver; Dispatcher: 403)
# ---------------------------------------------------------
@router.delete("/{fuel_id}")
def delete_fuel_record(
    fuel_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_str == "Dispatcher":
        raise HTTPException(status_code=403, detail="Access denied: Dispatchers can view fuel records but cannot delete them.")

    try:
        fuel_uuid = uuid.UUID(fuel_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid fuel_id UUID format")

    fuel = db.query(FuelRecord).filter(FuelRecord.fuel_id == fuel_uuid).first()
    if not fuel:
        raise HTTPException(status_code=404, detail="Fuel record not found")

    if role_str == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver:
            raise HTTPException(status_code=403, detail="Access denied: Driver profile not found.")
        assigned_v = db.query(Vehicle).filter(Vehicle.assigned_driver == driver.driver_id).all()
        v_ids = [v.vehicle_id for v in assigned_v]
        if fuel.driver_id != driver.driver_id and fuel.vehicle_id not in v_ids:
            raise HTTPException(status_code=403, detail="Access denied: You can only delete fuel records for your assigned vehicle.")

    db.delete(fuel)
    db.commit()
    return {"message": "Fuel record deleted successfully"}


# ---------------------------------------------------------
# Compute Fuel Efficiency Metrics (Read-only for all including Dispatcher)
# ---------------------------------------------------------
@router.get("/efficiency")
def get_fuel_efficiency(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    vehicles = db.query(Vehicle).all()
    results = []

    for v in vehicles:
        total_fuel_liters = sum([f.amount for f in db.query(FuelRecord).filter(FuelRecord.vehicle_id == v.vehicle_id).all()])
        trips = db.query(Trip).filter(Trip.vehicle_id == v.vehicle_id, Trip.status == "Completed").all()
        total_distance_km = sum([float(t.actual_distance or t.distance or 0.0) for t in trips])

        km_per_liter = round(total_distance_km / total_fuel_liters, 2) if total_fuel_liters > 0 else 0.0

        results.append({
            "vehicle_id": str(v.vehicle_id),
            "registration_number": v.registration_number,
            "vehicle_type": v.vehicle_type,
            "total_distance_km": round(total_distance_km, 1),
            "total_fuel_liters": round(total_fuel_liters, 1),
            "fuel_efficiency_kml": km_per_liter,
            "fuel_mode_note": "Calculated via OSRM trip distance divided by logged fuel consumed"
        })

    return results


# ---------------------------------------------------------
# Compute Fuel Cost Trends Per Vehicle (Read-only for all including Dispatcher)
# ---------------------------------------------------------
@router.get("/cost-trends")
@router.get("/trends")
def get_fuel_cost_trends(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    records = db.query(FuelRecord).order_by(FuelRecord.recorded_at.asc()).all()
    
    total_cost = sum(float(r.cost) for r in records)
    total_liters = sum(float(r.amount) for r in records)
    
    monthly_costs = {}
    vehicle_costs = {}

    for r in records:
        month_str = r.recorded_at.strftime("%b %Y") if r.recorded_at else (r.refill_date.strftime("%b %Y") if r.refill_date else "Unknown")
        monthly_costs[month_str] = monthly_costs.get(month_str, 0.0) + float(r.cost)

        v_id = str(r.vehicle_id)
        if v_id not in vehicle_costs:
            v = db.query(Vehicle).filter(Vehicle.vehicle_id == r.vehicle_id).first()
            vehicle_costs[v_id] = {
                "registration_number": v.registration_number if v else "Unknown",
                "total_cost": 0.0,
                "refill_count": 0
            }
        vehicle_costs[v_id]["total_cost"] += float(r.cost)
        vehicle_costs[v_id]["refill_count"] += 1

    return {
        "total_cost": round(total_cost, 2),
        "total_liters": round(total_liters, 2),
        "monthly_cost": {k: round(v, 2) for k, v in monthly_costs.items()},
        "monthly_trends": [{"month": k, "cost": round(v, 2)} for k, v in monthly_costs.items()],
        "vehicle_breakdown": list(vehicle_costs.values())
    }
