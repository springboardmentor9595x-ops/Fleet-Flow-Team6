import uuid

from sqlalchemy import Column, ForeignKey, String, Date
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Attendance(Base):
    __tablename__ = "attendance"

    attendance_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    driver_id = Column(
        UUID(as_uuid=True),
        ForeignKey("drivers.driver_id"),
        nullable=True
    )

    attendance_date = Column(
        Date,
        nullable=True
    )

    status = Column(
        String(20),
        nullable=True
    )