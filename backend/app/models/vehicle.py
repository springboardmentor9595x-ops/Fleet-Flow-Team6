import uuid
from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    vehicle_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    registration_number = Column(String(20), nullable=False)
    vehicle_type = Column(String(50), nullable=True)
    brand = Column(String(50), nullable=True)
    model = Column(String(50), nullable=True)
    manufacture_year = Column(Integer, nullable=True)
    fuel_type = Column(String(20), nullable=True)
    capacity = Column(Integer, nullable=True)
    assigned_driver = Column(UUID(as_uuid=True), nullable=True)
    status = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
