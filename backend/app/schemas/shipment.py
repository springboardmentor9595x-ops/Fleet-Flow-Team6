from uuid import UUID
from datetime import datetime
from pydantic import BaseModel
from app.models.shipment import ShipmentStatus


class ShipmentCreate(BaseModel):
    tracking_number: str
    source: str
    destination: str
    customer_name: str
    shipment_weight: float
    vehicle_id: UUID | None = None
    driver_id: UUID | None = None
    status: ShipmentStatus = ShipmentStatus.Created


class ShipmentUpdate(BaseModel):
    tracking_number: str | None = None
    source: str | None = None
    destination: str | None = None
    customer_name: str | None = None
    shipment_weight: float | None = None
    vehicle_id: UUID | None = None
    driver_id: UUID | None = None
    status: ShipmentStatus | None = None


class ShipmentOut(BaseModel):
    shipment_id: UUID
    tracking_number: str
    source: str
    destination: str
    customer_name: str
    shipment_weight: float
    vehicle_id: UUID | None
    driver_id: UUID | None
    status: ShipmentStatus
    created_at: datetime

    class Config:
        from_attributes = True