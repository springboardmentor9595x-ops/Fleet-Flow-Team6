import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from sqlalchemy import or_
from database import get_db

from app.models.notification import Notification
from app.models.user import User, RoleEnum
from app.core.security import get_current_user
from app.services.notification_service import notify_user, notify_roles

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)

@router.get("")
@router.get("/")
def get_user_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns notifications scoped to the logged-in user (or system-wide notifications).
    Newest first.
    """
    notifications = db.query(Notification).filter(
        or_(
            Notification.user_id == current_user.user_id,
            Notification.user_id.is_(None)
        )
    ).order_by(Notification.created_at.desc()).all()

    return [
        {
            "notification_id": str(n.notification_id),
            "user_id": str(n.user_id) if n.user_id else None,
            "title": n.title or "Notification",
            "message": n.message or "",
            "type": n.type or "info",
            "is_read": bool(n.is_read),
            "created_at": n.created_at.isoformat() if n.created_at else None
        }
        for n in notifications
    ]

@router.get("/unread-count")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    count = db.query(Notification).filter(
        or_(
            Notification.user_id == current_user.user_id,
            Notification.user_id.is_(None)
        ),
        Notification.is_read == False
    ).count()

    return {"unread_count": count}

@router.put("/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        n_uuid = uuid.UUID(notification_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid notification_id UUID format")

    notif = db.query(Notification).filter(
        Notification.notification_id == n_uuid,
        or_(
            Notification.user_id == current_user.user_id,
            Notification.user_id.is_(None)
        )
    ).first()

    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    db.commit()
    return {"message": "Notification marked as read", "notification_id": str(n_uuid)}

@router.put("/mark-all-read")
@router.post("/mark-all-read")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notifs = db.query(Notification).filter(
        or_(
            Notification.user_id == current_user.user_id,
            Notification.user_id.is_(None)
        ),
        Notification.is_read == False
    ).all()

    for n in notifs:
        n.is_read = True

    db.commit()
    return {"message": f"{len(notifs)} notification(s) marked as read"}

@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_notification_api(
    data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_user_id = data.get("user_id")
    target_roles = data.get("roles")
    title = data.get("title", "Alert")
    message = data.get("message", "")
    notif_type = data.get("type", "info")

    if target_roles:
        res = notify_roles(db, target_roles, title, message, notif_type)
    else:
        res = [notify_user(db, target_user_id, title, message, notif_type)]

    db.commit()
    return {"message": "Notification created successfully", "count": len(res)}
