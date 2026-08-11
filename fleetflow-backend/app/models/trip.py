import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from database import Base


class Trip(Base):
    __tablename__ = "trips"

    trip_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.vehicle_id"), nullable=True)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("drivers.driver_id"), nullable=True)
    shipment_id = Column(UUID(as_uuid=True), ForeignKey("shipments.shipment_id", ondelete="SET NULL"), nullable=True)
    start_location = Column(String(100), nullable=True)
    destination = Column(String(100), nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=True)
    end_time = Column(DateTime(timezone=True), nullable=True)
    distance = Column(Numeric(10, 2), nullable=True)
    status = Column(String(20), nullable=True)
