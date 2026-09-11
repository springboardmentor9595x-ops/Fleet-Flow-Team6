from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GPSCreate(BaseModel):
    vehicle_id: UUID
    latitude: float
    longitude: float
    speed: float | None = None


class GPSOut(BaseModel):
    tracking_id: UUID
    vehicle_id: UUID
    latitude: float
    longitude: float
    speed: float | None = None
    recorded_time: datetime

    class Config:
        from_attributes = True