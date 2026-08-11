import uuid
from sqlalchemy import Column, String, Date, Numeric, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from database import Base


class VehicleMaintenance(Base):
    __tablename__ = "vehicle_maintenance"

    maintenance_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.vehicle_id", ondelete="CASCADE"), nullable=False)
    maintenance_type = Column(String(100), nullable=False)
    service_date = Column(Date, nullable=False)
    next_service_date = Column(Date, nullable=False)
    cost = Column(Numeric(10, 2), nullable=True)
    remarks = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="pending")
