from datetime import date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.maintenance import VehicleMaintenance
from app.models.vehicle import Vehicle, VehicleStatus
from app.schemas.maintenance import MaintenanceCreate, MaintenanceUpdate


# ==========================================================
# CREATE
# ==========================================================

def create_maintenance(db: Session, data: MaintenanceCreate) -> VehicleMaintenance:
    record = VehicleMaintenance(**data.model_dump())
    if record.status == "Completed":
        record.is_resolved = True
    db.add(record)

    # Set vehicle status to Maintenance when service starts
    if data.status == "In Progress":
        vehicle = db.query(Vehicle).filter(
            Vehicle.vehicle_id == data.vehicle_id
        ).first()
        if vehicle:
            vehicle.status = VehicleStatus.Maintenance

    db.commit()
    db.refresh(record)
    return record


# ==========================================================
# GET ALL (optionally filtered by vehicle)
# ==========================================================

def get_all_maintenance(db: Session, vehicle_id=None):
    q = db.query(VehicleMaintenance)
    if vehicle_id:
        q = q.filter(VehicleMaintenance.vehicle_id == vehicle_id)
    return q.order_by(VehicleMaintenance.service_date.desc()).all()


# ==========================================================
# GET ONE
# ==========================================================

def get_maintenance(db: Session, maintenance_id):
    return db.query(VehicleMaintenance).filter(
        VehicleMaintenance.maintenance_id == maintenance_id
    ).first()


# ==========================================================
# UPDATE
# ==========================================================

def update_maintenance(db: Session, maintenance_id, data: MaintenanceUpdate):
    record = get_maintenance(db, maintenance_id)
    if not record:
        return None

    update_data = data.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(record, key, value)

    # Sync vehicle status based on maintenance status
    if "status" in update_data:
        if update_data["status"] == "Completed":
            record.is_resolved = True
        vehicle = db.query(Vehicle).filter(
            Vehicle.vehicle_id == record.vehicle_id
        ).first()
        if vehicle:
            if update_data["status"] == "In Progress":
                vehicle.status = VehicleStatus.Maintenance
            elif update_data["status"] in ("Completed", "Scheduled") and vehicle.status == VehicleStatus.Maintenance:
                vehicle.status = VehicleStatus.Available

    db.commit()
    db.refresh(record)
    return record


# ==========================================================
# UPCOMING / OVERDUE
# ==========================================================

def get_upcoming_overdue(db: Session, days_ahead: int = 7):
    today = date.today()
    threshold = today + timedelta(days=days_ahead)

    return db.query(VehicleMaintenance).filter(
        VehicleMaintenance.next_service_date != None,
        VehicleMaintenance.next_service_date <= threshold,
        VehicleMaintenance.is_resolved == False,
    ).all()
