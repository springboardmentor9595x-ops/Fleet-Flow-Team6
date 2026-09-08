from typing import Optional
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
from app.models.user import User


def log_activity(
    db: Session,
    user: Optional[User],
    action: str,
    module: str,
    description: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    status: str = "Success"
) -> AuditLog:
    """
    Creates an AuditLog record in the database for tracking user/system actions.
    Ensures sensitive data is never logged.
    """
    user_id = user.user_id if user else None
    user_name = user.full_name if user else "System"
    role = str(user.role.value) if user and hasattr(user.role, 'value') else (str(user.role) if user else "System")

    audit_entry = AuditLog(
        user_id=user_id,
        user_name=user_name,
        role=role,
        action=action,
        module=module,
        description=description,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None,
        status=status
    )
    try:
        db.add(audit_entry)
        db.commit()
        db.refresh(audit_entry)
    except Exception as e:
        db.rollback()
        # Log silently to avoid failing primary action if audit log table issue occurs
        print(f"[Audit Log Error]: Failed to create log entry: {e}")
    return audit_entry
