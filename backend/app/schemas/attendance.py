from uuid import UUID
from datetime import date
from pydantic import BaseModel


class AttendanceCreate(BaseModel):
    driver_id: UUID
    attendance_date: date
    status: str = "Present"  # Present, Absent, On Leave, Late


class AttendanceOut(BaseModel):
    attendance_id: UUID
    driver_id: UUID
    attendance_date: date | None = None
    status: str | None = "Present"

    class Config:
        from_attributes = True
