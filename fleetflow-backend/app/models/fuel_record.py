import uuid
from sqlalchemy import Column, Float, DateTime, ForeignKey, String, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base


class FuelRecord(Base):
    __tablename__ = "fuel_records"

    fuel_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.vehicle_id", ondelete="CASCADE"), nullable=False)
    fuel_amount = Column(Float, nullable=False)  # in liters
    fuel_cost = Column(Float, nullable=False)
    mileage = Column(Float, nullable=True)
    refill_date = Column(Date, nullable=True)
    notes = Column(String(255), nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())
