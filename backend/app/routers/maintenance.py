from uuid import UUID
from typing import Optional
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import RoleEnum
from app.models.vehicle import Vehicle
from app.models.notification import Notification
from app.schemas.maintenance import MaintenanceCreate, MaintenanceUpdate, MaintenanceOut
from app.crud.maintenance import (
    create_maintenance,
    get_all_maintenance,
    get_maintenance,
    update_maintenance,
    get_upcoming_overdue,
)

try:
    import redis
except ImportError:
    redis = None


router = APIRouter(
    prefix="/maintenance",
    tags=["Maintenance"],
)


# ==========================================================
# SCHEDULE MAINTENANCE
# Admin + FleetManager only
# ==========================================================

@router.post("/", response_model=MaintenanceOut)
def schedule_maintenance(
    data: MaintenanceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    return create_maintenance(db, data)


# ==========================================================
# LIST MAINTENANCE
# Admin / FleetManager → all; Dispatcher → read-only all; Driver → own vehicle only
# ==========================================================

@router.get("/", response_model=list[MaintenanceOut])
def list_maintenance(
    vehicle_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role == RoleEnum.Driver:
        from app.models.driver import Driver
        from sqlalchemy import or_
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        driver_id = driver.driver_id if driver else None
        vehicle = db.query(Vehicle).filter(
            or_(Vehicle.assigned_driver == driver_id, Vehicle.assigned_driver == current_user.user_id)
        ).first()
        if not vehicle:
            return []
        return get_all_maintenance(db, vehicle_id=vehicle.vehicle_id)

    return get_all_maintenance(db, vehicle_id=vehicle_id)



# ==========================================================
# UPCOMING / OVERDUE (fleet-wide alert view)
# Admin + FleetManager
# ==========================================================

@router.get("/upcoming", response_model=list[MaintenanceOut])
def list_upcoming(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    """Returns maintenance records due within `days` days that are not yet Completed."""
    return get_upcoming_overdue(db, days_ahead=days)


# ==========================================================
# CHECK & DISPATCH MAINTENANCE ALERTS (Milestone Task B)
# ==========================================================

@router.post("/check-alerts")
def check_maintenance_alerts(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    """
    Scans maintenance records for upcoming (<= days) or overdue service dates,
    logs console alerts, and inserts non-duplicate notifications into the Notifications table.
    Dispatches via Celery worker if available, with direct execution fallback.
    """
    from app.tasks.maintenance_tasks import check_maintenance_alerts_task

    # Try dispatching to Celery worker asynchronously if Redis is up
    task_id = None
    if redis:
        try:
            from app.core.celery_app import celery_app
            r = redis.Redis.from_url(celery_app.conf.broker_url, socket_connect_timeout=0.3)
            if r.ping():
                task = check_maintenance_alerts_task.apply_async(args=[days])
                task_id = str(task.id)
        except Exception:
            task_id = None

    # Run alert processing (direct run ensures instantaneous feedback)
    result = check_maintenance_alerts_task(days_ahead=days)
    result["celery_task_id"] = task_id
    result["message"] = f"Processed maintenance alerts. Created {result.get('alerts_created', 0)} new notification(s)."
    return result


@router.get("/worker-status")
def get_worker_status(
    current_user=Depends(get_current_user),
):
    """Checks Celery worker connection and queue health."""
    from app.core.celery_app import celery_app

    redis_ok = False
    active_workers = []
    if redis:
        try:
            r = redis.Redis.from_url(celery_app.conf.broker_url, socket_connect_timeout=0.5)
            redis_ok = bool(r.ping())
        except Exception:
            redis_ok = False

    if redis_ok:
        try:
            insp = celery_app.control.inspect(timeout=0.5)
            active = insp.active() if insp else None
            if active:
                active_workers = list(active.keys())
        except Exception:
            pass

    return {
        "broker_url": celery_app.conf.broker_url,
        "redis_connected": redis_ok,
        "active_workers": active_workers,
        "worker_count": len(active_workers),
        "scheduled_tasks": list(celery_app.conf.beat_schedule.keys()),
    }


# ==========================================================
# GET ONE
# ==========================================================

@router.get("/{maintenance_id}", response_model=MaintenanceOut)
def get_one(
    maintenance_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    record = get_maintenance(db, maintenance_id)
    if not record:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    return record


# ==========================================================
# UPDATE / COMPLETE MAINTENANCE
# Admin + FleetManager
# ==========================================================

@router.put("/{maintenance_id}", response_model=MaintenanceOut)
def update_maintenance_record(
    maintenance_id: UUID,
    data: MaintenanceUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(RoleEnum.Admin, RoleEnum.FleetManager)),
):
    updated = update_maintenance(db, maintenance_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    return updated
