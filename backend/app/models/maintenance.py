import uuid

from sqlalchemy import Column, ForeignKey, String, Date, Numeric, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class VehicleMaintenance(Base):
    __tablename__ = "vehicle_maintenance"

    maintenance_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    vehicle_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vehicles.vehicle_id"),
        nullable=True
    )

    maintenance_type = Column(
        String(50),
        nullable=True
    )

    service_date = Column(
        Date,
        nullable=True
    )

    next_service_date = Column(
        Date,
        nullable=True
    )

    cost = Column(
        Numeric(10, 2),
        nullable=True
    )

    remarks = Column(
        Text,
        nullable=True
    )

    status = Column(
        String(20),
        nullable=True
    )

    is_resolved = Column(
        Boolean,
        default=False,
        server_default="false",
        nullable=False
    )