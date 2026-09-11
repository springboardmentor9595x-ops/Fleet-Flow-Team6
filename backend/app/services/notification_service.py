"""
notification_service.py
-----------------------
Central helper for creating Notification records.
Used by routers and Celery tasks to decouple notification logic
from business logic.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.notification import Notification


def create_notification(
    db: Session,
    title: str,
    message: str,
    type: str = "info",
    user_id: Optional[UUID] = None,
) -> Notification:
    """
    Insert a single notification record.

    Args:
        db:      SQLAlchemy session (caller is responsible for commit).
        title:   Short headline shown in the notification bell.
        message: Detailed body text.
        type:    'info' | 'warning' | 'error' | 'success'
        user_id: Target user; None = broadcast (visible to Admin/FleetManager
                 and any role that queries unscoped).
    """
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=type,
        is_read=False,
        created_at=datetime.utcnow(),
    )
    db.add(notif)
    return notif


def create_broadcast_notification(
    db: Session,
    title: str,
    message: str,
    type: str = "info",
) -> Notification:
    """Shortcut for fleet-wide (user_id=None) broadcast notifications."""
    return create_notification(db, title=title, message=message, type=type, user_id=None)
