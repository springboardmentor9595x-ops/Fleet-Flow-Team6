import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from database import get_db
from app.core.security import require_roles, get_current_user
from app.models.user import User
from app.models.driver import Driver
from app.models.attendance import Attendance
from app.models.trip import Trip
from app.services.audit_service import log_activity


router = APIRouter(
    prefix="/attendance",
    tags=["Attendance Tracking"],
)


class MarkAttendanceRequest(BaseModel):
    driver_id: str
    date: date
    status: str  # Present, Absent, Leave


# ────────────────────────────────────────────────────────────────
# POST /attendance/check-in (Driver)
# ────────────────────────────────────────────────────────────────
@router.post("/check-in", status_code=status.HTTP_200_OK)
def check_in(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Driver self check-in endpoint.
    Creates/updates today's attendance record with check_in_time and status='Present'.
    Prevents duplicate active check-in.
    """
    driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found for current user."
        )

    today = date.today()
    now_utc = datetime.now(timezone.utc)

    # Check for existing active check-in for today
    existing = db.query(Attendance).filter(
        Attendance.driver_id == driver.driver_id,
        Attendance.date == today
    ).first()

    if existing and existing.check_in_time and not existing.check_out_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already checked in for today."
        )

    if existing:
        existing.status = "Present"
        existing.check_in_time = now_utc
        existing.check_out_time = None
        record = existing
    else:
        record = Attendance(
            attendance_id=uuid.uuid4(),
            driver_id=driver.driver_id,
            date=today,
            status="Present",
            check_in_time=now_utc,
            check_out_time=None
        )
        db.add(record)

    # Update driver status to Available if not currently assigned to active trip
    active_trip = db.query(Trip).filter(
        Trip.driver_id == driver.driver_id,
        Trip.status.in_(["Scheduled", "Assigned", "Dispatched", "In Transit"])
    ).first()

    if active_trip:
        driver.status = "On Duty"
    else:
        driver.status = "Available"

    from app.models.notification import Notification
    db.add(Notification(
        notification_id=uuid.uuid4(),
        type="success",
        title="Driver Checked In",
        message=f"Driver {current_user.full_name} checked in and marked Present for today."
    ))

    db.commit()
    db.refresh(record)

    log_activity(
        db, current_user, action="Attendance Check-In", module="Attendance",
        description=f"Driver {current_user.full_name} checked in successfully",
        entity_type="Attendance", entity_id=str(record.attendance_id)
    )

    return {
        "message": "Checked in successfully",
        "attendance_id": str(record.attendance_id),
        "driver_id": str(driver.driver_id),
        "date": str(record.date),
        "status": record.status,
        "check_in_time": record.check_in_time.isoformat() if record.check_in_time else None,
        "driver_status": driver.status
    }


# ────────────────────────────────────────────────────────────────
# POST /attendance/check-out (Driver)
# ────────────────────────────────────────────────────────────────
@router.post("/check-out", status_code=status.HTTP_200_OK)
def check_out(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Driver self check-out endpoint.
    Requires an active check-in. Updates status to 'Off Duty'.
    """
    driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found for current user."
        )

    today = date.today()
    now_utc = datetime.now(timezone.utc)

    record = db.query(Attendance).filter(
        Attendance.driver_id == driver.driver_id,
        Attendance.date == today,
        Attendance.check_in_time.isnot(None),
        Attendance.check_out_time.is_(None)
    ).first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active check-in found to check out."
        )

    record.check_out_time = now_utc
    record.status = "Off Duty"
    driver.status = "Off Duty"

    db.commit()
    db.refresh(record)

    log_activity(
        db, current_user, action="Attendance Check-Out", module="Attendance",
        description=f"Driver {current_user.full_name} checked out successfully",
        entity_type="Attendance", entity_id=str(record.attendance_id)
    )

    return {
        "message": "Checked out successfully",
        "attendance_id": str(record.attendance_id),
        "driver_id": str(driver.driver_id),
        "date": str(record.date),
        "status": record.status,
        "check_out_time": record.check_out_time.isoformat() if record.check_out_time else None,
        "driver_status": driver.status
    }


# ────────────────────────────────────────────────────────────────
# GET /attendance/today (Driver self status)
# ────────────────────────────────────────────────────────────────
@router.get("/today")
def get_today_attendance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
    if not driver:
        return {
            "driver_id": None,
            "checked_in": False,
            "checked_out": False,
            "status": "Not Checked In",
            "check_in_time": None,
            "check_out_time": None
        }

    today = date.today()
    record = db.query(Attendance).filter(
        Attendance.driver_id == driver.driver_id,
        Attendance.date == today
    ).order_by(desc(Attendance.check_in_time)).first()

    if not record or not record.check_in_time:
        return {
            "driver_id": str(driver.driver_id),
            "checked_in": False,
            "checked_out": False,
            "status": "Not Checked In",
            "check_in_time": None,
            "check_out_time": None
        }

    checked_in = record.check_in_time is not None and record.check_out_time is None
    checked_out = record.check_out_time is not None

    return {
        "attendance_id": str(record.attendance_id),
        "driver_id": str(driver.driver_id),
        "checked_in": checked_in,
        "checked_out": checked_out,
        "status": record.status,
        "check_in_time": record.check_in_time.isoformat() if record.check_in_time else None,
        "check_out_time": record.check_out_time.isoformat() if record.check_out_time else None
    }


