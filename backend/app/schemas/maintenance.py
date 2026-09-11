from uuid import UUID
from datetime import date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


# ==========================================================
# MAINTENANCE TYPES
# ==========================================================

MAINTENANCE_TYPES = [
    "Oil Change",
    "Tire Replacement",
    "Engine Service",
    "Brake Service",
    "General Inspection",
]

MAINTENANCE_STATUSES = ["Scheduled", "In Progress", "Completed"]


# ==========================================================
# CREATE
# ==========================================================

class MaintenanceCreate(BaseModel):
    vehicle_id: UUID
    maintenance_type: str
    service_date: date
    next_service_date: Optional[date] = None
    cost: Optional[Decimal] = None
    remarks: Optional[str] = None
    status: str = "Scheduled"
    is_resolved: Optional[bool] = False


# ==========================================================
# UPDATE
# ==========================================================

class MaintenanceUpdate(BaseModel):
    maintenance_type: Optional[str] = None
    service_date: Optional[date] = None
    next_service_date: Optional[date] = None
    cost: Optional[Decimal] = None
    remarks: Optional[str] = None
    status: Optional[str] = None
    is_resolved: Optional[bool] = None


# ==========================================================
# RESPONSE
# ==========================================================

class MaintenanceOut(BaseModel):
    maintenance_id: UUID
    vehicle_id: Optional[UUID]
    maintenance_type: Optional[str]
    service_date: Optional[date]
    next_service_date: Optional[date]
    cost: Optional[Decimal]
    remarks: Optional[str]
    status: Optional[str]
    is_resolved: bool

    class Config:
        from_attributes = True
