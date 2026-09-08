import uuid
from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    user_name = Column(String(100), nullable=True)
    role = Column(String(50), nullable=True)
    action = Column(String(100), nullable=False)
    module = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(String(100), nullable=True)
    status = Column(String(20), nullable=False, default="Success")
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
