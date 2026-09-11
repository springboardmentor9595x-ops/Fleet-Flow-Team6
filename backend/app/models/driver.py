import uuid

from sqlalchemy import Column, ForeignKey, String, Integer, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Driver(Base):
    __tablename__ = "drivers"

    driver_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id"),
        unique=True
    )

    license_number = Column(
        String(50),
        unique=True,
        nullable=False
    )

    experience_years = Column(
        Integer,
        nullable=True
    )

    address = Column(
        Text,
        nullable=True
    )

    status = Column(
        String(20),
        nullable=True
    )

    created_at = Column(
        DateTime,
        nullable=True
    )