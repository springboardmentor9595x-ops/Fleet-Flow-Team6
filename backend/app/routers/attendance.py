import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Body, Query
from sqlalchemy.orm import Session
from database import get_db

from app.models.user import User, RoleEnum
from app.models.driver import Driver
from app.models.attendance import Attendance, LeaveRequest
from app.models.notification import Notification
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
    if status_val not in ["Present", "Leave", "Absent", "On Leave"]:
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


# ---------------------------------------------------------
# Leave Request Endpoints
# ---------------------------------------------------------

@router.post("/leave-request", status_code=status.HTTP_201_CREATED)
def submit_leave_request(
    data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found.")

    start_str = data.get("start_date")
    end_str = data.get("end_date")
    reason = data.get("reason", "").strip()

    if not start_str or not end_str:
        raise HTTPException(status_code=400, detail="Start date and end date are required.")

    try:
        start_date = datetime.datetime.strptime(str(start_str), "%Y-%m-%d").date()
        end_date = datetime.datetime.strptime(str(end_str), "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    if start_date > end_date:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date.")

    req = LeaveRequest(
        leave_id=uuid.uuid4(),
        driver_id=driver.driver_id,
        user_id=current_user.user_id,
        start_date=start_date,
        end_date=end_date,
        reason=reason,
        status="Pending"
    )
    db.add(req)

    # Send Notification to Admins & Fleet Managers
    admins = db.query(User).filter(User.role.in_([RoleEnum.Admin, RoleEnum.FleetManager])).all()
    for admin in admins:
        notif = Notification(
            notification_id=uuid.uuid4(),
            user_id=admin.user_id,
            title="New Driver Leave Request",
            message=f"Driver {current_user.full_name} has requested leave from {start_date} to {end_date}.",
            type="warning"
        )
        db.add(notif)

    db.commit()
    db.refresh(req)

    return {
        "message": "Leave request submitted successfully",
        "leave_id": str(req.leave_id),
        "status": req.status,
        "start_date": req.start_date.isoformat(),
        "end_date": req.end_date.isoformat(),
        "reason": req.reason
    }


@router.get("/my-leave-requests")
def get_my_leave_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    driver = db.query(Driver).filter(Driver.user_id == current_user.user_id).first()
    if not driver:
        return []

    requests = db.query(LeaveRequest).filter(LeaveRequest.driver_id == driver.driver_id).order_by(LeaveRequest.created_at.desc()).all()
    return [
        {
            "leave_id": str(r.leave_id),
            "start_date": r.start_date.isoformat(),
            "end_date": r.end_date.isoformat(),
            "reason": r.reason,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None
        }
        for r in requests
    ]


@router.get("/leave-requests")
def get_all_leave_requests(
    status_filter: str | None = Query(None),
    current_user: User = Depends(require_roles(["Admin", "FleetManager", "Dispatcher"])),
    db: Session = Depends(get_db)
):
    query = db.query(LeaveRequest, Driver, User).join(Driver, LeaveRequest.driver_id == Driver.driver_id).join(User, Driver.user_id == User.user_id)
    if status_filter:
        query = query.filter(LeaveRequest.status == status_filter)

    results = query.order_by(LeaveRequest.created_at.desc()).all()
    return [
        {
            "leave_id": str(r.leave_id),
            "driver_id": str(d.driver_id),
            "driver_name": u.full_name,
            "license_number": d.license_number,
            "email": u.email,
            "start_date": r.start_date.isoformat(),
            "end_date": r.end_date.isoformat(),
            "reason": r.reason,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None
        }
        for r, d, u in results
    ]


@router.put("/leave-requests/{leave_id}/approve")
def approve_leave_request(
    leave_id: str,
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db)
):
    try:
        l_uuid = uuid.UUID(leave_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid leave_id format")

    req = db.query(LeaveRequest).filter(LeaveRequest.leave_id == l_uuid).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found.")

    req.status = "Approved"
    req.reviewed_by = current_user.user_id
    req.reviewed_at = datetime.datetime.now(datetime.timezone.utc)

    # Populate Attendance entries as "On Leave" for dates in range
    curr_date = req.start_date
    while curr_date <= req.end_date:
        att = db.query(Attendance).filter(Attendance.driver_id == req.driver_id, Attendance.date == curr_date).first()
        if att:
            att.status = "Leave"
        else:
            att = Attendance(
                attendance_id=uuid.uuid4(),
                driver_id=req.driver_id,
                date=curr_date,
                status="Leave"
            )
            db.add(att)
        curr_date += datetime.timedelta(days=1)

    # Send Notification to Driver
    notif = Notification(
        notification_id=uuid.uuid4(),
        user_id=req.user_id,
        title="Leave Request Approved",
        message=f"Your leave request from {req.start_date} to {req.end_date} has been APPROVED.",
        type="success"
    )
    db.add(notif)

    db.commit()
    return {"message": "Leave request approved successfully", "leave_id": str(req.leave_id), "status": "Approved"}


@router.put("/leave-requests/{leave_id}/reject")
def reject_leave_request(
    leave_id: str,
    current_user: User = Depends(require_roles(["Admin", "FleetManager"])),
    db: Session = Depends(get_db)
):
    try:
        l_uuid = uuid.UUID(leave_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid leave_id format")

    req = db.query(LeaveRequest).filter(LeaveRequest.leave_id == l_uuid).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found.")

    req.status = "Rejected"
    req.reviewed_by = current_user.user_id
    req.reviewed_at = datetime.datetime.now(datetime.timezone.utc)

    # Send Notification to Driver
    notif = Notification(
        notification_id=uuid.uuid4(),
        user_id=req.user_id,
        title="Leave Request Rejected",
        message=f"Your leave request from {req.start_date} to {req.end_date} was REJECTED.",
        type="error"
    )
    db.add(notif)

    db.commit()
    return {"message": "Leave request rejected successfully", "leave_id": str(req.leave_id), "status": "Rejected"}
