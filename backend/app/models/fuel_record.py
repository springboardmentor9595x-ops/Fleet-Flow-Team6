import uuid

from sqlalchemy import Column, ForeignKey, Numeric, Date
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class FuelRecord(Base):
    __tablename__ = "fuel_records"

    fuel_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    vehicle_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vehicles.vehicle_id"),
        nullable=True
    )

    fuel_amount = Column(
        Numeric(10, 2),
        nullable=True
    )

    fuel_cost = Column(
        Numeric(10, 2),
        nullable=True
    )

    mileage = Column(
        Numeric(10, 2),
        nullable=True
    )

    refill_date = Column(
        Date,
        nullable=True
    )