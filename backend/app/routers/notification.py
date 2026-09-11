from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, RoleEnum
from app.models.notification import Notification
from app.schemas.notification import NotificationOut, NotificationCreate

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)


@router.get("/", response_model=list[NotificationOut])
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Admin and FleetManager can view all notifications.
    Drivers and Dispatchers view notifications assigned to them or broadcast notifications.
    """
    if current_user.role in [RoleEnum.Admin, RoleEnum.FleetManager]:
        notifications = (
            db.query(Notification)
            .order_by(Notification.created_at.desc())
            .all()
        )
    else:
        notifications = (
            db.query(Notification)
            .filter(
                (Notification.user_id == current_user.user_id) |
                (Notification.user_id == None)
            )
            .order_by(Notification.created_at.desc())
            .all()
        )
    return notifications


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role in [RoleEnum.Admin, RoleEnum.FleetManager]:
        count = db.query(Notification).filter(Notification.is_read == False).count()
    else:
        count = (
            db.query(Notification)
            .filter(
                ((Notification.user_id == current_user.user_id) | (Notification.user_id == None)),
                Notification.is_read == False,
            )
            .count()
        )
    return {"unread_count": count}


@router.put("/{notification_id}/read", response_model=NotificationOut)
def mark_as_read(
    notification_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = (
        db.query(Notification)
        .filter(Notification.notification_id == notification_id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


@router.put("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role in [RoleEnum.Admin, RoleEnum.FleetManager]:
        db.query(Notification).filter(Notification.is_read == False).update({"is_read": True})
    else:
        db.query(Notification).filter(
            ((Notification.user_id == current_user.user_id) | (Notification.user_id == None)),
            Notification.is_read == False,
        ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}
