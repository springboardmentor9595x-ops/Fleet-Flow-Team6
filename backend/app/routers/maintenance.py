import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Body, Query
from sqlalchemy.orm import Session
from database import get_db

from app.models.user import User
from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.models.maintenance import VehicleMaintenance
from app.core.security import get_current_user, require_roles
from app.celery_worker import run_maintenance_alert_check

router = APIRouter(
    prefix="/maintenance",
    tags=["Vehicle Maintenance"]
)


def build_maintenance_response(m: VehicleMaintenance, db: Session) -> dict:
    v_reg = "Unknown"
    v_type = "Unknown"
    if m.vehicle_id:
        v = db.query(Vehicle).filter(Vehicle.vehicle_id == m.vehicle_id).first()
        if v:
            v_reg = v.registration_number
            v_type = v.vehicle_type

    today = datetime.date.today()
    is_overdue = m.next_service_date and m.next_service_date < today and m.status not in ["Completed", "Cancelled"]
    is_upcoming = m.next_service_date and today <= m.next_service_date <= (today + datetime.timedelta(days=7)) and m.status not in ["Completed", "Cancelled"]

    return {
        "maintenance_id": str(m.maintenance_id),
        "vehicle_id": str(m.vehicle_id),
        "registration_number": v_reg,
        "vehicle_type": v_type,
        "maintenance_type": m.maintenance_type,
        "service_date": m.service_date.isoformat() if m.service_date else None,
        "next_service_date": m.next_service_date.isoformat() if m.next_service_date else None,
        "cost": float(m.cost or 0.0),
        "remarks": m.remarks or "",
        "status": m.status,
        "resolution_status": getattr(m, "resolution_status", "Unresolved") or "Unresolved",
        "is_overdue": is_overdue,
        "is_upcoming": is_upcoming,
        "created_at": m.created_at.isoformat() if m.created_at else None
    }


