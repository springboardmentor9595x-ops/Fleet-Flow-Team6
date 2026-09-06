from enum import Enum
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, EmailStr, ConfigDict, field_validator
import re


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

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        clean_phone = v.strip()
        digits_only = re.sub(r"^\+", "", clean_phone)
        if not digits_only.isdigit():
            raise ValueError("Phone number must contain digits only.")
        if len(digits_only) < 10 or len(digits_only) > 15:
            raise ValueError("Please enter a valid 10 to 15 digit phone number.")
        return clean_phone


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    user_id: UUID
    full_name: str
    email: EmailStr
    phone: str
    role: UserRole
    profile_picture: str | None = None
    is_verified: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserProfileUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    full_name: str | None = None
    phone: str | None = None
    profile_picture: str | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is None:
            return v
        clean_phone = v.strip()
        if not clean_phone:
            return clean_phone
        digits_only = re.sub(r"^\+", "", clean_phone)
        if not digits_only.isdigit():
            raise ValueError("Phone number must contain digits only.")
        if len(digits_only) < 10 or len(digits_only) > 15:
            raise ValueError("Please enter a valid 10 to 15 digit phone number.")
        return clean_phone


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


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