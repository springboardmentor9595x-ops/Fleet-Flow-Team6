import uuid
import enum

from sqlalchemy import Column, String, Integer, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime

from app.database import Base


class VehicleStatus(str, enum.Enum):
    Available = "Available"
    Assigned = "Assigned"
    Maintenance = "Maintenance"
    InTransit = "InTransit"


class FuelType(str, enum.Enum):
    Petrol = "Petrol"
    Diesel = "Diesel"
    Electric = "Electric"
    CNG = "CNG"


class Vehicle(Base):
    __tablename__ = "vehicles"

    vehicle_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    registration_number = Column(String(50), unique=True, nullable=False)

    vehicle_type = Column(String(50), nullable=False)

    brand = Column(String(50))

    model = Column(String(50))

    manufacture_year = Column(Integer)

    fuel_type = Column(Enum(FuelType))

    capacity = Column(Integer)

    assigned_driver = Column(UUID(as_uuid=True), nullable=True)

    status = Column(
        Enum(VehicleStatus),
        default=VehicleStatus.Available
    )

    created_at = Column(DateTime, default=datetime.utcnow)

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )