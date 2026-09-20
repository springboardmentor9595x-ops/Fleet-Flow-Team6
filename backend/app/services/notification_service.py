import uuid
from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.models.user import User, RoleEnum

def notify_user(db: Session, user_id: uuid.UUID | str | None, title: str, message: str, notif_type: str = "info"):
    """
    Creates a Notification record for a single user (or system-wide if user_id is None).
    """
    u_uuid = None
    if user_id:
        try:
            u_uuid = uuid.UUID(str(user_id))
        except ValueError:
            pass

    notif = Notification(
        notification_id=uuid.uuid4(),
        user_id=u_uuid,
        title=title,
        message=message,
        type=notif_type,
        is_read=False
    )
    db.add(notif)
    return notif

def notify_roles(db: Session, roles: list[str], title: str, message: str, notif_type: str = "info"):
    """
    Creates a Notification record for all users matching the specified roles.
    """
    role_enums = []
    for r in roles:
        r_upper = r.upper()
        if r_upper == "ADMIN":
            role_enums.append(RoleEnum.Admin)
        elif r_upper in ["FLEETMANAGER", "FLEET_MANAGER"]:
            role_enums.append(RoleEnum.FleetManager)
        elif r_upper == "DISPATCHER":
            role_enums.append(RoleEnum.Dispatcher)
        elif r_upper == "DRIVER":
            role_enums.append(RoleEnum.Driver)

    target_users = db.query(User).filter(User.role.in_(role_enums)).all() if role_enums else []
    created_notifs = []
    
    for u in target_users:
        n = Notification(
            notification_id=uuid.uuid4(),
            user_id=u.user_id,
            title=title,
            message=message,
            type=notif_type,
            is_read=False
        )
        db.add(n)
        created_notifs.append(n)
        
    if not target_users:
        # Fallback to system notification
        n = Notification(
            notification_id=uuid.uuid4(),
            user_id=None,
            title=title,
            message=message,
            type=notif_type,
            is_read=False
        )
        db.add(n)
        created_notifs.append(n)

    return created_notifs
