import uuid
import enum
from sqlalchemy import Column, String, DateTime, Enum, Boolean
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from app.database import Base


class RoleEnum(str, enum.Enum):
    Admin = "Admin"
    FleetManager = "FleetManager"
    Driver = "Driver"
    Dispatcher = "Dispatcher"


class User(Base):
    __tablename__ = "users"


    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    phone = Column(String(15))
    role = Column(Enum(RoleEnum), nullable=False, default=RoleEnum.Driver)
    email_verified = Column(Boolean, default=False, nullable=False)
    is_email_verified = Column(Boolean, default=False, nullable=False)
    verification_otp = Column(String(255), nullable=True)
    verification_otp_expires_at = Column(DateTime, nullable=True)
    verification_token = Column(String(255), nullable=True)
    verification_token_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
