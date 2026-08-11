from enum import Enum
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, EmailStr, ConfigDict


class UserRole(str, Enum):
    Admin = "Admin"
    FleetManager = "FleetManager"
    Driver = "Driver"
    Dispatcher = "Dispatcher"


class UserSignup(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    phone: str
    role: UserRole


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    user_id: UUID
    full_name: str
    email: EmailStr
    phone: str
    role: UserRole
    is_verified: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenWithUser(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class VerifyRequest(BaseModel):
    email: EmailStr
    code: str


class ResendCodeRequest(BaseModel):
    email: EmailStr


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str


class SendOTPRequest(BaseModel):
    email: EmailStr