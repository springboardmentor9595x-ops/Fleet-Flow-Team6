import uuid

from sqlalchemy import Column, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class GPSTracking(Base):

    __tablename__ = "gps_tracking"

    tracking_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    vehicle_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vehicles.vehicle_id"),
        nullable=False
    )

    latitude = Column(
        Float,
        nullable=False
    )

    longitude = Column(
        Float,
        nullable=False
    )

    speed = Column(
        Float,
        nullable=True
    )

    recorded_time = Column(
        DateTime,
        server_default=func.now(),
        nullable=False
    )