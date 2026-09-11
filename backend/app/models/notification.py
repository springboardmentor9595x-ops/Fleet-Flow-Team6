import uuid

from sqlalchemy import Column, ForeignKey, String, Text, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    notification_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id"),
        nullable=True
    )

    title = Column(
        String(100),
        nullable=True
    )

    message = Column(
        Text,
        nullable=True
    )

    type = Column(
        String(30),
        nullable=True
    )

    is_read = Column(
        Boolean,
        nullable=True
    )

    created_at = Column(
        DateTime,
        nullable=True
    )