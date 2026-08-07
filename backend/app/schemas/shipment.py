from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class ShipmentBase(BaseModel):
    source: str
    destination: str
    customer_name: str
    shipment_weight: float
    vehicle_id: UUID | None = None
    driver_id: UUID | None = None
    status: str = "Created"


class ShipmentCreate(ShipmentBase):
    pass


class ShipmentUpdate(BaseModel):
    source: str | None = None
    destination: str | None = None
    customer_name: str | None = None
    shipment_weight: float | None = None
    vehicle_id: UUID | None = None
    driver_id: UUID | None = None
    status: str | None = None


class ShipmentResponse(ShipmentBase):
    shipment_id: UUID
    tracking_number: str
    created_at: datetime
    updated_at: datetime
    vehicle_reg: str | None = None
    driver_name: str | None = None

    model_config = ConfigDict(from_attributes=True)
