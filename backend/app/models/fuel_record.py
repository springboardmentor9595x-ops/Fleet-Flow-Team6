import uuid
from sqlalchemy import Column, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base


class FuelRecord(Base):
    __tablename__ = "fuel_records"

    fuel_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.vehicle_id", ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False)  # in liters
    cost = Column(Float, nullable=False)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())
