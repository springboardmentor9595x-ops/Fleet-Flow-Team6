from uuid import UUID
from datetime import datetime

from pydantic import BaseModel

from app.models.trip import TripStatus


# ==========================================================
# CREATE TRIP
# ==========================================================

class TripCreate(BaseModel):
    shipment_id: UUID
    vehicle_id: UUID
    driver_id: UUID

    start_location: str
    destination: str
    waypoints: list[str] | None = None

    # These values will be calculated by route optimization
    start_time: datetime | None = None
    distance: float | None = None
    duration: float | None = None
    eta: datetime | None = None

    route_type: str | None = "Fastest"

    # New trips are Scheduled by default
    status: TripStatus = TripStatus.Scheduled


# ==========================================================
# UPDATE TRIP
# ==========================================================

class TripUpdate(BaseModel):

    start_location: str | None = None
    destination: str | None = None
    waypoints: list[str] | None = None

    start_time: datetime | None = None
    end_time: datetime | None = None

    distance: float | None = None
    duration: float | None = None

    eta: datetime | None = None

    route_type: str | None = None

    status: TripStatus | None = None


# ==========================================================
# TRIP RESPONSE
# ==========================================================

class TripOut(BaseModel):

    trip_id: UUID

    shipment_id: UUID | None = None
    vehicle_id: UUID | None = None
    driver_id: UUID | None = None

    start_location: str | None = None
    destination: str | None = None
    waypoints: list[str] | None = None

    start_time: datetime | None = None
    end_time: datetime | None = None

    distance: float | None = None
    duration: float | None = None

    eta: datetime | None = None

    route_type: str | None = None

    status: TripStatus = TripStatus.Scheduled

    created_at: datetime | None = None

    geometry: list | None = None
    start_coords: list | None = None
    destination_coords: list | None = None
    route_options: dict | None = None

    class Config:
        from_attributes = True