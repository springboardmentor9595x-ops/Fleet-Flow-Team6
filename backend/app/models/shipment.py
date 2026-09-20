import uuid
from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base


class Shipment(Base):
    __tablename__ = "shipments"

    shipment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tracking_number = Column(String(50), unique=True, nullable=False, index=True)
    source = Column(String(100), nullable=False)
    destination = Column(String(100), nullable=False)
    customer_name = Column(String(100), nullable=False)
    shipment_weight = Column(Float, nullable=False)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.vehicle_id", ondelete="SET NULL"), nullable=True)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("drivers.driver_id", ondelete="SET NULL"), nullable=True)
    status = Column(String(30), nullable=False, default="Created")
    expected_delivery_time = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
