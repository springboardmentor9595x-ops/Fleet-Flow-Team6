import uuid
import enum
from datetime import datetime
from sqlalchemy.orm import relationship
from sqlalchemy import (
    Column,
    String,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    JSON,
)
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base



class TripStatus(str, enum.Enum):
    Scheduled = "Scheduled"
    InTransit = "In Transit"
    Completed = "Completed"
    Cancelled = "Cancelled"


class Trip(Base):
    __tablename__ = "trips"

    trip_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    shipment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("shipments.shipment_id"),
        nullable=False,
    )

    vehicle_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vehicles.vehicle_id"),
        nullable=False,
    )

    driver_id = Column(
        UUID(as_uuid=True),
        ForeignKey("drivers.driver_id"),
        nullable=False,
    )

    start_location = Column(String(200))
    destination = Column(String(200))
    waypoints = Column(JSON, nullable=True)

    start_time = Column(DateTime)
    end_time = Column(DateTime)

    distance = Column(Float)
    duration = Column(Float)
    eta = Column(DateTime)
    route_type = Column(String(50))

    status = Column(
        Enum(TripStatus),
        default=TripStatus.Scheduled,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )

    shipment = relationship("Shipment", back_populates="trips")
    vehicle = relationship("Vehicle")
    driver = relationship("Driver")