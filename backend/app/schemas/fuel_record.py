from uuid import UUID
from datetime import date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


# ==========================================================
# CREATE
# ==========================================================

class FuelRecordCreate(BaseModel):
    vehicle_id: UUID
    fuel_amount: Decimal       # litres
    fuel_cost: Decimal         # total cost
    mileage: Optional[Decimal] = None   # odometer reading at refill
    refill_date: date


# ==========================================================
# RESPONSE
# ==========================================================

class FuelRecordOut(BaseModel):
    fuel_id: UUID
    vehicle_id: Optional[UUID]
    fuel_amount: Optional[Decimal]
    fuel_cost: Optional[Decimal]
    mileage: Optional[Decimal]
    refill_date: Optional[date]

    class Config:
        from_attributes = True
