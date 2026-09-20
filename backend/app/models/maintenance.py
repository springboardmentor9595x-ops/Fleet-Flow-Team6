import uuid
from sqlalchemy import Column, String, Date, Numeric, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base


class VehicleMaintenance(Base):
    """
    VehicleMaintenance model representing vehicle servicing, inspections, and repair logs.
    """
    __tablename__ = "vehicle_maintenance"

    maintenance_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.vehicle_id", ondelete="CASCADE"), nullable=False)
    maintenance_type = Column(String(100), nullable=False)  # Oil Change, Tire Replacement, Engine Service, Brake Service, General Inspection
    service_date = Column(Date, nullable=False)
    next_service_date = Column(Date, nullable=False)
    cost = Column(Numeric(10, 2), nullable=True, default=0.0)
    remarks = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="Scheduled")  # Scheduled, In Service, Completed, Resolved, Cancelled
    resolution_status = Column(String(20), nullable=False, default="Unresolved")  # Unresolved, Resolved
    created_at = Column(DateTime(timezone=True), server_default=func.now())
