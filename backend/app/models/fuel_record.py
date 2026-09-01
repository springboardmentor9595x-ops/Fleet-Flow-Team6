import uuid
from sqlalchemy import Column, Float, DateTime, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base


class FuelRecord(Base):
    """
    FuelRecord model representing vehicle fuel refill entries and cost tracking.
    """
    __tablename__ = "fuel_records"

    fuel_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.vehicle_id", ondelete="CASCADE"), nullable=False)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("drivers.driver_id", ondelete="SET NULL"), nullable=True)
    amount = Column(Float, nullable=False)  # in Liters
    cost = Column(Float, nullable=False)    # Total cost in currency
    mileage = Column(Float, nullable=True, default=0.0)  # Odometer reading / mileage at refill
    refill_date = Column(Date, nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())
