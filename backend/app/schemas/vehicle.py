from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

from app.models.vehicle import VehicleStatus, FuelType


class VehicleCreate(BaseModel):
    registration_number: str
    vehicle_type: str
    brand: str
    model: str | None = None
    manufacture_year: int | None = None
    fuel_type: FuelType
    capacity: int
    assigned_driver: UUID | None = None
    status: VehicleStatus = VehicleStatus.Available


class VehicleUpdate(BaseModel):
    registration_number: str | None = None
    vehicle_type: str | None = None
    brand: str | None = None
    model: str | None = None
    manufacture_year: int | None = None
    fuel_type: FuelType | None = None
    capacity: int | None = None
    assigned_driver: UUID | None = None
    status: VehicleStatus | None = None


class VehicleOut(BaseModel):
    vehicle_id: UUID
    registration_number: str
    vehicle_type: str
    brand: str
    model: str | None = None
    manufacture_year: int | None = None
    fuel_type: FuelType
    capacity: int
    assigned_driver: UUID | None = None
    status: VehicleStatus
    created_at: datetime

    class Config:
        from_attributes = True