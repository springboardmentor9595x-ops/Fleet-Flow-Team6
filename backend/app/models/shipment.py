import uuid
import enum
from datetime import datetime

from sqlalchemy import Column, String, DateTime, Enum, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class ShipmentStatus(str, enum.Enum):
    Created = "Created"
    Assigned = "Assigned"
    InTransit = "In Transit"
    Delayed = "Delayed"
    Delivered = "Delivered"
    Cancelled = "Cancelled"


from sqlalchemy.orm import relationship

class Shipment(Base):
    __tablename__ = "shipments"

    shipment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    tracking_number = Column(String(50), unique=True, nullable=False)

    source = Column(String(200), nullable=False)

    destination = Column(String(200), nullable=False)

    customer_name = Column(String(100), nullable=False)

    shipment_weight = Column(Float, nullable=False)

    vehicle_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vehicles.vehicle_id"),
        nullable=True,
    )

    driver_id = Column(
        UUID(as_uuid=True),
        ForeignKey("drivers.driver_id"),
        nullable=True,
    )

    status = Column(
        Enum(ShipmentStatus),
        default=ShipmentStatus.Created,
        nullable=False,
    )

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    vehicle = relationship("Vehicle")
    driver = relationship("Driver")
    trips = relationship("Trip", back_populates="shipment", cascade="all, delete-orphan")