import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Body, Query
from sqlalchemy.orm import Session
from database import get_db

from app.models.user import User, RoleEnum
from app.models.driver import Driver
from app.models.attendance import Attendance
from app.core.security import get_current_user, require_roles

router = APIRouter(
    prefix="/attendance",
    tags=["Attendance Tracking"]
)

# ---------------------------------------------------------
# Mark Attendance (Admin, FleetManager, or Driver self check-in)
# ---------------------------------------------------------
@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
def mark_attendance(
    data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)

    if role_str == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver:
            raise HTTPException(status_code=404, detail="Driver profile not found.")
        driver_id = driver.driver_id
    else:
        try:
            driver_id = uuid.UUID(str(data.get("driver_id")))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid driver_id UUID format")

    att_date = datetime.date.today()
    if data.get("date"):
        try:
            att_date = datetime.datetime.strptime(str(data["date"]), "%Y-%m-%d").date()
        except ValueError:
            pass

    status_val = data.get("status", "Present")
    if status_val not in ["Present", "Leave", "Absent"]:
        status_val = "Present"

    att = db.query(Attendance).filter(Attendance.driver_id == driver_id, Attendance.date == att_date).first()
    if att:
        att.status = status_val
    else:
        att = Attendance(
            attendance_id=uuid.uuid4(),
            driver_id=driver_id,
            date=att_date,
            status=status_val
        )
        db.add(att)

    db.commit()
    return {
        "message": "Attendance marked successfully",
        "attendance_id": str(att.attendance_id),
        "driver_id": str(driver_id),
        "date": att_date.isoformat(),
        "status": status_val
    }

# ---------------------------------------------------------
# List Driver's Own Attendance History
# ---------------------------------------------------------
@router.get("/driver/{driver_id}")
def get_driver_attendance(
    driver_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    try:
        d_uuid = uuid.UUID(driver_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid driver_id UUID format")

    if role_str == "Driver":
        driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
        if not driver or driver.driver_id != d_uuid:
            raise HTTPException(status_code=403, detail="Access denied: You can only view your own attendance history.")

    records = db.query(Attendance).filter(Attendance.driver_id == d_uuid).order_by(Attendance.date.desc()).all()
    return [
        {
            "attendance_id": str(r.attendance_id),
            "driver_id": str(r.driver_id),
            "date": r.date.isoformat() if hasattr(r.date, "isoformat") else str(r.date),
            "status": r.status
        }
        for r in records
    ]

# ---------------------------------------------------------
# Fleet-wide Attendance (Management View)
# ---------------------------------------------------------
@router.get("/fleet")
def get_fleet_attendance(
    date: str | None = Query(None),
    current_user: User = Depends(require_roles(["Admin", "FleetManager", "Dispatcher"])),
    db: Session = Depends(get_db)
):
    query_date = datetime.date.today()
    if date:
        try:
            query_date = datetime.datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            pass

    drivers = db.query(Driver, User).join(User, Driver.user_id == User.user_id).all()
    results = []

    for d, u in drivers:
        att = db.query(Attendance).filter(Attendance.driver_id == d.driver_id, Attendance.date == query_date).first()
        results.append({
            "driver_id": str(d.driver_id),
            "driver_name": u.full_name,
            "license_number": d.license_number,
            "phone": u.phone or "N/A",
            "date": query_date.isoformat(),
            "status": att.status if att else "Not Marked"
        })

    return results
