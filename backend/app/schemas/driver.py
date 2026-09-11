from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from typing import Optional


class DriverVehicleInfo(BaseModel):
    vehicle_id: UUID
    registration_number: str
    vehicle_type: str
    brand: Optional[str] = None
    model: Optional[str] = None
    status: str

    model_config = ConfigDict(from_attributes=True)


class DriverUserInfo(BaseModel):
    user_id: UUID
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DriverBase(BaseModel):
    user_id: UUID | None = None
    license_number: str
    experience_years: int | None = None
    address: str | None = None
    status: str | None = "Available"


class DriverCreate(DriverBase):
    pass


class DriverUpdate(BaseModel):
    user_id: UUID | None = None
    license_number: str | None = None
    experience_years: int | None = None
    address: str | None = None
    status: str | None = None


class DriverOut(DriverBase):
    driver_id: UUID
    created_at: datetime | None = None
    user: Optional[DriverUserInfo] = None
    assigned_vehicle: Optional[DriverVehicleInfo] = None

    model_config = ConfigDict(from_attributes=True)


class VehicleAssignRequest(BaseModel):
    vehicle_id: UUID