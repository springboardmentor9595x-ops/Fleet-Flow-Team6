from uuid import UUID
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User, RoleEnum
from app.models.driver import Driver
from app.models.attendance import Attendance
from app.schemas.attendance import AttendanceCreate, AttendanceOut

router = APIRouter(
    prefix="/attendance",
    tags=["Attendance"],
)


@router.post("/", response_model=AttendanceOut)
def log_attendance(
    data: AttendanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Log attendance for a driver.
    Admin & FleetManager can log for any driver.
    Driver cannot mark their own attendance (per spec — must be done by manager).
    Dispatcher cannot log attendance.
    """
    if current_user.role == RoleEnum.Dispatcher:
        raise HTTPException(status_code=403, detail="Dispatchers cannot mark attendance")

    if current_user.role == RoleEnum.Driver:
        raise HTTPException(
            status_code=403,
            detail="Drivers cannot mark their own attendance — contact your Fleet Manager"
        )

    # Check for existing record on this date
    existing = (
        db.query(Attendance)
        .filter(
            Attendance.driver_id == data.driver_id,
            Attendance.attendance_date == data.attendance_date,
        )
        .first()
    )
    if existing:
        existing.status = data.status
        db.commit()
        db.refresh(existing)
        return existing

    record = Attendance(
        driver_id=data.driver_id,
        attendance_date=data.attendance_date,
        status=data.status,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/", response_model=list[AttendanceOut])
def list_attendance(
    driver_id: Optional[UUID] = None,
    attendance_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Admin & FleetManager: view all attendance records.
    Dispatcher: read-only view of all (useful for scheduling).
    Driver: view only their own records.

    Query params:
        driver_id:       filter by driver
        attendance_date: filter to a specific date (or start of range)
        end_date:        if provided along with attendance_date, returns date range
    """
    q = db.query(Attendance)

    if current_user.role == RoleEnum.Driver:
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver:
            return []
        q = q.filter(Attendance.driver_id == driver.driver_id)
    else:
        # Admin, FleetManager, Dispatcher — can filter by driver_id
        if driver_id:
            q = q.filter(Attendance.driver_id == driver_id)

    # Date filtering
    if attendance_date and end_date:
        q = q.filter(
            Attendance.attendance_date >= attendance_date,
            Attendance.attendance_date <= end_date,
        )
    elif attendance_date:
        q = q.filter(Attendance.attendance_date == attendance_date)

    return q.order_by(Attendance.attendance_date.desc()).all()
