import enum
import uuid
from sqlalchemy import Column, String, DateTime, Enum, Boolean, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from database import Base


class RoleEnum(str, enum.Enum):
    Admin = "Admin"
    FleetManager = "FleetManager"
    Dispatcher = "Dispatcher"
    Driver = "Driver"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", "role", name="uq_user_email_role"),
    )

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), nullable=False)
    password = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    role = Column(Enum(RoleEnum, name="role_enum"), nullable=False, default=RoleEnum.Driver)
    worker_type = Column(String(50), nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_code = Column(String(500), nullable=True)
    otp_code = Column(String(6), nullable=True)
    otp_expires_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )