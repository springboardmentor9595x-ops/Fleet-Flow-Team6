import uuid
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base


class Driver(Base):
    """
    Driver model linking driver metadata to an underlying User account with role=Driver.
    """
    __tablename__ = "drivers"

    driver_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=True)
    license_number = Column(String(50), nullable=False)
    experience_years = Column(Integer, nullable=True, default=0)
    address = Column(Text, nullable=True)
    status = Column(String(20), nullable=True, default="Active")  # Active, Assigned, Unavailable, Inactive
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", backref="driver")