# ---------------------------------------------------------
# List All Maintenance Records (Role-Gated)
# ---------------------------------------------------------
@router.get("")
@router.get("/")
def list_maintenance(
    vehicle_id: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    
    query = db.query(VehicleMaintenance)
    if vehicle_id:
        try:
            v_uuid = uuid.UUID(vehicle_id)
            query = query.filter(VehicleMaintenance.vehicle_id == v_uuid)
        except ValueError:
            pass

    if role_str == "Driver":
        # Driver can view maintenance status/alerts for their assigned vehicle only
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver:
            return []
        assigned_vehicles = db.query(Vehicle).filter(Vehicle.assigned_driver == driver.driver_id).all()
        vehicle_ids = [v.vehicle_id for v in assigned_vehicles]
        records = query.filter(VehicleMaintenance.vehicle_id.in_(vehicle_ids)).all() if vehicle_ids else []
    else:
        # Admin, FleetManager, Dispatcher see fleet maintenance records
        records = query.order_by(VehicleMaintenance.next_service_date.asc()).all()

    return [build_maintenance_response(m, db) for m in records]


# ---------------------------------------------------------
# Get Maintenance History for a Single Vehicle
# ---------------------------------------------------------
@router.get("/vehicle/{vehicle_id}")
def get_vehicle_maintenance_history(
    vehicle_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        v_uuid = uuid.UUID(vehicle_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid vehicle_id UUID format")

    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_str == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver:
            raise HTTPException(status_code=403, detail="Access denied: Not your assigned vehicle.")
        v = db.query(Vehicle).filter(Vehicle.vehicle_id == v_uuid, Vehicle.assigned_driver == driver.driver_id).first()
        if not v:
            raise HTTPException(status_code=403, detail="Access denied: Not your assigned vehicle.")

    records = db.query(VehicleMaintenance).filter(VehicleMaintenance.vehicle_id == v_uuid).order_by(VehicleMaintenance.service_date.desc()).all()
    return [build_maintenance_response(m, db) for m in records]


# ---------------------------------------------------------
# Schedule Maintenance (Admin & FleetManager Only)
# ---------------------------------------------------------
@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
def schedule_maintenance(
    data: dict = Body(...),
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db)
):
    try:
        vehicle_uuid = uuid.UUID(str(data.get("vehicle_id")))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid vehicle_id UUID format")

    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_uuid).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    try:
        s_date = datetime.datetime.strptime(str(data.get("service_date")), "%Y-%m-%d").date()
        next_date = datetime.datetime.strptime(str(data.get("next_service_date")), "%Y-%m-%d").date()
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD")

    initial_status = data.get("status", "Scheduled")
    initial_res_status = data.get("resolution_status", "Resolved" if initial_status in ["Completed", "Resolved"] else "Unresolved")

    new_m = VehicleMaintenance(
        maintenance_id=uuid.uuid4(),
        vehicle_id=vehicle_uuid,
        maintenance_type=data.get("maintenance_type", "General Inspection"),
        service_date=s_date,
        next_service_date=next_date,
        cost=float(data.get("cost", 0.0)),
        remarks=data.get("remarks", ""),
        status=initial_status,
        resolution_status=initial_res_status
    )
    db.add(new_m)

    # Automatically set vehicle status to "Maintenance" if service starts immediately
    if initial_status == "In Service":
        vehicle.status = "Maintenance"

    db.commit()
    db.refresh(new_m)
    return build_maintenance_response(new_m, db)


# ---------------------------------------------------------
# Update / Complete Maintenance (Admin & FleetManager Only)
# ---------------------------------------------------------
@router.put("/{maintenance_id}")
def update_maintenance(
    maintenance_id: str,
    data: dict = Body(...),
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db)
):
    try:
        m_uuid = uuid.UUID(maintenance_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid maintenance_id UUID format")

    m = db.query(VehicleMaintenance).filter(VehicleMaintenance.maintenance_id == m_uuid).first()
    if not m:
        raise HTTPException(status_code=404, detail="Maintenance record not found")

    if "maintenance_type" in data:
        m.maintenance_type = data["maintenance_type"]
    if "cost" in data:
        m.cost = float(data["cost"])
    if "remarks" in data:
        m.remarks = data["remarks"]
    if "service_date" in data and data["service_date"]:
        m.service_date = datetime.datetime.strptime(str(data["service_date"]), "%Y-%m-%d").date()
    if "next_service_date" in data and data["next_service_date"]:
        m.next_service_date = datetime.datetime.strptime(str(data["next_service_date"]), "%Y-%m-%d").date()
    if "resolution_status" in data:
        m.resolution_status = data["resolution_status"]

    if "status" in data:
        new_status = data["status"]
        m.status = new_status
        if new_status in ["Completed", "Resolved"]:
            m.resolution_status = "Resolved"
        elif new_status in ["Scheduled", "In Service"]:
            m.resolution_status = "Unresolved"

        # Sync vehicle status
        vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == m.vehicle_id).first()
        if vehicle:
            if new_status == "In Service":
                vehicle.status = "Maintenance"
            elif new_status in ["Completed", "Resolved", "Cancelled"]:
                vehicle.status = "Available"

    db.commit()
    db.refresh(m)
    return build_maintenance_response(m, db)


# ---------------------------------------------------------
# Manual Trigger Maintenance Alert Scanning
# ---------------------------------------------------------
@router.post("/trigger-alert-check")
def trigger_alert_check(current_user: User = Depends(require_roles(["Admin", "FleetManager"]))):
    res = run_maintenance_alert_check()
    return res


# ---------------------------------------------------------
# Delete Maintenance Record
# ---------------------------------------------------------
@router.delete("/{maintenance_id}")
def delete_maintenance(
    maintenance_id: str,
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db)
):
    try:
        m_uuid = uuid.UUID(maintenance_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid maintenance UUID format")

    m = db.query(VehicleMaintenance).filter(VehicleMaintenance.maintenance_id == m_uuid).first()
    if not m:
        raise HTTPException(status_code=404, detail="Maintenance record not found")

    # If vehicle was in Maintenance status, revert to Available
    vehicle = db.query(Vehicle).filter(Vehicle.vehicle_id == m.vehicle_id).first()
    if vehicle and vehicle.status == "Maintenance":
        vehicle.status = "Available"

    db.delete(m)
    db.commit()
    return {"message": "Maintenance record deleted successfully"}