# ────────────────────────────────────────────────────────────────
# POST /attendance/mark (Admin, FleetManager, Dispatcher)
# ────────────────────────────────────────────────────────────────
@router.post("/mark", status_code=status.HTTP_200_OK)
def mark_attendance(
    payload: MarkAttendanceRequest,
    current_user: User = Depends(require_roles(["Admin", "FleetManager", "Dispatcher"])),
    db: Session = Depends(get_db),
):
    try:
        driver_uuid = uuid.UUID(payload.driver_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid driver_id format")

    driver = db.query(Driver).filter(Driver.driver_id == driver_uuid).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    normalized_status = payload.status.strip().title()
    if normalized_status in ["On Leave", "Leave"]:
        normalized_status = "On Leave"
    elif normalized_status not in ["Present", "Absent", "Off Duty"]:
        normalized_status = "Present"

    record = db.query(Attendance).filter(
        Attendance.driver_id == driver_uuid,
        Attendance.date == payload.date,
    ).first()

    now_utc = datetime.now(timezone.utc)

    if record:
        record.status = normalized_status
        action = "updated"
    else:
        record = Attendance(
            attendance_id=uuid.uuid4(),
            driver_id=driver_uuid,
            date=payload.date,
            status=normalized_status,
        )
        db.add(record)
        action = "recorded"

    if normalized_status == "Present":
        active_trip = db.query(Trip).filter(
            Trip.driver_id == driver_uuid,
            func.lower(Trip.status).in_(["scheduled", "assigned", "dispatched", "in transit", "active"])
        ).first()
        driver.status = "On Duty" if active_trip else "Available"
        if not record.check_in_time:
            record.check_in_time = now_utc
        record.check_out_time = None
    elif normalized_status in ["Absent", "On Leave", "Off Duty"]:
        driver.status = normalized_status
        if normalized_status == "Off Duty" and not record.check_out_time:
            record.check_out_time = now_utc

    # Add notification for dashboard alerts
    driver_user = db.query(User).filter(User.user_id == driver.user_id).first() if driver.user_id else None
    driver_name = driver_user.full_name if driver_user else driver.license_number
    db.add(Notification(
        notification_id=uuid.uuid4(),
        type="success" if normalized_status == "Present" else "info",
        title="Attendance Updated",
        message=f"Driver {driver_name} attendance marked as {normalized_status} for {payload.date}."
    ))

    db.commit()
    db.refresh(record)

    log_activity(
        db, current_user, action="Mark Attendance", module="Attendance",
        description=f"Marked attendance for driver {driver_name} ({driver.license_number}) as {normalized_status}",
        entity_type="Attendance", entity_id=str(record.attendance_id)
    )

    return {
        "message": f"Attendance successfully {action}",
        "attendance_id": str(record.attendance_id),
        "driver_id": str(record.driver_id),
        "date": str(record.date),
        "status": record.status,
    }


# ────────────────────────────────────────────────────────────────
# GET /attendance/fleet (Admin, FleetManager, Dispatcher)
# ────────────────────────────────────────────────────────────────
@router.get("/fleet")
def get_fleet_attendance(
    target_date: Optional[date] = Query(None, alias="date"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(require_roles(["Admin", "FleetManager", "Dispatcher"])),
    db: Session = Depends(get_db),
):
    query = db.query(Attendance, Driver, User).join(
        Driver, Attendance.driver_id == Driver.driver_id
    ).outerjoin(
        User, Driver.user_id == User.user_id
    )

    s_date = start_date if isinstance(start_date, (date, str)) else None
    e_date = end_date if isinstance(end_date, (date, str)) else None
    t_date = target_date if isinstance(target_date, (date, str)) else None

    if s_date and e_date:
        query = query.filter(Attendance.date >= s_date, Attendance.date <= e_date)
    elif t_date:
        query = query.filter(Attendance.date == t_date)
    else:
        thirty_days_ago = date.today() - timedelta(days=30)
        query = query.filter(Attendance.date >= thirty_days_ago)

    if status_filter:
        query = query.filter(Attendance.status.ilike(f"%{status_filter}%"))

    records = query.order_by(Attendance.date.desc()).all()

    result = []
    for att, drv, usr in records:
        result.append({
            "attendance_id": str(att.attendance_id),
            "driver_id": str(att.driver_id),
            "driver_name": usr.full_name if usr else "Unknown Driver",
            "driver_email": usr.email if usr else None,
            "license_number": drv.license_number,
            "date": str(att.date),
            "status": att.status,
            "check_in_time": att.check_in_time.isoformat() if att.check_in_time else None,
            "check_out_time": att.check_out_time.isoformat() if att.check_out_time else None,
        })

    return result


# ────────────────────────────────────────────────────────────────
# GET /attendance/my (Driver self-service)
# ────────────────────────────────────────────────────────────────
@router.get("/my")
def get_my_attendance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
    if not driver:
        return {
            "driver_id": None,
            "summary": {"present": 0, "absent": 0, "leave": 0, "total": 0, "rate_pct": 100.0},
            "records": [],
        }

    records = db.query(Attendance).filter(
        Attendance.driver_id == driver.driver_id
    ).order_by(Attendance.date.desc()).all()

    present_count = sum(1 for r in records if r.status == "Present")
    absent_count = sum(1 for r in records if r.status == "Absent")
    leave_count = sum(1 for r in records if r.status in {"Leave", "On Leave"})
    total = len(records)
    rate_pct = round((present_count / total * 100), 1) if total else 100.0

    return {
        "driver_id": str(driver.driver_id),
        "license_number": driver.license_number,
        "summary": {
            "present": present_count,
            "absent": absent_count,
            "leave": leave_count,
            "total": total,
            "rate_pct": rate_pct,
        },
        "records": [
            {
                "attendance_id": str(r.attendance_id),
                "date": str(r.date),
                "status": r.status,
                "check_in_time": r.check_in_time.isoformat() if r.check_in_time else None,
                "check_out_time": r.check_out_time.isoformat() if r.check_out_time else None,
            }
            for r in records
        ],
    }


# ────────────────────────────────────────────────────────────────
# GET /attendance/history/{driver_id} (Admin, FleetManager, Dispatcher, Driver)
# ────────────────────────────────────────────────────────────────
@router.get("/history/{driver_id}")
def get_driver_attendance_history(
    driver_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        driver_uuid = uuid.UUID(driver_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid driver_id format")

    driver = db.query(Driver).filter(Driver.driver_id == driver_uuid).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_str == "Driver" and driver.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Drivers can only view their own attendance history",
        )

    records = db.query(Attendance).filter(
        Attendance.driver_id == driver_uuid
    ).order_by(Attendance.date.desc()).all()

    user = db.query(User).filter(User.user_id == driver.user_id).first() if driver.user_id else None

    present = sum(1 for r in records if r.status == "Present")
    absent = sum(1 for r in records if r.status == "Absent")
    leave = sum(1 for r in records if r.status in {"Leave", "On Leave"})
    total = len(records)

    return {
        "driver_id": driver_id,
        "driver_name": user.full_name if user else "Unknown Driver",
        "license_number": driver.license_number,
        "summary": {
            "present": present,
            "absent": absent,
            "leave": leave,
            "total": total,
            "rate_pct": round((present / total * 100), 1) if total else 100.0,
        },
        "records": [
            {
                "attendance_id": str(r.attendance_id),
                "date": str(r.date),
                "status": r.status,
                "check_in_time": r.check_in_time.isoformat() if r.check_in_time else None,
                "check_out_time": r.check_out_time.isoformat() if r.check_out_time else None,
            }
            for r in records
        ],
    }


# ────────────────────────────────────────────────────────────────
# GET /attendance/stats (Admin, FleetManager, Dispatcher)
# ────────────────────────────────────────────────────────────────
@router.get("/stats")
def get_attendance_stats(
    target_date: Optional[date] = Query(None, alias="date"),
    current_user: User = Depends(require_roles(["Admin", "FleetManager", "Dispatcher"])),
    db: Session = Depends(get_db),
):
    check_date = target_date if isinstance(target_date, (date, str)) else date.today()
    total_drivers = db.query(Driver).count()
    records = db.query(Attendance).filter(Attendance.date == check_date).all()

    present = sum(1 for r in records if r.status == "Present")
    absent = sum(1 for r in records if r.status == "Absent")
    leave = sum(1 for r in records if r.status in {"Leave", "On Leave"})
    off_duty = sum(1 for r in records if r.status == "Off Duty")
    marked = len(records)
    unmarked = max(0, total_drivers - marked)

    return {
        "date": str(check_date),
        "total_drivers": total_drivers,
        "present": present,
        "absent": absent,
        "leave": leave,
        "off_duty": off_duty,
        "unmarked": unmarked,
        "attendance_rate_pct": round((present / total_drivers * 100), 1) if total_drivers else 100.0,
    }
